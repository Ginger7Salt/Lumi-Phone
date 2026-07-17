import type { CharacterMomentPostType } from './momentCharacterPublishTypes'
import type { PublisherSelfCommentDraft } from './momentCharacterPublishTypes'
import type { CharacterMomentPrivacyDraft } from './momentCharacterPrivacyAi'
import { resolveCharacterMomentPrivacyMeta } from './momentCharacterPrivacyAi'
import {
  applyMentionsToPrivacyMeta,
  resolveCharacterMomentMentions,
} from './momentMentionUtils'
import type { MomentAttachedMusic } from './momentAttachedMusic'
import type { MomentItemModel } from './mockMoments'
import { normalizeMomentLocation } from './momentLocationUtils'
import { sanitizeMomentBodyText } from './momentTextSanitize'
import {
  buildMomentVisibilityLabel,
  type ContactTag,
  type MomentContactRef,
  type NewMomentDraft,
} from './newMomentTypes'
import { materializePublisherSelfComments } from './momentInteractionTypes'

export function draftToMomentItem(
  draft: NewMomentDraft,
  author: { name: string; avatar: string },
  tags: ContactTag[] = [],
): MomentItemModel {
  const id = `m-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const visibilityLabel = buildMomentVisibilityLabel(draft.privacy, tags)

  return {
    id,
    authorName: author.name,
    authorAvatar: author.avatar,
    content: sanitizeMomentBodyText(draft.content),
    images: draft.images.length ? draft.images : undefined,
    attachedMusic: draft.attachedMusic,
    location: normalizeMomentLocation(draft.location ?? undefined),
    timestamp: Date.now(),
    likes: [],
    comments: [],
    interactions: [],
    isUserAuthored: true,
    privacy: {
      mode: draft.privacy.mode,
      visibilityLabel,
      visibleToOnly:
        draft.privacy.mode === 'shareWith' ? draft.privacy.contacts : undefined,
      hiddenFrom: draft.privacy.mode === 'hideFrom' ? draft.privacy.contacts : undefined,
      mentions: draft.mentions.length ? draft.mentions : undefined,
      selectedTagIds: draft.privacy.selectedTagIds,
      selectedContactIds: draft.privacy.selectedContactIds,
      audience: draft.privacy.audience,
    },
  }
}

export function mockContactsToMomentRefs(
  contacts: { id: string; remarkName: string; avatarUrl?: string; characterId?: string }[],
): MomentContactRef[] {
  return contacts.map((c) => ({
    id: c.id,
    name: c.remarkName.trim() || '未命名',
    avatarUrl: c.avatarUrl,
    characterId: c.characterId,
  }))
}

/** 提醒谁看：仅好友，不含当前用户（`self`） */
export function filterMentionableMomentContacts(contacts: MomentContactRef[]): MomentContactRef[] {
  return contacts.filter((c) => c.id !== 'self')
}

export function characterPostToMomentItem(params: {
  characterId: string
  authorName: string
  authorAvatar: string
  postType: CharacterMomentPostType
  content: string
  imageUrls: string[]
  /** 与 imageUrls 对齐的生图提示词 */
  imagePrompts?: string[]
  location?: string
  privacy: CharacterMomentPrivacyDraft
  userContact?: MomentContactRef
  momentContacts?: MomentContactRef[]
  timestamp?: number
  isPinned?: boolean
  mentionUser?: boolean
  mentionCharacterIds?: string[]
  publisherSelfComments?: PublisherSelfCommentDraft[]
  attachedMusic?: MomentAttachedMusic
}): MomentItemModel {
  const ts =
    typeof params.timestamp === 'number' && Number.isFinite(params.timestamp)
      ? params.timestamp
      : Date.now()
  const id = `m-char-${params.characterId}-${ts}-${Math.random().toString(36).slice(2, 7)}`
  const privacyBase = resolveCharacterMomentPrivacyMeta({
    draft: params.privacy,
    momentContacts: params.momentContacts ?? [],
    userContact: params.userContact,
  })
  const mentions = resolveCharacterMomentMentions({
    mentionUser: params.mentionUser,
    mentionCharacterIds: params.mentionCharacterIds,
    userContact: params.userContact,
    momentContacts: params.momentContacts,
  })
  const privacy = applyMentionsToPrivacyMeta(privacyBase, mentions)
  const interactions = params.publisherSelfComments?.length
    ? materializePublisherSelfComments(params.publisherSelfComments, params.characterId, ts)
    : []

  return {
    id,
    authorName: params.authorName,
    authorAvatar: params.authorAvatar,
    content: params.content,
    images: params.imageUrls.length ? params.imageUrls : undefined,
    imagePrompts:
      params.imageUrls.length && params.imagePrompts?.length
        ? params.imageUrls.map((_, i) => String(params.imagePrompts?.[i] ?? '').trim())
        : undefined,
    attachedMusic: params.attachedMusic,
    location: params.location,
    timestamp: ts,
    likes: [],
    comments: [],
    interactions,
    isUserAuthored: false,
    authorCharacterId: params.characterId,
    postType: params.postType,
    privacy,
    ...(params.isPinned ? { isPinned: true } : {}),
  }
}
