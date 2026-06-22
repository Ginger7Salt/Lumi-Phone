import {
  normalizePublisherSelfComments,
  type CharacterMomentPostType,
  type PublisherSelfCommentDraft,
} from './momentCharacterPublishTypes'
import type { CharacterMomentPrivacyDraft } from './momentCharacterPrivacyAi'
import { normalizeCharacterMomentPrivacyDraft } from './momentCharacterPrivacyAi'
import type { InstantGenContentTypeChoice } from './momentInstantGenContentTypes'
import { clampInstantGenTextLength, MAX_MOMENT_IMAGES } from './momentContentLimits'
import { normalizeMomentLocation } from './momentLocationUtils'
import { parseCharacterMomentSongDraftFromAi, type CharacterMomentSongDraft } from './momentAttachedMusic'
import { sanitizeMomentBodyText, sanitizeMomentText } from './momentTextSanitize'

const INSTANT_GEN_PAYLOAD_NEST_KEYS = ['data', 'result', 'moment', 'post', 'output', 'response'] as const

function unwrapInstantGenPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  for (const key of INSTANT_GEN_PAYLOAD_NEST_KEYS) {
    const nested = o[key]
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue
    const n = nested as Record<string, unknown>
    if ('content' in n || 'postType' in n || 'interactions' in n || 'imagePrompts' in n) {
      return n
    }
  }
  return o
}

export type InstantGenPostTypeChoice = 'text' | 'mixed' | 'image' | 'music'

export function instantGenPostTypeIncludesText(
  postType: InstantGenPostTypeChoice,
): boolean {
  return postType === 'text' || postType === 'mixed' || postType === 'music'
}

export function instantGenPostTypeRequiresText(
  postType: InstantGenPostTypeChoice,
): boolean {
  return postType === 'text' || postType === 'mixed'
}

export type InstantGenConfig = {
  targetCharacterId: string
  postType: InstantGenPostTypeChoice
  contentType: InstantGenContentTypeChoice
  /** contentType === 'custom' 时用户指定的内容偏向 */
  customContentDirection?: string
  /** 含文字载体时的目标正文字数（1～2000，含一字/标点） */
  textLengthTarget: number
  includeRecentChat: boolean
  includeOfflinePlots: boolean
}

export type InstantGenInteractionReplyDraft = {
  content: string
  delaySeconds: number
}

export type InstantGenInteractionDraft = {
  type: 'like' | 'comment'
  authorId: string
  delaySeconds: number
  id?: string
  content?: string
  /** 回复同批 interactions 里某条评论的 id（如 c_001） */
  replyTo?: string
  reply?: InstantGenInteractionReplyDraft
}

export type InstantGenAiDraft = {
  postType: CharacterMomentPostType
  content: string
  imagePrompts: string[]
  interactions: InstantGenInteractionDraft[]
  location?: string
  privacy: CharacterMomentPrivacyDraft
  mentionUser?: boolean
  mentionCharacterIds?: string[]
  publisherSelfComments?: PublisherSelfCommentDraft[]
  attachedMusicDraft?: CharacterMomentSongDraft
}

export function instantGenChoiceToPostType(choice: InstantGenPostTypeChoice): CharacterMomentPostType {
  return choice
}

export function normalizeInstantGenPostType(
  raw: unknown,
  fallback: InstantGenPostTypeChoice,
): CharacterMomentPostType {
  if (raw === 'text' || raw === 'mixed' || raw === 'image' || raw === 'music') return raw
  return fallback
}

import { clampMomentInteractionDelay } from './momentInteractionTiming'

function clampDelaySeconds(raw: unknown, fallback = 60): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : fallback
  return clampMomentInteractionDelay(n)
}

export function normalizeInstantGenAiDraft(
  raw: unknown,
  userPostType: InstantGenPostTypeChoice,
  publisherCharacterId: string,
  maxContentChars?: number,
): InstantGenAiDraft | null {
  const o = unwrapInstantGenPayload(raw)
  if (!o) return null
  const postType = userPostType
  const contentLimit =
    maxContentChars != null ? clampInstantGenTextLength(maxContentChars) : undefined
  const rawContent =
    typeof o.content === 'string'
      ? o.content
      : typeof o.text === 'string'
        ? o.text
        : typeof o.body === 'string'
          ? o.body
          : ''
  const content = sanitizeMomentBodyText(rawContent, contentLimit)
  const promptSource = Array.isArray(o.imagePrompts)
    ? o.imagePrompts
    : Array.isArray(o.images)
      ? o.images
      : []
  const rawPrompts = promptSource
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .slice(0, MAX_MOMENT_IMAGES)
  const imagePrompts = postType === 'text' || postType === 'music' ? [] : rawPrompts
  const attachedMusicDraft = parseCharacterMomentSongDraftFromAi(o.attachedMusic)

  const interactions: InstantGenInteractionDraft[] = []
  if (Array.isArray(o.interactions)) {
    for (const row of o.interactions) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const type = r.type === 'like' || r.type === 'comment' ? r.type : null
      const authorId = typeof r.authorId === 'string' ? r.authorId.trim() : ''
      if (!type || !authorId) continue
      const draft: InstantGenInteractionDraft = {
        type,
        authorId,
        delaySeconds: clampDelaySeconds(r.delaySeconds),
      }
      if (typeof r.id === 'string' && r.id.trim()) draft.id = r.id.trim()
      if (type === 'comment' && typeof r.content === 'string') {
        draft.content = sanitizeMomentText(r.content)
      }
      if (type === 'comment') {
        const replyTo =
          typeof r.replyTo === 'string'
            ? r.replyTo.trim()
            : typeof r.replyToId === 'string'
              ? r.replyToId.trim()
              : typeof r.replyToCommentId === 'string'
                ? r.replyToCommentId.trim()
                : ''
        if (replyTo) draft.replyTo = replyTo
      }
      if (type === 'comment' && r.reply && typeof r.reply === 'object') {
        const rep = r.reply as Record<string, unknown>
        const repContent = sanitizeMomentText(typeof rep.content === 'string' ? rep.content : '')
        if (repContent) {
          draft.reply = {
            content: repContent,
            delaySeconds: clampDelaySeconds(rep.delaySeconds, 90),
          }
        }
      }
      if (type === 'comment' && !draft.content?.trim()) continue
      interactions.push(draft)
      if (interactions.length >= 12) break
    }
  }

  if (postType === 'image' && !imagePrompts.length) return null
  if (postType === 'mixed' && !content && !imagePrompts.length) return null
  if (postType === 'music' && !attachedMusicDraft) return null

  const location = normalizeMomentLocation(o.location)
  const privacy = normalizeCharacterMomentPrivacyDraft(o, publisherCharacterId)
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
    imagePrompts,
    interactions,
    location,
    privacy,
    mentionUser,
    mentionCharacterIds,
    ...(publisherSelfComments.length ? { publisherSelfComments } : {}),
    ...(attachedMusicDraft ? { attachedMusicDraft } : {}),
  }
}
