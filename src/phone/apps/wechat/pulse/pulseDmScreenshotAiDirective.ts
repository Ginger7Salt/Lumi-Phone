import {
  composePulseDmScreenshotDataUrl,
  dataUrlToWeChatImagePayload,
  type PulseDmScreenshotComposeInput,
  type PulseDmScreenshotLine,
} from './pulseDmScreenshotCompose'

export type AiPulseDmScreenshotDirective = {
  peerName: string
  lines: PulseDmScreenshotLine[]
}

const BLOCK_START_RE = /^\[(?:微博私信截图|PULSE_DM_SHOT)\]\s*$/i
const BLOCK_END_RE = /^\[\/(?:微博私信截图|PULSE_DM_SHOT)\]\s*$/i
const BLOCK_OPEN_PREFIX_RE = /^\[(?:微博私信截图|PULSE_DM_SHOT)\]/i
const PLACEHOLDER_RE = /^\[PULSE_DM_SHOT\]([a-zA-Z0-9_-]{6,40})\s*$/

const shotImageCache = new Map<string, { base64: string; mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }>()

export function buildWeChatPulseDmScreenshotOutputBlock(): string {
  return `
---------------------
【微博私信截图（举证给 {{user}} 看｜需会话开关打开）】
---------------------
- 仅在剧情需要时使用：吃网友好友私信瓜、澄清谣言、吐槽离谱私信等；**禁止**用截图秀人气/刷存在感；**日常闲聊不要刷屏截图**。截图里的网友内容宜克制，勿写成满屏表白、叫老公等炫耀节目单。
- 截图展示的是**你在微博私信里与某网友的对话**（云朵气泡 UI），不是微信聊天记录卡片。
- 格式（可独占数行；前后仍可有口语气泡）：
[微博私信截图]
对象：网友昵称
对方：第一条私信
我说：你的回复
对方：对方再接一句
[/微博私信截图]
- 「对象」= 对方微博网名；「我说」= 你（角色）发出的私信（截图右侧）；「对方」= 网友（左侧）。
- 每条 1 行、口语碎片感；合计 **2～8** 条；禁止 Unicode emoji（可用 [doge][允悲]）；禁止把真实微信会话原文整段粘贴。
- 本块**不会**显示在聊天气泡原文里，客户端会合成一张私信截图图片发出。
`.trim()
}

function parseSpeakerLine(raw: string): PulseDmScreenshotLine | null {
  const t = raw.trim()
  if (!t) return null
  const m =
    /^(?:对方|网友|粉丝|peer|fan)\s*[:：]\s*(.+)$/i.exec(t) ||
    /^(?:我说|我|自己|self|me)\s*[:：]\s*(.+)$/i.exec(t)
  if (!m) return null
  const content = m[1]!.trim().slice(0, 280)
  if (!content) return null
  const from: 'self' | 'peer' = /^(?:我说|我|自己|self|me)/i.test(t) ? 'self' : 'peer'
  return { from, content }
}

export function parsePulseDmScreenshotMarkup(block: string): AiPulseDmScreenshotDirective | null {
  const lines = String(block ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  let peerName = ''
  const msgs: PulseDmScreenshotLine[] = []
  for (const line of lines) {
    if (BLOCK_START_RE.test(line) || BLOCK_END_RE.test(line) || BLOCK_OPEN_PREFIX_RE.test(line)) continue
    const nameHit = /^(?:对象|对方昵称|网友|peerName|name)\s*[:：]\s*(.+)$/i.exec(line)
    if (nameHit) {
      peerName = nameHit[1]!.trim().slice(0, 24)
      continue
    }
    const msg = parseSpeakerLine(line)
    if (msg) msgs.push(msg)
  }
  if (msgs.length < 2) return null
  if (!peerName) peerName = '网友'
  return { peerName, lines: msgs.slice(0, 10) }
}

export function parsePulseDmScreenshotDirective(raw: string): AiPulseDmScreenshotDirective | null {
  const t = String(raw ?? '').replace(/\r\n/g, '\n').trim()
  if (!t) return null
  if (!/\[(?:微博私信截图|PULSE_DM_SHOT)\]/i.test(t)) return null
  const open = t.search(/\[(?:微博私信截图|PULSE_DM_SHOT)\]/i)
  const close = t.search(/\[\/(?:微博私信截图|PULSE_DM_SHOT)\]/i)
  if (open < 0) return null
  const inner =
    close > open
      ? t.slice(open, close + t.slice(close).indexOf(']') + 1)
      : t.slice(open)
  return parsePulseDmScreenshotMarkup(inner)
}

export function isPulseDmScreenshotDirectiveArtifactLine(line: string): boolean {
  const t = String(line ?? '').trim()
  if (!t) return false
  if (PLACEHOLDER_RE.test(t)) return true
  if (BLOCK_START_RE.test(t) || BLOCK_END_RE.test(t)) return true
  if (BLOCK_OPEN_PREFIX_RE.test(t) && /\[\/(?:微博私信截图|PULSE_DM_SHOT)\]/i.test(t)) return true
  return Boolean(parsePulseDmScreenshotDirective(t))
}

export function parsePulseDmScreenshotPlaceholderId(line: string): string | null {
  const m = PLACEHOLDER_RE.exec(String(line ?? '').trim())
  return m?.[1]?.trim() || null
}

export function takePulseDmScreenshotCachedImage(shotId: string): {
  base64: string
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
} | null {
  const id = shotId.trim()
  if (!id) return null
  const hit = shotImageCache.get(id)
  if (!hit) return null
  shotImageCache.delete(id)
  return hit
}

function newShotId(): string {
  return `pdms${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 从气泡中剥离私信截图块：用占位行替换，并异步合成图入缓存。
 * 调用方须 await preparePulseDmScreenshotPlaceholders 后再揭示气泡。
 */
export function stripPulseDmScreenshotDirectivesFromBubbles(bubbles: string[]): {
  bubbles: string[]
  pending: Array<{ placeholderId: string; directive: AiPulseDmScreenshotDirective }>
} {
  const pending: Array<{ placeholderId: string; directive: AiPulseDmScreenshotDirective }> = []
  const out: string[] = []

  let buffering: string[] | null = null
  const flushBuffer = () => {
    if (!buffering) return
    const block = buffering.join('\n')
    buffering = null
    const directive = parsePulseDmScreenshotMarkup(block)
    if (!directive) return
    const placeholderId = newShotId()
    pending.push({ placeholderId, directive })
    out.push(`[PULSE_DM_SHOT]${placeholderId}`)
  }

  for (const raw of bubbles) {
    const line = String(raw ?? '')
    const trimmed = line.trim()

    if (buffering) {
      buffering.push(line)
      if (BLOCK_END_RE.test(trimmed) || /\[\/(?:微博私信截图|PULSE_DM_SHOT)\]/i.test(trimmed)) {
        flushBuffer()
      }
      continue
    }

    // 单行完整块
    if (
      BLOCK_OPEN_PREFIX_RE.test(trimmed) &&
      /\[\/(?:微博私信截图|PULSE_DM_SHOT)\]/i.test(trimmed)
    ) {
      const directive = parsePulseDmScreenshotDirective(trimmed)
      if (directive) {
        const placeholderId = newShotId()
        pending.push({ placeholderId, directive })
        out.push(`[PULSE_DM_SHOT]${placeholderId}`)
      }
      continue
    }

    if (BLOCK_START_RE.test(trimmed) || (BLOCK_OPEN_PREFIX_RE.test(trimmed) && !BLOCK_END_RE.test(trimmed))) {
      buffering = [line]
      continue
    }

    out.push(line)
  }
  flushBuffer()

  return { bubbles: out, pending }
}

export async function preparePulseDmScreenshotPlaceholders(
  pending: Array<{ placeholderId: string; directive: AiPulseDmScreenshotDirective }>,
): Promise<void> {
  for (const row of pending) {
    const input: PulseDmScreenshotComposeInput = {
      peerName: row.directive.peerName,
      lines: row.directive.lines,
    }
    const dataUrl = await composePulseDmScreenshotDataUrl(input)
    if (!dataUrl) continue
    const payload = dataUrlToWeChatImagePayload(dataUrl)
    if (!payload) continue
    shotImageCache.set(row.placeholderId, payload)
  }
}

export const PULSE_DM_SCREENSHOT_TRANSCRIPT = '[微博私信截图]'
