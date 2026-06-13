import type { MomentsContactDirectory } from './momentsContactDirectory'
import type { MomentContactRef, MomentPrivacyMeta } from './newMomentTypes'

export type ResolvedVisibilityName = {
  name: string
  isUser: boolean
}

export type ResolvedVisibilityProtocol =
  | { kind: 'public' }
  | { kind: 'onlyUser' }
  | { kind: 'private' }
  | { kind: 'shareWith'; names: ResolvedVisibilityName[] }
  | { kind: 'hideFrom'; names: ResolvedVisibilityName[] }

export function buildMomentContactNameResolver(params: {
  contactDirectory: MomentsContactDirectory
  momentContacts: MomentContactRef[]
  currentUserName: string
}): (ref: MomentContactRef) => ResolvedVisibilityName {
  const byId = new Map(params.momentContacts.map((c) => [c.id, c]))

  return (ref) => {
    if (ref.id === 'self') {
      return {
        name: params.currentUserName.trim() || ref.name.trim() || '我',
        isUser: true,
      }
    }
    const live = byId.get(ref.id)
    const charId = (live?.characterId ?? ref.characterId)?.trim()
    if (charId) {
      return {
        name: params.contactDirectory.getDisplayName(charId),
        isUser: false,
      }
    }
    return {
      name: (live?.name ?? ref.name).trim() || '未命名',
      isUser: false,
    }
  }
}

export function resolveMomentVisibilityProtocol(
  privacy: MomentPrivacyMeta | undefined,
  resolveName: (ref: MomentContactRef) => ResolvedVisibilityName,
): ResolvedVisibilityProtocol {
  if (!privacy) return { kind: 'public' }
  if (privacy.audienceOnlyUser) return { kind: 'onlyUser' }

  switch (privacy.mode) {
    case 'public':
      return { kind: 'public' }
    case 'private':
      return { kind: 'private' }
    case 'shareWith':
      return {
        kind: 'shareWith',
        names: (privacy.visibleToOnly ?? []).map(resolveName),
      }
    case 'hideFrom':
      return {
        kind: 'hideFrom',
        names: (privacy.hiddenFrom ?? []).map(resolveName),
      }
    default:
      return { kind: 'public' }
  }
}
