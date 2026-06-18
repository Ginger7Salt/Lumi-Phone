import type { Favorite } from '../newFriendsPersona/types'
import { loadFavoriteVoiceAudio } from '../wechatVoiceAudioCache'

/** 收藏语音：优先收藏快照 / KV，再回落原聊天消息。 */
export async function resolveFavoriteVoiceAudioUrl(
  fav: Favorite,
  msgAudioUrl?: string | null,
): Promise<string | undefined> {
  const fromFavUrl = fav.voiceAudioUrl?.trim()
  if (fromFavUrl) return fromFavUrl
  const kvKey = fav.voiceAudioKvKey?.trim() || fav.id.trim()
  const fromKv = await loadFavoriteVoiceAudio(kvKey)
  if (fromKv) return fromKv
  const fromMsg = msgAudioUrl?.trim()
  return fromMsg || undefined
}
