import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { ListenPlayMode } from './listenPlayMode'
import type { NeteaseSongItem } from './neteaseMusicApi'

export const LISTEN_TOGETHER_PLAYER_SESSION_KV_KEY = 'listen-together-player-session-v1'

export type CachedPlayerSession = {
  song: NeteaseSongItem
  queue: NeteaseSongItem[]
  queueIndex: number
  queueMeta: { playlistId: number; isLikedPlaylist: boolean }
  playMode: ListenPlayMode
  updatedAt: number
}

export async function getCachedPlayerSession(): Promise<CachedPlayerSession | null> {
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_PLAYER_SESSION_KV_KEY)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as CachedPlayerSession
  if (!row.song?.id || !row.song.name?.trim()) return null
  return {
    song: row.song,
    queue: Array.isArray(row.queue) ? row.queue.filter((s) => s?.id) : [row.song],
    queueIndex: Number.isFinite(row.queueIndex) ? Math.max(0, row.queueIndex) : 0,
    queueMeta: {
      playlistId: row.queueMeta?.playlistId ?? 0,
      isLikedPlaylist: Boolean(row.queueMeta?.isLikedPlaylist),
    },
    playMode: row.playMode ?? 'repeatAll',
    updatedAt: row.updatedAt ?? 0,
  }
}

export async function saveCachedPlayerSession(session: CachedPlayerSession): Promise<void> {
  if (!session.song?.id) return
  await personaDb.setPhoneKv(LISTEN_TOGETHER_PLAYER_SESSION_KV_KEY, session)
}

export async function clearCachedPlayerSession(): Promise<void> {
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_PLAYER_SESSION_KV_KEY)
}
