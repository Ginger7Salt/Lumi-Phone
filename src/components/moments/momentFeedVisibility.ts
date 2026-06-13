import type { MomentItemModel } from './mockMoments'
import type { MomentContactRef } from './newMomentTypes'

function isUserSelfContact(contact: MomentContactRef): boolean {
  return contact.id === 'self'
}

/** 角色朋友圈是否对当前用户可见 */
export function canUserSeeCharacterMoment(
  item: MomentItemModel,
  _momentContacts: MomentContactRef[],
  blockedCharacterIds: Set<string> = new Set(),
): boolean {
  if (item.isUserAuthored) return true
  const charId = item.authorCharacterId?.trim()
  if (!charId) return true
  if (blockedCharacterIds.has(charId)) return false

  const privacy = item.privacy
  if (!privacy) return true

  if (privacy.audienceOnlyUser) return true

  if (privacy.mode === 'shareWith') {
    const visibleIds = new Set((privacy.visibleToOnly ?? []).map((c) => c.id))
    if (!visibleIds.size) return true
    return visibleIds.has('self')
  }

  if (privacy.mode === 'hideFrom') {
    const hiddenIds = new Set((privacy.hiddenFrom ?? []).map((c) => c.id))
    return !hiddenIds.has('self')
  }

  return true
}

export function filterMomentsForUserFeed(
  moments: MomentItemModel[],
  momentContacts: MomentContactRef[],
  blockedCharacterIds: Set<string> = new Set(),
): MomentItemModel[] {
  return moments.filter((item) =>
    canUserSeeCharacterMoment(item, momentContacts, blockedCharacterIds),
  )
}

/** 可参与角色发朋友圈的通讯录（排除自己、无 characterId、被屏蔽朋友圈的角色） */
export function filterPublishableCharacterContacts(
  contacts: MomentContactRef[],
  blockedCharacterIds: Set<string> = new Set(),
): MomentContactRef[] {
  return contacts.filter((c) => {
    if (isUserSelfContact(c)) return false
    const charId = c.characterId?.trim()
    if (!charId) return false
    if (blockedCharacterIds.has(charId)) return false
    return true
  })
}
