import type { WeChatListenProfileSharePayload } from '../../phone/apps/wechat/newFriendsPersona/types'

export const LISTEN_TOGETHER_OPEN_PROFILE_EVENT = 'listen-together:open-profile'

export type ListenTogetherProfileOpenDetail = {
  profileType: 'artist' | 'user'
  profileId: number
  displayName: string
  avatar?: string
}

export function listenProfileShareToOpenDetail(
  data: WeChatListenProfileSharePayload,
): ListenTogetherProfileOpenDetail {
  return {
    profileType: data.profileType,
    profileId: data.profileId,
    displayName: data.displayName,
    avatar: data.avatar,
  }
}

/** 从任意应用（如微信聊天）唤起听一听歌手/用户主页叠层 */
export function requestOpenListenTogetherProfile(detail: ListenTogetherProfileOpenDetail): void {
  if (!detail.profileId || !detail.displayName.trim()) return
  window.dispatchEvent(
    new CustomEvent<ListenTogetherProfileOpenDetail>(LISTEN_TOGETHER_OPEN_PROFILE_EVENT, {
      detail,
    }),
  )
}

export function requestOpenListenProfileShareCard(data: WeChatListenProfileSharePayload): void {
  requestOpenListenTogetherProfile(listenProfileShareToOpenDetail(data))
}
