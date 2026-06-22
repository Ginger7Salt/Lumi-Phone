import { useCallback, useEffect, useState } from 'react'

import { ListenTogetherActionToast } from './ListenTogetherActionToast'
import {
  ListenTogetherPlaylistDetailPage,
  type PlaylistDetailInfo,
} from './ListenTogetherPlaylistDetailPage'
import {
  LISTEN_TOGETHER_OPEN_TRACK_EVENT,
  type ListenTogetherTrackOpenDetail,
} from './listenTogetherTrackNavigation'
import { navigateToListenTogetherFullscreen } from './listenTogetherNavigation'
import {
  enterGuestListenMode,
  hydrateNeteaseListenSession,
} from './neteaseListenSession'
import type { NeteaseSongItem } from './neteaseMusicApi'
import { useListenTogetherPlayer } from './useListenTogetherPlayer'
import { getListenTogetherPlayerSnapshot } from './listenTogetherPlayerEngine'

/** 全局单曲/歌单叠层：微信音乐分享卡等入口可直接唤起，无需先进入发现页 */
export function ListenTogetherTrackOverlayHost() {
  const [neteaseCookie, setNeteaseCookie] = useState('')
  const [playlist, setPlaylist] = useState<PlaylistDetailInfo | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const { playSong, nowPlaying, isPlaying } = useListenTogetherPlayer()
  const playingSongId = nowPlaying.songId ?? null

  useEffect(() => {
    void hydrateNeteaseListenSession().then((session) => {
      setNeteaseCookie(session.cookie)
    })
  }, [])

  const openFromDetail = useCallback(
    async (detail: ListenTogetherTrackOpenDetail) => {
      if (detail.targetType === 'playlist') {
        setPlaylist({
          id: detail.targetId,
          title: detail.targetTitle,
          cover: detail.targetCover ?? '',
          count: detail.trackCount ?? 0,
        })
        return
      }

      setPlaylist(null)
      let session = await hydrateNeteaseListenSession()
      if (!session.isActive) {
        session = await enterGuestListenMode()
        setNeteaseCookie(session.cookie)
      }

      const song: NeteaseSongItem = {
        id: detail.targetId,
        name: detail.targetTitle,
        artist: detail.targetArtist?.trim() || '',
        cover: detail.targetCover ?? '',
      }
      const ok = await playSong(song, { queue: [song], index: 0, playlistId: 0 })
      if (ok) {
        navigateToListenTogetherFullscreen()
        return
      }
      const err = getListenTogetherPlayerSnapshot().playError
      setToast(err ?? '无法播放该歌曲（可能无收听权限，如版权或会员限制）')
    },
    [playSong],
  )

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<ListenTogetherTrackOpenDetail>).detail
      if (!detail?.targetId) return
      openFromDetail(detail)
    }
    window.addEventListener(LISTEN_TOGETHER_OPEN_TRACK_EVENT, onOpen as EventListener)
    return () => window.removeEventListener(LISTEN_TOGETHER_OPEN_TRACK_EVENT, onOpen as EventListener)
  }, [openFromDetail])

  const closePlaylist = useCallback(() => {
    setPlaylist(null)
  }, [])

  const handlePlaySong = useCallback(
    (song: NeteaseSongItem, queueTracks: NeteaseSongItem[]) => {
      const list = queueTracks.length > 0 ? queueTracks : [song]
      void playSong(song, {
        queue: list,
        index: Math.max(0, list.findIndex((t) => t.id === song.id)),
        playlistId: playlist?.id ?? 0,
      })
    },
    [playSong, playlist?.id],
  )

  const handleRequireLogin = useCallback(() => {
    setToast('请先登录网易云账号')
  }, [])

  return (
    <>
      {playlist ? (
        <div className="fixed inset-0 z-[10030] mx-auto max-w-[560px] overflow-hidden bg-stone-50">
          <ListenTogetherPlaylistDetailPage
            playlist={playlist}
            cookie={neteaseCookie}
            onBack={closePlaylist}
            onRequireLogin={handleRequireLogin}
            onPlaySong={handlePlaySong}
            playingSongId={playingSongId}
            isPlaying={isPlaying}
            className="h-full"
          />
        </div>
      ) : null}
      <ListenTogetherActionToast message={toast} onClear={() => setToast(null)} />
    </>
  )
}
