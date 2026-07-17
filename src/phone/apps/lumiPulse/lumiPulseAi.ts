import type { ApiConfig } from '../api/types'
import { openAiCompatibleChat, openAiCompatibleChatAny } from '../wechat/newFriendsPersona/ai'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import { loadPrivateChatNetworkRelationshipsBlock } from '../wechat/networkRelationshipsPrompt'
import { loadPulseCharacterFollowingPromptBlock } from './pulseFollowingPrompt'
import type {
  PulseComment,
  PulseDmThread,
  PulseGeneratedCharacterDynamics,
  PulseGeneratedProfileBundle,
  PulseGeneratedProfilePost,
  PulseGeneratedSocialAccount,
  PulsePost,
  PulsePostMediaKind,
  PulseSocialAccountSeed,
} from './pulseTypes'
import { parseSocialAccountsMarkup } from './parseSocialAccountsMarkup'
import { inventHeatLabel, parseTrendingData, type ParsedTrendingTopic } from './parseTrendingMarkup'
import { ensureTrendingTopicPrefix, movePulseTopicHashtagsToFront } from './pulseMentionDetect'
import { characterDynamicsTimeSpanHint, DEFAULT_CHARACTER_DYNAMICS_TIME_SPAN } from './characterDynamicsTime'
import {
  buildCharacterLocationPromptBlock,
  detectRelocationSignalsInContext,
  enforceCharacterLocationConsistency,
  extractWorldviewCityCandidatesFromText,
  mergeLocationAnchorWithPersona,
  rejectPlaceholderMomentLocation,
  resolveCharacterLocationAnchor,
} from '../../../components/moments/momentCharacterLocationAnchor'
import {
  MOMENT_LOCATION_PROMPT_HINT,
  normalizeMomentLocation,
} from '../../../components/moments/momentLocationUtils'
import { pickStablePulseNetizenAvatarPath } from './pulseNetizenAvatar'
import { MBTI_OUTPUT_BAN_SHORT } from '../wechat/mbtiOutputBan'

/** 微博广场所有生成任务共用：可见正文不得出现 MBTI 标签套话 */
const PULSE_MBTI_BAN = MBTI_OUTPUT_BAN_SHORT

/** 有配图时走多模态；无图仍走纯文本 chat */
async function pulseChatMaybeVision(params: {
  apiConfig: ApiConfig
  system: string
  userText: string
  imageDataUrls?: string[]
  temperature?: number
  max_tokens?: number
}): Promise<string> {
  const images = (params.imageDataUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /^data:image\//i.test(u) && /;base64,/i.test(u))
    .slice(0, 4)
  if (!images.length) {
    return openAiCompatibleChat(
      params.apiConfig,
      [
        { role: 'system', content: params.system },
        { role: 'user', content: params.userText },
      ],
      { temperature: params.temperature, max_tokens: params.max_tokens },
    )
  }
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: params.userText }]
  for (const url of images) {
    content.push({ type: 'image_url', image_url: { url } })
  }
  return openAiCompatibleChatAny(
    params.apiConfig,
    [
      { role: 'system', content: params.system },
      { role: 'user', content },
    ],
    { temperature: params.temperature, max_tokens: params.max_tokens },
  )
}

function extractJsonArray(raw: string): unknown[] | null {
  const t = raw.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t)
  const body = fence ? fence[1]!.trim() : t
  const start = body.indexOf('[')
  const end = body.lastIndexOf(']')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(body.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function clip(raw: unknown, max: number): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

const PULSE_USER_COMMENT_AUTHOR_PLACEHOLDERS = new Set([
  '用户',
  '玩家',
  '本人',
  '楼主本人',
  'user',
  'player',
  'me',
])

/** 生成评论禁止以用户/玩家身份发言（可被 @，但不得出现在 authorName） */
function isBlockedPulseUserCommentAuthor(
  authorName: string,
  playerNames: Array<string | null | undefined>,
): boolean {
  const n = authorName.trim()
  if (!n) return true
  const lower = n.toLowerCase()
  if (PULSE_USER_COMMENT_AUTHOR_PLACEHOLDERS.has(n) || PULSE_USER_COMMENT_AUTHOR_PLACEHOLDERS.has(lower)) {
    return true
  }
  for (const raw of playerNames) {
    const p = raw?.trim()
    if (!p) continue
    if (n === p || lower === p.toLowerCase()) return true
  }
  return false
}

function hasApi(cfg: ApiConfig | null | undefined): cfg is ApiConfig {
  return !!(cfg?.apiUrl?.trim() && cfg?.apiKey?.trim())
}

/** 未配置 API 或生成无有效结果时抛出，由 UI 提示用户 */
function requirePulseApi(cfg: ApiConfig | null | undefined): ApiConfig {
  if (!hasApi(cfg)) {
    throw new Error('请先在 API 设置中配置模型后再生成')
  }
  return cfg
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const t = raw.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t)
  const body = fence ? fence[1]!.trim() : t
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(body.slice(start, end + 1))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function clipInt(raw: unknown, min: number, max: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}

function rethrowPulseAiError(e: unknown, fallbackMessage: string): never {
  if (e instanceof Error && e.message.trim()) throw e
  throw new Error(fallbackMessage)
}

export async function aiGeneratePulseFeedPosts(params: {
  apiConfig: ApiConfig | null
  viewerName: string
  count?: number
}): Promise<Array<{ authorName: string; content: string }>> {
  const count = Math.min(8, Math.max(3, params.count ?? 5))
  const apiConfig = requirePulseApi(params.apiConfig)

  const sys = `你是 Lumi Pulse 微博广场的 AI 编导。生成 ${count} 条中文网友动态，风格克制、有文学感，禁止 Unicode emoji 与微博橙红色调用语。
${PULSE_MBTI_BAN}
可使用微博方括号表情（如 [doge][允悲][吃瓜]），每条 0～2 个。
只输出 JSON 数组：[{"authorName":"网名","content":"正文"}]
正文 40～180 字，像真实社交媒体碎片。`
  const user = `当前浏览者：${params.viewerName}。请生成广场动态。`

  try {
    const raw = await openAiCompatibleChat(
      apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.92 },
    )
    const rows = extractJsonArray(raw)
    if (!rows?.length) {
      throw new Error('生成失败：模型未返回有效 JSON')
    }
    const out: Array<{ authorName: string; content: string }> = []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const authorName = clip(r.authorName, 24)
      const content = clip(r.content, 400)
      if (authorName && content) out.push({ authorName, content })
    }
    if (!out.length) {
      throw new Error('生成失败：未解析到有效动态')
    }
    return out.slice(0, count)
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

export type PlayerPostEngagementScale = {
  likeCount: number
  repostCount: number
  commentCount: number
  dmThreadCount: number
  /** 注入评论 AI 的量级说明 */
  engagementHint: string
}

function randEngagementInt(min: number, max: number): number {
  const a = Math.ceil(min)
  const b = Math.floor(max)
  if (b <= a) return a
  return a + Math.floor(Math.random() * (b - a + 1))
}

/** 按粉丝体量抽取用户发帖后的赞/转/评/私信数量（数量本地定，评论文案走 AI） */
export function scalePlayerPostEngagement(followersRaw: number): PlayerPostEngagementScale {
  const followers = Math.max(0, Math.floor(Number(followersRaw) || 0))

  if (followers < 50) {
    const likeCount = randEngagementInt(3, 25)
    return {
      likeCount,
      repostCount: randEngagementInt(0, 2),
      commentCount: randEngagementInt(2, 4),
      dmThreadCount: 0,
      engagementHint: `粉丝约 ${followers || '很少'}（路人量级）：日常帖赞约 3～25，转发极少。`,
    }
  }
  if (followers < 500) {
    const likeCount = randEngagementInt(5, 80)
    return {
      likeCount,
      repostCount: randEngagementInt(0, 5),
      commentCount: randEngagementInt(3, 6),
      dmThreadCount: Math.random() < 0.45 ? 1 : 0,
      engagementHint: `粉丝约 ${followers}（普通量级）：日常帖赞约 5～80，转发很少。`,
    }
  }
  if (followers < 5000) {
    const likeCount = randEngagementInt(80, 800)
    const repostRatio = 0.03 + Math.random() * 0.07
    return {
      likeCount,
      repostCount: Math.max(1, Math.floor(likeCount * repostRatio)),
      commentCount: randEngagementInt(4, 8),
      dmThreadCount: randEngagementInt(1, 2),
      engagementHint: `粉丝约 ${followers}（校园/圈内人气）：日常帖赞约 80～800；转发约赞的 3%～10%。`,
    }
  }
  if (followers < 50_000) {
    const likeCount = randEngagementInt(400, 5000)
    const repostRatio = 0.04 + Math.random() * 0.08
    return {
      likeCount,
      repostCount: Math.max(2, Math.floor(likeCount * repostRatio)),
      commentCount: randEngagementInt(5, 10),
      dmThreadCount: randEngagementInt(2, 3),
      engagementHint: `粉丝约 ${followers}（公众人设）：日常帖赞约 400～5000；转发约赞的 4%～12%。`,
    }
  }
  const likeCount = randEngagementInt(3000, 30_000)
  const repostRatio = 0.05 + Math.random() * 0.1
  return {
    likeCount,
    repostCount: Math.max(5, Math.floor(likeCount * repostRatio)),
    commentCount: randEngagementInt(6, 12),
    dmThreadCount: randEngagementInt(2, 3),
    engagementHint: `粉丝约 ${followers}（高热度）：日常帖赞约数千～数万；转发约赞的 5%～15%。`,
  }
}

export type PulseCommentThreadEngagementScale = {
  /** 网友楼中楼接话条数（本地按粉丝体量抽取） */
  netizenReplyCount: number
  characterReplyMin: number
  characterReplyMax: number
  engagementHint: string
}

/** 评区楼中楼接话：粉丝多讨论多，粉丝少则冷清 */
export function scalePulseCommentThreadEngagement(followersRaw: number): PulseCommentThreadEngagementScale {
  const followers = Math.max(0, Math.floor(Number(followersRaw) || 0))

  if (followers < 50) {
    return {
      netizenReplyCount: randEngagementInt(0, 3),
      characterReplyMin: 1,
      characterReplyMax: 2,
      engagementHint: `粉丝约 ${followers || '很少'}（路人量级）：楼中楼一般冷清，路人围观 0～3 条即可，不必硬凑热闹。`,
    }
  }
  if (followers < 500) {
    return {
      netizenReplyCount: randEngagementInt(1, 5),
      characterReplyMin: 1,
      characterReplyMax: 2,
      engagementHint: `粉丝约 ${followers}（普通量级）：楼中楼偶尔有人接话，路人 1～5 条为宜。`,
    }
  }
  if (followers < 5000) {
    return {
      netizenReplyCount: randEngagementInt(3, 10),
      characterReplyMin: 1,
      characterReplyMax: 3,
      engagementHint: `粉丝约 ${followers}（校园/圈内人气）：楼中楼较活跃，路人可 3～10 条，可有楼中楼互怼。`,
    }
  }
  if (followers < 50_000) {
    return {
      netizenReplyCount: randEngagementInt(6, 16),
      characterReplyMin: 1,
      characterReplyMax: 4,
      engagementHint: `粉丝约 ${followers}（公众人设）：楼中楼热闹，路人 6～16 条，吃瓜/粉黑/附和混搭。`,
    }
  }
  return {
    netizenReplyCount: randEngagementInt(12, 35),
    characterReplyMin: 2,
    characterReplyMax: 6,
    engagementHint: `粉丝约 ${followers}（高热度）：楼中楼很热闹，路人可 12～35 条，节奏快、口吻多样。`,
  }
}

export async function aiGeneratePulseComments(params: {
  apiConfig: ApiConfig | null
  post: Pick<PulsePost, 'authorName' | 'content'>
  count?: number
  /** 粉丝量级说明；用户发帖自动互动时注入 */
  engagementHint?: string
  /** 禁止写成评论昵称的别名（微博昵称等） */
  blockedAuthorNames?: string[]
  /**
   * 当前剧情线公开形象 +（可选）身份底色。
   * 有剧情线时粉丝须按公开形象聊，勿把冲突的身份细节当人设。
   */
  playerPublicContext?: string
  /** 配图可见说明（描述或「有图无描述」） */
  postMediaBrief?: string
  /**
   * 帖子真实配图 data URL（本地上传图）；有则走 vision，模型须看图评论。
   * 无文字描述的本地图必须靠此字段，不能只靠 postMediaBrief。
   */
  postImageDataUrls?: string[]
  /** 身份真实姓名：须注入模型；评论点名优先用其衍生昵称，不必死喊全名 */
  playerRealName?: string
  /** 微博昵称：禁当面称呼 */
  playerWeiboNickname?: string
  /** 对外认证：可聊人设，禁止当口头称呼 */
  playerVerifyLabel?: string
}): Promise<Array<{ authorName: string; content: string; parentHint?: string; likeCount?: number }>> {
  const count = Math.min(12, Math.max(2, params.count ?? 6))
  const apiConfig = requirePulseApi(params.apiConfig)
  const engagementHint =
    params.engagementHint?.trim() ||
    '粉丝量级未知：评论 likeCount 宜偏日常路人（个位～百）。'
  const publicCtx = params.playerPublicContext?.trim() ?? ''
  const mediaBrief = params.postMediaBrief?.trim() ?? ''
  const visionImages = (params.postImageDataUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /^data:image\//i.test(u) && /;base64,/i.test(u))
  const hasVision = visionImages.length > 0
  const realName = params.playerRealName?.trim() || ''
  const weiboNick = params.playerWeiboNickname?.trim() || ''
  const verify = params.playerVerifyLabel?.trim() || ''
  const blocked = [
    params.post.authorName.trim(),
    weiboNick,
    ...(params.blockedAuthorNames ?? []).map((n) => n.trim()).filter(Boolean),
  ]

  const addressRules = realName
    ? `- 【当面称呼｜最高优先级】模型须知道用户身份真实姓名是「${realName}」，但**不必死喊全名**。点名时优先用由其衍生的口语昵称（如小顾、顾哥、顾老公、阿X、名字后缀等，按关系远近自然选），或只用「你」；全名可偶发，勿篇篇官称。禁止用微博昵称${weiboNick ? `「${weiboNick}」` : ''}；禁止把认证称号${verify ? `「${verify}」` : ''}当口头称呼（如「XX C位」「新晋C位」）。`
    : `- 【当面称呼】优先用「你」；禁止用微博昵称/认证称号当口头称呼。`

  const hasMedia = hasVision || Boolean(mediaBrief)
  const mediaRules = hasVision
    ? `- 【配图实拍｜最高优先级】用户消息附带 ${visionImages.length} 张真实配图（本地上传），你能看见画面。评论必须点出可见细节（人物表情/动作/服饰/场景/道具/字幕等），禁止假装只有文字、禁止空说「有图」「截图」而不谈画面；禁止编造看不清的细节。`
    : mediaBrief
      ? `- 【配图可见｜最高优先级】用户消息含配图说明：粉丝能看到画面。评论必须承接配图内容/氛围（吐槽截图、问图里谁、接梗等）；禁止假装只有文字短句、禁止嘲「没头没尾/就几个字」而忽略配图。`
      : `- 【无配图｜最高优先级】本帖只有文字，没有任何配图/截图/自拍。禁止提「配图」「图里」「照片里」「自拍」及任何臆造画面细节；只能接正文语气与公开形象，勿把人设档案里的外貌描写当成帖图。`

  const sys = `你是 Lumi Pulse 评论区 AI。针对用户刚发出的一条微博生成恰好 ${count} 条网友评论。
${PULSE_MBTI_BAN}
要求：
- 约一半为一级评论（不要写 parentHint）；
- 其余写 parentHint=被回复者昵称；
- 当总数≥4时，至少 1 组楼中楼：先一级 → 某人 parentHint 指向该一级 → 第三人 parentHint 指向刚才那条二级昵称（接话/杠精/附和均可）；
- 当总数≥6时，再多来 1 组不同楼中楼。
- 评论 likeCount 须贴合量级：${engagementHint}
${mediaRules}
${addressRules}
${
  publicCtx
    ? `- 【粉丝眼中的博主】须按用户消息中的「当前剧情线公开形象」理解量级与处境（如艺人/素人）。身份档案只作底色；冲突细节勿当聊天主线，除非帖文${hasMedia ? '或配图' : ''}明确相关。
- 粉丝口吻须匹配公开形象量级：素人路人帖偏日常；公众/艺人帖可有追星感，但仍要像真评论。`
    : ''
}
只输出 JSON：[{"authorName":"昵称","content":"评论","parentHint":"可选","likeCount":数字}]
likeCount 为非负整数（直接写数字，勿写 w/万）；禁止 Unicode emoji；可用微博方括号表情如 [doge][允悲]，每条 0～1 个。语气真实多样，像刚刷到新帖。
硬性：authorName 只能是随机网友昵称；禁止「用户」「玩家」「本人」或博主「${params.post.authorName}」本人；禁止用${
    blocked.filter(Boolean).length > 1
      ? `以下昵称：${[...new Set(blocked.filter(Boolean))].join('、')}`
      : `博主昵称`
  }。`
  const postBodyLabel = params.post.content.trim() || (hasMedia ? '（配图/无文字）' : '（无文字）')
  const user = `博主展示名：${params.post.authorName}
正文：${postBodyLabel}
${
  hasVision
    ? `\n【配图｜共 ${visionImages.length} 张｜已附在本消息中，请直接看图】\n粉丝刷到时能看见这些画面；请按画面写评论。\n`
    : mediaBrief
      ? `\n【配图｜粉丝可见】\n${mediaBrief.slice(0, 2_500)}\n`
      : `\n【媒体】本帖无配图。\n`
}
${realName ? `身份真实姓名（须知晓；点名优先用其衍生昵称，不必死喊全名）：${realName}\n` : ''}${
  weiboNick && weiboNick !== realName ? `微博昵称（禁止当面称呼）：${weiboNick}\n` : ''
}${verify ? `对外认证（可聊人设，禁止当口头称呼）：${verify}\n` : ''}${
  publicCtx
    ? `\n【当前剧情线公开形象｜量级/处境以此为准；当面称呼从真实姓名衍生，勿用微博昵/认证称号】\n${publicCtx.slice(0, 8_000)}\n`
    : ''
}`

  try {
    const raw = await pulseChatMaybeVision({
      apiConfig,
      system: sys,
      userText: user,
      imageDataUrls: visionImages,
      temperature: 0.9,
    })
    const rows = extractJsonArray(raw)
    if (!rows?.length) {
      throw new Error('生成失败：模型未返回有效 JSON')
    }
    const out: Array<{ authorName: string; content: string; parentHint?: string; likeCount?: number }> = []
    const blockedLower = new Set(blocked.map((n) => n.toLowerCase()).filter(Boolean))
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const authorName = clip(r.authorName, 24)
      const content = clip(r.content, 280)
      if (!authorName || !content) continue
      if (
        isBlockedPulseUserCommentAuthor(authorName, blocked) ||
        blockedLower.has(authorName.toLowerCase())
      ) {
        continue
      }
      const parentHint = clip(r.parentHint, 24) || undefined
      const likeCount = clipInt(r.likeCount, 0, 9_999_999)
      out.push({ authorName, content, parentHint, likeCount })
    }
    if (!out.length) {
      throw new Error('生成失败：未解析到有效评论')
    }
    return out.slice(0, count)
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

export type PulseCharacterPostReactionDraft = {
  characterId: string
  like: boolean
  comment?: string
  delaySeconds: number
}

/**
 * 用户发帖后：可见绑定角色以本人身份点赞/评论（非路人网友）。
 * 输出 JSON：{"actions":[{"charId":"...","like":true,"comment":"可选","delaySeconds":60},...]}
 */
export async function aiGeneratePulseCharacterPostReactions(params: {
  apiConfig: ApiConfig | null
  post: Pick<PulsePost, 'authorName' | 'content'>
  playerDisplayName: string
  characters: Array<{
    characterId: string
    name: string
    personaSummary?: string
    /** 该角色剧情线里认识的用户公开形象 */
    knownUserOnTheirLine?: string
  }>
  /** 用户当前剧情线公开形象（发帖时呈现给路人的样子） */
  activePlotPublicSummary?: string
  /** 融合模式：允许跨线认知冲突 */
  fusionMode?: boolean
  /** 配图文字说明（无实图时的兜底） */
  postMediaBrief?: string
  /** 帖子真实配图 data URL；有则走 vision */
  postImageDataUrls?: string[]
}): Promise<PulseCharacterPostReactionDraft[]> {
  const apiConfig = requirePulseApi(params.apiConfig)
  const fusion = params.fusionMode === true
  const activePublic = params.activePlotPublicSummary?.trim() || ''
  const mediaBrief = params.postMediaBrief?.trim() || ''
  const visionImages = (params.postImageDataUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /^data:image\//i.test(u) && /;base64,/i.test(u))
  const hasVision = visionImages.length > 0
  const chars = params.characters
    .map((c) => ({
      characterId: c.characterId.trim(),
      name: c.name.trim() || '角色',
      personaSummary: c.personaSummary?.trim() || '',
      knownUserOnTheirLine: c.knownUserOnTheirLine?.trim() || '',
    }))
    .filter((c) => c.characterId)
  if (!chars.length) return []

  const roster = chars
    .map((c, i) => `${i + 1}. charId=${c.characterId}｜昵称=${c.name}`)
    .join('\n')
  const personaBlocks = chars
    .map((c) => {
      const body = c.personaSummary.slice(0, 1600) || `（${c.name}：人设摘要缺失，按普通人设克制发挥）`
      const known = c.knownUserOnTheirLine
        ? `\n【你与用户这条剧情线里认识的用户】${c.knownUserOnTheirLine}`
        : ''
      return `——\n【角色 ${c.name}｜charId=${c.characterId}】\n${body}${known}`
    })
    .join('\n')

  const userName = params.playerDisplayName.trim() || params.post.authorName.trim() || '用户'
  const hasMedia = hasVision || Boolean(mediaBrief)
  const mediaRule = hasVision
    ? `3. comment 可省略或空串（只点赞）；若写评论：1～2 句口语，**必须承接配图可见细节**（表情/动作/场景等）与正文，禁止「看到了」「收到」「不错哦」空话，禁止假装看不见图。`
    : mediaBrief
      ? `3. comment 可省略或空串（只点赞）；若写评论：1～2 句口语，承接正文具体内容/情绪与配图说明，禁止「看到了」「收到」「不错哦」空话。`
      : `3. comment 可省略或空串（只点赞）；若写评论：1～2 句口语，只承接正文语气/情绪；【无配图】禁止提「配图」「图里」及臆造画面细节。`

  const sys = `你是 Lumi Pulse 微博评区编导。用户刚发了微博，请让【允许名单】里的角色以本人身份做出自然反应（点赞 / 评论）。
${PULSE_MBTI_BAN}
只输出 JSON（不要 Markdown）：
{"actions":[{"charId":"角色ID","like":true或false,"comment":"可选评论文案","delaySeconds":数字},...]}

硬性规则：
1. charId 必须与名单完全一致；不可发明名单外角色。
2. 每位角色最多 1 条 action；不必人人都评，但至少约一半角色 like=true。
${mediaRule}
4. 语气必须贴合该角色人设；禁止客服腔、网红模板、翻译腔。
5. delaySeconds 为刷到帖后的秒数，范围 25～480，彼此错开。
6. 禁止 Unicode emoji；可用微博方括号表情如 [doge][允悲]，每条评论最多 1 个。
7. 评论是对用户「${userName}」说的；禁止角色自称用户或替用户说话。
${
  hasVision
    ? '8. 【配图实拍｜最高优先级】用户消息附带真实配图，你能看见画面；角色评论须像真的刷到这张图一样接话。'
    : hasMedia
      ? '8. 【配图可见】须承接配图说明，禁止假装只有文字。'
      : '8. 【无配图｜最高优先级】本帖只有文字；禁止编造配图/自拍画面。'
}
${
  fusion
    ? `9. 【融合模式｜跨线认知】用户当前公开形象可能与「该角色剧情线里认识的用户」不同。若两者冲突（例如你线里 TA 是小透明，但帖文像艺人跑通告），须按你线认知写出疑惑/吐槽/试探/调侃，禁止假装一直知道 TA 是公众人物。
10. 若该角色线认知与公开形象一致，则正常互动即可。`
    : `9. 按当前剧情线理解用户公开形象即可。`
}`

  const user = `用户微博昵称：${userName}
正文：${params.post.content.trim() || (hasMedia ? '（配图/无文字）' : '（无文字）')}
${
  hasVision
    ? `\n【配图｜共 ${visionImages.length} 张｜已附在本消息中，请直接看图】\n`
    : mediaBrief
      ? `\n【配图说明】\n${mediaBrief.slice(0, 1_200)}\n`
      : `\n【媒体】本帖无配图。\n`
}
${activePublic ? `\n【用户当前剧情线公开形象｜帖文对外呈现】\n${activePublic.slice(0, 1200)}\n` : ''}
【允许名单】
${roster}

【人设参考】
${personaBlocks}

请生成 actions JSON。`

  try {
    const raw = await pulseChatMaybeVision({
      apiConfig,
      system: sys,
      userText: user,
      imageDataUrls: visionImages,
      temperature: 0.86,
    })
    const obj = extractJsonObject(raw)
    const actions = Array.isArray(obj?.actions) ? obj!.actions : null
    if (!actions?.length) throw new Error('生成失败：未返回角色互动')

    const allowed = new Set(chars.map((c) => c.characterId))
    const out: PulseCharacterPostReactionDraft[] = []
    const seen = new Set<string>()
    for (const row of actions) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const characterId = clip(r.charId ?? r.characterId, 80)
      if (!characterId || !allowed.has(characterId) || seen.has(characterId)) continue
      seen.add(characterId)
      const like = r.like === true || r.like === 'true' || r.like === 1
      const comment = clip(r.comment, 280)
      const delayRaw = Number(r.delaySeconds)
      const delaySeconds = Number.isFinite(delayRaw)
        ? Math.min(480, Math.max(25, Math.round(delayRaw)))
        : 40 + out.length * 55
      if (!like && !comment) continue
      out.push({
        characterId,
        like: like || Boolean(comment),
        comment: comment || undefined,
        delaySeconds,
      })
    }
    return out
  } catch (e) {
    rethrowPulseAiError(e, '角色互动生成失败')
  }
}

/**
 * 针对用户刚发出的某条评论，生成网友讨论回复（挂在该评论下，可含楼中楼）。
 */
export async function aiGeneratePulseNetizenReplies(params: {
  apiConfig: ApiConfig | null
  post: Pick<PulsePost, 'authorName' | 'content'>
  userComment: { authorName: string; content: string }
  /** 期望生成的路人回复条数；由 scalePulseCommentThreadEngagement 按粉丝体量决定 */
  count?: number
  /** 粉丝量级说明，引导模型把握讨论热度 */
  engagementHint?: string
  /** 身份真实姓名：当面称呼从其衍生；勿用微博昵称喊人 */
  playerRealName?: string
  /** 微博昵称：禁止当面称呼 */
  playerWeiboNickname?: string
  /** 楼中楼上下文：角色刚接过话时，网友可继续围观讨论 */
  threadContext?: {
    /** 禁止冒充的昵称（角色微博名等） */
    bannedAuthorNames?: string[]
    /** 已出现、可作 parentHint 目标的发言 */
    priorReplies?: Array<{ authorName: string; content: string }>
    /**
     * 楼中楼锚点：
     * - char：用户正在回复该认证角色（须读懂用户↔角色）
     * - char_top：角色刚发了一级评论，路人在其下围观讨论
     * - netizen：用户正在回复某网友
     */
    replyTarget?: {
      authorName: string
      content: string
      kind: 'char' | 'char_top' | 'netizen'
    }
  }
}): Promise<Array<{ authorName: string; content: string; parentHint?: string; likeCount?: number }>> {
  const count = Math.max(0, Math.floor(params.count ?? 0))
  if (count <= 0) return []
  const apiConfig = requirePulseApi(params.apiConfig)
  const userName = params.userComment.authorName.trim() || '用户'
  const userContent = params.userComment.content.trim()
  const engagementHint = params.engagementHint?.trim() || ''
  const realName = params.playerRealName?.trim() || ''
  const weiboNick = params.playerWeiboNickname?.trim() || ''
  const replyTarget = params.threadContext?.replyTarget
    ? {
        authorName: params.threadContext.replyTarget.authorName.trim(),
        content: params.threadContext.replyTarget.content.trim(),
        kind: params.threadContext.replyTarget.kind,
      }
    : null
  const banned = [
    userName,
    params.post.authorName.trim(),
    realName,
    weiboNick,
    ...(params.threadContext?.bannedAuthorNames ?? []).map((n) => n.trim()).filter(Boolean),
  ]
  const prior = (params.threadContext?.priorReplies ?? [])
    .map((r) => ({
      authorName: r.authorName.trim(),
      content: r.content.trim(),
    }))
    .filter((r) => r.authorName && r.content)
  const priorNames = [...new Set(prior.map((r) => r.authorName))]
  const priorBlock = prior.length
    ? `\n本楼此前已有：\n${prior.map((r) => `- 「${r.authorName}」：${r.content}`).join('\n')}\n`
    : ''
  const priorHintRule = priorNames.length
    ? `2. 其余也可 parentHint="${userName}"，或指向本批更早网友昵称，或指向本楼已有发言者（${priorNames.join('、')}）形成楼中楼。`
    : `2. 其余也可 parentHint="${userName}"，或指向本批更早出现的网友昵称形成楼中楼（接话/杠/附和/追问）。`
  const threadDepthRule =
    count >= 4
      ? `3. 当讨论较热时，至少 1 组楼中楼（有人回复该条后，再有人回复那条网友${priorNames.length ? '或本楼角色' : ''}）。`
      : `3. 讨论条数少时保持精简，不必硬凑楼中楼。`
  const addressRule = realName
    ? replyTarget?.kind === 'char_top'
      ? `7. 【当面称呼｜最高优先级】若点名真人博主：须知晓真实姓名「${realName}」，优先用其衍生口语昵称（小顾、顾哥、阿X 等）或「你」；禁止用微博昵称${weiboNick ? `「${weiboNick}」` : ''}招呼；禁止用认证称号当口头名字。`
      : `7. 【当面称呼｜最高优先级】若点名真人用户：须知晓真实姓名「${realName}」，优先用其衍生口语昵称（小顾、顾哥、阿X 等）或「你」；禁止用微博昵称${weiboNick ? `「${weiboNick}」` : ''}招呼；禁止用认证称号当口头名字。评区显示名「${userName}」只是楼里昵称，不要当真人全名喊。`
    : `7. 【当面称呼】点名时优先用「你」；禁止用微博昵称/认证称号当口头称呼。`

  const replyTargetBlock =
    replyTarget?.kind === 'char_top' && replyTarget.authorName
      ? `
【楼中楼关系｜最高优先级｜必读】
- 认证角色「${replyTarget.authorName}」刚在本帖下发了一级评论（不是用户本人）：${replyTarget.content || '（空）'}
- 请生成**其他路人网友**挂在该角色评论下的讨论：吃瓜、起哄、接梗、追问、嗑糖、吐槽粉味均可。
- 大家都知道这是角色「${replyTarget.authorName}」发的；禁止当成普通路人自言自语，禁止装看不见认证身份。
- 可点名角色微博昵称讨论，但**禁止冒充**该角色发言（authorName 不得写成角色名；parentHint 可指向角色或本批网友）。
- 可顺带聊博主与该角色的互动气氛，但主线仍是接角色这条评论。
`
      : replyTarget?.kind === 'char' && replyTarget.authorName
        ? `
【楼中楼关系｜最高优先级｜必读】
- 评区显示名「${userName}」这条评论，是在**回复认证角色「${replyTarget.authorName}」**，不是自言自语，也不是跟空气对话。
- 角色「${replyTarget.authorName}」原评：${replyTarget.content || '（空）'}
- 用户（显示名「${userName}」）的回复：${userContent || '（空）'}
- 围观网友必须读懂这对互动：用户话里的「你 / 老师 / 哥 / 姐 / 许老师」等，通常指的就是角色「${replyTarget.authorName}」。
- 可以吃瓜、起哄、帮腔、嗑糖、吐槽粉味、追问细节，但**禁止**假装不知道用户在跟谁说话，**禁止**写成「你在跟谁彼此彼此 / 幻觉 / 莫名其妙」这类把用户当神经病的无厘头接话。
- 可点名角色微博昵称「${replyTarget.authorName}」讨论，但禁止冒充该角色发言（parentHint 可指向用户或本批网友，勿冒充角色写 authorName）。
`
        : replyTarget?.authorName
          ? `
【楼中楼关系】
- 「${userName}」是在回复「${replyTarget.authorName}」：${replyTarget.content || '（空）'}
- 围观须承接这对互动，勿当成无对象乱评。
`
          : ''

  const speakerRule =
    replyTarget?.kind === 'char_top'
      ? `5. 生成的全部是**其他路人网友**回复：禁止以博主「${params.post.authorName}」或角色「${replyTarget?.authorName ?? ''}」身份发言；禁止替用户本人再写一条。`
      : replyTarget?.kind === 'char'
        ? `5. 生成的全部是**其他路人网友**回复：禁止替「${userName}」本人再写一条，禁止以博主「${params.post.authorName}」或角色「${replyTarget.authorName}」身份发言；网友可以讨论这对用户↔角色互动。`
        : `5. 生成的全部是**其他路人网友**回复：禁止替「${userName}」本人再写一条，也禁止以博主「${params.post.authorName}」身份发言${priorNames.length ? `，禁止冒充「${priorNames.join('」「')}」` : ''}。将该发言者「${userName}」视为普通冲浪网友（评区显示名），禁止当成平台运营。`

  const sys = `你是 Lumi Pulse 评论区路人讨论生成器。评论区刚出现一条评论，请生成约 ${count} 条其他网友回复来接话讨论（可略多略少，贴合热度）。
${PULSE_MBTI_BAN}
${engagementHint ? `【热度参考】${engagementHint}\n` : ''}
硬性规则：
1. 第一条必须 parentHint="${userName}"（直接回复该条评论）。
${priorHintRule}
${threadDepthRule}
4. 禁止把网友昵称写成与「${banned.filter(Boolean).join('」「')}」相同；禁止再用「用户」「玩家」「本人」等占位昵称；禁止 Unicode emoji；可用 [doge][允悲]。
${speakerRule}
6. ${addressRule.replace(/^\d+\.\s*/, '')}
只输出 JSON：[{"authorName":"昵称","content":"评论","parentHint":"必填或指向更早昵称","likeCount":数字}]`

  const user = `微博博主：${params.post.authorName}
微博正文：${params.post.content}
${realName ? `用户真实姓名（须知晓；称呼优先衍生昵称，勿死喊全名）：${realName}\n` : ''}${
    weiboNick && weiboNick !== realName ? `用户微博昵称（禁止当面称呼）：${weiboNick}\n` : ''
  }${replyTargetBlock}${priorBlock}
${
  replyTarget?.kind === 'char_top'
    ? `认证角色「${userName}」刚发出的一级评论：
${userContent}

请生成约 ${count} 条路人网友挂在该角色评论下的讨论回复。再次强调：这是角色本人发评，围观要接得上，禁止冒充角色。`
    : `评区显示名「${userName}」刚发出的评论：
${userContent}

请生成约 ${count} 条其他网友围绕该评论${
        replyTarget?.kind === 'char'
          ? `（以及用户与认证角色「${replyTarget.authorName}」的互动）`
          : prior.length
            ? '与本楼已有回复'
            : ''
      }的讨论回复。${
        replyTarget?.kind === 'char'
          ? '再次强调：大家都看得懂用户是在回那位角色，不要写成无对象接话。'
          : ''
      }`
}`

  try {
    const raw = await openAiCompatibleChat(
      apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.92 },
    )
    const rows = extractJsonArray(raw)
    if (!rows?.length) {
      throw new Error('生成失败：模型未返回有效 JSON')
    }
    const bannedSet = new Set(banned.map((n) => n.toLowerCase()).filter(Boolean))
    const out: Array<{ authorName: string; content: string; parentHint?: string; likeCount?: number }> = []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const authorName = clip(r.authorName, 24)
      const content = clip(r.content, 280)
      if (!authorName || !content) continue
      if (
        bannedSet.has(authorName.toLowerCase()) ||
        isBlockedPulseUserCommentAuthor(authorName, [userName, ...banned])
      ) {
        continue
      }
      let parentHint = clip(r.parentHint, 24) || userName
      out.push({
        authorName,
        content,
        parentHint,
        likeCount: clipInt(r.likeCount, 0, 9_999_999),
      })
    }
    if (!out.length) {
      throw new Error('生成失败：未解析到有效回复')
    }
    // 确保首条挂在用户评论下
    out[0] = { ...out[0]!, parentHint: userName }
    return out
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

/**
 * 用户回复了某角色的评论后：该角色以本人身份接话（楼中楼条数随粉丝体量浮动）。
 */
export async function aiGeneratePulseCharacterCommentReply(params: {
  apiConfig: ApiConfig | null
  post: Pick<PulsePost, 'authorName' | 'content'>
  character: { characterId: string; name: string; personaSummary?: string }
  /** @deprecated 仅兼容；称呼请用 playerRealName */
  playerDisplayName?: string
  /** 身份真实姓名：当面称呼从其衍生 */
  playerRealName?: string
  /** 微博昵称：禁止当面称呼 */
  playerWeiboNickname?: string
  /** 被用户点进回复的那条角色评论 */
  targetComment: { authorName: string; content: string }
  /** 用户刚发出的回复 */
  userReply: { authorName: string; content: string }
  postMediaBrief?: string
  postImageDataUrls?: string[]
  characterReplyMin?: number
  characterReplyMax?: number
  engagementHint?: string
}): Promise<string[]> {
  const apiConfig = requirePulseApi(params.apiConfig)
  const charName = params.character.name.trim() || '角色'
  const persona = params.character.personaSummary?.trim().slice(0, 1600) || `（${charName}：按普通人设克制发挥）`
  const realName =
    params.playerRealName?.trim() ||
    params.playerDisplayName?.trim() ||
    '用户'
  const weiboNick = params.playerWeiboNickname?.trim() || ''
  const replyAuthorLabel = params.userReply.authorName.trim() || '用户'
  const targetText = params.targetComment.content.trim()
  const userText = params.userReply.content.trim()
  const mediaBrief = params.postMediaBrief?.trim() || ''
  const replyMin = Math.max(1, Math.floor(params.characterReplyMin ?? 1))
  const replyMax = Math.max(replyMin, Math.floor(params.characterReplyMax ?? 2))
  const engagementHint = params.engagementHint?.trim() || ''
  const visionImages = (params.postImageDataUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /^data:image\//i.test(u) && /;base64,/i.test(u))
  const hasVision = visionImages.length > 0

  const sys = `你是 Lumi Pulse 微博评区编导。用户刚在评论区回复了角色「${charName}」的一条评论，请以该角色本人身份接话（楼中楼）。
${PULSE_MBTI_BAN}
${engagementHint ? `【热度参考】${engagementHint}\n` : ''}
只输出 JSON：{"replies":["回复1","回复2",...]}

硬性规则：
1. 仅以「${charName}」身份发言；禁止替用户或其他网友说话。
2. replies 约 ${replyMin}～${replyMax} 条（可在此范围内随意发挥，热度高可偏多、话题简单可偏少）；每条 1～2 句口语，直接回应用户刚才说的话，可顺带点一下原帖。
3. 语气必须贴合人设；禁止客服腔、网红模板、翻译腔。
4. 禁止 Unicode emoji；可用 [doge][允悲] 等微博表情，每条最多 1 个。
5. 【当面称呼｜最高优先级】须知晓用户真实姓名「${realName}」，点名时优先用由其衍生的口语昵称（小顾、顾哥、顾老公、阿X 等，按关系远近）或「你」；全名可偶用，勿篇篇官称。**严禁**用微博昵称${weiboNick ? `「${weiboNick}」` : ''}招呼用户；**严禁**把认证/舞台称号当口头名字。楼里显示名「${replyAuthorLabel}」可能是匿名网名，不要把它当真人姓名喊。
${
  hasVision
    ? '6. 帖子附有真实配图时可自然承接画面细节，勿假装看不见。'
    : mediaBrief
      ? '6. 可自然承接配图说明，勿假装看不见图。'
      : '6. 【无配图】本帖只有文字；接话勿提配图/图里画面。'
}`

  const hasMedia = hasVision || Boolean(mediaBrief)
  const user = `微博博主：${params.post.authorName}
微博正文：${params.post.content.trim() || (hasMedia ? '（配图/无文字）' : '（无文字）')}
用户真实姓名（须知晓；称呼优先衍生昵称）：${realName}
${weiboNick && weiboNick !== realName ? `用户微博昵称（禁止当面称呼）：${weiboNick}\n` : ''}${
    hasVision
      ? `\n【配图｜共 ${visionImages.length} 张｜已附在本消息中】\n`
      : mediaBrief
        ? `\n【配图说明】\n${mediaBrief.slice(0, 800)}\n`
        : `\n【媒体】本帖无配图。\n`
  }
【角色人设】
${persona}

【${charName} 原先的评论】
${targetText || '（空）'}

【用户回复 ${charName}｜评区显示名「${replyAuthorLabel}」，真人是「${realName}」】
${userText || '（空）'}

请生成 ${charName} 的接话 JSON（约 ${replyMin}～${replyMax} 条）。勿用微博昵称喊用户。`

  try {
    const raw = await pulseChatMaybeVision({
      apiConfig,
      system: sys,
      userText: user,
      imageDataUrls: visionImages,
      temperature: 0.88,
    })
    const obj = extractJsonObject(raw)
    const rows = Array.isArray(obj?.replies) ? obj!.replies : null
    if (!rows?.length) throw new Error('生成失败：未返回角色回复')
    const out: string[] = []
    for (const row of rows) {
      const text = clip(typeof row === 'string' ? row : (row as Record<string, unknown>)?.content, 280)
      if (text) out.push(text)
      if (out.length >= replyMax) break
    }
    if (!out.length) throw new Error('生成失败：角色回复为空')
    return out
  } catch (e) {
    rethrowPulseAiError(e, '角色回复生成失败')
  }
}

const TRENDING_STYLE_GUIDE: Record<string, string> = {
  mixed: '混杂舆论：吃瓜、通稿、粉黑、围观混搭，口吻多样。',
  gossip: '吃瓜吐槽：起哄围观、段子感强，少正经分析。',
  fandom:
    '纯粉夸夸：仅角色与用户的粉丝群体视角，全是正向安利、宠粉、截图夸夸与感动安利；禁止阴阳、拉踩、对线、黑粉、带节奏或任何恶意措辞。',
  roast: '阴阳拉踩：阴阳怪气、带节奏、杠精感明显。',
  formal: '通稿风：营销号、官媒腔、标题党式表述偏多。',
  calm: '理性讨论：克制、分析、少情绪宣泄。',
}

const TRENDING_STYLE_LABEL: Record<string, string> = {
  mixed: '混杂舆论',
  gossip: '吃瓜吐槽',
  fandom: '纯粉夸夸',
  roast: '阴阳拉踩',
  formal: '通稿风',
  calm: '理性讨论',
}

export async function aiGeneratePulseTrending(params: {
  apiConfig: ApiConfig | null
  povName: string
  povContext?: string
  /** 热搜话题条数，默认 4，范围 1～8 */
  count?: number
  /** 每条热搜下的讨论帖数量，默认 3，范围 1～6 */
  postsPerTopic?: number
  /** 每帖评论区互动总数（一级+二级），默认 4，范围 1～12 */
  commentsPerPost?: number
  /** 讨论帖风格 id，见 TRENDING_STYLE_GUIDE（兼容单选） */
  style?: string
  /** 讨论风格多选；优先于 style */
  styles?: string[]
  /** 用户自定义生成要求 */
  customRequirements?: string
  /** 允许的帖形态：text / text_image / image（多选） */
  postKinds?: Array<'text' | 'text_image' | 'image'>
  /** 可 @ 的昵称名单（角色名、用户微博昵称等） */
  mentionTargets?: string[]
  /** 当前用户微博展示名（优先被合理艾特）；关闭纳入用户身份时勿传 */
  playerDisplayName?: string
  /** 是否纳入用户身份；false 时禁止写用户相关内容 */
  includePlayerIdentity?: boolean
}): Promise<ParsedTrendingTopic[]> {
  const count = Math.min(8, Math.max(1, params.count ?? 4))
  const postsPerTopic = Math.min(6, Math.max(1, params.postsPerTopic ?? 3))
  const commentsPerPost = Math.min(12, Math.max(1, params.commentsPerPost ?? 4))
  const styleKeys = (
    params.styles?.length
      ? params.styles
      : params.style
        ? [params.style]
        : ['mixed']
  )
    .map((s) => s.trim())
    .filter(Boolean)
  const uniqueStyles = [...new Set(styleKeys.length ? styleKeys : ['mixed'])]
  const styleGuide = uniqueStyles
    .map((key) => TRENDING_STYLE_GUIDE[key] ?? TRENDING_STYLE_GUIDE.mixed)
    .filter(Boolean)
    .join('；')
  const styleLabels = uniqueStyles
    .map((key) => TRENDING_STYLE_LABEL[key] ?? key)
    .join('、')
  const custom = params.customRequirements?.trim().slice(0, 400) ?? ''
  const apiConfig = requirePulseApi(params.apiConfig)
  const includePlayer = params.includePlayerIdentity !== false
  const playerName = includePlayer ? params.playerDisplayName?.trim() || '' : ''
  const playerAuthorBlocklist = [playerName, params.playerDisplayName]

  const kindSet = new Set(
    (params.postKinds?.length ? params.postKinds : (['text', 'text_image', 'image'] as const)).filter(
      (k) => k === 'text' || k === 'text_image' || k === 'image',
    ),
  )
  if (!kindSet.size) kindSet.add('text')
  const allowText = kindSet.has('text')
  const allowTextImage = kindSet.has('text_image')
  const allowImage = kindSet.has('image')
  const kindLabels = [
    allowText ? '纯文字' : '',
    allowTextImage ? '文字+图片' : '',
    allowImage ? '纯图片' : '',
  ]
    .filter(Boolean)
    .join('、')

  const mediaRules: string[] = [
    `10. 【帖形态】每帖须写「类型：」且仅从以下取值混排：${kindLabels}。`,
  ]
  if (allowText) {
    mediaRules.push('   - 类型：纯文字 → 只写正文，不要写配图字段。')
  }
  if (allowTextImage) {
    mediaRules.push(
      '   - 类型：文字+图片 → 写正文，并写「配图：」下列出 1～9 条**通俗中文**画面描述（每行一条，仅占位展示给用户；例：「顾湛琛拿着一盒草莓牛奶对镜自拍，一只手比耶」；不要输出真实图片 URL；**禁止**写英文 SD tag / 生图提示词）。',
    )
  }
  if (allowImage) {
    mediaRules.push(
      '   - 类型：纯图片 → 正文可空或极短（≤15字），必须写「配图：」1～9 条通俗中文画面描述；不要输出真实图片 URL；不要另写生图提示词。',
    )
  }
  mediaRules.push(
    '11. 配图只写给用户看的**通俗中文**画面描述（像跟人说话：谁在干什么、拿着什么、自拍还是街拍）；禁止「远景：」「近景：」等分镜术语开场；禁止英文 SD tag / 生图提示词字段；客户端点生成时会另推英文提示词。',
  )

  const examplePosts = [
    allowText
      ? `[POST]
作者：吃瓜群众
类型：纯文字
正文：#热搜标题# 今晚这场宴会怎么这么多镜头……那位一出来全场都静了，@微博昵称 你也看了吗？
赞：1400`
      : '',
    allowTextImage
      ? `[POST]
作者：名媛风向标
类型：文字+图片
正文：#热搜标题# 家人们谁懂啊！宴会上看到那位了，黑色礼服配厌世脸简直绝杀。[泪] 同框的还有 @玩家微博昵称
赞：24000
配图：
1. 黑色礼服名媛站在宴会台阶上，冷白灯打下侧脸，旁边银发护卫余光扫过
2. 顾湛琛拿着一盒草莓牛奶对镜自拍，一只手比着耶`
      : '',
    allowImage
      ? `[POST]
作者：街拍机位
类型：纯图片
正文：#热搜标题#
赞：880
配图：
1. 宴会长桌烛光里黑礼服剪影一晃而过
2. 走廊尽头银发护卫背影，鞋跟敲地`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const sys = `【热搜推演协议】
${PULSE_MBTI_BAN}
请结合当前世界线与角色状态，推演 ${count} 个娱乐圈/社会热搜。
请严格使用以下标签格式输出数据，绝对不要使用 JSON，不要输出任何多余的废话或 markdown 代码围栏。

[TOPIC]
#热搜标题#
热度标签：爆/热/新
热度：1.2亿
摘要：一句话简评。

${examplePosts}

[COMMENT]
昵称：路人A
内容：这条评论很犀利。
赞：28

[COMMENT]
昵称：粉丝B
回复：路人A
内容：非黑即白，楼上说得对。
赞：6

[COMMENT]
昵称：路人C
回复：粉丝B
内容：你们怎么什么都吹？就这还实锤？
赞：11

[COMMENT]
昵称：吃瓜群众
内容：坐等后续。
赞：14

[TOPIC]
#下一个热搜标题#
热度标签：热
热度：560万
摘要：另一句导语。

规则：
1. 输出恰好 ${count} 个 [TOPIC]；每个 TOPIC 含恰好 ${postsPerTopic} 个 [POST]。
2. 每个 POST 的评论区须含恰好 ${commentsPerPost} 个 [COMMENT]（每条 COMMENT 须带「赞：数字」）。
3. 评论结构必须像真微博评论区，有接话与对线：
   - 约 40%～55% 为一级评论（不要写「回复」字段）；
   - 其余必须写「回复：被回复者昵称」；
   - 当 ${commentsPerPost}≥4 时，每帖至少出现 1 组楼中楼：一级 → 回复该一级 → 再回复刚才那条二级（第三层「回复」指向二级昵称，而非只会回一级）；
   - 当 ${commentsPerPost}≥6 时，力争 2 组不同楼中楼或更长对线（可多名网友来回接话）。
4. 「回复」目标昵称必须是同帖更早出现过的评论作者昵称（一级或二级均可）。
5. 标题必须用一对 # 包住；正文可含换行与引号；禁止 Unicode emoji；微博表情须用词库正式名（如 [doge][允悲][泪][吃瓜][失望]），禁止自造 [流泪][叹气] 等未收录写法。
6. 语气要像真实舆论场，但不要真实名人全名（可用化名/代称）。
7. 讨论帖与评论的整体风格（可多选混排，本次启用：${styleLabels}）：${styleGuide}
   - 若启用多种风格，同一 TOPIC 内不同 POST / 评论应轮换覆盖所选风格，勿只写一种。
8. 【人设锚定｜最高优先级】用户消息中的「角色档案」「世界背景」「世界书」${includePlayer ? '「玩家/用户身份」' : ''}为唯一事实来源：
   - 角色姓名、身份、关系、经历、性格、外貌等必须与之相符；
   - **禁止**另编一套角色人设${includePlayer ? '或用户人设（禁止虚构用户姓名/身份/职业/关系来顶替档案）' : ''}；
   - 未在档案中出现的重大设定不要当作既成事实写进热搜标题或帖文；可合理猜测网友舆论角度，但不得篡改人设。
${
  includePlayer
    ? `8b. 【评论作者｜最高优先级】讨论帖评论的「昵称」只能是随机网友；禁止以当前用户微博昵称${playerName ? `「${playerName}」` : ''}或「用户」「玩家」「本人」作为评论昵称；用户只可被 @ 提及，**不得替用户发言**或写一条用户自己的评论。
`
    : `8b. 【禁止用户相关内容｜最高优先级】本次未纳入用户身份：热搜标题、摘要、讨论帖与评论须纯围绕所选参考角色及其舆论场；禁止出现玩家/用户本人、用户微博昵称、用户身份、用户与角色的私人暧昧/同居/恋爱线作为话题主体；禁止 @ 用户、写「@用户」「玩家」「你」指代现实玩家；剧情参考里若出现用户台词，只可作角色侧事件背景，勿让用户成为热搜主角或评论作者。
`
}9. 若提供了「近期剧情参考」「近期微博参考」与参考角色档案，热搜标题、摘要、讨论帖与评论须可取材其中的公开事件/关系/冲突，并与人设一致；微博参考为广场公开发博（非私聊），可据此延展舆论，禁止整段照抄正文。若未选参考角色：优先锚定用户身份/自定义要求生成相关舆论；二者皆无时，仅写不点名具体圈内人设的泛化娱乐热搜。
${mediaRules.join('\n')}
12. 若所选类型不止一种，同一 TOPIC 内的多条 POST 应尽量混用不同类型，避免全部同一形态。
13. 【话题前缀｜必须】每个 [POST] 的正文必须以「本 TOPIC 的热搜标题（两侧带 #）」开头，例如「#某某热搜# 后面接正文」；纯图帖若几乎无正文，正文也至少写该话题标签。
14. 【艾特｜必须用微博昵称】正文与评论可使用「@昵称 」（昵称后须有空格或换行）；**只能**艾特【可艾特名单】里的**微博/线上昵称**；禁止用角色真实姓名、身份全名、通讯录备注；禁止写「@用户」「@玩家」「@你」等占位词；约 20%～40% 的帖/评含 1 个艾特即可，勿刷屏。`

  const mentionList = (params.mentionTargets ?? [])
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 24)
  const ctx = params.povContext?.trim() ?? ''
  const ctxLabel = includePlayer
    ? '【参考上下文（可不含角色：仅用户身份；或含角色人设/世界书、可选近期剧情与微博；生成须锚定已注入内容，禁止另编）】'
    : '【参考上下文（含角色人设基础信息、世界书，以及可选的近期剧情与微博；未纳入用户身份；生成必须锚定角色人设，禁止另编，禁止写用户相关内容）】'
  const user = `当前世界主角显示名：${params.povName}
允许的讨论帖类型：${kindLabels}
允许的讨论风格：${styleLabels}
${playerName ? `当前用户微博昵称（可被 @，禁止作为评论昵称/替用户发言）：${playerName}\n` : ''}${
    !includePlayer
      ? '【本次范围】仅围绕参考角色生成舆论；禁止任何用户/玩家本人相关内容。若上下文未注入角色档案，则写泛化娱乐舆论且勿点名具体人设。\n'
      : '【评论作者禁令】热搜讨论帖评论区只能是随机网友；禁止以用户身份发评论。\n'
  }${
    mentionList.length
      ? `【可艾特名单｜均为微博昵称，禁止改写成真实姓名】${mentionList.map((n) => `@${n}`).join(' ')}\n（正文里写 @昵称 后请留空格；例：看到 @${mentionList[0]} 本人出来时……）\n`
      : ''
  }${
    ctx
      ? `${ctxLabel}\n${ctx.slice(0, 18_000)}\n`
      : '【警告】未注入角色人设/世界书与用户身份。请勿编造具体角色或用户档案；仅生成不点名具体人设细节的泛化舆论。\n'
  }
请基于上述上下文推演相关舆论场的热搜及讨论帖。
${custom ? `\n【用户额外要求】\n${custom}\n（在不破坏标签格式、且优先贴合已注入上下文的前提下尽量满足；额外要求不得覆盖或改写已注入的人设事实${includePlayer ? '' : '；额外要求若涉及用户本人请忽略'}；额外要求不得要求生成“用户自己的评论”。）` : ''}`

  try {
    const raw = await openAiCompatibleChat(
      apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.9 },
    )
    const topics = parseTrendingData(raw)
      .slice(0, count)
      .map((t, i) => ({
        ...t,
        heatLabel: t.heatLabel || inventHeatLabel(i + 1, t.tag),
        posts: t.posts.slice(0, postsPerTopic).map((p) => {
          let mediaKind = p.mediaKind
          let images = p.images ?? []
          let content = p.content
          // 收敛到用户允许的类型
          if (mediaKind === 'text' && !allowText) {
            mediaKind = allowTextImage ? 'text_image' : 'image'
          } else if (mediaKind === 'text_image' && !allowTextImage) {
            mediaKind = allowImage && images.length ? 'image' : allowText ? 'text' : 'image'
          } else if (mediaKind === 'image' && !allowImage) {
            mediaKind = allowTextImage ? 'text_image' : 'text'
          }
          if (mediaKind === 'text') images = []
          if ((mediaKind === 'text_image' || mediaKind === 'image') && images.length === 0 && (allowTextImage || allowImage)) {
            images = [{ description: `${content.slice(0, 80) || t.title}相关画面` }]
          }
          if (mediaKind === 'image' && !content.trim()) content = ''
          content = ensureTrendingTopicPrefix(content, t.title)
          const comments = p.comments
            .filter((c) => !isBlockedPulseUserCommentAuthor(c.authorName, playerAuthorBlocklist))
            .slice(0, commentsPerPost)
          return {
            ...p,
            content,
            mediaKind,
            images: images.slice(0, 9),
            comments,
          }
        }),
      }))
    if (!topics.length) {
      throw new Error('生成失败：未能解析到有效热搜（请重试）')
    }
    return topics
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

/** @deprecated 别名：新热搜引擎 */
export const generateTrendingTopics = aiGeneratePulseTrending

const DM_STYLE_GUIDE: Record<string, string> = {
  mixed: '混杂网友私信：表白、提问、八卦、安利、轻度阴阳混搭；对象始终是用户本人。',
  fandom: '纯粉夸夸：宠粉感、安利、截图式夸夸，无恶意；夸的是用户或其相关事，不是把用户叫成角色。',
  curious: '好奇提问：问用户近况、或用户与参考角色之间的公开八卦，语气礼貌或碎嘴。',
  roast: '阴阳质疑：拉踩、逼问、带节奏，仍像真人私信而非通稿；对象是用户。',
  confession: '感情向：暧昧表白、单恋碎碎念、想靠近的语气；对象是用户，禁止对角色名表白开场。',
  casual: '路人闲聊：短、碎、像随手发，少长篇抒情。',
}

const DM_STYLE_LABEL: Record<string, string> = {
  mixed: '混杂',
  fandom: '纯粉夸夸',
  curious: '好奇提问',
  roast: '阴阳质疑',
  confession: '感情表白',
  casual: '路人闲聊',
}

function parseDmIsUserFan(row: Record<string, unknown>, styleKeys: string[]): boolean {
  const raw = row.isUserFan ?? row.isFan ?? row.followsUser ?? row.isFollower
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase()
    if (['true', '1', 'yes', '是', '粉丝', '已关注'].includes(t)) return true
    if (['false', '0', 'no', '否', '路人', '未关注'].includes(t)) return false
  }
  // 模型漏写时：纯粉偏向粉丝，阴阳/闲聊偏向路人，其余约半
  if (styleKeys.includes('fandom') && !styleKeys.includes('roast') && !styleKeys.includes('casual')) {
    return true
  }
  if (styleKeys.includes('roast') || styleKeys.includes('casual')) return false
  return Math.random() < 0.55
}

/** 私信禁止 @；去掉模型误写的艾特片段；全角方括号表情归一成半角 */
function sanitizePulseDmFanText(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\uFF3B/g, '[')
    .replace(/\uFF3D/g, ']')
    .replace(/@[^\s\[\]@，。！？,.!?；;：:]{1,32}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 480)
}

export async function aiGeneratePulseDmThreads(params: {
  apiConfig: ApiConfig | null
  /**
   * 用户身份卡真实姓名（须注入模型知晓）。
   * 网友优先用其衍生口语昵称（小顾、顾老公等）或「你」；不必死喊全名；禁止用微博/微信昵称。
   */
  playerRealName: string
  /** 微博昵称：仅作禁称呼名单，勿用来点名用户 */
  playerWeiboNickname?: string
  /** 参考角色显示名（仅作话题/事件来源，不是收件人） */
  refCharacterNames?: string[]
  /** 私信会话数（会话条数），默认 4，范围 1～12 */
  threadCount?: number
  /** 每会话消息条数，默认 4，范围 1～8 */
  messagesPerThread?: number
  /** 私信风格 id（可多选混排） */
  styles?: string[]
  /** 风格自定义补充 */
  styleCustom?: string
  /** 已拼好人设 + 世界书 + 用户身份 + 近期剧情（用户身份始终注入） */
  povContext?: string
  customRequirements?: string
}): Promise<Array<{ fanName: string; messages: string[]; isUserFan: boolean }>> {
  const n = Math.min(12, Math.max(1, params.threadCount ?? 4))
  const msgsPer = Math.min(8, Math.max(1, params.messagesPerThread ?? 4))
  const apiConfig = requirePulseApi(params.apiConfig)
  const realName = params.playerRealName.trim() || '用户'
  const weiboNick = params.playerWeiboNickname?.trim() || ''
  const refNames = [...new Set((params.refCharacterNames ?? []).map((s) => s.trim()).filter(Boolean))]
  const hasRefChars = refNames.length > 0
  const refList = hasRefChars ? refNames.join('、') : ''
  const ctx = params.povContext?.trim() ?? ''
  const custom = params.customRequirements?.trim().slice(0, 400) ?? ''

  const styleKeys = [...new Set((params.styles?.length ? params.styles : ['mixed']).map((s) => s.trim()).filter(Boolean))]
  const styleCustom = params.styleCustom?.trim().slice(0, 120) ?? ''
  if (!styleKeys.length && !styleCustom) styleKeys.push('mixed')
  const styleGuideParts = styleKeys.map((k) => DM_STYLE_GUIDE[k] ?? DM_STYLE_GUIDE.mixed)
  if (styleCustom) styleGuideParts.push(`自定义追加：${styleCustom}`)
  const styleGuide = styleGuideParts.join('；')
  const styleLabels = [
    ...styleKeys.map((k) => DM_STYLE_LABEL[k] ?? k),
    ...(styleCustom ? [`自定义(${styleCustom.slice(0, 24)})`] : []),
  ].join('、')

  const bannedAddress = [
    weiboNick && weiboNick !== realName ? `微博昵称「${weiboNick}」` : '',
    ...refNames.map((n) => `角色名「${n}」`),
  ]
    .filter(Boolean)
    .join('、')

  const topicRules = hasRefChars
    ? `- 【参考角色｜可选话题】角色（${refList}）不是收件人，只是可聊的第三方八卦/事件来源。
- 【禁止认错人】严禁把用户当成参考角色来招呼（如「${refNames[0]}你好」）；称呼对象永远是用户。
- 可聊用户与这些角色之间公开可议的事；禁止另编重大人设。`
    : `- 【仅用户本人】本次未指定参考角色：私信话题只围绕用户本人（近况、打扮、路人印象、安利、提问等），禁止凭空编造具体第三方角色姓名与亲密剧情当主线。`

  const sys = `你是 Lumi Pulse 微博「网友私信」编导。生成路人/粉丝发给「用户本人」的私信。
${PULSE_MBTI_BAN}
只输出 JSON 数组（不要其它说明）：
[{"fanName":"网名","isUserFan":true,"messages":["消息1","消息2"]}]

【收件人｜称呼｜最高优先级】
- 收件人是用户本人；须知晓身份真实姓名为「${realName}」，但**不必每句喊全名**。
- 当面称呼：优先用由其衍生的口语昵称（如小顾、顾哥、顾老公、阿X、名字后缀等，按粉/路人关系自然选），或「你」；全名可偶用，勿篇篇官称。禁止写 @，禁止任何 @艾特。
${weiboNick && weiboNick !== realName ? `- 禁止用微博昵称「${weiboNick}」招呼用户（那是网名，不是当面称呼）。` : '- 禁止用微博网名招呼用户。'}
- 禁止把对外认证/舞台称号当口头称呼（如「顾C位」「新晋C位」「XX艺人」）；认证可作人设背景，不要当名字喊。
${topicRules}
${bannedAddress ? `- 禁止用作当面称呼的名单：${bannedAddress}。` : ''}

硬性要求：
1. 恰好 ${n} 个会话（数组元素）；每个 messages 恰好 ${msgsPer} 条，按时间从早到晚。
2. messages 内默认是独立短气泡（少字多句，宜 5～15 字）；若会话风格为表白/夸夸/安慰等，允许其中 **1 条**写成长一点的口语小作文（约 80～220 字），其余仍可短句搭配，勿整组都是说明书腔长文。
3. 全部为网友单向发给用户的私信（不必写用户回覆）；fanName 须彼此不同、像真微博网名；禁止 fanName 等于「${realName}」${weiboNick ? `或「${weiboNick}」` : ''}${hasRefChars ? '或参考角色名' : ''}。
4. 每个会话必须给 isUserFan（boolean）：true=该网友已关注用户（用户的粉丝）；false=未关注的路人。各会话应有真有假，勿整批同一值；纯粉风更宜 true，阴阳/路人闲聊可 false。
5. 私信风格（可多选混排，本次：${styleLabels}）：${styleGuide}
   多会话时轮换覆盖所选风格，勿整批同一口吻。口吻应与 isUserFan 大致一致（粉丝更熟络/宠粉，路人更生疏）。
6. 禁止 Unicode emoji；可用微博方括号表情如 [doge][允悲][泪]，须用词库正式名。
7. 【禁止艾特】messages 内严禁出现 @ 符号与 @昵称；直接说「你」或从「${realName}」衍生的口语昵称。
8. 【人设锚定｜剧情线优先】若上下文含「当前剧情线公开形象」，粉丝/路人须按该公开形象理解用户量级与处境；身份档案仅作底色。当面称呼从真实姓名衍生，不得改用微博昵称或认证称号。无公开形象块时，才以「用户身份」为事实来源${hasRefChars ? '；参考角色的人设/世界书/剧情仅作八卦与事件素材' : ''}。禁止另编重大设定。
9. 禁止替用户发言；禁止把 fanName 写成用户${hasRefChars ? '或角色' : ''}。
${hasRefChars ? '10. 若提供了近期剧情参考，可取材公开可聊细节，写成路人私信口吻，不要照抄私聊原文。' : '10. 无参考角色时：勿捏造「某某角色/某某剧情线」作为主话题。'}
${custom ? `11. 【其他自定义要求】在不破坏 JSON 的前提下尽量满足：${custom}` : ''}`

  const user = `用户真实姓名（须知晓；称呼优先用其衍生昵称，不必死喊全名）：${realName}
${weiboNick && weiboNick !== realName ? `用户微博昵称（禁止用来称呼）：${weiboNick}\n` : ''}${
    hasRefChars
      ? `参考角色（话题来源，非收件人）：${refList}\n`
      : `参考角色：无（只针对用户本人生成私信）\n`
  }私信会话数：${n}
每会话消息数：${msgsPer}
风格：${styleLabels}
【再次强调】禁止任何 @；知姓名「${realName}」→ 喊小顾/顾老公这类衍生或「你」即可；禁用微博昵称与认证称号当名字。每个会话必须带 isUserFan。
${
    ctx
      ? hasRefChars
        ? `【参考上下文（用户身份 / 角色人设 / 世界书 / 世界背景 / 可选近期剧情）】\n${ctx.slice(0, 16_000)}\n`
        : `【用户身份上下文｜须严格遵守】\n${ctx.slice(0, 10_000)}\n`
      : hasRefChars
        ? '【警告】未注入用户身份与参考角色上下文。请勿编造具体人设档案，仅生成面向用户的泛化网友私信。\n'
        : '【警告】未注入用户身份。请勿编造具体人设档案，仅生成面向用户的泛化网友私信。\n'
  }${custom ? `【其他自定义要求】\n${custom}` : ''}
请生成 ${n} 组发给用户「${realName}」的网友私信会话。`

  try {
    const raw = await openAiCompatibleChat(
      apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.93 },
    )
    const rows = extractJsonArray(raw)
    if (!rows?.length) {
      throw new Error('生成失败：模型未返回有效 JSON')
    }
    const out: Array<{ fanName: string; messages: string[]; isUserFan: boolean }> = []
    const usedNames = new Set<string>()
    const bannedFanNames = new Set(
      [realName, weiboNick, ...refNames].map((s) => s.trim().toLowerCase()).filter(Boolean),
    )
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      let fanName = clip(r.fanName, 24)
      if (!fanName) continue
      if (bannedFanNames.has(fanName.toLowerCase())) continue
      if (usedNames.has(fanName.toLowerCase())) {
        fanName = `${fanName}${out.length + 1}`
      }
      usedNames.add(fanName.toLowerCase())
      const msgs = Array.isArray(r.messages)
        ? r.messages.map((m) => sanitizePulseDmFanText(m)).filter(Boolean)
        : []
      const isUserFan = parseDmIsUserFan(r, styleKeys)
      if (msgs.length) out.push({ fanName, messages: msgs.slice(0, msgsPer), isUserFan })
    }
    if (!out.length) {
      throw new Error('生成失败：未解析到有效私信')
    }
    return out.slice(0, n)
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

const CHARACTER_POST_STYLE_GUIDE: Record<string, string> = {
  daily: '日常碎碎念：生活、学习、通勤、小事吐槽。',
  literary: '克制文艺：短句、隐喻、少灌水，像日记断片。',
  witty: '俏皮玩梗：轻松自嘲、轻度网络语感，不失人设。',
  formal: '正式公告：职务/公开人设腔、通知或表态。',
  emotional: '情绪向：感慨、心事、温情或压力释放。',
  showcase: '晒物安利：餐食、风景、作品、好物分享。',
}

/**
 * 角色微博主页「生成动态」：按人设写若干条本人帖子 + 评论区；
 * 点赞/转发贴合粉丝量级；可选本人二级回复。
 */
export async function aiGeneratePulseCharacterDynamics(params: {
  apiConfig: ApiConfig | null
  characterName: string
  weiboNickname: string
  worldName?: string
  personaSummary: string
  /** 已有粉丝量，用于校准互动数 */
  followers?: number
  verifyLabel?: string
  bio?: string
  postCount: number
  commentsPerPost: number
  postKinds?: Array<'text' | 'text_image' | 'image'>
  postStyles?: string[]
  /** 帖子风格自定义补充（追加） */
  postStyleCustom?: string
  commentStyles?: string[]
  /** 评论风格自定义补充（追加） */
  commentStyleCustom?: string
  includeAuthorReplies?: boolean
  /** 近期私聊 / 线下约会剧情上下文（已拼好的文本） */
  plotContext?: string
  /** 是否允许提到用户本人 */
  includeUserMention?: boolean
  /** 当前用户微博昵称（开启提到用户时注入） */
  playerDisplayName?: string
  /** 多条动态时间跨度（口吻提示，实际时间戳本地分配） */
  timeSpan?: import('./characterDynamicsTime').CharacterDynamicsTimeSpan
  /** 正文字数下限（汉字计） */
  contentLenMin?: number
  /** 正文字数上限（汉字计） */
  contentLenMax?: number
  /** 其它自定义生成要求 */
  customRequirements?: string
  /** 角色 id：用于位置市级锚点（朋友圈/历史微博） */
  characterId?: string
  /** 当前微博身份 / 会话玩家身份 id（注入人脉关系边） */
  sessionPlayerIdentityId?: string | null
  /** 微信账号 id（读朋友圈位置历史） */
  accountId?: string | null
  /** 该角色已有微博带位置的标注（参与市级锚点） */
  recentPulseLocations?: string[]
}): Promise<PulseGeneratedCharacterDynamics> {
  const postCount = Math.min(8, Math.max(1, params.postCount))
  const commentsPerPost = Math.min(10, Math.max(2, params.commentsPerPost))
  const apiConfig = requirePulseApi(params.apiConfig)
  const authorNick = params.weiboNickname.trim() || params.characterName.trim() || '博主'
  const followers = Math.max(0, Math.floor(params.followers ?? 0))

  const kindSet = new Set(
    (params.postKinds?.length ? params.postKinds : (['text', 'text_image', 'image'] as const)).filter(
      (k) => k === 'text' || k === 'text_image' || k === 'image',
    ),
  )
  if (!kindSet.size) kindSet.add('text')
  const allowText = kindSet.has('text')
  const allowTextImage = kindSet.has('text_image')
  const allowImage = kindSet.has('image')
  const kindLabels = [
    allowText ? '纯文字' : '',
    allowTextImage ? '文字+图片' : '',
    allowImage ? '纯图片' : '',
  ]
    .filter(Boolean)
    .join('、')

  const postStyleKeys = [...new Set((params.postStyles?.length ? params.postStyles : []).map((s) => s.trim()).filter(Boolean))]
  const postStyleCustom = params.postStyleCustom?.trim().slice(0, 120) ?? ''
  if (!postStyleKeys.length && !postStyleCustom) postStyleKeys.push('daily')
  const postStyleGuideParts = postStyleKeys.map((k) => CHARACTER_POST_STYLE_GUIDE[k] ?? k)
  if (postStyleCustom) postStyleGuideParts.push(`自定义追加：${postStyleCustom}`)
  const postStyleGuide = postStyleGuideParts.join('；')
  const postStyleLabels = [
    ...postStyleKeys,
    ...(postStyleCustom ? [`自定义(${postStyleCustom.slice(0, 24)})`] : []),
  ].join('、')

  const commentStyleKeys = [
    ...new Set((params.commentStyles?.length ? params.commentStyles : []).map((s) => s.trim()).filter(Boolean)),
  ]
  const commentStyleCustom = params.commentStyleCustom?.trim().slice(0, 120) ?? ''
  if (!commentStyleKeys.length && !commentStyleCustom) commentStyleKeys.push('mixed')
  const commentStyleGuideParts = commentStyleKeys.map(
    (k) => TRENDING_STYLE_GUIDE[k] ?? TRENDING_STYLE_GUIDE.mixed,
  )
  if (commentStyleCustom) commentStyleGuideParts.push(`自定义追加：${commentStyleCustom}`)
  const commentStyleGuide = commentStyleGuideParts.join('；')
  const commentStyleLabels = [
    ...commentStyleKeys.map((k) => TRENDING_STYLE_LABEL[k] ?? k),
    ...(commentStyleCustom ? [`自定义(${commentStyleCustom.slice(0, 24)})`] : []),
  ].join('、')

  const includeAuthorReplies = params.includeAuthorReplies !== false
  const includeUserMention = params.includeUserMention === true
  /** 无论是否可 @ 用户，都拿来拦截「替用户发的评论」 */
  const playerName = params.playerDisplayName?.trim() || ''
  const plotCtx = params.plotContext?.trim().slice(0, 12_000) ?? ''
  const custom = params.customRequirements?.trim().slice(0, 400) ?? ''
  const timeSpanHint = characterDynamicsTimeSpanHint(
    params.timeSpan ?? DEFAULT_CHARACTER_DYNAMICS_TIME_SPAN,
  )
  let contentLenMin = Math.floor(Number(params.contentLenMin ?? 40))
  let contentLenMax = Math.floor(Number(params.contentLenMax ?? 280))
  if (!Number.isFinite(contentLenMin)) contentLenMin = 40
  if (!Number.isFinite(contentLenMax)) contentLenMax = 280
  contentLenMin = Math.min(800, Math.max(10, contentLenMin))
  contentLenMax = Math.min(800, Math.max(10, contentLenMax))
  if (contentLenMin > contentLenMax) {
    const t = contentLenMin
    contentLenMin = contentLenMax
    contentLenMax = t
  }
  const contentLenRule =
    postCount >= 2
      ? `正文（汉字计，含标点/空格/方括号表情码）必须落在 ${contentLenMin}～${contentLenMax} 字：本批须恰好各有 1 篇达到约 ${contentLenMin} 字（允许 ±5）与约 ${contentLenMax} 字（允许 ±12），其余帖随意分布在区间内且长度彼此错开；最短/最长档优先用纯文字或文字+图片。`
      : `正文字数（汉字计）须落在 ${contentLenMin}～${contentLenMax} 之间。`

  const engagementHint =
    followers <= 0
      ? '粉丝量未知：日常帖赞约 20～400，爆款可到数千；转发约为赞的 2%～8%。'
      : followers < 500
        ? `粉丝约 ${followers}（普通量级）：日常帖赞约 5～80，偶发上百；转发很少。`
        : followers < 5000
          ? `粉丝约 ${followers}（校园/圈内人气）：日常帖赞约 80～800，爆款可到数千；转发约赞的 3%～10%。`
          : followers < 50_000
            ? `粉丝约 ${followers}（公众人设）：日常帖赞约 400～5000，爆款可过万；转发约赞的 4%～12%。`
            : `粉丝约 ${followers}（高热度）：日常帖赞约数千～数万；转发约赞的 5%～15%。`

  const mediaRules: string[] = [
    `7. 「类型」仅能从：${kindLabels}；同一批次尽量混排所选类型。`,
  ]
  if (allowTextImage || allowImage) {
    mediaRules.push(
      `8. 文字+图片 / 纯图片须写「配图」数组，1～6 条通俗中文画面描述（例：拿着草莓牛奶对镜自拍比耶）；禁止英文 SD tag；纯图也须有符合【正文字数】的正文（勿留空）。`,
    )
  } else {
    mediaRules.push('8. 本次仅纯文字，不要写配图字段。')
  }

  const characterId = params.characterId?.trim() || ''
  const sessionPlayerIdentityId = params.sessionPlayerIdentityId?.trim() || ''
  let networkRelationshipsBlock = ''
  let pulseFollowingBlock = ''
  if (characterId) {
    try {
      const [ch, following] = await Promise.all([
        personaDb.getCharacter(characterId),
        loadPulseCharacterFollowingPromptBlock({
          characterId,
          accountId: params.accountId,
        }),
      ])
      pulseFollowingBlock = following.trim()
      if (ch) {
        networkRelationshipsBlock = (
          await loadPrivateChatNetworkRelationshipsBlock({
            character: ch,
            sessionPlayerIdentityId: sessionPlayerIdentityId || undefined,
          })
        ).trim()
      }
    } catch {
      networkRelationshipsBlock = ''
      pulseFollowingBlock = ''
    }
  }
  const networkAndFollowingBlock = [networkRelationshipsBlock, pulseFollowingBlock]
    .filter(Boolean)
    .join('\n')

  const pulseLocs = (params.recentPulseLocations ?? [])
    .map((x) => rejectPlaceholderMomentLocation(x))
    .filter((x): x is string => Boolean(x))
  const momentAnchor = characterId
    ? await resolveCharacterLocationAnchor({
        accountId: params.accountId,
        characterId,
      })
    : { anchorCity: null as string | null, recentLocations: [] as string[] }
  const locationAnchor = mergeLocationAnchorWithPersona({
    locationAnchor: {
      anchorCity: momentAnchor.anchorCity,
      recentLocations: [...pulseLocs, ...momentAnchor.recentLocations].slice(0, 12),
    },
    personaTexts: [params.personaSummary, plotCtx, custom, params.worldName],
  })
  const { anchorCity, recentLocations: mergedRecentLocations } = locationAnchor
  const personaCities = extractWorldviewCityCandidatesFromText(
    params.personaSummary,
    plotCtx,
    custom,
    params.worldName,
  )
  const relocationAllowed = detectRelocationSignalsInContext(
    plotCtx,
    params.personaSummary,
    custom,
  )
  const locationPromptBlock = [
    buildCharacterLocationPromptBlock({
      anchorCity,
      recentLocations: mergedRecentLocations.slice(0, 8),
      relocationAllowed,
    }),
    personaCities.length
      ? `【世界观地名】人设/世界书中已识别的地名优先使用：${personaCities.slice(0, 5).join('、')}。附带 location 时第一级须与此一致（无明确跨城剧情时）。`
      : '【世界观地名】人设与世界书未抽到明确城市时：location 优先填 null；禁止编造字母市名或无依据新城。',
  ]
    .join('\n')
    .replace(/朋友圈/g, '微博/朋友圈')
  const weiboLocationHint = MOMENT_LOCATION_PROMPT_HINT.replace(/朋友圈/g, '微博')

  const sys = `你是 Lumi Pulse 角色微博动态编导。只输出一个 JSON 对象（不要其它说明）：
${PULSE_MBTI_BAN}
{
  "posts": [
    {
      "content": "微博正文",
      "mediaKind": "text|text_image|image",
      "images": [{ "description": "通俗中文画面描述" }],
      "location": null,
      "likeCount": 数字,
      "repostCount": 数字,
      "comments": [
        {
          "authorName": "昵称",
          "content": "评论",
          "parentHint": "可选·被回复者昵称",
          "likeCount": 数字,
          "isAuthor": false
        }
      ]
    }
  ]
}
硬性要求：
1. 恰好 ${postCount} 条 posts，均为「${authorNick}」本人发出。
2. 每帖 comments 恰好 ${commentsPerPost} 条；commentCount 不必另写。
3. 约 40%～55% 为一级评论（不要 parentHint）；其余写 parentHint；当 ${commentsPerPost}≥4 时至少 1 组楼中楼。
4. 【评论作者｜最高优先级】评论区发言者只能是：① 随机路人/粉丝网友昵称；${
    includeAuthorReplies
      ? `② 角色博主「${authorNick}」（isAuthor=true 的二级回复）。`
      : `禁止「${authorNick}」本人回评（全部 isAuthor=false）。`
  } **严禁**以用户/玩家本人、用户微博昵称${playerName ? `「${playerName}」` : ''}、或「用户」「玩家」「本人」等作为评论 authorName；不得替用户发言或写一条“用户自己的评论”。剧情参考里的用户台词只能作背景，不得改写成用户评论。
5. ${
    includeAuthorReplies
      ? `至少在约一半帖子中出现 1～2 条 isAuthor=true 的二级回复：authorName 必须写成「${authorNick}」，parentHint 指向更早的网友昵称；本人回复口吻贴合人设、简短亲切。`
      : `全部评论 isAuthor=false；禁止出现「${authorNick}」本人回评。`
  }
6. 点赞/转发须符合下列量级，并与人设地位一致：${engagementHint}
   评论 likeCount 可随帖子热度升高，热评可达数万（直接写整数，勿写 w/万 字样）。
7. 发帖风格（可多选混排，本次：${postStyleLabels}）：${postStyleGuide}
   其中「自定义追加」须叠在已选预设风格之上，用于微调口吻，不是单独替换其它风格。
   评论区风格（可多选混排，本次：${commentStyleLabels}）：${commentStyleGuide}
   评论区「自定义追加」同样叠在已选预设之上，不替换其它风格。
${mediaRules.join('\n')}
9. 禁止 Unicode emoji；可用微博方括号表情如 [doge][允悲][失望][泪]。须用词库正式名，禁止自造 [叹气][流泪][无奈] 等未收录写法（应用 [失望]/[泪]/[允悲]）。
10. 【人设锚定】只根据「人设资料」写内容；禁止另编重大设定；禁止把档案外的真人名人塞进正文。
${
    includeUserMention
      ? `11. 【可提用户｜仅提及不发言】正文与**网友/博主评论内容**可合理提到或 @${playerName || '用户微博昵称'}（须用微博昵称，禁止写「@用户」「@玩家」「@你」）；约 20%～40% 帖文可自然带一次提及即可，勿刷屏。**绝不能**把用户写成评论作者。`
      : `11. 【禁止用户相关】帖文与评论禁止出现玩家/用户本人、用户微博昵称、@用户/@玩家/@你，以及用户与该角色的私人恋爱/同居线作内容主体；即使剧情参考里有用户台词，也只可作背景，勿让用户成为博文主角或评论作者。`
  }
12. 【时间跨度】${timeSpanHint}；各帖语境日期/时段应彼此错开，勿让多帖像连续几小时连发。
13. 【正文字数】${contentLenRule}
14. 【话题标签】约 70%～90% 的帖文须带 1～2 个微博话题，格式必须是成对井号如「#草莓蛋糕#」「#今日穿搭#」；话题须贴合该帖内容与人设场景，可自拟日常/圈内话题，**不必**是热搜榜既有词；禁止整批帖共用同一个空泛话题；**话题必须写在正文最前面**（例：「#草莓蛋糕# 周末探店……」），禁止插在正文中段或末尾；短帖可只放 1 个；话题字数计入【正文字数】。
15. 【位置标注 location｜可选】与朋友圈规则相同：多数帖填 null；仅当角色想强调「此刻在哪」时填写（探店/演出/旅行/正文点名场所等）。格式「市·区/商圈/地标」，禁止家里/公司/宿舍等非地理词。第一级地名必须用人设/世界书中的真实世界观地名${anchorCity ? `（常驻锚点：${anchorCity}）` : ''}；**严禁**字母市名或甲乙丙市等占位写法。
${weiboLocationHint}
${locationPromptBlock}
${
  networkRelationshipsBlock || pulseFollowingBlock
    ? `16. 【人脉与关注｜硬性】
${
  networkRelationshipsBlock
    ? `   - 若提供了【人脉圈内 · 角色关系与看法】：提及其他圈内角色时须按表中「关系」「称呼」与双方看法写；禁止与表矛盾的亲密/敌对叙事。
   - 每条边已标 **双向** 或 **单向**：双向=彼此都认识，可自然互提；单向=仅箭头一侧认识（「对方不知/未回关系」时对方默认不当众回应你的公开帖，也勿写成对方主动 @/评论你）。
   - 评论区仍以路人网友为主；若偶尔点名真实圈内熟人，仅限与你**双向**相关者，且称呼须用表内当面称呼；禁止把仅单向认识的人写成你的互关好友一起出镜。
   - 与用户本人的站位以人脉表「玩家」相关段为准，勿另编亲疏。`
    : ''
}${
  pulseFollowingBlock
    ? `
   - 若提供了【你的微博关注列表】：谈及「我关注的人 / 刷到熟人 / 互关」须与表一致；可合理提及表内圈内角色或圈外网友；禁止声称关注表外熟人，也勿否认表内已关注。`
    : ''
}`
    : ''
}
${plotCtx ? `${networkRelationshipsBlock || pulseFollowingBlock ? '17' : '16'}. 若提供了「近期剧情参考」，可取材其中的事件/情绪/细节，但仍须像本人公开发的微博，不要照抄私聊原文。` : ''}
${
  custom
    ? `${plotCtx ? (networkRelationshipsBlock || pulseFollowingBlock ? '18' : '17') : networkRelationshipsBlock || pulseFollowingBlock ? '17' : '16'}. 【其他自定义要求】在不破坏 JSON 格式与人设事实的前提下尽量满足：${custom}`
    : ''
}`

  const user = `角色档案名：${params.characterName}
微博昵称（发帖署名）：${authorNick}
认证：${params.verifyLabel?.trim() || '（无）'}
简介：${params.bio?.trim() || '（无）'}
世界：${params.worldName?.trim() || '（未指定）'}
粉丝数参考：${followers || '未知'}
时间跨度要求：${timeSpanHint}
正文字数要求：${contentLenMin}～${contentLenMax}（多帖时必含最短档与最长档各一篇）
话题要求：多数帖文在正文最前面带 1～2 个贴合内容的 #话题#（非必须热搜词）
位置：多数不带；想强调场所时写 location（须用世界观真实地名${anchorCity ? `，市级优先「${anchorCity}」` : ''}），否则 null；禁止字母占位市名
${
    includeUserMention && playerName
      ? `可提及的用户微博昵称（仅可被 @/提到，禁止作为评论作者）：${playerName}\n`
      : playerName
        ? `【禁止替用户发言】即使用户微博昵称是「${playerName}」，评论区也不得以其为 authorName。\n`
        : ''
  }【评论作者禁令】评论区不得出现用户本人发言；只允许网友${includeAuthorReplies ? `与博主「${authorNick}」` : ''}。
${
    params.personaSummary.trim()
      ? `【人设资料｜须严格遵守】\n${params.personaSummary.trim().slice(0, 10_000)}\n`
      : '【警告】无人设资料，仅生成不点名细节的泛化日常。\n'
  }${
    networkAndFollowingBlock
      ? `${networkAndFollowingBlock.replace(/私聊中谈到圈内人时/g, '发微博/提及时')}\n`
      : ''
  }${
    plotCtx
      ? `【近期剧情参考】\n${plotCtx}\n`
      : ''
  }${custom ? `【其他自定义要求】\n${custom}` : ''}`

  const playerAuthorBlocklist = [playerName, params.playerDisplayName]

  try {
    const raw = await openAiCompatibleChat(
      apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.88 },
    )
    const obj = extractJsonObject(raw)
    if (!obj) throw new Error('生成失败：模型未返回有效 JSON')
    const postsRaw = obj.posts
    if (!Array.isArray(postsRaw) || !postsRaw.length) {
      throw new Error('生成失败：未解析到有效动态')
    }

    const posts: PulseGeneratedProfilePost[] = []
    for (const row of postsRaw) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      let content = movePulseTopicHashtagsToFront(clip(r.content, Math.max(500, contentLenMax)))
      let mediaKind = normalizeMediaKind(r.mediaKind ?? r.type ?? r['类型'])
      const images: Array<{ description: string }> = []
      if (Array.isArray(r.images)) {
        for (const img of r.images) {
          if (typeof img === 'string') {
            const d = clip(img, 280)
            if (d) images.push({ description: d })
            continue
          }
          if (!img || typeof img !== 'object') continue
          const d = clip((img as Record<string, unknown>).description, 280)
          if (d) images.push({ description: d })
        }
      }

      if (mediaKind === 'text' && !allowText) {
        mediaKind = allowTextImage ? 'text_image' : 'image'
      } else if (mediaKind === 'text_image' && !allowTextImage) {
        mediaKind = allowImage && images.length ? 'image' : allowText ? 'text' : 'image'
      } else if (mediaKind === 'image' && !allowImage) {
        mediaKind = allowTextImage ? 'text_image' : 'text'
      }
      if (mediaKind === 'text') images.length = 0
      if ((mediaKind === 'text_image' || mediaKind === 'image') && !images.length && (allowTextImage || allowImage)) {
        images.push({ description: `${content.slice(0, 60) || authorNick}相关画面` })
      }
      if (mediaKind === 'image' && !content.trim()) content = ''
      if (!content && mediaKind === 'text') continue

      const comments: PulseGeneratedProfilePost['comments'] = []
      if (Array.isArray(r.comments)) {
        for (const c of r.comments) {
          if (!c || typeof c !== 'object') continue
          const cr = c as Record<string, unknown>
          const authorName = clip(cr.authorName, 24)
          const commentContent = clip(cr.content, 280)
          if (!authorName || !commentContent) continue
          const isAuthor =
            cr.isAuthor === true ||
            authorName === authorNick ||
            String(cr.isAuthor).toLowerCase() === 'true'
          if (!includeAuthorReplies && isAuthor) continue
          // 角色本人回评允许；其余若撞上用户昵称/占位词则丢弃
          if (!isAuthor && isBlockedPulseUserCommentAuthor(authorName, playerAuthorBlocklist)) continue
          comments.push({
            authorName: isAuthor ? authorNick : authorName,
            content: commentContent,
            parentHint: clip(cr.parentHint, 24) || undefined,
            likeCount: clipInt(cr.likeCount, 0, 9_999_999),
            isAuthor: includeAuthorReplies ? isAuthor : false,
          })
        }
      }

      // 开启本人回复却未产出时，补一条简单博主回复
      if (includeAuthorReplies && comments.length >= 2 && !comments.some((c) => c.isAuthor)) {
        const top = comments.find((c) => !c.parentHint) ?? comments[0]!
        comments.push({
          authorName: authorNick,
          content: '谢谢关心～',
          parentHint: top.authorName,
          likeCount: clipInt(Math.max(3, Math.floor((followers || 100) / 200)), 1, 999),
          isAuthor: true,
        })
      }

      const sliced = comments.slice(0, commentsPerPost)
      const locationLabel = enforceCharacterLocationConsistency({
        location: normalizeMomentLocation(r.location ?? r.locationLabel),
        anchorCity,
        contextTexts: [plotCtx, params.personaSummary, custom],
        postContent: content,
      })
      posts.push({
        content,
        mediaKind,
        images: images.slice(0, 6),
        likeCount: clipInt(r.likeCount, 0, 9_999_999),
        repostCount: clipInt(r.repostCount, 0, 999_999),
        commentCount: sliced.length,
        comments: sliced,
        ...(locationLabel ? { locationLabel } : {}),
      })
    }

    if (!posts.length) throw new Error('生成失败：未解析到有效动态')
    return { posts: posts.slice(0, postCount) }
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

function normalizeMediaKind(raw: unknown): PulsePostMediaKind {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (t === 'image' || t === '纯图片' || t === 'img') return 'image'
  if (t === 'text_image' || t === '文字+图片' || t === '图文' || t === 'text+image') return 'text_image'
  if (t === 'text' || t === '纯文字' || t === '文字') return 'text'
  return 'text'
}

/** 按角色人设生成个人主页：统计数据 + 若干条 TA 发的微博（含互动数与评论） */
export async function aiGeneratePulseProfileBundle(params: {
  apiConfig: ApiConfig | null
  characterName: string
  worldName: string
  personaSummary: string
  postCount: number
}): Promise<PulseGeneratedProfileBundle> {
  const postCount = Math.min(8, Math.max(1, params.postCount))
  const apiConfig = requirePulseApi(params.apiConfig)

  const sys = `你是 Lumi Pulse 微博个人主页编导。根据角色人设，生成该角色作为「名人/主角」的微博主页数据。
${PULSE_MBTI_BAN}
只输出一个 JSON 对象（不要 markdown 包裹以外的说明）：
{
  "profileStats": { "following": 数字, "followers": 数字, "bio": "一句个人简介<=60字" },
  "followingUsers": [{ "name": "关注对象的微博昵称", "bio": "可选一句话简介<=30字" }],
  "posts": [
    {
      "content": "微博正文 40~200字",
      "likeCount": 数字,
      "commentCount": 数字,
      "repostCount": 数字,
      "comments": [{ "authorName": "网友昵称", "content": "评论内容" }]
    }
  ]
}
要求：
- 必须生成恰好 ${postCount} 条 posts，均为该角色本人发的微博（第一人称或日记感）
- 每条 post 的 comments 数组提供 2~4 条真实网友评论；commentCount 可大于 comments 长度（表示还有更多评论）
- 评论 authorName 只能是随机网友；禁止以用户/玩家本人或「用户」「玩家」占位词发言；不得替用户发评论
- likeCount/commentCount/repostCount 须符合该角色人气，彼此合理
- 禁止 Unicode emoji；可用微博方括号表情如 [doge][允悲]
- 粉丝数/获赞须与角色身份匹配（普通人偏低，主角/名人可偏高）
- followingUsers 提供 3~8 个该角色会关注的微博账号（网友/博主/同行），following 数字须与 followingUsers 长度一致
- 【人设锚定】下列「人设资料」中的角色档案、世界背景、世界书与用户身份为唯一事实来源；微博内容须符合其人设，禁止另编角色或用户设定`

  const user = `世界：${params.worldName}
角色：${params.characterName}
${
    params.personaSummary.trim()
      ? `【人设资料｜须严格遵守】\n${params.personaSummary.trim().slice(0, 8000)}`
      : '【警告】无人设资料，禁止编造具体角色/用户档案细节。'
  }`

  try {
    const raw = await openAiCompatibleChat(
      apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.88 },
    )
    const obj = extractJsonObject(raw)
    if (!obj) throw new Error('生成失败：模型未返回有效 JSON')

    const statsRaw = obj.profileStats
    if (!statsRaw || typeof statsRaw !== 'object') {
      throw new Error('生成失败：缺少 profileStats')
    }
    const sr = statsRaw as Record<string, unknown>
    const profileStats = {
      following: clipInt(sr.following, 0, 9999),
      followers: clipInt(sr.followers, 0, 99_000_000),
      likesReceived: 0,
      bio: clip(sr.bio, 120) || undefined,
    }

    const postsRaw = obj.posts
    if (!Array.isArray(postsRaw) || !postsRaw.length) {
      throw new Error('生成失败：未解析到有效动态')
    }

    const posts: PulseGeneratedProfileBundle['posts'] = []
    for (const row of postsRaw) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const content = clip(r.content, 500)
      if (!content) continue
      const comments: Array<{ authorName: string; content: string }> = []
      if (Array.isArray(r.comments)) {
        for (const c of r.comments) {
          if (!c || typeof c !== 'object') continue
          const cr = c as Record<string, unknown>
          const authorName = clip(cr.authorName, 24)
          const commentContent = clip(cr.content, 280)
          if (!authorName || !commentContent) continue
          if (isBlockedPulseUserCommentAuthor(authorName, [])) continue
          if (authorName === params.characterName.trim()) continue
          comments.push({ authorName, content: commentContent })
        }
      }
      posts.push({
        content,
        likeCount: clipInt(r.likeCount, 0, 9_999_999),
        commentCount: Math.max(comments.length, clipInt(r.commentCount, 0, 999_999)),
        repostCount: clipInt(r.repostCount, 0, 999_999),
        comments,
      })
    }

    if (!posts.length) throw new Error('生成失败：未解析到有效动态')

    const followingUsers: PulseGeneratedProfileBundle['followingUsers'] = []
    if (Array.isArray(obj.followingUsers)) {
      for (const row of obj.followingUsers) {
        if (!row || typeof row !== 'object') continue
        const r = row as Record<string, unknown>
        const name = clip(r.name, 24)
        if (!name) continue
        followingUsers.push({ name, bio: clip(r.bio, 60) || undefined })
      }
    }

    return {
      profileStats: {
        ...profileStats,
        following: followingUsers.length > 0 ? followingUsers.length : profileStats.following,
      },
      posts: posts.slice(0, postCount),
      followingUsers,
    }
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

type SocialAccountsGenMode = 'player' | 'characters'

/**
 * 将模型 markup 对齐到种子列表（缺字段回退）。
 */
function alignGeneratedSocialAccounts(params: {
  accounts: PulseSocialAccountSeed[]
  parsed: ReturnType<typeof parseSocialAccountsMarkup>
}): PulseGeneratedSocialAccount[] {
  const { accounts, parsed } = params
  const byKey = new Map<string, (typeof parsed)[number]>()
  for (const row of parsed) {
    const k = row.key.trim().replace(/^char:/i, '').replace(/^player:/i, '')
    if (k) byKey.set(k.toLowerCase(), row)
    byKey.set(row.key.trim(), row)
  }
  const lookupHit = (seedKey: string) => {
    const k = seedKey.trim()
    return (
      byKey.get(k) ||
      byKey.get(k.replace(/^char:/i, '').replace(/^player:/i, '').toLowerCase()) ||
      byKey.get(k.toLowerCase())
    )
  }
  const rosterNames = new Set(accounts.map((a) => a.name.trim().toLowerCase()).filter(Boolean))
  const out: PulseGeneratedSocialAccount[] = []
  for (const seed of accounts) {
    const hit = lookupHit(seed.key)
    const isPlayer = seed.key === 'player'
    const extras = isPlayer
      ? []
      : (hit?.extraFollowing ?? [])
          .filter((e) => !rosterNames.has(e.name.trim().toLowerCase()))
          .slice(0, 8)
    const wx = seed.wechatNickname?.trim() || seed.name.trim()
    let weiboNick = isPlayer ? '' : hit?.weiboNickname?.trim() || ''
    if (!isPlayer && (!weiboNick || weiboNick === wx)) {
      weiboNick = `${(wx || seed.name).slice(0, 8)}·博`
    }
    out.push({
      key: seed.key,
      weiboNickname: isPlayer ? undefined : weiboNick.slice(0, 24),
      bio: isPlayer ? undefined : hit?.bio || seed.roleHint?.trim().slice(0, 60) || undefined,
      verifyLabel: isPlayer
        ? hit?.verifyLabel?.trim().slice(0, 24) || '城市青年'
        : hit?.verifyLabel?.trim() || seed.roleHint?.trim().slice(0, 24) || '角色认证',
      followers:
        hit && hit.followers > 0
          ? hit.followers
          : isPlayer
            ? 12 + accounts.length
            : 80 + accounts.length * 20,
      likesReceived: 0,
      extraFollowing: isPlayer
        ? []
        : extras.length
          ? extras
          : [
              { name: `${seed.name.slice(0, 6)}的观测站`, bio: '偶尔路过的路人号' },
              { name: '街角汽水铺', bio: '分享日常碎片' },
            ],
    })
  }
  return out
}

async function aiGeneratePulseSocialAccountsBatch(params: {
  apiConfig: ApiConfig
  worldName: string
  accounts: PulseSocialAccountSeed[]
  mode: SocialAccountsGenMode
  playerIdentityContext?: string
  plotAnchorName?: string
  plotAnchorContext?: string
  /** 各角色人设摘要（按 key 分块）；角色批次必读 */
  characterPersonaContext?: string
}): Promise<PulseGeneratedSocialAccount[]> {
  const accounts = params.accounts.filter((a) => a.key.trim() && a.name.trim())
  if (!accounts.length) return []

  const mode = params.mode
  const playerCtx = params.playerIdentityContext?.trim() ?? ''
  const plotName = params.plotAnchorName?.trim() || '所选角色'
  const plotCtx = params.plotAnchorContext?.trim() ?? ''
  const charPersona = params.characterPersonaContext?.trim() ?? ''

  const rosterLines = accounts
    .map((a, i) => {
      const wx = a.wechatNickname?.trim() || a.name.trim()
      const hint = a.roleHint?.trim() ? `；身份提示：${a.roleHint.trim().slice(0, 40)}` : ''
      return `${i + 1}. key=${a.key}｜微信昵称=${wx}${hint}`
    })
    .join('\n')

  const sys =
    mode === 'player'
      ? `你是 Lumi Pulse 微博社交关系编导。本任务只生成【用户账号 key=player】的粉丝数与认证，不生成任何角色账号，不生成帖子。
${PULSE_MBTI_BAN}
禁止输出 JSON。只输出下列 markup：

[ACCOUNT]
key：player
粉丝：整数
认证：认证身份短句，不超过24字（展示在用户主页昵称下方；须锚定用户身份档案 + 剧情锚点语境）

格式硬性要求：
1. 必须用 [ACCOUNT] 起始；字段名后用中文冒号「：」或英文冒号「:」
2. 只输出 key=player 一块，禁止输出其他 key，禁止微博昵称 / 简介 / 圈外关注
3. 禁止生成帖子/动态/评论；禁止解释说明
4. 【用户粉丝｜剧情锚点｜最高优先级】粉丝数必须依据「剧情锚点角色」语境推断用户在【与该角色相处的这条剧情线】里的社会能见度：小透明/普通人→数十～数百；小有名气艺人/公众人物→数千～数万；禁止无依据飙成百万
5. 【用户认证｜最高优先级】须严格依据「用户身份档案」并结合「剧情锚点」语境提炼对外短标签；禁止把用户写成名单里的角色，禁止另编冲突设定
6. 禁止 Unicode emoji 与微博方括号表情；禁止输出「获赞」字段`
      : `你是 Lumi Pulse 微博社交关系编导。本任务只生成【角色账号】社交数据，不生成用户(player)，不生成帖子。
${PULSE_MBTI_BAN}
禁止输出 JSON。只输出下列 markup（每个角色一块）：

[ACCOUNT]
key：与名单完全一致的 key
微博昵称：该账号在微博端使用的昵称，不超过16字
认证：认证身份短句，不超过24字（将单独展示在头像昵称下方）
简介：一句个人简介，不超过60字
粉丝：整数
圈外关注：
- 昵称｜一句话简介
- 昵称｜一句话简介

格式硬性要求：
1. 必须用 [ACCOUNT] 起始；字段名后用中文冒号「：」或英文冒号「:」
2. 须覆盖名单中每一个 key，不可增减、不可改写 key；禁止输出 key=player
3. 禁止生成帖子/动态/评论；禁止解释说明
4. 【角色人设隔离｜最高优先级】每位角色的微博昵称 / 认证 / 简介 / 粉丝量级 / 圈外关注，必须严格锚定该角色自己的人设与身份提示；禁止互相抄职业赛道；禁止把某一角色的人设套到另一角色上
5. 粉丝须符合该角色自身身份（普通人偏低，名人可偏高）
6. 圈外关注写 2～6 条「- 昵称｜简介」，且贴合该角色自身圈层，勿全员同质
7. 禁止 Unicode emoji；「简介 / 认证 / 微博昵称 / 圈外关注简介」一律纯文字，禁止微博方括号表情
8. 简介克制有文学感；「认证」须与该角色设定一致，禁止与「简介」完全同文；禁止空泛「普通人」「微博用户」敷衍（除非档案确实空白）
9. 「微博昵称」禁止原样照抄微信昵称；同一输出内各账号微博昵称互不重复
10. 禁止输出「获赞」字段；禁止臆造名单内角色互关`

  const user =
    mode === 'player'
      ? `世界氛围：${params.worldName || '现代都市'}
【剧情锚点角色】${plotName}
（用户粉丝数与认证须按「与 ${plotName} 相关的这条剧情线」里的用户处境来写。）
【须生成】
${rosterLines}
${
  playerCtx
    ? `\n【用户身份参考（认证必须锚定；禁止另编）】\n${playerCtx.slice(0, 7_500)}\n`
    : `\n【警告】未注入用户身份档案。认证请写克制的泛化标签（如「城市青年」），勿臆造具体职业传奇。\n`
}
${
  plotCtx
    ? `\n【剧情锚点语境｜人设与近期剧情｜推断粉丝量级与认证时必读】\n${plotCtx.slice(0, 10_000)}\n`
    : `\n【警告】未注入剧情锚点语境。粉丝请写克制的普通人量级（约数十～数百），勿臆造成名传奇。\n`
}
示例（仅示意格式，勿照抄内容）：
[ACCOUNT]
key：player
粉丝：86
认证：独立插画师`
      : `世界氛围：${params.worldName || '现代都市'}
【账号名单｜须全部生成｜每人独立人设｜微信昵称仅供区分勿复用】
${rosterLines}
${
  charPersona
    ? `\n【角色人设参考｜按 key 锚定；每位角色只读自己的块，禁止串台】\n${charPersona.slice(0, 14_000)}\n`
    : `\n【警告】未注入角色人设全文。请严格依据名单「身份提示」写认证/简介，勿臆造冲突职业。\n`
}
示例（仅示意格式，勿照抄内容）：
[ACCOUNT]
key：char_xxx
微博昵称：咕噜慢半拍
认证：高校在读
简介：把日子拍成慢镜头。
粉丝：3500
圈外关注：
- 街角汽水铺｜分享日常碎片
- 午夜电台｜偶尔失眠听歌`

  const raw = await openAiCompatibleChat(
    params.apiConfig,
    [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    { temperature: 0.82 },
  )
  const parsed = parseSocialAccountsMarkup(raw)
  if (!parsed.length) throw new Error('生成失败：未解析到有效社交账号数据')
  return alignGeneratedSocialAccounts({ accounts, parsed })
}

/**
 * 生成用户 + 通讯录好友的社交账号数据（简介/粉丝/获赞/圈外关注）。
 * 不生成帖子；圈内互相关注由本地写入。
 * 用户账号另生成「认证」，须锚定当前身份基础信息与世界书。
 * 用户粉丝量级须按「剧情锚点角色」语境推断（同身份在不同角色线可有不同知名度）。
 * 【隔离】用户与角色分两次请求生成，避免剧情锚点人设污染其他角色账号。
 * 输出为稳定 markup（非 JSON）：[ACCOUNT] + 字段行。
 */
export async function aiGeneratePulseSocialAccounts(params: {
  apiConfig: ApiConfig | null
  worldName: string
  accounts: PulseSocialAccountSeed[]
  /** 当前用户身份档案 + 世界书（生成用户认证时必读） */
  playerIdentityContext?: string
  /** 剧情锚点角色名（用于提示用户粉丝量级；仅影响 player） */
  plotAnchorName?: string
  /** 锚点角色人设 + 近期剧情（仅影响 player） */
  plotAnchorContext?: string
  /** 角色人设摘要（按 key）；仅影响角色批次 */
  characterPersonaContext?: string
}): Promise<PulseGeneratedSocialAccount[]> {
  const apiConfig = requirePulseApi(params.apiConfig)
  const accounts = params.accounts.filter((a) => a.key.trim() && a.name.trim())
  if (!accounts.length) throw new Error('没有可生成的社交账号')

  const playerAccounts = accounts.filter((a) => a.key === 'player' || a.key.startsWith('player:'))
  const charAccounts = accounts.filter((a) => a.key !== 'player' && !a.key.startsWith('player:'))

  try {
    // 用户 / 角色分批，避免「单选剧情锚点」的语境串到其他角色人设上
    const tasks: Array<Promise<PulseGeneratedSocialAccount[]>> = []
    if (playerAccounts.length) {
      tasks.push(
        aiGeneratePulseSocialAccountsBatch({
          apiConfig,
          worldName: params.worldName,
          accounts: playerAccounts,
          mode: 'player',
          playerIdentityContext: params.playerIdentityContext,
          plotAnchorName: params.plotAnchorName,
          plotAnchorContext: params.plotAnchorContext,
        }),
      )
    }
    if (charAccounts.length) {
      tasks.push(
        aiGeneratePulseSocialAccountsBatch({
          apiConfig,
          worldName: params.worldName,
          accounts: charAccounts,
          mode: 'characters',
          characterPersonaContext: params.characterPersonaContext,
        }),
      )
    }
    const batches = await Promise.all(tasks)
    const out = batches.flat()
    if (!out.length) throw new Error('生成失败：未解析到有效社交账号数据')
    return out
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

export type NestedPulseComment = PulseComment & {
  /** 楼中楼：被回复者昵称（直接回一级评论时不填） */
  replyToName?: string
}

export function nestPulseComments(
  flat: PulseComment[],
): Array<PulseComment & { replies: NestedPulseComment[] }> {
  const byId = new Map(flat.map((c) => [c.id, c] as const))
  const childrenByParent = new Map<string, PulseComment[]>()
  for (const c of flat) {
    if (!c.parentId) continue
    const list = childrenByParent.get(c.parentId) ?? []
    list.push(c)
    childrenByParent.set(c.parentId, list)
  }

  const collectReplies = (rootId: string): NestedPulseComment[] => {
    const out: NestedPulseComment[] = []
    const walk = (parentId: string, directUnderRoot: boolean) => {
      const kids = [...(childrenByParent.get(parentId) ?? [])].sort(
        (a, b) => a.createdAt - b.createdAt,
      )
      for (const kid of kids) {
        const parent = byId.get(parentId)
        out.push({
          ...kid,
          replyToName: directUnderRoot ? undefined : parent?.authorName,
        })
        walk(kid.id, false)
      }
    }
    walk(rootId, true)
    return out
  }

  return flat
    .filter((c) => !c.parentId)
    .map((r) => ({
      ...r,
      replies: collectReplies(r.id),
    }))
}

export function flatToDmThreads(
  rows: Array<{ fanName: string; messages: string[]; isUserFan?: boolean }>,
): PulseDmThread[] {
  return rows.map((row, threadIndex) => {
    const now = Date.now()
    const fanName = row.fanName.trim() || `网友${threadIndex + 1}`
    const messages = row.messages.map((content, i) => ({
      id: `pdm-${now}-${threadIndex}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      fromFan: true,
      content: sanitizePulseDmFanText(content),
      createdAt: now - (row.messages.length - i) * 45_000,
    })).filter((m) => m.content)
    const last = messages[messages.length - 1]
    return {
      id: `pth-${now}-${threadIndex}`,
      fanName,
      fanAvatarUrl: pickStablePulseNetizenAvatarPath(`dm:${fanName}`),
      isUserFan: row.isUserFan === true,
      messages,
      lastMessage: last?.content ?? '',
      lastAt: last?.createdAt ?? now,
      unread: messages.length,
    }
  })
}

/** 私信会话：网友继续回复用户（玩家已发消息后触发） */
export async function aiGeneratePulseDmReply(params: {
  apiConfig: ApiConfig | null
  /** 用户身份真实姓名（须知晓；称呼优先衍生昵称） */
  playerRealName: string
  /** 微博昵称：禁称呼名单 */
  playerWeiboNickname?: string
  fanName: string
  /** 近期消息，按时间从早到晚 */
  history: Array<{ fromFan: boolean; content: string }>
  /** 可选：参考角色名，仅防「把用户认成角色」 */
  refCharacterNames?: string[]
}): Promise<string[]> {
  const apiConfig = requirePulseApi(params.apiConfig)
  const fanName = params.fanName.trim() || '网友'
  const realName = params.playerRealName.trim() || '用户'
  const weiboNick = params.playerWeiboNickname?.trim() || ''
  const refNames = [...new Set((params.refCharacterNames ?? []).map((s) => s.trim()).filter(Boolean))]
  const refHint = refNames.length ? refNames.join('、') : ''
  const hist = params.history
    .map((m) => {
      const c = m.content.trim()
      if (!c) return null
      return `${m.fromFan ? fanName : realName}：${c}`
    })
    .filter(Boolean)
    .slice(-16)
  const sys = `你是 Lumi Pulse 微博「网友私信」接话编导。粉丝「${fanName}」正在给用户发私信（微信同款：少字多句、多气泡连发）。
${PULSE_MBTI_BAN}
只输出 JSON 字符串数组（不要其它说明）：["气泡1","气泡2","气泡3"]
也允许改成纯文本时用换行：每一行=一条气泡。

【发送逻辑｜与微信私聊对齐｜最高优先级】
- **少字多句（默认）**：普通闲聊用 **3～6** 条短气泡；每条宜 **5～15 字**（语气词、「？」「……」可更短）；能拆就拆，禁止无必要地整轮挤成一条说明书长文。
- **禁止固定 2 条**：不要总是回两条；看语境决定条数。极短确认（「好」「行」「okok」）才可只 1 条。
- **小作文例外（允许）**：遇到表白、夸夸、安慰、道歉、深夜真心话、追星安利上头、情绪倾诉等需要「接住」的场景时，可发 **1 条较长小作文**（约 80～220 字，口语私信腔，不要公文/小说旁白），前后可各配 0～2 条短气泡当铺垫或收尾；小作文不要整轮碎成十几个半截句破坏氛围。
- 每条独立成气泡，像真人连发微博私信；勿写成被硬切的说明文。

硬性要求：
1. 全部以粉丝「${fanName}」口吻写；须知晓用户真实姓名「${realName}」，称呼优先用其衍生口语昵称（小顾、顾老公等）或「你」，不必死喊全名；禁止替用户发言，禁止改写 fanName。
2. 承接上下文里用户刚说的内容；可追问/附和/表白/吐槽/安慰，勿复读用户原句。
3. 【禁止艾特】严禁任何 @ 与 @昵称。
${weiboNick && weiboNick !== realName ? `4. 禁止用微博昵称「${weiboNick}」称呼用户。` : '4. 禁止用网名/微博昵称称呼用户。'}
5. 【禁止认错人】禁止把用户认成角色来称呼；禁止用认证称号（C位/艺人称号等）当口头名字；${
    refHint
      ? `参考角色「${refHint}」若出现，只能当第三方话题，绝不能写成「${refNames[0]}你好」这种对准用户的招呼。`
      : '不要用其他角色名招呼收件人。'
  }
6. 禁止 Unicode emoji；可用微博方括号表情如 [doge][允悲][泪]。
7. 禁止编造设定级剧透。`

  const user = `用户真实姓名（须知晓；称呼优先衍生昵称）：${realName}
${weiboNick && weiboNick !== realName ? `微博昵称（禁止称呼）：${weiboNick}\n` : ''}粉丝：${fanName}
${refHint ? `参考角色（非收件人）：${refHint}\n` : ''}【私信记录（早→晚）】
${hist.length ? hist.join('\n') : '（尚无上下文，请以一句对用户的寒暄/关心开场）'}

请以「${fanName}」身份继续私信用户：知姓名「${realName}」→ 可喊小顾/顾老公这类衍生或「你」；默认少字多句；表白/夸夸/安慰等可小作文；禁止 @，不要总是只有 2 条。`

  try {
    const raw = await openAiCompatibleChat(
      apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.94 },
    )
    const out = parsePulseDmReplyBubbles(raw)
    if (!out.length) {
      throw new Error('生成失败：未解析到有效私信')
    }
    return out
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

/** 解析网友接话气泡：JSON 数组优先，否则按换行拆成多气泡 */
function parsePulseDmReplyBubbles(raw: string): string[] {
  const rows = extractJsonArray(raw)
  const fromJson: string[] = []
  if (rows?.length) {
    for (const row of rows) {
      if (typeof row === 'string') {
        const t = sanitizePulseDmFanText(row)
        if (t) fromJson.push(t)
        continue
      }
      if (row && typeof row === 'object') {
        const r = row as Record<string, unknown>
        const t = sanitizePulseDmFanText(r.content ?? r.text ?? r.message)
        if (t) fromJson.push(t)
      }
    }
  }
  if (fromJson.length) return fromJson.slice(0, 8)

  const lines = String(raw ?? '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .split(/\n+/)
    .map((line) => sanitizePulseDmFanText(line.replace(/^[-*•\d.、）)\]]+\s*/, '')))
    .filter(Boolean)
  return lines.slice(0, 8)
}
