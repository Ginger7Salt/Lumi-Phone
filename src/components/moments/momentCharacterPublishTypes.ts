import type { CharacterMomentPrivacyDraft } from './momentCharacterPrivacyAi'
import { normalizeCharacterMomentPrivacyDraft } from './momentCharacterPrivacyAi'
import { unwrapMomentJsonPayload } from '../anonymousQa/qnaDirectedJsonParse'
import { MAX_MOMENT_IMAGES } from './momentContentLimits'
import { normalizeMomentLocation } from './momentLocationUtils'
import { parseCharacterMomentSongDraftFromAi, type CharacterMomentSongDraft } from './momentAttachedMusic'
import { sanitizeMomentBodyText } from './momentTextSanitize'

export type CharacterMomentPostType = 'text' | 'image' | 'mixed' | 'music'

/** @deprecated 使用 CharacterMomentPrivacyDraft */
export type CharacterMomentPrivacyHint = 'only_user' | 'public'

/** 发布者在评论区对自己的追评/补充说明 */
export type PublisherSelfCommentDraft = {
  content: string
  delaySeconds?: number
}

/** 大模型返回的朋友圈草稿 */
export type CharacterMomentAiDraft = {
  postType: CharacterMomentPostType
  content: string
  images: string[]
  privacy: CharacterMomentPrivacyDraft
  location?: string
  /** 角色自行决定是否置顶本条 */
  isPinned?: boolean
  /** 提醒用户查看 */
  mentionUser?: boolean
  /** 提醒其他好友查看（characterId） */
  mentionCharacterIds?: string[]
  /** 发布者在自己动态下的评论区自评补充（0~3 条） */
  publisherSelfComments?: PublisherSelfCommentDraft[]
  /** postType=music 时 AI 给出的歌曲信息（发布前会解析为 attachedMusic） */
  attachedMusicDraft?: CharacterMomentSongDraft
}

export const PUBLISHER_SELF_COMMENT_JSON_HINT =
  '"publisherSelfComments":[{"content":"追评补充说明","delaySeconds":60}]'

export const PUBLISHER_SELF_COMMENT_PROMPT_RULES = `
# Publisher Self-Comments (publisherSelfComments · 评论区自评补充)
可选字段 publisherSelfComments：数组，0~3 条。模拟真人在发完朋友圈后又在评论区「追评 / 补充说明 / 续写吐槽」。
- **必须与本条朋友圈正文/配图/地点同一主题**：是对本条动态的续写、补刀、澄清或展开细节；正文隐晦时，追评可用全新措辞，但读者仍应感到是在说**同一条**动态。
- **严禁**把私聊里另起话题的内容搬进评论区（如私聊约饭、送糖水、处理别的事、聊天梗等），除非本条朋友圈**正文里已经写到**同一件事。
- 近期私聊摘要仅作人设与语气参考，**不是**评论区素材库；读者没看过私聊，只看这条朋友圈，自评必须能独立读通、不突兀。
- 正文往往是一句情绪或梗概；自评才是展开细节、澄清误会、补刀或续写——但主题仍须是**这一条**。
- 例：正文「今天好倒霉」→ 自评「老板...我是客人，不是打工人。。为什么要坑我。。。我靠！！！」
- 反例：正文讲占有欲/头像/配图 → 自评「糖水在门口趁热喝」「昨天的花我处理掉了」——与正文无关，**禁止**。
- 这是**自己对自己**的补充，不是回复别人；不要写「回复 XXX」。
- 多数动态 0 条即可；只有正文意犹未尽、需要补刀或澄清时才写 1~2 条，禁止每条都追评。
- 每条可有 delaySeconds（30~180，略晚于发文），表示发完正文隔一会再追评。
`.trim()

export function normalizeCharacterMomentPostType(raw: unknown): CharacterMomentPostType {
  if (raw === 'text' || raw === 'image' || raw === 'mixed' || raw === 'music') return raw
  return 'mixed'
}

export function normalizePublisherSelfComments(raw: unknown): PublisherSelfCommentDraft[] {
  if (!Array.isArray(raw)) return []
  const out: PublisherSelfCommentDraft[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const content = sanitizeMomentBodyText(typeof o.content === 'string' ? o.content : '')
    if (!content) continue
    let delaySeconds: number | undefined
    if (typeof o.delaySeconds === 'number' && Number.isFinite(o.delaySeconds)) {
      delaySeconds = Math.max(30, Math.min(300, Math.floor(o.delaySeconds)))
    }
    out.push({ content, ...(delaySeconds != null ? { delaySeconds } : {}) })
    if (out.length >= 3) break
  }
  return out
}

export function normalizeCharacterMomentAiDraft(
  raw: unknown,
  publisherCharacterId: string,
): CharacterMomentAiDraft | null {
  const o = unwrapMomentJsonPayload(raw)
  if (!o) return null
  const postType = normalizeCharacterMomentPostType(o.postType)
  const rawContent =
    typeof o.content === 'string'
      ? o.content
      : typeof o.text === 'string'
        ? o.text
        : typeof o.body === 'string'
          ? o.body
          : ''
  const content = sanitizeMomentBodyText(rawContent)
  const promptSource = Array.isArray(o.images)
    ? o.images
    : Array.isArray(o.imagePrompts)
      ? o.imagePrompts
      : []
  const images = promptSource
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .slice(0, MAX_MOMENT_IMAGES)
  const privacy = normalizeCharacterMomentPrivacyDraft(o, publisherCharacterId)
  const attachedMusicDraft = parseCharacterMomentSongDraftFromAi(o.attachedMusic)

  if (postType === 'text' && !content) return null
  if (postType === 'image' && !images.length) return null
  if (postType === 'mixed' && !content && !images.length) return null
  if (postType === 'music' && !attachedMusicDraft) return null

  const location = normalizeMomentLocation(o.location)
  const isPinned = o.isPinned === true
  const mentionUser = o.mentionUser === true
  const mentionCharacterIds = Array.isArray(o.mentionCharacterIds)
    ? o.mentionCharacterIds
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter(Boolean)
        .filter((id) => id !== publisherCharacterId)
        .slice(0, 5)
    : []

  const publisherSelfComments = normalizePublisherSelfComments(o.publisherSelfComments)

  return {
    postType,
    content,
    images,
    privacy,
    location,
    isPinned,
    mentionUser,
    mentionCharacterIds,
    ...(publisherSelfComments.length ? { publisherSelfComments } : {}),
    ...(attachedMusicDraft ? { attachedMusicDraft } : {}),
  }
}
