import { useEffect, useMemo } from 'react'

import type { MomentItemModel } from './mockMoments'
import { canUserSeeCharacterMoment } from './momentFeedVisibility'
import { buildMomentsContactDirectory } from './momentsContactDirectory'
import {
  buildMentionNoticeFromMoment,
  momentMentionSourceId,
  momentMentionsUser,
} from './momentMentionUtils'
import {
  buildNoticeFromInteraction,
  shouldPermanentlySkipInteractionNotice,
} from './momentInteractionNoticeEngine'
import { getUnlockedInteractions } from './momentInteractionTypes'
import type { MomentContactRef } from './newMomentTypes'
import { useMomentsSettingsStore } from './useMomentsSettingsStore'
import { useMomentsStore } from './useMomentsStore'

type SyncMomentNoticesParams = {
  moments: MomentItemModel[]
  now: number
  userDisplayName: string
  playerIdentityId?: string | null
  momentContacts: MomentContactRef[]
}

export function useSyncMomentInteractionNotices({
  moments,
  now,
  userDisplayName,
  playerIdentityId,
  momentContacts,
}: SyncMomentNoticesParams) {
  const { settings } = useMomentsSettingsStore()
  const pushNotice = useMomentsStore((s) => s.pushNotice)
  const markProcessedInteraction = useMomentsStore((s) => s.markProcessedInteraction)
  const hasProcessedInteraction = useMomentsStore((s) => s.hasProcessedInteraction)

  const contactDirectory = useMemo(
    () => buildMomentsContactDirectory(momentContacts),
    [momentContacts],
  )

  const contactCharIds = useMemo(() => {
    const ids = new Set<string>()
    for (const c of momentContacts) {
      const cid = c.characterId?.trim()
      if (cid) ids.add(cid)
    }
    return ids
  }, [momentContacts])

  useEffect(() => {
    for (const moment of moments) {
      if (
        momentMentionsUser(moment) &&
        canUserSeeCharacterMoment(moment, momentContacts) &&
        !hasProcessedInteraction(momentMentionSourceId(moment.id))
      ) {
        const mentionNotice = buildMentionNoticeFromMoment(moment)
        if (mentionNotice) pushNotice(mentionNotice)
      }

      const unlocked = getUnlockedInteractions(moment.interactions, now)
      for (const interaction of unlocked) {
        if (interaction.type === 'viewed') {
          markProcessedInteraction(interaction.id)
          continue
        }
        if (hasProcessedInteraction(interaction.id)) continue

        const dispatchInput = {
          moment,
          interaction,
          userDisplayName,
          playerIdentityId,
          onlyDirectInteraction: settings.onlyDirectInteraction,
          contactCharIds,
          resolveDisplayName: contactDirectory.getDisplayName,
          now,
        }

        const notice = buildNoticeFromInteraction(dispatchInput)

        if (notice) {
          pushNotice(notice)
        } else if (shouldPermanentlySkipInteractionNotice(dispatchInput)) {
          markProcessedInteraction(interaction.id)
        }
      }
    }
  }, [
    contactCharIds,
    contactDirectory,
    hasProcessedInteraction,
    markProcessedInteraction,
    moments,
    now,
    playerIdentityId,
    pushNotice,
    settings.onlyDirectInteraction,
    userDisplayName,
    momentContacts,
  ])
}
