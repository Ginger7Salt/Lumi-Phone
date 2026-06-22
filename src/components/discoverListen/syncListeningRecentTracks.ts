import { formatLyricsExcerptForAi } from '../../phone/apps/wechat/musicSync/listenShareAiContext'
import type { ParsedLyricLine } from './listenLyricParse'
import { companionSyncDurationKey } from './listenTogetherSyncDuration'
import { useMusicStore, type MusicTrack } from '../../stores/useMusicStore'

const MAX_RECENT_TRACKS = 5
const MAX_LYRICS_SNAPSHOT_LINES = 120

export type SyncListeningRecentTrack = {
  songId: number
  title: string
  artist: string
  lastPositionMs: number
  durationMs: number
  /** 哼唱匹配用 */
  lyrics: ParsedLyricLine[]
  /** AI 上下文用 */
  lyricsExcerpt: string
  switchedAtMs: number
}

let sessionKey: string | null = null
let recentTracks: SyncListeningRecentTrack[] = []

function capLyricsSnapshot(lines: ParsedLyricLine[]): ParsedLyricLine[] {
  if (lines.length <= MAX_LYRICS_SNAPSHOT_LINES) return [...lines]
  return lines.slice(0, MAX_LYRICS_SNAPSHOT_LINES)
}

function archiveTrack(
  track: MusicTrack,
  lastPositionMs: number,
  durationMs: number,
  lyrics: ParsedLyricLine[],
): void {
  const title = track.title.trim()
  if (!title || title === '暂无播放' || track.id <= 0) return

  const snapshot = capLyricsSnapshot(lyrics)
  const entry: SyncListeningRecentTrack = {
    songId: track.id,
    title,
    artist: track.artist?.trim() ?? '',
    lastPositionMs: Math.max(0, lastPositionMs),
    durationMs: Math.max(0, durationMs),
    lyrics: snapshot,
    lyricsExcerpt: formatLyricsExcerptForAi(snapshot),
    switchedAtMs: Date.now(),
  }

  recentTracks = [entry, ...recentTracks.filter((t) => t.songId !== track.id)].slice(0, MAX_RECENT_TRACKS)
}

export function getSyncListeningRecentTracks(): readonly SyncListeningRecentTrack[] {
  return recentTracks
}

export function clearSyncListeningRecentTracks(): void {
  sessionKey = null
  recentTracks = []
}

/** 共听切歌时保留近期曲目，供微信 AI 回忆「刚才那首」 */
export function mountSyncListeningRecentTracksTracker(): () => void {
  const initial = useMusicStore.getState().syncListening
  sessionKey = initial ? companionSyncDurationKey(initial.companion) : null

  const unsub = useMusicStore.subscribe((state, prev) => {
    const syncKey = state.syncListening
      ? companionSyncDurationKey(state.syncListening.companion)
      : null
    const prevSyncKey = prev.syncListening
      ? companionSyncDurationKey(prev.syncListening.companion)
      : null

    if (!syncKey) {
      if (prevSyncKey) clearSyncListeningRecentTracks()
      return
    }

    if (syncKey !== sessionKey) {
      sessionKey = syncKey
      recentTracks = []
    }

    const prevTrackId = prev.currentTrack?.id ?? 0
    const nextTrackId = state.currentTrack?.id ?? 0
    if (prevTrackId > 0 && nextTrackId > 0 && prevTrackId !== nextTrackId && prev.currentTrack) {
      archiveTrack(prev.currentTrack, prev.currentTimeMs, prev.durationMs, prev.lyrics)
    }
  })

  return () => {
    unsub()
    clearSyncListeningRecentTracks()
  }
}
