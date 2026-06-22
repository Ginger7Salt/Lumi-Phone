export type MomentPrivacyMode = 'public' | 'private' | 'shareWith' | 'hideFrom'

export type MomentContactRef = {
  id: string
  name: string
  avatarUrl?: string
  characterId?: string
}

export interface ContactTag {
  id: string
  /** 标签名，如 "家人", "高冷男主们" */
  name: string
  memberIds: string[]
}

export type PrivacyAudienceSelection = {
  type: 'share' | 'hide'
  selectedTags: string[]
  selectedContacts: string[]
}

export type NewMomentPrivacy = {
  mode: MomentPrivacyMode
  /** 解析后的联系人（标签成员 + 直接勾选并集） */
  contacts: MomentContactRef[]
  selectedTagIds?: string[]
  selectedContactIds?: string[]
  audience?: PrivacyAudienceSelection
}

import type { MomentAttachedMusic } from './momentAttachedMusic'

export type NewMomentDraft = {
  content: string
  images: string[]
  attachedMusic?: MomentAttachedMusic
  location: string | null
  mentions: MomentContactRef[]
  privacy: NewMomentPrivacy
}

export type MomentPrivacyMeta = {
  mode: MomentPrivacyMode
  visibilityLabel: string
  /** 角色「仅对你可见」钓鱼朋友圈 */
  audienceOnlyUser?: boolean
  visibleToOnly?: MomentContactRef[]
  hiddenFrom?: MomentContactRef[]
  mentions?: MomentContactRef[]
  selectedTagIds?: string[]
  selectedContactIds?: string[]
  audience?: PrivacyAudienceSelection
}

export function createEmptyNewMoment(): NewMomentDraft {
  return {
    content: '',
    images: [],
    location: null,
    mentions: [],
    privacy: { mode: 'public', contacts: [] },
  }
}

export function isNewMomentPublishable(draft: NewMomentDraft): boolean {
  return (
    draft.content.trim().length > 0 ||
    draft.images.length > 0 ||
    Boolean(draft.attachedMusic?.title.trim())
  )
}

export function formatLocationPreview(location: string | null): string {
  const t = location?.trim()
  return t || '不显示'
}

export function formatMentionPreview(mentions: MomentContactRef[]): string {
  if (!mentions.length) return '不提醒'
  if (mentions.length <= 2) return mentions.map((c) => c.name).join(', ')
  return `${mentions[0]!.name} 等 ${mentions.length} 人`
}

export function formatPrivacyPreview(privacy: NewMomentPrivacy, tags: ContactTag[] = []): string {
  const tagNames = (privacy.selectedTagIds ?? [])
    .map((id) => tags.find((t) => t.id === id)?.name)
    .filter((n): n is string => !!n)
  const directNames = privacy.contacts
    .filter((c) => (privacy.selectedContactIds ?? []).includes(c.id))
    .map((c) => c.name)
  const labels = [...tagNames, ...directNames]
  const resolvedCount = privacy.contacts.length

  switch (privacy.mode) {
    case 'public':
      return '公开'
    case 'private':
      return '私密'
    case 'shareWith':
      if (!labels.length && !resolvedCount) return '部分可见'
      if (tagNames.length && !directNames.length && tagNames.length <= 2) {
        return `仅 ${tagNames.join(', ')} 可见`
      }
      if (labels.length <= 2) return `仅 ${labels.join(', ')} 可见`
      return `仅 ${labels[0]} 等 ${resolvedCount || labels.length} 人可见`
    case 'hideFrom':
      if (!labels.length && !resolvedCount) return '不给谁看'
      if (tagNames.length && !directNames.length && tagNames.length <= 2) {
        return `${tagNames.join(', ')} 不可见`
      }
      if (labels.length <= 2) return `${labels.join(', ')} 不可见`
      return `${labels[0]} 等 ${resolvedCount || labels.length} 人不可见`
    default:
      return '公开'
  }
}

/** 查手机朋友圈镜像用的 visibility 文案 */
export function buildMomentVisibilityLabel(
  privacy: NewMomentPrivacy,
  tags: ContactTag[] = [],
): string {
  return formatPrivacyPreview(privacy, tags)
}
