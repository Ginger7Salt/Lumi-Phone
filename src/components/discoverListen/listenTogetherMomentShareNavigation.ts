import { songShareToMomentMusic, type MomentAttachedMusic } from '../moments/momentAttachedMusic'

export const LISTEN_TOGETHER_SHARE_TO_MOMENTS_EVENT = 'listen-together:share-to-moments'

export type ShareSongToMomentsDetail = {
  songId: number
  title: string
  artist: string
  cover?: string
}

let pendingShare: ShareSongToMomentsDetail | null = null

export function shareSongDetailToMomentMusic(detail: ShareSongToMomentsDetail): MomentAttachedMusic {
  return songShareToMomentMusic({
    id: detail.songId,
    title: detail.title,
    artist: detail.artist,
    cover: detail.cover,
  })
}

/** 从听一听单曲菜单唤起朋友圈发布（附带歌曲） */
export function requestShareSongToMoments(detail: ShareSongToMomentsDetail): void {
  if (!detail.songId || !detail.title.trim()) return
  pendingShare = detail
  window.dispatchEvent(
    new CustomEvent<ShareSongToMomentsDetail>(LISTEN_TOGETHER_SHARE_TO_MOMENTS_EVENT, {
      detail,
    }),
  )
}

export function consumePendingShareSongToMoments(): ShareSongToMomentsDetail | null {
  const next = pendingShare
  pendingShare = null
  return next
}
