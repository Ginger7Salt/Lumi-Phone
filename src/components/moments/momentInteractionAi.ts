import { parseModelJsonPayload } from '../anonymousQa/qnaDirectedJsonParse'
import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'
import type { ApiConfig } from '../../phone/apps/api/types'

import type { AiMomentInteractionDraft } from './momentInteractionTypes'
import { generatePersonaBoundUserMomentInteractions } from './momentUserInteractionAi'
import { assertMomentsChatApiConfigured } from './momentsChatApiReady'
import { MOMENT_TEXT_OUTPUT_HINT, sanitizeMomentText } from './momentTextSanitize'
import type { AllowedMomentCharacter } from './momentPrivacyAudience'
import { runMomentsVisionChat } from './momentVisionChat'

function extractInteractionsArray(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return null
  const o = payload as Record<string, unknown>
  if (Array.isArray(o.interactions)) return o.interactions as unknown[]
  return null
}

function normalizeDraft(
  raw: unknown,
  allowedCharIds: Set<string>,
  allowViewed: boolean,
): AiMomentInteractionDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const charId = typeof o.charId === 'string' ? o.charId.trim() : ''
  if (!charId || !allowedCharIds.has(charId)) return null

  const typeRaw = o.type
  const type =
    typeRaw === 'like' || typeRaw === 'comment' || (allowViewed && typeRaw === 'viewed')
      ? typeRaw
      : null
  if (!type) return null

  const delayRaw = Number(o.delaySeconds)
  const delaySeconds = Number.isFinite(delayRaw) ? Math.max(5, Math.min(7200, delayRaw)) : 60

  if (type === 'comment') {
    const content = sanitizeMomentText(typeof o.content === 'string' ? o.content : '')
    if (!content) return null
    const replyToCharId =
      typeof o.replyToCharId === 'string' && allowedCharIds.has(o.replyToCharId.trim())
        ? o.replyToCharId.trim()
        : undefined
    return { charId, type, content: content.slice(0, 280), delaySeconds, replyToCharId }
  }

  if (type === 'viewed') {
    const dwellRaw = Number(o.dwellSeconds)
    const dwellSeconds = Number.isFinite(dwellRaw)
      ? Math.max(3, Math.min(300, Math.round(dwellRaw)))
      : 12
    return { charId, type, delaySeconds, dwellSeconds }
  }

  return { charId, type, delaySeconds }
}

function buildSystemPrompt(
  allowed: AllowedMomentCharacter[],
  enableVisitorFootprints: boolean,
  mentioned: AllowedMomentCharacter[],
  withCharacterContexts: boolean,
): string {
  const roster = allowed.map((c) => `${c.charId}（${c.displayName}）`).join('、')
  const typeUnion = enableVisitorFootprints
    ? '"like"|"comment"|"viewed"'
    : '"like"|"comment"'
  const viewedRule = enableVisitorFootprints
    ? withCharacterContexts
      ? '\n8. type 为 viewed 表示角色看了但不点赞不评论；需 dwellSeconds（3～120）。冷战/低好感/闹矛盾时可优先用 viewed。'
      : '\n6. type 为 viewed 表示角色看了但不点赞不评论；需 dwellSeconds（3～120）。冷战/低好感/闹矛盾时可优先用 viewed。'
    : ''
  const mentionBlock = mentioned.length
    ? `\n\n【提醒谁看 · 被 @ 的角色】
${mentioned.map((c) => `- ${c.displayName}（${c.charId}）`).join('\n')}
这些角色**一定知道**用户这条朋友圈提到了自己（会刷到/收到提醒感）。
**禁止**因被 @ 就强行点赞/评论；须结合人设、与用户当前关系、是否在冷战/赌气/闹矛盾等。
关系冷淡/冷战/赌气时：仅 type=viewed（若允许）或不输出该角色任何互动，**不要**违心点赞评论。
关系正常/亲密时：可 like/comment，仍须符合性格。`
    : ''

  return `你是虚拟社交网络中的「朋友圈互动编排器」。
必须仅输出一个 JSON 对象，不要 Markdown，不要解释。
JSON 结构：
{"interactions":[{"charId":"角色ID","type":${typeUnion},"content":"仅评论需要","delaySeconds":数字,"dwellSeconds":"仅viewed","replyToCharId":"可选"}]}

规则：
1. charId 必须来自允许名单，严禁编造 ID 或名字。
2. 不需要每个角色都互动；符合人设与作息，0～${Math.min(allowed.length, 6)} 条即可。
3. delaySeconds 为「刷到朋友圈后」的秒数；同一角色须连贯：先 like（或 viewed），comment 仅比同角色 like 大 8～15 秒（模拟打字），禁止同角色 like 与 comment 相差超过 30 秒。
4. 评论须符合各角色性格（傲娇、高冷、温柔等），简短自然。${
    withCharacterContexts
      ? '\n5. 下方各角色区块含与该用户的**近期私聊与长期记忆**：评论须据此反应，像真人刷到熟人朋友圈，可接梗、关心、吐槽或暧昧，勿写与人设/关系无关的客套。\n6. 若某角色标注「私聊未回但发朋友圈」，可在 comment 中自然调侃（如有空发朋友圈没空回消息）；须贴合人设，勿机械模板；关系冷淡或严肃时可略过。\n7. 严禁在 JSON 里写 displayName，只写 charId。'
      : '\n5. 严禁在 JSON 里写 displayName，只写 charId。'
  }${viewedRule}${mentionBlock}

${MOMENT_TEXT_OUTPUT_HINT}`
    .concat(`\n\n允许的角色名单：${roster || '（无）'}`)
}

export async function generateMomentInteractions(params: {
  apiConfig: ApiConfig | null
  momentContent: string
  imageCount: number
  momentImages?: string[]
  allowedCharacters: AllowedMomentCharacter[]
  mentionedCharacters?: AllowedMomentCharacter[]
  enableVisitorFootprints?: boolean
  /** 用户朋友圈：注入各角色私聊/长期记忆与「未回私聊却发朋友圈」情境 */
  wechatCtx?: AnonymousQaWechatContext | null
  momentPublishedAt?: number
}): Promise<AiMomentInteractionDraft[]> {
  const {
    apiConfig,
    momentContent,
    imageCount,
    momentImages,
    allowedCharacters,
    mentionedCharacters = [],
    enableVisitorFootprints = false,
    wechatCtx = null,
    momentPublishedAt,
  } = params
  if (!allowedCharacters.length) return []

  const cfg = apiConfig
  assertMomentsChatApiConfigured(cfg)

  const allowedCharIds = new Set(allowedCharacters.map((c) => c.charId))
  const publishedAt = momentPublishedAt ?? Date.now()
  const canUsePersonaPath = !!wechatCtx

  if (canUsePersonaPath) {
    return generatePersonaBoundUserMomentInteractions({
      wechatCtx,
      momentContent,
      imageCount,
      momentImages,
      allowedCharacters,
      mentionedCharacterIds: new Set(mentionedCharacters.map((c) => c.charId)),
      enableVisitorFootprints,
      momentPublishedAt: publishedAt,
    })
  }

  const withCharacterContexts = false

  const mentionLines = mentionedCharacters.length
    ? `\n被用户「提醒谁看」@ 的角色：${mentionedCharacters.map((c) => c.displayName).join('、')}`
    : ''
  const userTask = [
    '【系统任务：朋友圈动态互动模拟】',
    `用户刚刚发布了一条朋友圈。内容：${momentContent.trim() || '（无文字）'}`,
    `配图数：${imageCount}`,
    `能看到这条动态的角色：${allowedCharacters.map((c) => c.displayName).join('、')}${mentionLines}`,
    enableVisitorFootprints
      ? '请模拟点赞/评论/静默浏览(viewed)，返回 JSON。被 @ 的角色须知晓被提及，但互动深浅由关系与情境决定。'
      : '请模拟点赞/评论，返回 JSON。被 @ 的角色须知晓被提及，但互动深浅由关系与情境决定。',
  ].join('\n\n')

  const raw = await runMomentsVisionChat(cfg, {
    system: buildSystemPrompt(
      allowedCharacters,
      enableVisitorFootprints,
      mentionedCharacters,
      withCharacterContexts,
    ),
    userText: userTask,
    momentImages,
    temperature: 0.78,
    max_tokens: 1200,
  })
  const payload = parseModelJsonPayload(raw)
  const rows = extractInteractionsArray(payload)
  if (!rows?.length) return []

  const out: AiMomentInteractionDraft[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const draft = normalizeDraft(row, allowedCharIds, enableVisitorFootprints)
    if (!draft) continue
    const key = `${draft.charId}:${draft.type}:${draft.content ?? ''}:${draft.dwellSeconds ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(draft)
    if (out.length >= 8) break
  }
  return out
}
