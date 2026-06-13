import { WECHAT_SELF_PEER_CHARACTER_ID } from '../../phone/apps/wechat/wechatConversationKey'

import type { MomentItemModel } from './mockMoments'
import { getDayKey } from './utils/archiveTimelineDate'

export type ArchiveSubjectId = 'self' | string

export function isArchiveCurrentUser(userId: string): boolean {
  const id = userId.trim()
  return id === 'self' || id === '__self__' || id === WECHAT_SELF_PEER_CHARACTER_ID
}

export function filterMomentsForArchiveSubject(
  moments: MomentItemModel[],
  userId: string,
): MomentItemModel[] {
  const subject = userId.trim()
  if (!subject) return []
  if (isArchiveCurrentUser(subject)) {
    return moments.filter((m) => !!m.isUserAuthored)
  }
  return moments.filter((m) => m.authorCharacterId?.trim() === subject)
}

export type ArchiveTimelineEntry =
  | { kind: 'camera'; id: string; sortAt: number; dayKey: string }
  | { kind: 'moment'; id: string; moment: MomentItemModel; sortAt: number; dayKey: string }

export function buildArchiveTimelineEntries(
  moments: MomentItemModel[],
  isCurrentUser: boolean,
  nowMs = Date.now(),
): ArchiveTimelineEntry[] {
  const entries: ArchiveTimelineEntry[] = []

  if (isCurrentUser) {
    entries.push({
      kind: 'camera',
      id: 'archive-camera-today',
      sortAt: nowMs + 1,
      dayKey: getDayKey(nowMs, nowMs),
    })
  }

  for (const moment of moments) {
    entries.push({
      kind: 'moment',
      id: moment.id,
      moment,
      sortAt: moment.timestamp,
      dayKey: getDayKey(moment.timestamp, nowMs),
    })
  }

  return entries.sort((a, b) => b.sortAt - a.sortAt || a.id.localeCompare(b.id))
}

export function pickPinnedMoments(moments: MomentItemModel[]): MomentItemModel[] {
  return moments.filter((m) => m.isPinned).sort((a, b) => b.timestamp - a.timestamp)
}
