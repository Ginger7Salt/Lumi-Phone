import { useCallback, useEffect, useState } from 'react'

import type { ArtistDetailInfo } from './ListenTogetherArtistDetailPage'
import { ListenTogetherArtistDetailPage } from './ListenTogetherArtistDetailPage'
import { ListenTogetherUserProfilePage } from './ListenTogetherUserProfilePage'
import { ListenTogetherActionToast } from './ListenTogetherActionToast'
import {
  LISTEN_TOGETHER_OPEN_PROFILE_EVENT,
  type ListenTogetherProfileOpenDetail,
} from './listenTogetherProfileNavigation'
import { hydrateNeteaseListenSession } from './neteaseListenSession'
import type { NeteaseArtistItem } from './neteaseMusicApi'
import type { UserDetailInfo } from './listenTogetherProfileTypes'

/** 全局歌手/用户主页叠层：微信主页分享卡等入口可直接唤起，无需先进入发现页 */
export function ListenTogetherProfileOverlayHost() {
  const [neteaseCookie, setNeteaseCookie] = useState('')
  const [artist, setArtist] = useState<ArtistDetailInfo | null>(null)
  const [user, setUser] = useState<UserDetailInfo | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const listenSessionActive = Boolean(neteaseCookie.trim())

  useEffect(() => {
    void hydrateNeteaseListenSession().then((session) => {
      setNeteaseCookie(session.cookie)
    })
  }, [])

  const openFromDetail = useCallback((detail: ListenTogetherProfileOpenDetail) => {
    if (detail.profileType === 'user') {
      setArtist(null)
      setUser({
        userId: detail.profileId,
        nickname: detail.displayName,
        avatar: detail.avatar ?? '',
      })
      return
    }
    setUser(null)
    setArtist({
      id: detail.profileId,
      name: detail.displayName,
      avatar: detail.avatar ?? '',
    })
  }, [])

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<ListenTogetherProfileOpenDetail>).detail
      if (!detail?.profileId) return
      openFromDetail(detail)
    }
    window.addEventListener(LISTEN_TOGETHER_OPEN_PROFILE_EVENT, onOpen as EventListener)
    return () => window.removeEventListener(LISTEN_TOGETHER_OPEN_PROFILE_EVENT, onOpen as EventListener)
  }, [openFromDetail])

  const closeAll = useCallback(() => {
    setArtist(null)
    setUser(null)
  }, [])

  const openArtistDetail = useCallback((next: NeteaseArtistItem) => {
    setUser(null)
    setArtist({ id: next.id, name: next.name, avatar: next.avatar })
  }, [])

  const openUserProfile = useCallback((next: UserDetailInfo) => {
    setArtist(null)
    setUser(next)
  }, [])

  const handleRequireLogin = useCallback(() => {
    setToast('请先登录网易云账号')
  }, [])

  const handlePlaySong = useCallback(() => {
    setToast('请在听一听中播放音乐')
  }, [])

  return (
    <>
      {artist ? (
        <div className="fixed inset-0 z-[10030] mx-auto max-w-[560px] overflow-hidden bg-stone-50">
          <ListenTogetherArtistDetailPage
            artist={artist}
            cookie={neteaseCookie}
            sessionActive={listenSessionActive}
            onBack={closeAll}
            onRequireLogin={handleRequireLogin}
            onOpenArtist={openArtistDetail}
            onOpenUser={openUserProfile}
            onPlaySong={handlePlaySong}
            className="h-full"
          />
        </div>
      ) : null}
      {user ? (
        <div className="fixed inset-0 z-[10030] mx-auto max-w-[560px] overflow-hidden bg-stone-50">
          <ListenTogetherUserProfilePage
            user={user}
            cookie={neteaseCookie}
            sessionActive={listenSessionActive}
            onBack={closeAll}
            onRequireLogin={handleRequireLogin}
            onOpenArtist={openArtistDetail}
            onOpenUser={openUserProfile}
            onOpenPlaylist={() => setToast('请在听一听中打开歌单')}
            className="h-full"
          />
        </div>
      ) : null}
      <ListenTogetherActionToast message={toast} onClear={() => setToast(null)} />
    </>
  )
}
