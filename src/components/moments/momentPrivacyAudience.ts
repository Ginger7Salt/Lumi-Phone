import type { ContactTag, MomentContactRef, NewMomentPrivacy } from './newMomentTypes'
import { resolvePrivacyContactIds } from './privacySelectionUtils'

export type AllowedMomentCharacter = {
  charId: string
  displayName: string
}

export function filterAllowedMomentCharacters(
  privacy: NewMomentPrivacy,
  contacts: MomentContactRef[],
  tags: ContactTag[],
): AllowedMomentCharacter[] {
  const friends = contacts.filter((c) => c.id !== 'self' && c.characterId?.trim())
  if (privacy.mode === 'private') return []

  if (privacy.mode === 'public') {
    return friends.map((c) => ({
      charId: c.characterId!.trim(),
      displayName: c.name.trim() || '未命名',
    }))
  }

  if (privacy.mode === 'shareWith') {
    const allowedContactIds = new Set(
      resolvePrivacyContactIds(
        tags,
        privacy.selectedTagIds ?? [],
        privacy.selectedContactIds ?? [],
      ),
    )
    return friends
      .filter((c) => allowedContactIds.has(c.id))
      .map((c) => ({
        charId: c.characterId!.trim(),
        displayName: c.name.trim() || '未命名',
      }))
  }

  if (privacy.mode === 'hideFrom') {
    const hiddenContactIds = new Set(
      resolvePrivacyContactIds(
        tags,
        privacy.selectedTagIds ?? [],
        privacy.selectedContactIds ?? [],
      ),
    )
    return friends
      .filter((c) => !hiddenContactIds.has(c.id))
      .map((c) => ({
        charId: c.characterId!.trim(),
        displayName: c.name.trim() || '未命名',
      }))
  }

  return []
}
