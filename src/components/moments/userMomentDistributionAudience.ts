import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'

import type { MomentItemModel } from './mockMoments'
import {
  filterAllowedMomentCharacters,
  type AllowedMomentCharacter,
} from './momentPrivacyAudience'
import { filterPlayerBoundMomentCharacters } from './momentRelationshipGraph'
import { privacyMetaToDraftPrivacy } from './momentVisitorFootprints'
import type { ContactTag, MomentContactRef } from './newMomentTypes'

export type UserMomentAudienceSnapshot = {
  visible: AllowedMomentCharacter[]
  hidden: AllowedMomentCharacter[]
}

function listAllFriendCharacters(contacts: MomentContactRef[]): AllowedMomentCharacter[] {
  return contacts
    .filter((c) => c.id !== 'self' && c.characterId?.trim())
    .map((c) => ({
      charId: c.characterId!.trim(),
      displayName: c.name.trim() || '未命名',
    }))
}

/** 按用户设置的隐私 + 玩家身份绑定，解析哪些角色可见 / 不可见该条用户朋友圈 */
export function resolveUserMomentAudience(params: {
  moment: MomentItemModel
  momentContacts: MomentContactRef[]
  tags: ContactTag[]
  playerIdentityId: string | null | undefined
  relationships: ReadonlyArray<Relationship>
}): UserMomentAudienceSnapshot {
  const privacy = privacyMetaToDraftPrivacy(params.moment.privacy)
  const allFriends = listAllFriendCharacters(params.momentContacts)
  const allowedByPrivacy = filterAllowedMomentCharacters(
    privacy,
    params.momentContacts,
    params.tags,
  )
  const visible = filterPlayerBoundMomentCharacters(
    allowedByPrivacy,
    params.playerIdentityId,
    params.relationships,
  )
  const visibleIds = new Set(visible.map((v) => v.charId))
  const hidden = allFriends.filter((f) => !visibleIds.has(f.charId))
  return { visible, hidden }
}
