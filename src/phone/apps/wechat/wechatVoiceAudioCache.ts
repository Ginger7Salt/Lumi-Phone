import { personaDb } from './newFriendsPersona/idb'

export const FAVORITE_VOICE_AUDIO_KV_PREFIX = 'wechat-favorite-voice-audio-v1:'
export const SHARED_RECORD_VOICE_AUDIO_KV_PREFIX = 'wechat-shared-record-voice-audio-v1:'

const MAX_KV_AUDIO_CHARS = 800_000

/** data URL 或超长 URL 写入 KV，短 http(s) 链可直接落在消息/收藏字段上。 */
export function shouldStoreVoiceAudioInKv(audioUrl: string): boolean {
  const u = audioUrl.trim()
  if (!u) return false
  return u.startsWith('data:') || u.length > 1800
}

function clipAudioForKv(audioUrl: string): string {
  const u = audioUrl.trim()
  if (!u) return ''
  return u.length > MAX_KV_AUDIO_CHARS ? u.slice(0, MAX_KV_AUDIO_CHARS) : u
}

export async function persistFavoriteVoiceAudio(cacheKey: string, audioUrl: string): Promise<void> {
  const key = cacheKey.trim()
  const url = clipAudioForKv(audioUrl)
  if (!key || !url) return
  await personaDb.setPhoneKv(`${FAVORITE_VOICE_AUDIO_KV_PREFIX}${key}`, url)
}

export async function loadFavoriteVoiceAudio(cacheKey: string): Promise<string | undefined> {
  const key = cacheKey.trim()
  if (!key) return undefined
  const raw = await personaDb.getPhoneKv(`${FAVORITE_VOICE_AUDIO_KV_PREFIX}${key}`)
  const url = typeof raw === 'string' ? raw.trim() : ''
  return url || undefined
}

export async function persistSharedRecordVoiceAudio(shareId: string, audioUrl: string): Promise<void> {
  const id = shareId.trim()
  const url = clipAudioForKv(audioUrl)
  if (!id || !url) return
  await personaDb.setPhoneKv(`${SHARED_RECORD_VOICE_AUDIO_KV_PREFIX}${id}`, url)
}

export async function loadSharedRecordVoiceAudio(shareId: string): Promise<string | undefined> {
  const id = shareId.trim()
  if (!id) return undefined
  const raw = await personaDb.getPhoneKv(`${SHARED_RECORD_VOICE_AUDIO_KV_PREFIX}${id}`)
  const url = typeof raw === 'string' ? raw.trim() : ''
  return url || undefined
}
