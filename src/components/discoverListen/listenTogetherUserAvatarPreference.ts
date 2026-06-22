import { personaDb, pullPhoneKvWithLocalStorageLegacy } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { resolveCharacterAvatarUrl } from '../../phone/utils/characterAvatarUrl'
import { useMusicStore } from '../../stores/useMusicStore'
import { getCachedNeteaseProfile } from './listenTogetherPersistence'

export const LISTEN_TOGETHER_USER_AVATAR_SOURCE_KV_KEY = 'listen-together-user-avatar-source-v1'
export const LISTEN_TOGETHER_USER_AVATAR_SOURCE_CHANGED = 'listen-together-user-avatar-source-changed'

export type ListenTogetherUserAvatarSource = 'wechat' | 'netease'

const DEFAULT_FALLBACK = 'https://api.dicebear.com/7.x/notionists/svg?seed=me-rose'

let cachedSource: ListenTogetherUserAvatarSource | null = null
let cachedNeteaseAvatarUrl: string | null = null

export function rememberListenTogetherNeteaseAvatar(url: string | null | undefined): void {
  const trimmed = url?.trim()
  if (trimmed) cachedNeteaseAvatarUrl = trimmed
}

export function getListenTogetherUserAvatarSourceSync(): ListenTogetherUserAvatarSource {
  return cachedSource ?? 'netease'
}

export async function hydrateListenTogetherUserAvatarPreference(): Promise<ListenTogetherUserAvatarSource> {
  const raw = await pullPhoneKvWithLocalStorageLegacy(LISTEN_TOGETHER_USER_AVATAR_SOURCE_KV_KEY, [])
  cachedSource = raw === 'wechat' ? 'wechat' : 'netease'
  const cachedProfile = await getCachedNeteaseProfile()
  rememberListenTogetherNeteaseAvatar(cachedProfile?.profile?.user?.avatar)
  return cachedSource
}

export async function setListenTogetherUserAvatarSource(
  source: ListenTogetherUserAvatarSource,
): Promise<void> {
  cachedSource = source
  await personaDb.setPhoneKv(LISTEN_TOGETHER_USER_AVATAR_SOURCE_KV_KEY, source)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LISTEN_TOGETHER_USER_AVATAR_SOURCE_CHANGED))
  }
}

export function resolveWechatAppAvatar(avatarImageUrl?: string | null): string {
  return (
    resolveCharacterAvatarUrl({ avatarUrl: avatarImageUrl }) ||
    avatarImageUrl?.trim() ||
    ''
  )
}

export function resolveListenTogetherUserAvatar(params: {
  source?: ListenTogetherUserAvatarSource
  wechatAvatarUrl?: string | null
  neteaseAvatarUrl?: string | null
}): string {
  const source = params.source ?? getListenTogetherUserAvatarSourceSync()
  const wechat = params.wechatAvatarUrl?.trim() || ''
  const netease =
    params.neteaseAvatarUrl?.trim() || cachedNeteaseAvatarUrl?.trim() || ''

  if (source === 'netease' && netease) return netease
  if (wechat) return wechat
  if (netease) return netease
  return DEFAULT_FALLBACK
}

export function patchActiveSyncListeningUserAvatar(avatar: string): void {
  const trimmed = avatar.trim()
  if (!trimmed) return
  const sync = useMusicStore.getState().syncListening
  if (!sync || sync.user.avatar === trimmed) return
  useMusicStore.getState().setSyncListening({
    ...sync,
    user: { ...sync.user, avatar: trimmed },
  })
}
