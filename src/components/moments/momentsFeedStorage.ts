import { personaDb, emitWeChatStorageChanged } from '../../phone/apps/wechat/newFriendsPersona/idb'

import { normalizeMomentLocation } from './momentLocationUtils'
import { sanitizeMomentBodyText, sanitizeMomentText } from './momentTextSanitize'
import type { MomentComment, MomentItemModel } from './mockMoments'
import type { MomentInteraction } from './momentInteractionTypes'
import type { MomentPrivacyMeta } from './newMomentTypes'
import type { MomentContactRef } from './newMomentTypes'

function normalizeMomentContactRef(raw: unknown): MomentContactRef | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const name = typeof o.name === 'string' ? o.name : ''
  if (!id || !name) return null
  return {
    id,
    name,
    avatarUrl: typeof o.avatarUrl === 'string' ? o.avatarUrl : undefined,
    characterId: typeof o.characterId === 'string' ? o.characterId : undefined,
  }
}

function normalizeMomentPrivacy(raw: unknown): MomentPrivacyMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const mode =
    o.mode === 'public' ||
    o.mode === 'private' ||
    o.mode === 'shareWith' ||
    o.mode === 'hideFrom'
      ? o.mode
      : 'public'
  const visibilityLabel =
    typeof o.visibilityLabel === 'string' ? o.visibilityLabel : '公开'

  const mapContacts = (list: unknown) =>
    Array.isArray(list)
      ? list.map(normalizeMomentContactRef).filter((c): c is MomentContactRef => !!c)
      : undefined

  const mentions = mapContacts(o.mentions)
  const visibleToOnly = mapContacts(o.visibleToOnly)
  const hiddenFrom = mapContacts(o.hiddenFrom)

  return {
    mode,
    visibilityLabel,
    audienceOnlyUser: o.audienceOnlyUser === true,
    visibleToOnly: visibleToOnly?.length ? visibleToOnly : undefined,
    hiddenFrom: hiddenFrom?.length ? hiddenFrom : undefined,
    mentions: mentions?.length ? mentions : undefined,
    selectedTagIds: Array.isArray(o.selectedTagIds)
      ? o.selectedTagIds.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)
      : undefined,
    selectedContactIds: Array.isArray(o.selectedContactIds)
      ? o.selectedContactIds.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)
      : undefined,
    audience:
      o.audience && typeof o.audience === 'object' && !Array.isArray(o.audience)
        ? (o.audience as MomentPrivacyMeta['audience'])
        : undefined,
  }
}

const KV_PREFIX = 'wechat-user-moments-v1'

function kvKey(accountId: string): string {
  return `${KV_PREFIX}:${accountId.trim()}`
}

function normalizeComment(raw: unknown): MomentComment | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const author = typeof o.author === 'string' ? o.author : ''
  const content = sanitizeMomentText(typeof o.content === 'string' ? o.content : '')
  if (!id || !author || !content) return null
  return {
    id,
    author,
    content,
    replyTo: typeof o.replyTo === 'string' ? o.replyTo : undefined,
    isAuthorReply: o.isAuthorReply === true,
    replyToCommentId: typeof o.replyToCommentId === 'string' ? o.replyToCommentId : undefined,
    authorCharacterId: typeof o.authorCharacterId === 'string' ? o.authorCharacterId : undefined,
    elicited: o.elicited === true,
    createdAt:
      typeof o.createdAt === 'number' && Number.isFinite(o.createdAt) ? o.createdAt : undefined,
  }
}

function normalizeInteraction(raw: unknown): MomentInteraction | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const charId = typeof o.charId === 'string' ? o.charId.trim() : ''
  const type = o.type === 'like' || o.type === 'comment' || o.type === 'viewed' ? o.type : null
  const visibleAt = typeof o.visibleAt === 'number' && Number.isFinite(o.visibleAt) ? o.visibleAt : null
  if (!id || !charId || !type || visibleAt == null) return null
  return {
    id,
    charId,
    type,
    visibleAt,
    content: typeof o.content === 'string' ? sanitizeMomentText(o.content) : undefined,
    replyToCharId: typeof o.replyToCharId === 'string' ? o.replyToCharId : undefined,
    replyToInteractionId: typeof o.replyToInteractionId === 'string' ? o.replyToInteractionId : undefined,
    replyToCommentId: typeof o.replyToCommentId === 'string' ? o.replyToCommentId : undefined,
    isAuthorReply: o.isAuthorReply === true,
    dwellSeconds: typeof o.dwellSeconds === 'number' ? o.dwellSeconds : undefined,
  }
}

function normalizeMoment(raw: unknown): MomentItemModel | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const authorName = typeof o.authorName === 'string' ? o.authorName : ''
  const authorAvatar = typeof o.authorAvatar === 'string' ? o.authorAvatar : ''
  const content = sanitizeMomentBodyText(typeof o.content === 'string' ? o.content : '')
  const timestamp = typeof o.timestamp === 'number' && Number.isFinite(o.timestamp) ? o.timestamp : Date.now()
  if (!id || !authorName) return null

  const likes = Array.isArray(o.likes)
    ? o.likes.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)
    : undefined

  const comments = Array.isArray(o.comments)
    ? o.comments.map(normalizeComment).filter((c): c is MomentComment => !!c)
    : undefined

  const interactions = Array.isArray(o.interactions)
    ? o.interactions.map(normalizeInteraction).filter((i): i is MomentInteraction => !!i)
    : undefined

  const images = Array.isArray(o.images)
    ? o.images.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)
    : undefined

  return {
    id,
    authorName,
    authorAvatar,
    content,
    timestamp,
    likes: likes?.length ? likes : undefined,
    comments: comments?.length ? comments : undefined,
    interactions: interactions?.length ? interactions : undefined,
    images: images?.length ? images : undefined,
    location: normalizeMomentLocation(o.location),
    isUserAuthored: o.isUserAuthored === true,
    authorCharacterId: typeof o.authorCharacterId === 'string' ? o.authorCharacterId : undefined,
    postType:
      o.postType === 'text' || o.postType === 'image' || o.postType === 'mixed'
        ? o.postType
        : undefined,
    privacy: normalizeMomentPrivacy(o.privacy),
    isPinned: o.isPinned === true,
  }
}

export async function loadUserMoments(accountId: string | null | undefined): Promise<MomentItemModel[]> {
  const acc = accountId?.trim()
  if (!acc) return []
  try {
    const raw = await personaDb.getPhoneKv(kvKey(acc))
    if (!Array.isArray(raw)) return []
    return raw
      .map(normalizeMoment)
      .filter((m): m is MomentItemModel => !!m)
      .sort((a, b) => b.timestamp - a.timestamp)
  } catch {
    return []
  }
}

export async function saveUserMoments(
  accountId: string | null | undefined,
  items: MomentItemModel[],
): Promise<void> {
  const acc = accountId?.trim()
  if (!acc) return
  try {
    await personaDb.setPhoneKv(kvKey(acc), items)
    emitWeChatStorageChanged()
  } catch {
    // ignore quota
  }
}

export async function clearUserMoments(accountId: string | null | undefined): Promise<void> {
  await saveUserMoments(accountId, [])
}

export async function upsertUserMoment(
  accountId: string | null | undefined,
  item: MomentItemModel,
): Promise<MomentItemModel[]> {
  const acc = accountId?.trim()
  if (!acc) return [item]
  const existing = await loadUserMoments(acc)
  const withoutDup = existing.filter((m) => m.id !== item.id)
  const next = [item, ...withoutDup].sort((a, b) => b.timestamp - a.timestamp)
  await saveUserMoments(acc, next)
  return next
}

export async function deleteUserMoment(
  accountId: string | null | undefined,
  momentId: string,
): Promise<MomentItemModel[]> {
  const acc = accountId?.trim()
  const id = momentId.trim()
  if (!acc || !id) return []
  const existing = await loadUserMoments(acc)
  const next = existing.filter((m) => m.id !== id)
  await saveUserMoments(acc, next)
  return next
}

export async function patchUserMoment(
  accountId: string | null | undefined,
  momentId: string,
  patch: Partial<MomentItemModel>,
): Promise<MomentItemModel[]> {
  const acc = accountId?.trim()
  if (!acc) return []
  const existing = await loadUserMoments(acc)
  const next = existing.map((m) => (m.id === momentId ? { ...m, ...patch } : m))
  await saveUserMoments(acc, next)
  return next
}
