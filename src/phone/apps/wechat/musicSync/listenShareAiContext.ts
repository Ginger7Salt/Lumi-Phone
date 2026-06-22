import { getCachedPlaylistSync, getCachedSongPlayback } from '../../../../components/discoverListen/listenTogetherPersistence'
import { loadNeteaseCookie } from '../../../../components/discoverListen/neteaseApiClient'
import type { ParsedLyricLine } from '../../../../components/discoverListen/listenLyricParse'
import { formatLyricTime } from '../../../../components/discoverListen/listenLyricParse'
import {
  fetchArtistAlbumsPage,
  fetchArtistDetail,
  fetchArtistTopSongs,
  fetchPlaylistMeta,
  fetchPlaylistTracks,
  fetchSongLyric,
  type NeteaseSongItem,
} from '../../../../components/discoverListen/neteaseMusicApi'
import type {
  WeChatListenCommentSharePayload,
  WeChatListenProfileSharePayload,
  WeChatListenShareTrackLine,
  WeChatListenTrackSharePayload,
} from '../newFriendsPersona/types'
import type { SendListenProfileShareInput } from './sendListenProfileShare'
import type { SendListenTrackShareInput } from './sendListenTrackShare'

const MAX_PLAYLIST_TRACK_LINES = 48
const MAX_PLAYLIST_LYRICS_FETCH = 2
const MAX_TOP_SONGS = 10
const MAX_ALBUM_TITLES = 6
const MAX_BRIEF_DESC = 320
const MAX_PLAYLIST_DESC = 240
const MAX_LYRICS_CHARS = 2800
const MAX_LYRICS_LINES = 56
/** 注入角色的歌词时间轴最多覆盖到该时刻（约 4 分钟） */
const MAX_LYRICS_UNTIL_MS = 4 * 60 * 1000

function lyricsHaveRealTiming(lines: ParsedLyricLine[]): boolean {
  if (lines.length <= 1) return false
  const first = lines[0]?.timeMs ?? 0
  return lines.some((l, i) => i > 0 && l.timeMs > first)
}

function formatLyricLineForAi(line: ParsedLyricLine, withTiming: boolean): string {
  const text = String(line.text ?? '').trim()
  if (!text || text === '暂无歌词') return ''
  if (!withTiming) return text
  return `[${formatLyricTime(line.timeMs)}] ${text}`
}

/** 将 LRC 行转为注入模型的时间轴歌词节选（[mm:ss] 歌词） */
export function formatLyricsExcerptForAi(lines: ParsedLyricLine[]): string {
  const withTiming = lyricsHaveRealTiming(lines)

  let out = ''
  let lineCount = 0
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!
    const row = formatLyricLineForAi(line, withTiming)
    if (!row) continue
    if (withTiming && line.timeMs > MAX_LYRICS_UNTIL_MS) {
      out += '\n…（后续歌词略）'
      break
    }
    if (lineCount >= MAX_LYRICS_LINES) {
      out += '\n…（歌词未完）'
      break
    }
    const chunk = lineCount === 0 ? row : `\n${row}`
    if (out.length + chunk.length > MAX_LYRICS_CHARS) {
      out += '\n…（歌词节选）'
      break
    }
    out += chunk
    lineCount += 1
  }
  return out.trim()
}

function clipText(raw: string | undefined, max: number): string {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

/** 拉取单曲歌词并格式化为 AI 摘录（优先读本地播放缓存；含 [mm:ss] 时间轴） */
export async function resolveSongLyricsExcerpt(songId: number, cookie: string): Promise<string> {
  if (!songId) return ''

  let lines: ParsedLyricLine[] = []
  try {
    const cached = await getCachedSongPlayback(songId)
    if (cached?.lyrics?.length) lines = cached.lyrics
  } catch {
    /* ignore */
  }

  if (!lines.length && cookie.trim()) {
    try {
      lines = await fetchSongLyric(cookie.trim(), songId)
    } catch {
      lines = []
    }
  }

  return formatLyricsExcerptForAi(lines)
}

function appendLyricsBlock(head: string, lyricsExcerpt?: string): string {
  const lyrics = lyricsExcerpt?.trim()
  if (!lyrics) return head
  return `${head}；歌词（带时间轴，[分:秒] 后为该时刻起唱的内容）：\n${lyrics}`
}

function mapSongLines(tracks: NeteaseSongItem[], limit: number): WeChatListenShareTrackLine[] {
  return tracks.slice(0, limit).map((s) => ({
    title: s.name.trim(),
    ...(s.artist?.trim() ? { artist: s.artist.trim() } : {}),
    ...(s.id ? { songId: s.id } : {}),
  }))
}

async function enrichTrackLinesWithLyrics(
  lines: WeChatListenShareTrackLine[],
  cookie: string,
  maxFetch: number,
): Promise<WeChatListenShareTrackLine[]> {
  if (!cookie.trim() || maxFetch <= 0 || !lines.length) return lines

  const out = lines.map((line) => ({ ...line }))
  let fetched = 0
  for (let i = 0; i < out.length && fetched < maxFetch; i += 1) {
    const sid = out[i]?.songId
    if (!sid) continue
    const excerpt = await resolveSongLyricsExcerpt(sid, cookie)
    if (!excerpt) continue
    out[i] = { ...out[i]!, lyricsExcerpt: excerpt }
    fetched += 1
  }
  return out
}

function formatTrackLineForAi(t: WeChatListenShareTrackLine, index: number): string {
  const artist = t.artist?.trim()
  const base = `${index + 1}. ${t.title}${artist ? ` — ${artist}` : ''}`
  const lyrics = t.lyricsExcerpt?.trim()
  if (!lyrics) return base
  const indented = lyrics.replace(/\n/g, '\n   ')
  return `${base}\n   歌词（时间轴）：${indented}`
}

function parseTrackLinesRaw(raw: unknown): WeChatListenShareTrackLine[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: WeChatListenShareTrackLine[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const title = typeof r.title === 'string' ? r.title.trim().slice(0, 120) : ''
    if (!title) continue
    const artist = typeof r.artist === 'string' ? r.artist.trim().slice(0, 120) : ''
    const songIdRaw = typeof r.songId === 'number' ? r.songId : Number(r.songId)
    const lyricsExcerpt =
      typeof r.lyricsExcerpt === 'string' ? clipText(r.lyricsExcerpt, MAX_LYRICS_CHARS) : ''
    out.push({
      title,
      ...(artist ? { artist } : {}),
      ...(Number.isFinite(songIdRaw) && songIdRaw > 0 ? { songId: Math.floor(songIdRaw) } : {}),
      ...(lyricsExcerpt ? { lyricsExcerpt } : {}),
    })
    if (out.length >= MAX_PLAYLIST_TRACK_LINES) break
  }
  return out.length ? out : undefined
}

function parseStringListRaw(raw: unknown, max: number, itemMax = 80): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: string[] = []
  for (const item of raw) {
    const t = typeof item === 'string' ? item.trim().slice(0, itemMax) : ''
    if (!t) continue
    out.push(t)
    if (out.length >= max) break
  }
  return out.length ? out : undefined
}

/** 从 DB 原始对象解析歌单曲目摘录 */
export function parseListenShareTrackLinesFromDb(raw: unknown): WeChatListenShareTrackLine[] | undefined {
  return parseTrackLinesRaw(raw)
}

/** 从 DB 原始对象解析歌手分享 AI 字段 */
export function parseListenProfileShareAiFieldsFromDb(r: Record<string, unknown>) {
  const briefDesc = typeof r.briefDesc === 'string' ? clipText(r.briefDesc, MAX_BRIEF_DESC) : ''
  const aliases = parseStringListRaw(r.aliases, 6, 40)
  const identities = parseStringListRaw(r.identities, 8, 24)
  const musicSizeRaw = typeof r.musicSize === 'number' ? r.musicSize : Number(r.musicSize)
  const albumSizeRaw = typeof r.albumSize === 'number' ? r.albumSize : Number(r.albumSize)
  const followersRaw = typeof r.followers === 'number' ? r.followers : Number(r.followers)
  const topSongTitles = parseStringListRaw(r.topSongTitles, MAX_TOP_SONGS)
  const albumTitles = parseStringListRaw(r.albumTitles, MAX_ALBUM_TITLES)
  return {
    ...(briefDesc ? { briefDesc } : {}),
    ...(aliases ? { aliases } : {}),
    ...(identities ? { identities } : {}),
    ...(Number.isFinite(musicSizeRaw) && musicSizeRaw > 0
      ? { musicSize: Math.floor(musicSizeRaw) }
      : {}),
    ...(Number.isFinite(albumSizeRaw) && albumSizeRaw > 0
      ? { albumSize: Math.floor(albumSizeRaw) }
      : {}),
    ...(Number.isFinite(followersRaw) && followersRaw > 0
      ? { followers: Math.floor(followersRaw) }
      : {}),
    ...(topSongTitles ? { topSongTitles } : {}),
    ...(albumTitles ? { albumTitles } : {}),
  }
}

/** 单曲/歌单分享 → 注入模型的会话行 */
export function formatListenTrackShareAiTranscriptLine(lt: WeChatListenTrackSharePayload): string {
  const typeLabel = lt.targetType === 'song' ? '单曲' : '歌单'
  const head = `（分享${typeLabel}）《${lt.targetTitle}》${lt.targetArtist?.trim() ? ` · ${lt.targetArtist.trim()}` : ''}`
  if (lt.targetType === 'song') return appendLyricsBlock(head, lt.lyricsExcerpt)

  const metaParts: string[] = []
  if (lt.trackCount != null && lt.trackCount > 0) metaParts.push(`共 ${lt.trackCount} 首`)
  if (lt.playlistCreator?.trim()) metaParts.push(`创建者：${lt.playlistCreator.trim()}`)
  if (lt.playlistDescription?.trim()) metaParts.push(`简介：${lt.playlistDescription.trim()}`)

  const lines = lt.trackLines ?? []
  if (!lines.length) {
    return metaParts.length ? `${head}；${metaParts.join('；')}` : head
  }

  const listed = lines.map((t, i) => formatTrackLineForAi(t, i)).join('\n')
  const total = lt.trackCount ?? lines.length
  const tail =
    total > lines.length ? `\n…（另有 ${total - lines.length} 首未列出）` : ''
  const meta = metaParts.length ? `${metaParts.join('；')}；` : ''
  return `${head}；${meta}曲目：\n${listed}${tail}`
}

/** 歌手/用户主页分享 → 注入模型的会话行 */
export function formatListenProfileShareAiTranscriptLine(lp: WeChatListenProfileSharePayload): string {
  const typeLabel = lp.profileType === 'artist' ? '歌手' : '用户'
  const head = `（分享主页）${typeLabel}：${lp.displayName}`
  if (lp.profileType !== 'artist') {
    const sub = lp.subtitle?.trim()
    return sub && sub !== '网易云用户' ? `${head}（${sub}）` : head
  }

  const parts: string[] = [head]
  if (lp.identities?.length) parts.push(`身份：${lp.identities.join('、')}`)
  if (lp.aliases?.length) parts.push(`别名：${lp.aliases.join('、')}`)
  const stats: string[] = []
  if (lp.musicSize != null && lp.musicSize > 0) stats.push(`单曲约 ${lp.musicSize} 首`)
  if (lp.albumSize != null && lp.albumSize > 0) stats.push(`专辑约 ${lp.albumSize} 张`)
  if (lp.followers != null && lp.followers > 0) stats.push(`粉丝约 ${lp.followers}`)
  if (stats.length) parts.push(stats.join('，'))
  if (lp.briefDesc?.trim()) parts.push(`简介：${lp.briefDesc.trim()}`)
  if (lp.topSongTitles?.length) parts.push(`热门曲目：${lp.topSongTitles.join('、')}`)
  if (lp.albumTitles?.length) parts.push(`专辑：${lp.albumTitles.join('、')}`)
  return parts.join('；')
}

/** 评论分享 → 注入模型的会话行 */
export function formatListenCommentShareAiTranscriptLine(lc: WeChatListenCommentSharePayload): string {
  const head = `（分享评论）${lc.commentAuthor}：${lc.commentText} · 《${lc.targetTitle}》${lc.targetArtist?.trim() ? ` — ${lc.targetArtist.trim()}` : ''}`
  if (lc.targetType !== 'song') return head
  return appendLyricsBlock(head, lc.lyricsExcerpt)
}

async function resolvePlaylistTrackLines(
  playlistId: number,
  cookie: string,
): Promise<{
  trackCount?: number
  playlistCreator?: string
  playlistDescription?: string
  trackLines?: WeChatListenShareTrackLine[]
}> {
  const mapWithLyrics = async (tracks: NeteaseSongItem[], total: number, meta?: {
    creator?: string
    description?: string
  }) => {
    let trackLines = mapSongLines(tracks, MAX_PLAYLIST_TRACK_LINES)
    trackLines = await enrichTrackLinesWithLyrics(trackLines, cookie, MAX_PLAYLIST_LYRICS_FETCH)
    return {
      trackCount: total,
      ...(meta?.creator ? { playlistCreator: meta.creator } : {}),
      ...(meta?.description ? { playlistDescription: meta.description } : {}),
      trackLines,
    }
  }

  const cached = getCachedPlaylistSync(playlistId)
  if (cached?.tracks?.length) {
    return mapWithLyrics(
      cached.tracks,
      cached.count || cached.tracks.length,
      {
        creator: cached.meta?.creator?.nickname?.trim(),
        description: clipText(cached.meta?.description, MAX_PLAYLIST_DESC),
      },
    )
  }

  if (!cookie) return {}

  try {
    const meta = await fetchPlaylistMeta(cookie, playlistId)
    let tracks: NeteaseSongItem[] = []
    try {
      tracks = await fetchPlaylistTracks(cookie, playlistId, 100, 0)
    } catch {
      tracks = []
    }
    const total = meta.count || tracks.length
    return mapWithLyrics(tracks, total, {
      creator: meta.creator?.nickname?.trim(),
      description: clipText(meta.description, MAX_PLAYLIST_DESC),
    })
  } catch {
    return {}
  }
}

/** 分享前拉取歌单曲目等，写入持久化 payload */
export async function enrichListenTrackSharePayload(
  input: SendListenTrackShareInput,
  shareId: string,
): Promise<WeChatListenTrackSharePayload> {
  const base: WeChatListenTrackSharePayload = {
    kind: 'listen_track_share',
    shareId,
    targetType: input.targetType,
    targetId: input.targetId,
    targetTitle: input.targetTitle.trim(),
    ...(input.targetArtist?.trim() ? { targetArtist: input.targetArtist.trim() } : {}),
    ...(input.targetCover?.trim() ? { targetCover: input.targetCover.trim() } : {}),
    ...(input.trackCount != null && Number.isFinite(input.trackCount)
      ? { trackCount: Math.max(0, Math.floor(input.trackCount)) }
      : {}),
  }

  if (input.targetType !== 'playlist') {
    const cookie = loadNeteaseCookie().trim()
    const lyricsExcerpt = await resolveSongLyricsExcerpt(input.targetId, cookie)
    return {
      ...base,
      ...(lyricsExcerpt ? { lyricsExcerpt } : {}),
    }
  }

  const cookie = loadNeteaseCookie().trim()
  const extra = await resolvePlaylistTrackLines(input.targetId, cookie)
  return {
    ...base,
    trackCount: extra.trackCount ?? base.trackCount,
    ...(extra.playlistCreator ? { playlistCreator: extra.playlistCreator } : {}),
    ...(extra.playlistDescription ? { playlistDescription: extra.playlistDescription } : {}),
    ...(extra.trackLines?.length ? { trackLines: extra.trackLines } : {}),
  }
}

/** 分享前拉取歌手详情，写入持久化 payload */
export async function enrichListenProfileSharePayload(
  input: SendListenProfileShareInput,
  shareId: string,
): Promise<WeChatListenProfileSharePayload> {
  const base: WeChatListenProfileSharePayload = {
    kind: 'listen_profile_share',
    shareId,
    profileType: input.profileType,
    profileId: input.profileId,
    displayName: input.displayName.trim(),
    ...(input.avatar?.trim() ? { avatar: input.avatar.trim() } : {}),
    ...(input.subtitle?.trim() ? { subtitle: input.subtitle.trim() } : {}),
  }

  if (input.profileType !== 'artist') return base

  const cookie = loadNeteaseCookie().trim()
  if (!cookie) return base

  try {
    const [detail, topSongs, albumsPage] = await Promise.all([
      fetchArtistDetail(cookie, input.profileId),
      fetchArtistTopSongs(cookie, input.profileId).catch(() => [] as NeteaseSongItem[]),
      fetchArtistAlbumsPage(cookie, input.profileId, { offset: 0, limit: MAX_ALBUM_TITLES }).catch(
        () => ({ albums: [], more: false }),
      ),
    ])
    const topSongTitles = topSongs
      .map((s) => s.name.trim())
      .filter(Boolean)
      .slice(0, MAX_TOP_SONGS)
    const albumTitles = albumsPage.albums
      .map((a) => a.name.trim())
      .filter(Boolean)
      .slice(0, MAX_ALBUM_TITLES)

    return {
      ...base,
      displayName: detail.name?.trim() || base.displayName,
      ...(detail.avatar?.trim() ? { avatar: detail.avatar.trim() } : {}),
      ...(clipText(detail.briefDesc, MAX_BRIEF_DESC)
        ? { briefDesc: clipText(detail.briefDesc, MAX_BRIEF_DESC) }
        : {}),
      ...(detail.alias?.length ? { aliases: detail.alias.map((a) => a.trim()).filter(Boolean).slice(0, 6) } : {}),
      ...(detail.identities?.length
        ? { identities: detail.identities.map((a) => a.trim()).filter(Boolean).slice(0, 8) }
        : {}),
      ...(detail.musicSize > 0 ? { musicSize: detail.musicSize } : {}),
      ...(detail.albumSize > 0 ? { albumSize: detail.albumSize } : {}),
      ...(detail.followers > 0 ? { followers: detail.followers } : {}),
      ...(topSongTitles.length ? { topSongTitles } : {}),
      ...(albumTitles.length ? { albumTitles } : {}),
    }
  } catch {
    return base
  }
}
