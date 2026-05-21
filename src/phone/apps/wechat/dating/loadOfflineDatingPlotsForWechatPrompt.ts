import type { Character } from '../newFriendsPersona/types'
import { personaDb } from '../newFriendsPersona/idb'
import { loadDatingPlotsFromKv, type DatingPlotSnapshotItem } from '../unifiedMemoryAutoSummary'
import { DATING_AI_OFFLINE_UNSUMMARIZED_CHAR_CAP } from './types'
import {
  collectCharacterMentionSearchTokens,
  resolveOfflineDatingArchiveContext,
} from './offlineDatingArchiveResolve'
import { offlinePlotBodyRelevantToNpcForLinkedExcerpt } from './offlineDatingNpcSpeakerDetect'
import { splitDatingAssistantOutput } from './plotCoT'
import { extractVnVoiceParamsBlock } from './vnVoiceParamsStrip'

function plotBodyForPrompt(p: DatingPlotSnapshotItem): string {
  const raw = String(p.content || '').trim()
  if (!raw) return ''
  if (p.type === 'player') return raw
  const prose = splitDatingAssistantOutput(raw).content.trim()
  return extractVnVoiceParamsBlock(prose).cleanedText.trim()
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatPlotTraceDate(ts: number): string {
  const d = new Date(Number.isFinite(ts) ? ts : Date.now())
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function clipSnippet(s: string, max: number) {
  const t = String(s || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}（…）`
}

function clipReferenceTail(raw: string, cap: number, label: string): string {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  if (t.length <= cap) return t
  const marker = `…【${label}：过长已保留末尾最近内容】\n`
  const budget = Math.max(0, cap - marker.length)
  return marker + t.slice(-budget)
}

export type OfflinePlotBuildOpts = {
  plots: DatingPlotSnapshotItem[]
  plotCursorMin: number
  borrowed?: boolean
  rootName?: string
  peerLabel?: string
  filterNpc?: (plot: DatingPlotSnapshotItem, body: string) => boolean
  maxChars: number
}

function filterPlotTail(opts: OfflinePlotBuildOpts): DatingPlotSnapshotItem[] {
  let tail = opts.plots
    .filter((p) => {
      const ts = typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : 1
      return ts > opts.plotCursorMin
    })
    .sort((a, b) => (a.timestamp ?? 1) - (b.timestamp ?? 1))

  if (opts.filterNpc) {
    const kept = new Set<number>()
    tail.forEach((p, i) => {
      const body = plotBodyForPrompt(p)
      if (body && opts.filterNpc!(p, body)) kept.add(i)
    })
    for (const i of [...kept]) {
      if (tail[i]?.type !== 'player') continue
      const next = i + 1
      if (tail[next]?.type === 'ai' && plotBodyForPrompt(tail[next]!)) kept.add(next)
    }
    tail = tail.filter((_, i) => kept.has(i))
  }
  return tail
}

/** 游标后线下剧情：正文全文（去思维链）。 */
export function buildOfflinePlotsFullText(opts: OfflinePlotBuildOpts): string {
  const peerLabel = opts.peerLabel?.trim() || '对方'
  const rootName = opts.rootName?.trim() || '主角'
  const borrowed = opts.borrowed === true
  const tail = filterPlotTail(opts)
  const lines: string[] = []
  for (const p of tail) {
    const t = plotBodyForPrompt(p)
    if (!t) continue
    if (p.type === 'player') lines.push(`我：${t}`)
    else if (borrowed) lines.push(`「${rootName}」（线下剧情）：${t}`)
    else lines.push(`${peerLabel}：${t}`)
  }
  if (borrowed && !lines.length) {
    const hint =
      opts.filterNpc
        ? `（近期「${rootName}」的线下剧情中，未找到与你相关的节选；勿编造你亲口说过的细节。）`
        : `（当前人设缺少可用于检索的名字/昵称，未对「${rootName}」线下剧情做片段过滤。）`
    lines.push(hint)
  }
  return clipReferenceTail(lines.join('\n'), opts.maxChars, '尚未总结·线下剧情')
}

function filterPlotsForNpcBorrowedArchive(
  tail: DatingPlotSnapshotItem[],
  perspective: Character | null,
): DatingPlotSnapshotItem[] {
  const tokens = collectCharacterMentionSearchTokens(perspective)
  if (!tokens.length) return tail
  const keptIdx = new Set<number>()
  tail.forEach((p, i) => {
    const body = plotBodyForPrompt(p)
    if (!body) return
    if (offlinePlotBodyRelevantToNpcForLinkedExcerpt(body, perspective, tokens)) keptIdx.add(i)
  })
  for (const i of [...keptIdx]) {
    if (tail[i]?.type !== 'player') continue
    const next = i + 1
    const ai = tail[next]
    if (ai?.type === 'ai' && plotBodyForPrompt(ai)) keptIdx.add(next)
  }
  return tail.filter((_, i) => keptIdx.has(i))
}

/** 游标后线下剧情：带时间戳的正文摘录（供思维溯源） */
export async function listUnsummarizedOfflinePlotTraceItems(
  characterId: string | null | undefined,
  peerDisplayName?: string | null,
  opts?: { maxItems?: number; snippetChars?: number; /** 不作条内字数截断（思维溯源完整展示） */ fullSnippet?: boolean },
): Promise<Array<{ date: string; snippet: string }>> {
  const cid = characterId?.trim()
  if (!cid) return []
  const maxItems = Math.max(1, Math.min(2000, opts?.maxItems ?? 16))
  const snippetChars = Math.max(80, Math.min(2000, opts?.snippetChars ?? 420))
  try {
    const ctx = await resolveOfflineDatingArchiveContext(cid)
    if (!ctx) return []
    const plotCursor = await personaDb.getDatingPlotSummaryCursor(ctx.archiveCharacterId)
    const dMin = plotCursor ?? 0
    const plots = await loadDatingPlotsFromKv(ctx.archiveCharacterId)
    let tail = plots
      .filter((p) => {
        const ts = typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : 1
        return ts > dMin
      })
      .sort((a, b) => (a.timestamp ?? 1) - (b.timestamp ?? 1))
      .slice(-maxItems)

    const borrowed = ctx.perspectiveCharacterId !== ctx.archiveCharacterId
    if (borrowed) {
      tail = filterPlotsForNpcBorrowedArchive(tail, ctx.perspective)
    }

    const rootName = (ctx.archiveOwner?.name ?? '').trim() || '主角'
    const peerLabel = peerDisplayName?.trim() || (ctx.perspective?.name ?? '').trim() || '对方'
    const out: Array<{ date: string; snippet: string }> = []
    for (const p of tail) {
      const body = plotBodyForPrompt(p)
      if (!body) continue
      const ts = typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : Date.now()
      let role: string
      if (p.type === 'player') {
        role = '我'
      } else if (borrowed) {
        role = `「${rootName}」（线下剧情）`
      } else {
        role = peerLabel
      }
      const line = `${role}：${body}`
      out.push({
        date: formatPlotTraceDate(ts),
        snippet: opts?.fullSnippet ? line : clipSnippet(line, snippetChars),
      })
    }
    return out
  } catch {
    return []
  }
}

/**
 * 与约会页 `getOnlineMemoryContext` / `generateDatingAi` 使用同一规则：
 * plot 游标之后、尚未写入长期记忆的材料（正文全文）。
 */
export async function buildUnsummarizedOfflineDatingText(
  characterId: string | null | undefined,
  peerDisplayName?: string | null,
): Promise<string> {
  const cid = characterId?.trim()
  if (!cid) return ''
  try {
    const ctx = await resolveOfflineDatingArchiveContext(cid)
    if (!ctx) return ''
    const plotCursor = await personaDb.getDatingPlotSummaryCursor(ctx.archiveCharacterId)
    const dMin = plotCursor ?? 0
    const plots = await loadDatingPlotsFromKv(ctx.archiveCharacterId)
    const borrowed = ctx.perspectiveCharacterId !== ctx.archiveCharacterId
    const tokens = borrowed ? collectCharacterMentionSearchTokens(ctx.perspective) : []
    const peerLabel = peerDisplayName?.trim() || (ctx.perspective?.name ?? '').trim() || '对方'
    return buildOfflinePlotsFullText({
      plots,
      plotCursorMin: dMin,
      borrowed,
      rootName: (ctx.archiveOwner?.name ?? '').trim() || '主角',
      peerLabel,
      filterNpc:
        borrowed && tokens.length
          ? (_plot, body) =>
              offlinePlotBodyRelevantToNpcForLinkedExcerpt(body, ctx.perspective, tokens)
          : undefined,
      maxChars: DATING_AI_OFFLINE_UNSUMMARIZED_CHAR_CAP,
    })
  } catch {
    return ''
  }
}

/** 仅从给定快照拼接游标后线下剧情正文（不从 KV 再读全档）。 */
export async function formatOfflineUnsummarizedBlockFromPlotSnapshots(
  plots: DatingPlotSnapshotItem[],
  peerDisplayName: string | null | undefined,
  maxChars?: number,
): Promise<string> {
  const cap = maxChars ?? DATING_AI_OFFLINE_UNSUMMARIZED_CHAR_CAP
  const peerLabel = peerDisplayName?.trim() || '对方'
  return buildOfflinePlotsFullText({
    plots,
    plotCursorMin: -1,
    peerLabel,
    maxChars: cap,
  })
}

/** 微信与其它线上 completion：注入游标后线下剧情正文。 */
export async function loadOfflineDatingPlotsPromptBlock(
  characterId: string | null | undefined,
  characterDisplayName?: string | null,
): Promise<string> {
  const cid = characterId?.trim()
  const body = await buildUnsummarizedOfflineDatingText(cid, characterDisplayName)
  if (!body.trim()) return ''

  const ctx = cid ? await resolveOfflineDatingArchiveContext(cid) : null
  const borrowed = !!(ctx && ctx.perspectiveCharacterId !== ctx.archiveCharacterId)

  const header = borrowed
    ? `【尚未总结·关联主角线下剧情（节选）】` +
      `你与「${(ctx?.archiveOwner?.name ?? '').trim() || '主角'}」同属一条时间线；下列为 plot 总结游标之后的正文摘录（节选）。`
    : `【尚未总结·线下剧情（约会页 plot 总结游标之后）】` +
      `与当前会话为**同一角色、同一时间线**；须参考下列事实自然衔接，**禁止**与线下已发生内容明显矛盾。`

  return `${header}\n\n${body}`
}

/** 模型注入块里的「尚未总结·线下剧情」说明段（单行，后接空行再是正文）。 */
const OFFLINE_PLOT_INJECT_HEADER_RE =
  /【尚未总结·(?:关联主角线下剧情（节选）|线下剧情（约会页 plot 总结游标之后）)】[^\n]*\n\n/g

/** 思维溯源 / UI：去掉仅注入模型用的前言，只保留正文摘录。 */
export function stripOfflineDatingPlotsInjectHeaderForTraceDisplay(text: string): string {
  let s = String(text ?? '').trim()
  if (!s) return ''

  s = s.replace(OFFLINE_PLOT_INJECT_HEADER_RE, '').trim()
  s = s.replace(/…【尚未总结·线下剧情[^】]*】\n?/g, '').trim()
  s = s
    .replace(/（近期「[^」]+」的线下剧情中，未找到[^\n]+）\n?/g, '')
    .replace(/（当前人设缺少可用于检索[^\n]+）\n?/g, '')
    .trim()

  return s
}
