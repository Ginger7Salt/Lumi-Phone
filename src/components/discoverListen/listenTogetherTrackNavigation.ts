import type { WeChatListenTrackSharePayload } from '../../phone/apps/wechat/newFriendsPersona/types'

export const LISTEN_TOGETHER_OPEN_TRACK_EVENT = 'listen-together:open-track'

export type ListenTogetherTrackOpenDetail = {
  targetType: 'song' | 'playlist'
  targetId: number
  targetTitle: string
  targetArtist?: string
  targetCover?: string
  trackCount?: number
}

export function listenTrackShareToOpenDetail(
  data: WeChatListenTrackSharePayload,
): ListenTogetherTrackOpenDetail {
  return {
    targetType: data.targetType,
    targetId: data.targetId,
    targetTitle: data.targetTitle,
    targetArtist: data.targetArtist,
    targetCover: data.targetCover,
    trackCount: data.trackCount,
  }
}

/** 从任意应用（如微信聊天）唤起听一听单曲/歌单 */
export function requestOpenListenTogetherTrack(detail: ListenTogetherTrackOpenDetail): void {
  if (!detail.targetId || !detail.targetTitle.trim()) return
  window.dispatchEvent(
    new CustomEvent<ListenTogetherTrackOpenDetail>(LISTEN_TOGETHER_OPEN_TRACK_EVENT, {
      detail,
    }),
  )
}

export function requestOpenListenTrackShareCard(data: WeChatListenTrackSharePayload): void {
  requestOpenListenTogetherTrack(listenTrackShareToOpenDetail(data))
}
