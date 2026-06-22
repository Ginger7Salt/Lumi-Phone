import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { NeteaseSongItem } from './neteaseMusicApi'

export const LISTEN_TOGETHER_PLAY_HISTORY_KV_KEY = 'listen-together-play-history-v1'
export const LISTEN_PLAY_HISTORY_CHANGED = 'listen-together-play-history-changed'

const MAX_PLAY_HISTORY_ENTRIES = 80

export type ListenPlayHistoryEntry = {
  songId: number
  name: string
  artist: string
  cover: string
  artistId?: number
  playedAtMs: number
}

let playHistoryMemory: ListenPlayHistoryEntry[] = []
let playHistoryHydrated = false

function notifyPlayHistoryChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LISTEN_PLAY_HISTORY_CHANGED))
  }
}

function dedupePlayHistoryBySongId(entries: ListenPlayHistoryEntry[]): ListenPlayHistoryEntry[] {
  const seen = new Set<number>()
  const out: ListenPlayHistoryEntry[] = []
  for (const entry of entries) {
    const id = entry.songId
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(entry)
  }
  return out.slice(0, MAX_PLAY_HISTORY_ENTRIES)
}

async function hydratePlayHistoryFromIdb(): Promise<void> {
  if (playHistoryHydrated) return
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_PLAY_HISTORY_KV_KEY)
  if (Array.isArray(raw)) {
    const normalized = raw
      .filter(
        (entry): entry is ListenPlayHistoryEntry =>
          !!entry &&
          typeof entry === 'object' &&
          typeof (entry as ListenPlayHistoryEntry).songId === 'number' &&
          (entry as ListenPlayHistoryEntry).songId > 0 &&
          typeof (entry as ListenPlayHistoryEntry).playedAtMs === 'number',
      )
      .sort((a, b) => b.playedAtMs - a.playedAtMs)
    const deduped = dedupePlayHistoryBySongId(normalized)
    playHistoryMemory = deduped
    if (deduped.length !== normalized.length) {
      await personaDb.setPhoneKv(LISTEN_TOGETHER_PLAY_HISTORY_KV_KEY, deduped)
    }
  } else {
    playHistoryMemory = []
  }
  playHistoryHydrated = true
}

async function persistPlayHistory(): Promise<void> {
  await personaDb.setPhoneKv(LISTEN_TOGETHER_PLAY_HISTORY_KV_KEY, playHistoryMemory)
  notifyPlayHistoryChanged()
}

export function listenPlayHistoryEntryFromSong(
  song: NeteaseSongItem,
  playedAtMs = Date.now(),
): ListenPlayHistoryEntry {
  return {
    songId: song.id,
    name: song.name,
    artist: song.artist,
    cover: song.cover,
    artistId: song.artistId,
    playedAtMs,
  }
}

export function listenPlayHistoryEntryToSong(entry: ListenPlayHistoryEntry): NeteaseSongItem {
  return {
    id: entry.songId,
    name: entry.name,
    artist: entry.artist,
    cover: entry.cover,
    artistId: entry.artistId,
  }
}

export async function listListenPlayHistory(): Promise<ListenPlayHistoryEntry[]> {
  await hydratePlayHistoryFromIdb()
  return [...playHistoryMemory]
}

export async function recordListenPlayHistory(song: NeteaseSongItem): Promise<void> {
  if (!song?.id) return
  await hydratePlayHistoryFromIdb()
  const entry = listenPlayHistoryEntryFromSong(song)
  playHistoryMemory = dedupePlayHistoryBySongId([
    entry,
    ...playHistoryMemory.filter((item) => item.songId !== song.id),
  ])
  await persistPlayHistory()
}

export async function clearListenPlayHistory(): Promise<void> {
  playHistoryMemory = []
  playHistoryHydrated = true
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_PLAY_HISTORY_KV_KEY)
  notifyPlayHistoryChanged()
}

export function formatListenPlayHistoryTime(playedAtMs: number, now = Date.now()): string {
  const date = new Date(playedAtMs)
  if (!Number.isFinite(date.getTime())) return '—'
  const pad = (value: number) => String(value).padStart(2, '0')
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`

  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const entryDayStart = new Date(playedAtMs)
  entryDayStart.setHours(0, 0, 0, 0)
  const dayDiff = Math.floor((todayStart.getTime() - entryDayStart.getTime()) / 86_400_000)

  if (dayDiff === 0) return `今天 ${clock}`
  if (dayDiff === 1) return `昨天 ${clock}`
  if (date.getFullYear() === todayStart.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${clock}`
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${clock}`
}
