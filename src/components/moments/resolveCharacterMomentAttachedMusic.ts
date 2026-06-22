import { loadNeteaseCookie } from '../discoverListen/neteaseApiClient'
import {
  searchNeteaseSongs,
  fetchNeteaseSongDetails,
  type NeteaseSongItem,
} from '../discoverListen/neteaseMusicApi'
import {
  enrichMomentAttachedMusic,
  songShareToMomentMusic,
  type MomentAttachedMusic,
} from './momentAttachedMusic'

function normalizeSongKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function hasCjk(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text)
}

function isMostlyLatin(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  const latin = (t.match(/[a-zA-Z]/g) ?? []).length
  return latin / t.length > 0.55
}

function scoreSongMatch(song: NeteaseSongItem, title: string, artist: string): number {
  const name = normalizeSongKey(song.name)
  const artistName = normalizeSongKey(song.artist)
  const wantTitle = normalizeSongKey(title)
  const wantArtist = normalizeSongKey(artist)
  let score = 0
  if (!wantTitle) return score
  if (name === wantTitle) score += 12
  else if (name.includes(wantTitle) || wantTitle.includes(name)) score += 6
  if (wantArtist) {
    if (artistName === wantArtist) score += 10
    else if (artistName.includes(wantArtist) || wantArtist.includes(artistName)) score += 5
  }
  if (hasCjk(title) || hasCjk(artist)) {
    if (hasCjk(song.name)) score += 4
    if (hasCjk(song.artist)) score += 2
    if (isMostlyLatin(song.name) && !isMostlyLatin(title)) score -= 5
  }
  return score
}

function pickBestNeteaseSongMatch(
  songs: NeteaseSongItem[],
  title: string,
  artist: string,
): NeteaseSongItem | null {
  if (!songs.length) return null
  let best = songs[0]!
  let bestScore = scoreSongMatch(best, title, artist)
  for (let i = 1; i < songs.length; i += 1) {
    const song = songs[i]!
    const score = scoreSongMatch(song, title, artist)
    if (score > bestScore) {
      best = song
      bestScore = score
    }
  }
  return best
}

function buildSearchQueries(title: string, artist: string): string[] {
  const t = title.trim()
  const a = artist.trim()
  const queries = [ [t, a].filter(Boolean).join(' '), t, a ? `${a} ${t}` : '' ]
    .map((q) => q.trim())
    .filter(Boolean)
  return [...new Set(queries)]
}

async function searchNeteaseTrack(
  cookie: string,
  title: string,
  artist: string,
): Promise<NeteaseSongItem | null> {
  const queries = buildSearchQueries(title, artist)
  let best: NeteaseSongItem | null = null
  let bestScore = -1

  for (const query of queries) {
    try {
      const songs = await searchNeteaseSongs(cookie, query, 12)
      const candidate = pickBestNeteaseSongMatch(songs, title, artist)
      if (!candidate) continue
      const score = scoreSongMatch(candidate, title, artist)
      if (score > bestScore) {
        best = candidate
        bestScore = score
      }
      if (score >= 18) break
    } catch {
      // 尝试下一个关键词
    }
  }

  return best
}

function throwUnresolvedMomentMusic(title: string, artist: string): never {
  throw new Error(
    `未在网易云曲库找到「${title}」— ${artist}。请换一首网易云常见的真实歌曲后重试`,
  )
}

/** 将 AI 给出的歌名/歌手解析为可发布、可播放的朋友圈 attachedMusic */
export async function resolveCharacterMomentAttachedMusic(draft: {
  title: string
  artist?: string
  songId?: number
}): Promise<MomentAttachedMusic> {
  const title = draft.title.trim() || '未知歌曲'
  const artist = draft.artist?.trim() || '未知歌手'
  /** 无网易账号登录也可走公共 API 搜索（与听一听游客模式一致） */
  const cookie = loadNeteaseCookie().trim()

  let track: NeteaseSongItem | null = null
  if (draft.songId) {
    try {
      const rows = await fetchNeteaseSongDetails(cookie, [draft.songId])
      track = rows[0] ?? null
    } catch {
      track = null
    }
  }
  if (!track) {
    track = await searchNeteaseTrack(cookie, title, artist)
  }

  if (!track?.id) {
    throwUnresolvedMomentMusic(title, artist)
  }

  let attached = songShareToMomentMusic({
    id: track.id,
    title: track.name,
    artist: track.artist,
    cover: track.cover,
    artistId: track.artistId,
  })
  attached = await enrichMomentAttachedMusic(attached)
  return attached
}
