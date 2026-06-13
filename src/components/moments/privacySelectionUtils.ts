import type {
  ContactTag,
  MomentContactRef,
  MomentPrivacyMode,
  NewMomentPrivacy,
  PrivacyAudienceSelection,
} from './newMomentTypes'

export type { PrivacyAudienceSelection }

export function privacyModeToAudienceType(mode: MomentPrivacyMode): 'share' | 'hide' | null {
  if (mode === 'shareWith') return 'share'
  if (mode === 'hideFrom') return 'hide'
  return null
}

export function resolvePrivacyContactIds(
  tags: ContactTag[],
  selectedTagIds: string[],
  selectedContactIds: string[],
): string[] {
  const ids = new Set<string>()
  for (const tagId of selectedTagIds) {
    const tag = tags.find((t) => t.id === tagId)
    tag?.memberIds.forEach((id) => ids.add(id))
  }
  selectedContactIds.forEach((id) => ids.add(id))
  return Array.from(ids)
}

export function resolvePrivacyContacts(
  contacts: MomentContactRef[],
  tags: ContactTag[],
  selectedTagIds: string[],
  selectedContactIds: string[],
): MomentContactRef[] {
  const byId = new Map(contacts.map((c) => [c.id, c]))
  return resolvePrivacyContactIds(tags, selectedTagIds, selectedContactIds)
    .map((id) => byId.get(id))
    .filter((c): c is MomentContactRef => !!c)
}

export function buildPrivacyFromDraft(params: {
  mode: MomentPrivacyMode
  selectedTagIds: string[]
  selectedContactIds: string[]
  contacts: MomentContactRef[]
  tags: ContactTag[]
}): NewMomentPrivacy {
  const { mode, selectedTagIds, selectedContactIds, contacts, tags } = params
  const audienceType = privacyModeToAudienceType(mode)
  const resolved = resolvePrivacyContacts(contacts, tags, selectedTagIds, selectedContactIds)

  return {
    mode,
    contacts: mode === 'public' || mode === 'private' ? [] : resolved,
    selectedTagIds: mode === 'public' || mode === 'private' ? [] : selectedTagIds,
    selectedContactIds: mode === 'public' || mode === 'private' ? [] : selectedContactIds,
    audience:
      audienceType && (selectedTagIds.length || selectedContactIds.length)
        ? {
            type: audienceType,
            selectedTags: selectedTagIds,
            selectedContacts: selectedContactIds,
          }
        : audienceType
          ? { type: audienceType, selectedTags: selectedTagIds, selectedContacts: selectedContactIds }
          : undefined,
  }
}

/** 隐私配置可选好友（不含当前用户） */
export function filterPrivacyPickableContacts(contacts: MomentContactRef[]): MomentContactRef[] {
  return contacts.filter((c) => c.id !== 'self')
}
