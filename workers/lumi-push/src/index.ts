import webpush from 'web-push'

export interface Env {
  DB: D1Database
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

const DEFAULT_TEST_BODY =
  '测试系统通知：若你已切到其他 App 或桌面，应在通知栏看到本条消息。'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type PushSubscriptionRow = {
  client_id: string
  endpoint: string
  p256dh: string
  auth: string
  enabled: number
}

type PushSubscriptionPayload = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

function configureWebPush(env: Env): string | null {
  const pub = env.VAPID_PUBLIC_KEY?.trim()
  const priv = env.VAPID_PRIVATE_KEY?.trim()
  const subject = env.VAPID_SUBJECT?.trim() || 'mailto:lumi@example.com'
  if (!pub || !priv) return 'VAPID 密钥未配置（需设置 VAPID_PUBLIC_KEY 与 VAPID_PRIVATE_KEY）'
  webpush.setVapidDetails(subject, pub, priv)
  return null
}

async function sendPushToRow(
  env: Env,
  row: PushSubscriptionRow,
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  const err = configureWebPush(env)
  if (err) throw new Error(err)
  const subscription: PushSubscriptionPayload = {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  }
  await webpush.sendNotification(
    subscription as webpush.PushSubscription,
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }),
    { TTL: 86400 },
  )
}

async function upsertSubscription(
  db: D1Database,
  clientId: string,
  sub: PushSubscriptionPayload,
  enabled: boolean,
): Promise<void> {
  const now = Date.now()
  await db
    .prepare(
      `INSERT INTO push_subscriptions (client_id, endpoint, p256dh, auth, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(client_id) DO UPDATE SET
         endpoint = excluded.endpoint,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         enabled = excluded.enabled,
         updated_at = excluded.updated_at`,
    )
    .bind(clientId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, enabled ? 1 : 0, now, now)
    .run()
}

async function getSubscription(db: D1Database, clientId: string): Promise<PushSubscriptionRow | null> {
  return db
    .prepare('SELECT client_id, endpoint, p256dh, auth, enabled FROM push_subscriptions WHERE client_id = ?')
    .bind(clientId)
    .first<PushSubscriptionRow>()
}

async function isFallbackJobCancelled(db: D1Database, jobId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT cancelled, sent FROM push_fallback_jobs WHERE job_id = ?')
    .bind(jobId)
    .first<{ cancelled: number; sent: number }>()
  if (!row) return true
  return row.cancelled === 1 || row.sent === 1
}

async function runDeferredFallbackJob(
  env: Env,
  params: { jobId: string; clientId: string; title: string; body: string; delayMs: number },
): Promise<void> {
  const delayMs = Math.max(1000, Math.min(60_000, Math.floor(params.delayMs)))
  await sleep(delayMs)
  if (await isFallbackJobCancelled(env.DB, params.jobId)) return

  const row = await getSubscription(env.DB, params.clientId)
  if (!row || !row.enabled) {
    await env.DB.prepare('UPDATE push_fallback_jobs SET cancelled = 1 WHERE job_id = ?')
      .bind(params.jobId)
      .run()
    return
  }

  try {
    await sendPushToRow(env, row, {
      title: params.title,
      body: params.body,
      data: { type: 'test-fallback', jobId: params.jobId },
    })
    await env.DB.prepare('UPDATE push_fallback_jobs SET sent = 1 WHERE job_id = ?').bind(params.jobId).run()
  } catch {
    /* 订阅失效等：静默结束 */
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    try {
      if (request.method === 'GET' && path === '/health') {
        const vapidReady = !!(env.VAPID_PUBLIC_KEY?.trim() && env.VAPID_PRIVATE_KEY?.trim())
        return json({ ok: true, vapidReady })
      }

      if (request.method === 'GET' && path === '/vapid-public-key') {
        const pub = env.VAPID_PUBLIC_KEY?.trim()
        if (!pub) return json({ ok: false, message: 'VAPID 公钥未配置' }, 503)
        return json({ ok: true, publicKey: pub })
      }

      if (request.method === 'POST' && path === '/subscribe') {
        const body = (await request.json()) as {
          clientId?: string
          subscription?: PushSubscriptionPayload
          enabled?: boolean
        }
        const clientId = body.clientId?.trim()
        const sub = body.subscription
        if (!clientId || !sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
          return json({ ok: false, message: '缺少 clientId 或 subscription' }, 400)
        }
        await upsertSubscription(env.DB, clientId, sub, body.enabled !== false)
        return json({ ok: true })
      }

      if (request.method === 'POST' && path === '/unsubscribe') {
        const body = (await request.json()) as { clientId?: string }
        const clientId = body.clientId?.trim()
        if (!clientId) return json({ ok: false, message: '缺少 clientId' }, 400)
        await env.DB.prepare('UPDATE push_subscriptions SET enabled = 0, updated_at = ? WHERE client_id = ?')
          .bind(Date.now(), clientId)
          .run()
        return json({ ok: true })
      }

      /** 登记延迟兜底 Push：本地成功后会 /test/cancel */
      if (request.method === 'POST' && path === '/test/start') {
        const body = (await request.json()) as {
          jobId?: string
          clientId?: string
          delayMs?: number
          title?: string
          body?: string
        }
        const jobId = body.jobId?.trim()
        const clientId = body.clientId?.trim()
        if (!jobId || !clientId) return json({ ok: false, message: '缺少 jobId 或 clientId' }, 400)

        const row = await getSubscription(env.DB, clientId)
        if (!row || !row.enabled) {
          return json({ ok: false, message: '未找到有效推送订阅，请先开启后台推送并完成 Web Push 注册' }, 404)
        }

        const delayMs = Math.max(1000, Math.min(60_000, Math.floor(body.delayMs ?? 8000)))
        const title = body.title?.trim() || 'Lumi Phone'
        const text = body.body?.trim() || DEFAULT_TEST_BODY
        const now = Date.now()

        await env.DB.prepare(
          `INSERT INTO push_fallback_jobs (job_id, client_id, fire_at, title, body, cancelled, sent, created_at)
           VALUES (?, ?, ?, ?, ?, 0, 0, ?)
           ON CONFLICT(job_id) DO UPDATE SET
             client_id = excluded.client_id,
             fire_at = excluded.fire_at,
             title = excluded.title,
             body = excluded.body,
             cancelled = 0,
             sent = 0,
             created_at = excluded.created_at`,
        )
          .bind(jobId, clientId, now + delayMs, title, text, now)
          .run()

        ctx.waitUntil(
          runDeferredFallbackJob(env, { jobId, clientId, title, body: text, delayMs }),
        )

        return json({ ok: true, jobId, delayMs })
      }

      if (request.method === 'POST' && path === '/test/cancel') {
        const body = (await request.json()) as { jobId?: string }
        const jobId = body.jobId?.trim()
        if (!jobId) return json({ ok: false, message: '缺少 jobId' }, 400)
        await env.DB.prepare('UPDATE push_fallback_jobs SET cancelled = 1 WHERE job_id = ? AND sent = 0')
          .bind(jobId)
          .run()
        return json({ ok: true })
      }

      /** 兼容旧客户端：立即云端 Push */
      if (request.method === 'POST' && path === '/test') {
        const body = (await request.json()) as {
          clientId?: string
          title?: string
          body?: string
        }
        const clientId = body.clientId?.trim()
        if (!clientId) return json({ ok: false, message: '缺少 clientId' }, 400)
        const row = await getSubscription(env.DB, clientId)
        if (!row || !row.enabled) {
          return json({ ok: false, message: '未找到有效推送订阅，请先在本机开启后台推送' }, 404)
        }
        await sendPushToRow(env, row, {
          title: body.title?.trim() || 'Lumi Phone',
          body: body.body?.trim() || DEFAULT_TEST_BODY,
          data: { type: 'test' },
        })
        return json({ ok: true })
      }

      return json({ ok: false, message: 'Not Found' }, 404)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return json({ ok: false, message: msg }, 500)
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    await env.DB.prepare('DELETE FROM push_fallback_jobs WHERE created_at < ?').bind(cutoff).run()
  },
}
