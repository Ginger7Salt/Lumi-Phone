import type { MomentItemModel } from './mockMoments'
import { canUserSeeCharacterMoment } from './momentFeedVisibility'
import { sanitizeMomentBodyText } from './momentTextSanitize'
import type { MomentContactRef } from './newMomentTypes'
import { filterMomentsForArchiveSubject } from './userMomentsArchiveFilters'

export const CONTACT_MOMENTS_SNAPSHOT_LIMIT = 5

export type ContactMomentSnapshotCell =
  | { kind: 'image'; id: string; src: string }
  | { kind: 'text'; id: string; preview: string }

export function pickContactMomentSnapshots(
  allMoments: MomentItemModel[],
  characterId: string,
  momentContacts: MomentContactRef[] = [],
  blockedCharacterIds: Set<string> = new Set(),
  limit = CONTACT_MOMENTS_SNAPSHOT_LIMIT,
): ContactMomentSnapshotCell[] {
  const charId = characterId.trim()
  if (!charId) return []

  const subjectMoments = filterMomentsForArchiveSubject(allMoments, charId).filter((item) =>
    canUserSeeCharacterMoment(item, momentContacts, blockedCharacterIds),
  )

  return subjectMoments.slice(0, limit).map((moment) => {
    const firstImage = moment.images?.find((src) => src.trim())
    if (firstImage) {
      return { kind: 'image' as const, id: moment.id, src: firstImage.trim() }
    }
    const preview = sanitizeMomentBodyText(moment.content).trim()
    return {
      kind: 'text' as const,
      id: moment.id,
      preview: preview || '分享图片',
    }
  })
}
