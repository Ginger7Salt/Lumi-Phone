import { useCallback, useEffect, useMemo, useState } from 'react'

import { useCustomization } from '../../phone/CustomizationContext'
import {
  hydrateListenTogetherUserAvatarPreference,
  LISTEN_TOGETHER_USER_AVATAR_SOURCE_CHANGED,
  patchActiveSyncListeningUserAvatar,
  rememberListenTogetherNeteaseAvatar,
  resolveListenTogetherUserAvatar,
  resolveWechatAppAvatar,
  setListenTogetherUserAvatarSource,
  getListenTogetherUserAvatarSourceSync,
  type ListenTogetherUserAvatarSource,
} from './listenTogetherUserAvatarPreference'

export function useListenTogetherUserAvatar(neteaseAvatarUrl?: string | null) {
  const { state } = useCustomization()
  const [source, setSource] = useState<ListenTogetherUserAvatarSource>(() =>
    getListenTogetherUserAvatarSourceSync(),
  )

  const wechatAvatar = useMemo(
    () => resolveWechatAppAvatar(state.profile.avatarImageUrl),
    [state.profile.avatarImageUrl],
  )

  const neteaseAvatar = neteaseAvatarUrl?.trim() || ''

  useEffect(() => {
    rememberListenTogetherNeteaseAvatar(neteaseAvatar)
  }, [neteaseAvatar])

  useEffect(() => {
    void hydrateListenTogetherUserAvatarPreference().then(setSource)
    const onChanged = () => setSource(getListenTogetherUserAvatarSourceSync())
    window.addEventListener(LISTEN_TOGETHER_USER_AVATAR_SOURCE_CHANGED, onChanged)
    return () => window.removeEventListener(LISTEN_TOGETHER_USER_AVATAR_SOURCE_CHANGED, onChanged)
  }, [])

  const avatar = useMemo(
    () =>
      resolveListenTogetherUserAvatar({
        source,
        wechatAvatarUrl: wechatAvatar,
        neteaseAvatarUrl: neteaseAvatar,
      }),
    [source, wechatAvatar, neteaseAvatar],
  )

  useEffect(() => {
    patchActiveSyncListeningUserAvatar(avatar)
  }, [avatar])

  const setAvatarSource = useCallback(
    async (next: ListenTogetherUserAvatarSource) => {
      await setListenTogetherUserAvatarSource(next)
      const resolved = resolveListenTogetherUserAvatar({
        source: next,
        wechatAvatarUrl: wechatAvatar,
        neteaseAvatarUrl: neteaseAvatar,
      })
      patchActiveSyncListeningUserAvatar(resolved)
    },
    [wechatAvatar, neteaseAvatar],
  )

  return {
    avatar,
    source,
    setAvatarSource,
    wechatAvatar,
    neteaseAvatar,
  }
}

/** 非 React 场景（如微信聊天共听回调）解析当前应展示的用户头像 */
export function resolveListenTogetherSyncUserAvatar(params: {
  wechatAvatarUrl?: string | null
  neteaseAvatarUrl?: string | null
}): string {
  return resolveListenTogetherUserAvatar({
    wechatAvatarUrl: params.wechatAvatarUrl,
    neteaseAvatarUrl: params.neteaseAvatarUrl,
  })
}
