import {
  getCachedNeteaseProfile,
  getCachedPlaylist,
  getCachedRecentSongs,
} from '../discoverListen/listenTogetherPersistence'
import { listListenPlayHistory } from '../discoverListen/listenTogetherPlayHistory'
import { getSyncListeningRecentTracks } from '../discoverListen/syncListeningRecentTracks'
import { loadUserMoments } from './momentsFeedStorage'

export type UserMusicTasteSongSource =
  | 'play_history'
  | 'sync_listening'
  | 'netease_recent'
  | 'liked_playlist'
  | 'user_moment'

export type UserMusicTasteSongRef = {
  title: string
  artist: string
  source: UserMusicTasteSongSource
  score: number
}

export type UserMusicTasteProfile = {
  songs: UserMusicTasteSongRef[]
  topArtists: string[]
  hasSignal: boolean
}

export type ProactiveMomentFollowUserMusicTasteSettings = {
  enabled: boolean
  /** 向用户口味靠拢的强度 0～100 */
  weight: number
}

export const DEFAULT_PROACTIVE_MOMENT_FOLLOW_USER_MUSIC_TASTE: ProactiveMomentFollowUserMusicTasteSettings =
  {
    enabled: false,
    weight: 70,
  }

function clampTasteWeight(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function normalizeProactiveMomentFollowUserMusicTaste(
  raw: unknown,
): ProactiveMomentFollowUserMusicTasteSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PROACTIVE_MOMENT_FOLLOW_USER_MUSIC_TASTE }
  }
  const o = raw as Record<string, unknown>
  return {
    enabled:
      typeof o.enabled === 'boolean'
        ? o.enabled
        : DEFAULT_PROACTIVE_MOMENT_FOLLOW_USER_MUSIC_TASTE.enabled,
    weight: clampTasteWeight(o.weight, DEFAULT_PROACTIVE_MOMENT_FOLLOW_USER_MUSIC_TASTE.weight),
  }
}

function songKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}::${artist.trim().toLowerCase()}`
}

function mergeSong(
  bucket: Map<string, UserMusicTasteSongRef>,
  title: string,
  artist: string,
  source: UserMusicTasteSongSource,
  score: number,
): void {
  const t = title.trim()
  if (!t) return
  const a = artist.trim()
  const key = songKey(t, a)
  const existing = bucket.get(key)
  if (!existing || score > existing.score) {
    bucket.set(key, { title: t, artist: a || '未知歌手', source, score })
  }
}

export async function collectUserMusicTasteProfile(
  accountId: string | null | undefined,
): Promise<UserMusicTasteProfile> {
  const bucket = new Map<string, UserMusicTasteSongRef>()

  try {
    const history = await listListenPlayHistory()
    history.slice(0, 15).forEach((entry, index) => {
      mergeSong(bucket, entry.name, entry.artist, 'play_history', 12 - index * 0.45)
    })
  } catch {
    /* ignore */
  }

  for (const [index, track] of getSyncListeningRecentTracks().entries()) {
    mergeSong(bucket, track.title, track.artist, 'sync_listening', 15 - index * 2)
  }

  try {
    const cachedProfile = await getCachedNeteaseProfile()
    const userId = cachedProfile?.profile?.user?.userId
    if (userId) {
      const recent = await getCachedRecentSongs(userId)
      recent?.songs.slice(0, 10).forEach((song, index) => {
        mergeSong(bucket, song.name, song.artist, 'netease_recent', 10 - index * 0.6)
      })

      const likedPlaylistId = cachedProfile.profile.likedSongs?.id
      if (likedPlaylistId) {
        const liked = await getCachedPlaylist(likedPlaylistId)
        liked?.tracks.slice(0, 12).forEach((song, index) => {
          mergeSong(bucket, song.name, song.artist, 'liked_playlist', 8 - index * 0.35)
        })
      }
    }
  } catch {
    /* ignore */
  }

  const acc = accountId?.trim()
  if (acc) {
    try {
      const moments = await loadUserMoments(acc)
      moments
        .filter((moment) => moment.isUserAuthored && moment.attachedMusic?.title?.trim())
        .slice(0, 8)
        .forEach((moment, index) => {
          const music = moment.attachedMusic!
          mergeSong(bucket, music.title, music.artist, 'user_moment', 14 - index * 1.4)
        })
    } catch {
      /* ignore */
    }
  }

  const songs = [...bucket.values()].sort((a, b) => b.score - a.score).slice(0, 12)

  const artistCounts = new Map<string, number>()
  for (const song of songs) {
    const artist = song.artist.trim()
    if (!artist || artist === '未知歌手') continue
    artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + song.score)
  }
  const topArtists = [...artistCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name)

  return {
    songs,
    topArtists,
    hasSignal: songs.length > 0,
  }
}

export function formatUserMusicTastePreview(profile: UserMusicTasteProfile): string {
  if (!profile.hasSignal) {
    return '暂无听歌/分享记录；开启后会在听一听播放、红心歌单或你分享歌曲到朋友圈后生效'
  }
  const parts: string[] = []
  if (profile.topArtists.length) {
    parts.push(`常听歌手：${profile.topArtists.join('、')}`)
  }
  const sample = profile.songs
    .slice(0, 3)
    .map((song) => `《${song.title}》${song.artist ? ` · ${song.artist}` : ''}`)
    .join('；')
  if (sample) parts.push(`近期参考：${sample}`)
  return parts.join(' · ')
}

export function buildProactiveMomentUserMusicTastePrompt(
  profile: UserMusicTasteProfile,
  weight: number,
): string {
  const strength = clampTasteWeight(weight, DEFAULT_PROACTIVE_MOMENT_FOLLOW_USER_MUSIC_TASTE.weight)
  if (strength <= 0) return ''

  if (!profile.hasSignal) {
    return `
- **向用户口味靠拢**（倾向强度 ${strength}%）：当前缺少可靠听歌记录，请仍按上方语种占比与角色人设选网易云真实歌曲；待有一起听/播放数据后会自动对齐。
`.trim()
  }

  const artistLine = profile.topArtists.length
    ? `- 用户常听/常分享歌手：${profile.topArtists.join('、')}`
    : ''
  const songLines = profile.songs
    .slice(0, 8)
    .map((song) => `  · 《${song.title}》${song.artist ? ` · ${song.artist}` : ''}`)
    .join('\n')

  return `
- **向用户口味靠拢**（倾向强度 ${strength}%）：角色若选 postType=music，选歌应明显参考用户近期听歌偏好——同歌手、同气质或同语种路线的**网易云真实歌曲**；100%=强烈对齐，50%=适度参考。
${artistLine}
- 用户近期在听/分享（可从中选一首直接分享，或选同歌手/同路线的另一首；勿每条原样复读同一首）：
${songLines}
- 配文可像朋友安利：「这首你应该也会喜欢」「想起你最近老在听的那路」；仍须符合角色人设，并遵守上方语种占比。
`.trim()
}
