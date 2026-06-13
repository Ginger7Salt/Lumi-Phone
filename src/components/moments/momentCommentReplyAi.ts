import type { ApiConfig } from '../../phone/apps/api/types'
import { loadPrivateChatNetworkRelationshipsBlock } from '../../phone/apps/wechat/networkRelationshipsPrompt'
import { buildSystemContent } from '../../phone/apps/wechat/wechatChatAi'
import { parseModelJsonPayload } from '../anonymousQa/qnaDirectedJsonParse'
import {
  buildAnonymousQaPersonaPromptPack,
  type AnonymousQaWechatContext,
} from '../anonymousQa/buildAnonymousQaPersonaContext'
import { assertMomentsChatApiConfigured } from './momentsChatApiReady'
import type { MomentComment } from './mockMoments'
import { MOMENT_TEXT_OUTPUT_HINT, sanitizeMomentText } from './momentTextSanitize'
import { runMomentsVisionChat } from './momentVisionChat'

const REPLY_TASK_PER_COMMENT = `
【朋友圈互动指令】
你发布了朋友圈。用户对你发送了评论，请结合你的人设回复（傲娇可装作不在意，爹系可认真回复）。
输出规则：
- 用户有 N 条评论时，replies 数组必须恰好 N 项，与评论顺序一一对应
- 每项是自然口语，像微信朋友圈评，1-3 句，直接写正文
- 禁止在正文里写「回复1」「回复₁」「回复一」等编号、分条标题或序号前缀
- 仅输出 JSON：{"replies":["对第1条评论的回复","对第2条评论的回复"]}
${MOMENT_TEXT_OUTPUT_HINT}
`.trim()

const REPLY_TASK_UNIFIED = `
【朋友圈互动指令 · 整体回应】
你发布了朋友圈。用户连续发了多条评论，这些评论是同一段思路的展开（例如先疑惑、后想通），不是让你逐条分开答。
请阅读全部评论后，写**一条**自然、连贯的回复，像真人在评论区接话：
- 要承接用户评论的整体语境与情绪转折，可呼应最早一条里的疑问，也可接住最后一条里的结论
- 只输出**一条**回复，不要拆成多条、不要编号、不要「回复1/回复2」
- 1-3 句口语化即可，像微信朋友圈评
- 仅输出 JSON：{"reply":"你的整体回复"} 或 {"replies":["你的整体回复"]}
${MOMENT_TEXT_OUTPUT_HINT}
`.trim()

const NUMBERED_REPLY_SPLIT =
  /(?:^|\s)(?:回复[\s]*[₀₁₂₃₄₅₆₇₈₉0-9一二三四五六七八九十]+[：:]\s*)/g

export function splitNumberedReplyContent(content: string): string[] {
  const trimmed = content.trim()
  if (!trimmed) return []
  const parts = trimmed
    .split(NUMBERED_REPLY_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.length > 1 ? parts : [trimmed]
}

function normalizeReplyCount(replies: string[], expectedCount: number): string[] {
  const cleaned = replies.map((r) => r.trim()).filter(Boolean)
  if (!expectedCount) return cleaned
  if (!cleaned.length) return Array.from({ length: expectedCount }, () => '')
  if (cleaned.length === expectedCount) return cleaned
  if (cleaned.length === 1 && expectedCount > 1) {
    const split = splitNumberedReplyContent(cleaned[0]!)
    if (split.length === expectedCount) return split
  }
  if (cleaned.length > expectedCount) return cleaned.slice(0, expectedCount)
  const last = cleaned[cleaned.length - 1]!
  return [...cleaned, ...Array.from({ length: expectedCount - cleaned.length }, () => last)]
}

function parseRepliesFromPayload(payload: unknown, expectedCount: number): string[] | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>

  if (typeof obj.reply === 'string' && obj.reply.trim()) {
    return [obj.reply.trim()]
  }

  if (Array.isArray(obj.replies)) {
    const replies = obj.replies.map((r) => String(r ?? '').trim()).filter(Boolean)
    if (replies.length) return normalizeReplyCount(replies, expectedCount)
  }

  if ('content' in obj) {
    const content = String(obj.content ?? '').trim()
    if (!content) return null
    const split = splitNumberedReplyContent(content)
    return normalizeReplyCount(split.length > 1 ? split : [content], expectedCount)
  }

  return null
}

export type MomentAuthorReplyMode = 'unified' | 'per-comment'

export async function generateMomentAuthorReplies(params: {
  wechatCtx: AnonymousQaWechatContext
  characterId: string
  momentContent: string
  momentImages?: string[]
  userDisplayName: string
  pendingComments: MomentComment[]
  /** 多条未回复评论时默认整体回应；可显式指定 */
  replyMode?: MomentAuthorReplyMode
}): Promise<string[]> {
  const expectedCount = params.pendingComments.length
  if (!expectedCount) return []

  const unified =
    params.replyMode === 'unified' ||
    (params.replyMode !== 'per-comment' && expectedCount > 1)
  const outputCount = unified ? 1 : expectedCount

  const cfg = params.wechatCtx.apiConfig
  assertMomentsChatApiConfigured(cfg)

  const pack = await buildAnonymousQaPersonaPromptPack({
    characterId: params.characterId,
    wechatCtx: params.wechatCtx,
    relevanceHaystack: params.pendingComments.map((c) => c.content).join('\n'),
  })
  if (!pack.character) {
    throw new Error('未找到该角色人设')
  }

  const networkRelationshipsBlock = await loadPrivateChatNetworkRelationshipsBlock({
    character: pack.character,
    sessionPlayerIdentityId: params.wechatCtx.playerIdentityId,
  })

  const system = buildSystemContent({
    character: pack.character,
    playerIdentity: pack.playerIdentity,
    playerDisplayName: params.userDisplayName.trim() || '朋友',
    promptMode: 'persona',
    longTermMemoryNotes: pack.longTermMemoryNotes || undefined,
    worldBackgroundPrompt: pack.worldBackgroundPrompt,
    offlineDatingPlotsContext: pack.offlineDatingPlotsContext || undefined,
    unsummarizedPrivateNotes: pack.unsummarizedPrivateNotes || undefined,
    unsummarizedGroupNotes: pack.unsummarizedGroupNotes || undefined,
    meetEncounterMemoriesContext: pack.meetEncounterMemoriesContext || undefined,
    unsummarizedMeetNotes: pack.unsMeet?.trim() || undefined,
    networkRelationshipsBlock: networkRelationshipsBlock || undefined,
    chatMemberIds: [params.characterId],
  })

  const commentLines = params.pendingComments
    .map((c, i) => `${i + 1}. ${c.content}`)
    .join('\n')

  const userTask = unified
    ? [
        `你发布了朋友圈：${params.momentContent.trim() || '（无文字）'}`,
        `用户 ${params.userDisplayName} 连续发了 ${expectedCount} 条评论（请当作同一段思路整体阅读）：`,
        commentLines,
        '请写一条承接全部评论的整体回复，只返回 JSON。',
      ].join('\n\n')
    : [
        `你发布了朋友圈：${params.momentContent.trim() || '（无文字）'}`,
        `用户 ${params.userDisplayName} 对你连续发送了 ${expectedCount} 条评论：`,
        commentLines,
        `请逐条回复，replies 数组必须包含 ${expectedCount} 项，只返回 JSON。`,
      ].join('\n\n')

  const taskAppendix = unified ? REPLY_TASK_UNIFIED : REPLY_TASK_PER_COMMENT

  const raw = await runMomentsVisionChat(cfg as ApiConfig, {
    system: `${system}\n\n${taskAppendix}`,
    userText: userTask,
    momentImages: params.momentImages,
    temperature: 0.88,
    max_tokens: unified ? 520 : 800,
  })

  const payload = parseModelJsonPayload(raw)
  const parsed = parseRepliesFromPayload(payload, outputCount)
  if (parsed?.some((r) => r.trim())) {
    return parsed.map((r) => sanitizeMomentText(r)).filter(Boolean)
  }

  const fallback = raw.trim()
  if (fallback && !fallback.startsWith('{')) {
    const parts = unified
      ? [sanitizeMomentText(fallback)].filter(Boolean)
      : normalizeReplyCount(splitNumberedReplyContent(fallback), outputCount)
          .map((r) => sanitizeMomentText(r))
          .filter(Boolean)
    if (parts.length) return parts
  }

  throw new Error('模型未返回有效回复，请重试')
}
