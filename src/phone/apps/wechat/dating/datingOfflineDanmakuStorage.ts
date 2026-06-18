import type { DanmakuOverlayBullet } from '../DanmakuOverlay'
import { personaDb } from '../newFriendsPersona/idb'

const KV_PREFIX = 'dating-offline-dm-bullets-v1'

export type DatingOfflineDmKvPayload = {
  v: 1
  /** 生成该批弹幕时的 plots.length */
  anchorPlotCount: number
  bullets: DanmakuOverlayBullet[]
}

function kvKey(characterId: string): string {
  return `${KV_PREFIX}:${characterId.trim()}`
}

function normalizeBulletRow(x: unknown): DanmakuOverlayBullet | null {
  if (!x || typeof x !== 'object') return null
  const r = x as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id.trim() : ''
  const text = typeof r.text === 'string' ? r.text : ''
  if (!id || !text.trim()) return null
  const track = typeof r.track === 'number' && Number.isFinite(r.track) ? Math.max(0, Math.floor(r.track)) : 0
  const durationSec =
    typeof r.durationSec === 'number' && Number.isFinite(r.durationSec) ? Math.max(3, r.durationSec) : 8
  const startDelaySec =
    typeof r.startDelaySec === 'number' && Number.isFinite(r.startDelaySec) ? Math.max(0, r.startDelaySec) : undefined
  const fontPx = typeof r.fontPx === 'number' && Number.isFinite(r.fontPx) ? Math.max(10, Math.min(36, r.fontPx)) : 14
  const colorRgba = typeof r.colorRgba === 'string' && r.colorRgba.trim() ? r.colorRgba.trim() : 'rgba(0,0,0,0.85)'
  const st = r.style
  const style: DanmakuOverlayBullet['style'] = st === 'gray' || st === 'white' || st === 'none' ? st : 'none'
  let topPct: number | undefined
  if (typeof r.topPct === 'number' && Number.isFinite(r.topPct)) {
    topPct = Math.min(100, Math.max(0, r.topPct))
  }
  return { id, text, track, durationSec, startDelaySec, fontPx, colorRgba, style, topPct }
}

function parsePayload(raw: unknown): DatingOfflineDmKvPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const anchorRaw = typeof o.anchorPlotCount === 'number' ? o.anchorPlotCount : Number(o.anchorPlotCount)
  const anchorPlotCount = Number.isFinite(anchorRaw) ? Math.max(0, Math.floor(anchorRaw)) : 0
  const arr = Array.isArray(o.bullets) ? o.bullets : []
  const bullets: DanmakuOverlayBullet[] = []
  for (const row of arr) {
    const b = normalizeBulletRow(row)
    if (b) bullets.push(b)
  }
  if (!bullets.length) return null
  return { v: 1, anchorPlotCount, bullets }
}

/** 自上次弹幕锚点以来是否已走完一轮（玩家输入后 AI 已回复） */
export function shouldInvalidateDatingOfflineDm(
  anchorPlotCount: number,
  plots: ReadonlyArray<{ type: string }>,
): boolean {
  if (plots.length <= anchorPlotCount) return false
  const last = plots[plots.length - 1]
  return last?.type === 'ai'
}

/** 恢复时按轨错开 startDelay，避免同轨叠字 */
export function staggerDatingOfflineDmAfterRestore(
  bullets: DanmakuOverlayBullet[],
  trackCount: number,
): DanmakuOverlayBullet[] {
  const tc = Math.max(1, trackCount)
  const nextEarliestSec = new Map<number, number>()
  return bullets.map((b) => {
    const track = Math.min(Math.max(0, b.track), tc - 1)
    const gapSec = Math.max(1.4, b.durationSec * 0.92)
    const wanted = b.startDelaySec ?? 0
    const minStart = nextEarliestSec.get(track) ?? 0
    const startDelaySec = Math.max(wanted, minStart)
    nextEarliestSec.set(track, startDelaySec + gapSec)
    return { ...b, track, startDelaySec }
  })
}

export async function loadDatingOfflineDmSnapshot(
  characterId: string,
  plots: ReadonlyArray<{ type: string }>,
): Promise<{ anchorPlotCount: number; bullets: DanmakuOverlayBullet[] } | null> {
  const cid = characterId.trim()
  if (!cid) return null
  try {
    const raw = await personaDb.getPhoneKv(kvKey(cid))
    const payload = parsePayload(raw)
    if (!payload) return null
    if (shouldInvalidateDatingOfflineDm(payload.anchorPlotCount, plots)) {
      await personaDb.setPhoneKv(kvKey(cid), { v: 1, anchorPlotCount: 0, bullets: [] })
      return null
    }
    return { anchorPlotCount: payload.anchorPlotCount, bullets: payload.bullets.slice(-180) }
  } catch {
    return null
  }
}

export async function saveDatingOfflineDmSnapshot(
  characterId: string,
  anchorPlotCount: number,
  bullets: DanmakuOverlayBullet[],
): Promise<void> {
  const cid = characterId.trim()
  if (!cid || bullets.length === 0) return
  await personaDb.setPhoneKv(kvKey(cid), {
    v: 1,
    anchorPlotCount: Math.max(0, Math.floor(anchorPlotCount)),
    bullets: bullets.slice(-180),
  })
}

export async function clearDatingOfflineDmSnapshot(characterId: string): Promise<void> {
  const cid = characterId.trim()
  if (!cid) return
  await personaDb.setPhoneKv(kvKey(cid), { v: 1, anchorPlotCount: 0, bullets: [] })
}
