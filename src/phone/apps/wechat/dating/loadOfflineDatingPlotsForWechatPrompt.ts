import type { Character } from '../newFriendsPersona/types'
import { personaDb } from '../newFriendsPersona/idb'
import { loadDatingPlotsFromKv, type DatingPlotSnapshotItem } from '../unifiedMemoryAutoSummary'
import { DATING_AI_REFERENCE_SECTION_CHAR_CAP } from './types'
import {
  collectCharacterMentionSearchTokens,
  resolveOfflineDatingArchiveContext,
} from './offlineDatingArchiveResolve'
import { offlinePlotBodyHasNpcSpeakerOrMentionFallback } from './offlineDatingNpcSpeakerDetect'
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

function filterPlotsForNpcBorrowedArchive(
  tail: DatingPlotSnapshotItem[],
  perspective: Character | null,
): DatingPlotSnapshotItem[] {
  const tokens = collectCharacterMentionSearchTokens(perspective)
  if (!tokens.length) return tail
  return tail.filter((p) => {
    const body = plotBodyForPrompt(p)
    if (!body) return false
    return offlinePlotBodyHasNpcSpeakerOrMentionFallback(body, perspective, tokens)
  })
}

/** 游标后线下剧情：带时间戳的条列表（供思维溯源） */
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

function clipReferenceTail(raw: string, cap: number, label: string): string {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  if (t.length <= cap) return t
  const marker = `…【${label}：过长已保留末尾最近内容】\n`
  const budget = Math.max(0, cap - marker.length)
  return marker + t.slice(-budget)
}

/**
 * 与约会页 `getOnlineMemoryContext` / `generateDatingAi` 使用同一规则：
 * `getDatingPlotSummaryCursor(存档归属人设)` 之后、尚未写入「已总结长期记忆」的约会剧情正文（去思维链）。
 * 若当前人设为绑定到主角的 NPC：从**主角**的线下存档读取，并优先**仅保留存在该 NPC「对白姓名框」的条目**（`【对白】姓名：…`、`【内心｜姓名】…`、或旧稿行首 `姓名：…`）；避免仅靠旁白/他人台词里「提到名字」误入选。若无任何结构化对白行则回退为全文关键词匹配（兼容非 VN 稿）。
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
    let tail = plots
      .filter((p) => {
        const ts = typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : 1
        return ts > dMin
      })
      .sort((a, b) => (a.timestamp ?? 1) - (b.timestamp ?? 1))

    const borrowed = ctx.perspectiveCharacterId !== ctx.archiveCharacterId
    const tokens = borrowed ? collectCharacterMentionSearchTokens(ctx.perspective) : []
    if (borrowed && tokens.length) {
      tail = filterPlotsForNpcBorrowedArchive(tail, ctx.perspective)
    }

    const rootName = (ctx.archiveOwner?.name ?? '').trim() || '主角'
    const peerLabel = peerDisplayName?.trim() || (ctx.perspective?.name ?? '').trim() || '对方'
    const lines: string[] = []
    for (const p of tail) {
      const t = plotBodyForPrompt(p)
      if (!t) continue
      if (p.type === 'player') {
        lines.push(`我：${t}`)
      } else if (borrowed) {
        lines.push(`「${rootName}」（线下剧情）：${t}`)
      } else {
        lines.push(`${peerLabel}：${t}`)
      }
    }

    if (borrowed && !lines.length) {
      const hint =
        tokens.length > 0
          ? `（近期「${rootName}」的线下剧情中，未找到以你为说话人的【对白】/【内心｜…】或旧稿「姓名：」行，也未命中全文关键词；勿编造你亲口说过的细节，可自然表示「听说/后来才知情」等。）`
          : `（当前人设缺少可用于检索的名字/昵称，未对「${rootName}」线下剧情做片段过滤；请严格按人设把握知情边界。）`
      lines.push(hint)
    }

    return lines.join('\n')
  } catch {
    return ''
  }
}

/**
 * 仅从给定快照拼接「尚未总结·线下剧情」式样正文（**不从 KV 再读全档**）。
 * 用于「重新生成」某条 AI 气泡：避免把待重写的旧正文再次注入 user，导致洗稿雷同。
 */
export function formatOfflineUnsummarizedBlockFromPlotSnapshots(
  plots: DatingPlotSnapshotItem[],
  peerDisplayName: string | null | undefined,
  maxChars: number = DATING_AI_REFERENCE_SECTION_CHAR_CAP,
): string {
  const peerLabel = peerDisplayName?.trim() || '对方'
  const lines: string[] = []
  for (const p of plots) {
    const t = plotBodyForPrompt(p)
    if (!t) continue
    if (p.type === 'player') lines.push(`我：${t}`)
    else lines.push(`${peerLabel}：${t}`)
  }
  const raw = lines.join('\n').trim()
  return clipReferenceTail(raw, maxChars, '尚未总结·线下剧情')
}

/**
 * 微信与其它线上 completion：注入「尚未总结·线下剧情」，与约会页游标规则一致。
 * 正文过长时保留时间轴末尾（与约会参考资料裁剪策略一致）。
 */
export async function loadOfflineDatingPlotsPromptBlock(
  characterId: string | null | undefined,
  characterDisplayName?: string | null,
): Promise<string> {
  const cid = characterId?.trim()
  const raw = await buildUnsummarizedOfflineDatingText(cid, characterDisplayName)
  const body = clipReferenceTail(raw, DATING_AI_REFERENCE_SECTION_CHAR_CAP, '尚未总结·线下剧情')
  if (!body.trim()) return ''

  const ctx = cid ? await resolveOfflineDatingArchiveContext(cid) : null
  const borrowed = !!(ctx && ctx.perspectiveCharacterId !== ctx.archiveCharacterId)
  const rootName = (ctx?.archiveOwner?.name ?? '').trim() || '主角'
  const selfName = (characterDisplayName ?? ctx?.perspective?.name ?? '').trim() || '当前角色'

  const header = borrowed
    ? `【尚未总结·关联主角线下剧情（节选）】` +
      `你与「${rootName}」同属一条时间线；下列内容来自**「${rootName}」在约会页的线下剧情存档**（plot 总结游标之后）。` +
      `节选规则：**优先只保留存在你（${selfName}）为说话人的行**——即 VN 的 \`【对白】${(ctx?.perspective?.name ?? '').trim() || '姓名'}：…\`、\`【内心｜${(ctx?.perspective?.name ?? '').trim() || '姓名'}】…\`，或旧稿行首「姓名：」对白；**不会**仅凭旁白或他人台词里「提到你名字」整段收入。` +
      `若该段剧情无上述结构化对白行，则退化为全文关键词匹配（兼容非 VN 稿）。` +
      `叙述口吻多为**主角/旁白视角**，你应理解为你**亲口说过或内心独白可被合理引用**的片段；**禁止**把主角的台词误记成你自己发的、**禁止**与节选明显矛盾；未写入的段落**禁止**据此编造你在场言行。若仅有一句系统提示，表示近期未命中节选，勿硬编。`
    : `【尚未总结·线下剧情（约会页 plot 总结游标之后）】与当前会话为**同一角色、同一时间线**。` +
      `须参考下列事实自然衔接，**禁止**与线下已发生内容明显矛盾或假装从未发生；若为空可忽略。`

  return `${header}\n\n${body}`
}
