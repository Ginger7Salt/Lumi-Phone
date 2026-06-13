import { useEffect, useMemo, useState } from 'react'

import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import {
  resolveCharacterAvatarUrl,
  resolveProfileAvatarPreviewUrl,
} from '../../phone/utils/characterAvatarUrl'

import type { MomentItemModel } from './mockMoments'
import { loadUserMoments } from './momentsFeedStorage'
import { resolveMomentsCoverDisplayUrl } from './momentsCoverDefaults'
import {
  buildArchiveTimelineEntries,
  filterMomentsForArchiveSubject,
  isArchiveCurrentUser,
  pickPinnedMoments,
} from './userMomentsArchiveFilters'

export type UserMomentsArchiveProfile = {
  userId: string
  isCurrentUser: boolean
  displayName: string
  signature: string
  avatarUrl: string
  coverUrl: string
}

type UseUserMomentsArchiveParams = {
  accountId: string | null | undefined
  userId: string
  selfProfile?: {
    displayName: string
    signature?: string
    avatarUrl?: string
    coverUrl?: string
  }
}

export function useUserMomentsArchive(params: UseUserMomentsArchiveParams) {
  const [allMoments, setAllMoments] = useState<MomentItemModel[]>([])
  const [profile, setProfile] = useState<UserMomentsArchiveProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const userId = params.userId.trim()
  const isCurrentUser = isArchiveCurrentUser(userId)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void (async () => {
      const moments = await loadUserMoments(params.accountId)
      if (cancelled) return

      const subjectMoments = filterMomentsForArchiveSubject(moments, userId)
      setAllMoments(subjectMoments)

      if (isCurrentUser) {
        const self = params.selfProfile
        setProfile({
          userId,
          isCurrentUser: true,
          displayName: self?.displayName.trim() || '我',
          signature: self?.signature?.trim() || '',
          avatarUrl: resolveProfileAvatarPreviewUrl(self?.avatarUrl) || '',
          coverUrl: resolveMomentsCoverDisplayUrl(self?.coverUrl),
        })
        setLoading(false)
        return
      }

      const character = await personaDb.getCharacter(userId)
      if (cancelled) return

      const displayName =
        character?.remark?.trim() ||
        character?.wechatNickname?.trim() ||
        character?.name?.trim() ||
        '未命名'
      const signature = character?.wechatSignature?.trim() || character?.motto?.trim() || ''
      const avatarUrl =
        resolveProfileAvatarPreviewUrl(
          resolveCharacterAvatarUrl({ avatarUrl: character?.avatarUrl }),
        ) || ''
      const coverUrl = resolveMomentsCoverDisplayUrl(character?.momentsCoverUrl)

      setProfile({
        userId,
        isCurrentUser: false,
        displayName,
        signature,
        avatarUrl,
        coverUrl,
      })
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [
    isCurrentUser,
    params.accountId,
    params.selfProfile?.avatarUrl,
    params.selfProfile?.coverUrl,
    params.selfProfile?.displayName,
    params.selfProfile?.signature,
    userId,
  ])

  useEffect(() => {
    const reloadProfile = async () => {
      if (isCurrentUser) {
        const self = params.selfProfile
        setProfile({
          userId,
          isCurrentUser: true,
          displayName: self?.displayName.trim() || '我',
          signature: self?.signature?.trim() || '',
          avatarUrl: resolveProfileAvatarPreviewUrl(self?.avatarUrl) || '',
          coverUrl: resolveMomentsCoverDisplayUrl(self?.coverUrl),
        })
        return
      }
      const character = await personaDb.getCharacter(userId)
      const displayName =
        character?.remark?.trim() ||
        character?.wechatNickname?.trim() ||
        character?.name?.trim() ||
        '未命名'
      const signature = character?.wechatSignature?.trim() || character?.motto?.trim() || ''
      const avatarUrl =
        resolveProfileAvatarPreviewUrl(
          resolveCharacterAvatarUrl({ avatarUrl: character?.avatarUrl }),
        ) || ''
      const coverUrl = resolveMomentsCoverDisplayUrl(character?.momentsCoverUrl)
      setProfile({
        userId,
        isCurrentUser: false,
        displayName,
        signature,
        avatarUrl,
        coverUrl,
      })
    }

    const onStorage = () => {
      void loadUserMoments(params.accountId).then((moments) => {
        setAllMoments(filterMomentsForArchiveSubject(moments, userId))
      })
      void reloadProfile()
    }
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [
    isCurrentUser,
    params.accountId,
    params.selfProfile?.avatarUrl,
    params.selfProfile?.coverUrl,
    params.selfProfile?.displayName,
    params.selfProfile?.signature,
    userId,
  ])

  const pinnedMoments = useMemo(() => pickPinnedMoments(allMoments), [allMoments])
  const timelineEntries = useMemo(
    () => buildArchiveTimelineEntries(allMoments, isCurrentUser),
    [allMoments, isCurrentUser],
  )

  return {
    loading,
    profile,
    allMoments,
    setAllMoments,
    pinnedMoments,
    timelineEntries,
    refreshMoments: async () => {
      const moments = await loadUserMoments(params.accountId)
      setAllMoments(filterMomentsForArchiveSubject(moments, userId))
    },
  }
}
