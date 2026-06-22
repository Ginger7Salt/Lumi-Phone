import { loadNeteaseCookie } from '../../../../components/discoverListen/neteaseApiClient'
import { listenTogetherPlayerEngine } from '../../../../components/discoverListen/listenTogetherPlayerEngine'
import type { ParsedLyricLine } from '../../../../components/discoverListen/listenLyricParse'
import { isActiveSyncListeningWithCharacter } from './syncListeningPlaybackBias'
import { resolveSongLyricsExcerpt } from './listenShareAiContext'
import {
  filterCharacterMusicSyncDirectives,
  isCharacterMusicSyncDirectiveArtifactLine,
  mergeCharacterMusicSyncDirectiveBubbles,
  parseCharacterMusicSyncDirective,
  parseCharacterMusicSyncDirectiveFromArtifactLine,
  type CharacterMusicSyncDirective,
} from './wechatCharacterMusicSyncAi'
import {
  fetchNeteaseSongDetails,
  searchNeteaseSongs,
  type NeteaseSongItem,
} from '../../../../components/discoverListen/neteaseMusicApi'
import { useMusicStore, type SyncListeningProfile } from '../../../../stores/useMusicStore'
import type { WeChatMusicSyncInvitePayload } from '../newFriendsPersona/types'

export type CharacterMusicSyncSessionContext = {
  characterId: string
  user: SyncListeningProfile
  companion: SyncListeningProfile
}

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

/** 搜歌结果择优用；邀约卡展示不依赖此分数（搜不到仍用指令里的歌名/歌手） */
const MIN_INVITE_MATCH_SCORE = 4

/** 未在网易云解析到曲目 id 时的占位（仅展示邀约卡，接受/播放时再解析） */
const UNRESOLVED_INVITE_TRACK_ID = 0

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
  const queries = [[t, a].filter(Boolean).join(' '), t, a ? `${a} ${t}` : '']
    .map((q) => q.trim())
    .filter(Boolean)
  return [...new Set(queries)]
}

async function searchNeteaseTrackForDirective(
  cookie: string,
  title: string,
  artist: string,
  forInvite = false,
): Promise<NeteaseSongItem | null> {
  const queries = buildSearchQueries(title, artist)
  let best: NeteaseSongItem | null = null
  let bestScore = -1
  for (const query of queries) {
    try {
      const songs = await searchNeteaseSongs(cookie, query, 20)
      const candidate = pickBestNeteaseSongMatch(songs, title, artist)
      if (!candidate) continue
      const score = scoreSongMatch(candidate, title, artist)
      if (score > bestScore) {
        best = candidate
        bestScore = score
      }
      if (score >= 18) break
    } catch {
      /* 尝试下一个关键词 */
    }
  }
  if (!forInvite) return best
  if (!best) return null
  const wantTitle = normalizeSongKey(title)
  const gotTitle = normalizeSongKey(best.name)
  if (wantTitle && gotTitle === wantTitle) return best
  if (bestScore >= MIN_INVITE_MATCH_SCORE) return best
  // 邀约卡不阻断：有候选则带上封面/id，阈值未过也优于纯文本兜底
  return best
}

async function resolveTrackForDirective(
  fields: {
    trackId?: number
    title?: string
    artist?: string
    coverUrl?: string
  },
  options?: { forInvite?: boolean },
): Promise<NeteaseSongItem | null> {
  /** 无网易账号登录也可走公共 API 搜索（与听一听游客模式一致） */
  const cookie = loadNeteaseCookie().trim()
  const title = fields.title?.trim() ?? ''
  const artist = fields.artist?.trim() ?? ''

  if (fields.trackId) {
    try {
      const rows = await fetchNeteaseSongDetails(cookie, [fields.trackId])
      if (rows[0]) return rows[0]
    } catch {
      /* fallback search */
    }
  }

  if (title || artist) {
    const track = await searchNeteaseTrackForDirective(cookie, title, artist, options?.forInvite)
    if (track) return track
  }

  if (options?.forInvite) {
    if (title || artist || fields.trackId) {
      return {
        id: fields.trackId && fields.trackId > 0 ? fields.trackId : UNRESOLVED_INVITE_TRACK_ID,
        name: title || '未知歌曲',
        artist: artist || '未知歌手',
        cover: fields.coverUrl?.trim() || '',
      }
    }
    return null
  }

  const current = useMusicStore.getState().currentTrack
  if (current?.id && current.title !== '暂无播放') {
    return {
      id: current.id,
      name: current.title,
      artist: current.artist,
      cover: current.cover,
      artistId: current.artistId,
    }
  }

  if (fields.trackId) {
    return {
      id: fields.trackId,
      name: title || '未知歌曲',
      artist: artist || '未知歌手',
      cover: fields.coverUrl?.trim() || '',
    }
  }

  return null
}

function parseClockTimeToMs(raw: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(raw.trim())
  if (!m) return null
  const min = Number(m[1])
  const sec = Number(m[2])
  const fracRaw = m[3] ?? '0'
  const ms = fracRaw.length >= 3 ? Number(fracRaw.slice(0, 3)) : Number(fracRaw.padEnd(3, '0'))
  if (!Number.isFinite(min) || !Number.isFinite(sec) || !Number.isFinite(ms)) return null
  return (min * 60 + sec) * 1000 + ms
}

function normalizeLyricSeekKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？、；：「」『』""''（）()[\]【】《》…~～·,.!?;:'"`-]+/g, '')
}

function resolveSeekTimeMsFromLyric(lyric: string, lyrics: ParsedLyricLine[]): number | null {
  const want = normalizeLyricSeekKey(lyric)
  if (!want || want.length < 2) return null
  let best: ParsedLyricLine | null = null
  let bestScore = 0
  for (const line of lyrics) {
    const text = line.text.trim()
    if (!text || text === '暂无歌词') continue
    const key = normalizeLyricSeekKey(text)
    if (key === want) return line.timeMs
    if (key.includes(want) || want.includes(key)) {
      const score = Math.min(key.length, want.length)
      if (score > bestScore) {
        best = line
        bestScore = score
      }
    }
  }
  return best && bestScore >= 2 ? best.timeMs : null
}

export function resolveCharacterMusicSeekTimeMs(directive: {
  timeMs?: number
  time?: string
  lyric?: string
  percent?: number
}): number | null {
  if (directive.timeMs != null && Number.isFinite(directive.timeMs) && directive.timeMs >= 0) {
    return Math.floor(directive.timeMs)
  }
  if (directive.time?.trim()) {
    const ms = parseClockTimeToMs(directive.time)
    if (ms != null) return ms
  }
  if (directive.lyric?.trim()) {
    const { lyrics } = useMusicStore.getState()
    const ms = resolveSeekTimeMsFromLyric(directive.lyric, lyrics)
    if (ms != null) return ms
  }
  if (directive.percent != null && Number.isFinite(directive.percent)) {
    const { durationMs } = useMusicStore.getState()
    if (durationMs > 0) {
      const pct = Math.max(0, Math.min(100, directive.percent))
      return Math.round((pct / 100) * durationMs)
    }
  }
  return null
}

/** 角色共听拉进度：同步播放器并继续播放 */
export function applyCharacterMusicSeek(timeMs: number): boolean {
  if (!Number.isFinite(timeMs) || timeMs < 0) return false
  listenTogetherPlayerEngine.seekToTimeMs(timeMs)
  const { isPlaying } = useMusicStore.getState()
  if (!isPlaying) {
    listenTogetherPlayerEngine.togglePlay()
  }
  return true
}

function ensureSyncListening(ctx: CharacterMusicSyncSessionContext): void {
  useMusicStore.getState().setSyncListening({
    user: ctx.user,
    companion: { ...ctx.companion, characterId: ctx.characterId },
  })
}

function buildInvitePayloadFromFields(
  fields: {
    trackId?: number
    title?: string
    artist?: string
    coverUrl?: string
  },
  inviteId: string,
  track: NeteaseSongItem | null,
): WeChatMusicSyncInvitePayload | null {
  const trackTitle = (track?.name || fields.title || '').trim()
  const trackArtist = (track?.artist || fields.artist || '').trim() || '未知歌手'
  if (!trackTitle && !(fields.trackId && fields.trackId > 0)) return null

  const resolvedId =
    track && Number.isFinite(track.id) && track.id > 0
      ? track.id
      : fields.trackId && fields.trackId > 0
        ? fields.trackId
        : UNRESOLVED_INVITE_TRACK_ID

  return {
    kind: 'music_invite',
    inviteId,
    trackId: resolvedId,
    trackTitle: trackTitle || '未知歌曲',
    trackArtist,
    coverUrl: track?.cover?.trim() || fields.coverUrl?.trim() || '',
  }
}

export async function buildCharacterMusicSyncInvitePayload(
  fields: {
    trackId?: number
    title?: string
    artist?: string
    coverUrl?: string
  },
  inviteId: string,
): Promise<WeChatMusicSyncInvitePayload | null> {
  try {
    const track = await resolveTrackForDirective(fields, { forInvite: true })
    const invite = buildInvitePayloadFromFields(fields, inviteId, track)
    if (!invite) return null

    const cookie = loadNeteaseCookie().trim()
    if (cookie && invite.trackId > 0) {
      try {
        const lyricsExcerpt = await resolveSongLyricsExcerpt(invite.trackId, cookie)
        if (lyricsExcerpt) return { ...invite, lyricsExcerpt }
      } catch {
        /* 歌词拉取失败不阻断邀约卡 */
      }
    }

    return invite
  } catch {
    return buildInvitePayloadFromFields(fields, inviteId, null)
  }
}

export async function startCharacterMusicSyncInvitePlayback(
  invite: WeChatMusicSyncInvitePayload,
  ctx: CharacterMusicSyncSessionContext,
): Promise<boolean> {
  const track = await resolveTrackForDirective(
    {
      trackId: invite.trackId > 0 ? invite.trackId : undefined,
      title: invite.trackTitle,
      artist: invite.trackArtist,
      coverUrl: invite.coverUrl,
    },
    { forInvite: true },
  )
  if (!track?.id || track.id <= 0) return false
  ensureSyncListening(ctx)
  try {
    await listenTogetherPlayerEngine.playSong(track, { queue: [track], index: 0 })
    return true
  } catch {
    return false
  }
}

export async function applyCharacterMusicSyncDirective(
  directive: CharacterMusicSyncDirective,
  ctx: CharacterMusicSyncSessionContext,
): Promise<{ invite?: WeChatMusicSyncInvitePayload; playedTrack?: NeteaseSongItem }> {
  const inSync = isActiveSyncListeningWithCharacter(ctx.characterId)

  if (directive.kind === 'play_next') {
    if (!inSync) return {}
    await listenTogetherPlayerEngine.playNext()
    return {}
  }

  if (directive.kind === 'play_prev') {
    if (!inSync) return {}
    await listenTogetherPlayerEngine.playPrev()
    return {}
  }

  if (directive.kind === 'play') {
    if (!inSync) return {}
    const track = await resolveTrackForDirective(directive)
    if (!track?.id) return {}
    ensureSyncListening(ctx)
    try {
      await listenTogetherPlayerEngine.playSong(track, { queue: [track], index: 0 })
    } catch {
      /* 播放失败不阻断 */
    }
    return { playedTrack: track }
  }

  if (directive.kind === 'seek') {
    if (!inSync) return {}
    const timeMs = resolveCharacterMusicSeekTimeMs(directive)
    if (timeMs == null) return {}
    applyCharacterMusicSeek(timeMs)
    return {}
  }

  if (directive.kind === 'invite') {
    const inviteId = `cmi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const invite = await buildCharacterMusicSyncInvitePayload(directive, inviteId)
    if (!invite) return {}
    return { invite }
  }

  return {}
}

export function buildCharacterMusicSyncSessionContextForProactive(params: {
  characterId: string
  characterDisplayName: string
  characterAvatarUrl?: string
  playerDisplayName: string
  playerAvatarUrl?: string
}): CharacterMusicSyncSessionContext {
  return {
    characterId: params.characterId.trim(),
    user: {
      name: params.playerDisplayName.trim() || '我',
      avatar: params.playerAvatarUrl?.trim() || '',
    },
    companion: {
      name: params.characterDisplayName.trim() || '对方',
      avatar: params.characterAvatarUrl?.trim() || '',
      characterId: params.characterId.trim(),
    },
  }
}

export type PendingCharacterMusicSyncInvite = {
  /** 在第 N 条对手方可见气泡（文本/语音/图等）露出后插入邀约卡 */
  insertAfterBubbleStep: number
  invite: WeChatMusicSyncInvitePayload
  replyText?: string
}

export type PendingCharacterMusicSyncSeek = {
  /** 在第 N 条对手方可见气泡露出后执行拉进度 */
  insertAfterBubbleStep: number
  timeMs: number
  lyricHint?: string
}

export type PendingCharacterMusicSyncPlay = {
  /** 在第 N 条对手方可见气泡露出后切歌/点播 */
  insertAfterBubbleStep: number
  directive: Extract<CharacterMusicSyncDirective, { kind: 'play' }>
}

async function planCharacterMusicSyncPlayOrInvite(
  act: Extract<CharacterMusicSyncDirective, { kind: 'play' }>,
  insertAfterBubbleStep: number,
  ctx: CharacterMusicSyncSessionContext,
  pendingInvites: PendingCharacterMusicSyncInvite[],
  pendingPlays: PendingCharacterMusicSyncPlay[],
  callbacks: {
    onInviteResolved?: (invite: WeChatMusicSyncInvitePayload) => void
    onInviteFailed?: (fields: { title?: string; artist?: string }) => void
    onPlayPlanned?: (play: PendingCharacterMusicSyncPlay) => void
    onPlayConvertedToInvite?: (play: Extract<CharacterMusicSyncDirective, { kind: 'play' }>) => void
  },
): Promise<void> {
  const inSync = isActiveSyncListeningWithCharacter(ctx.characterId)
  if (inSync) {
    const planned: PendingCharacterMusicSyncPlay = {
      insertAfterBubbleStep,
      directive: act,
    }
    pendingPlays.push(planned)
    callbacks.onPlayPlanned?.(planned)
    return
  }

  const inviteAct: CharacterMusicSyncDirective = {
    kind: 'invite',
    title: act.title,
    artist: act.artist,
    trackId: act.trackId,
    coverUrl: act.coverUrl,
  }
  try {
    const result = await applyCharacterMusicSyncDirective(inviteAct, ctx)
    if (result.invite) {
      pendingInvites.push({
        insertAfterBubbleStep,
        invite: result.invite,
      })
      callbacks.onInviteResolved?.(result.invite)
      callbacks.onPlayConvertedToInvite?.(act)
    } else {
      callbacks.onInviteFailed?.({ title: act.title, artist: act.artist })
    }
  } catch (err) {
    callbacks.onInviteFailed?.({ title: act.title, artist: act.artist })
    if (typeof console !== 'undefined') {
      console.warn('[music_sync] MUSIC_PLAY→INVITE convert failed', err)
    }
  }
}

/** 从气泡序列中提取共听指令、搜歌并规划邀约卡插入位置（指令行本身不展示） */
export async function preprocessCharacterMusicSyncBubblesForChat(params: {
  bubbles: string[]
  ctx: CharacterMusicSyncSessionContext
  onInviteResolved?: (invite: WeChatMusicSyncInvitePayload) => void
  onInviteFailed?: (fields: { title?: string; artist?: string }) => void
  onSeekPlanned?: (seek: PendingCharacterMusicSyncSeek) => void
  onPlayPlanned?: (play: PendingCharacterMusicSyncPlay) => void
  onPlayConvertedToInvite?: (play: Extract<CharacterMusicSyncDirective, { kind: 'play' }>) => void
}): Promise<{
  bubbles: string[]
  pendingInvites: PendingCharacterMusicSyncInvite[]
  pendingSeeks: PendingCharacterMusicSyncSeek[]
  pendingPlays: PendingCharacterMusicSyncPlay[]
}> {
  const merged = mergeCharacterMusicSyncDirectiveBubbles(params.bubbles)
  const next: string[] = []
  const pendingInvites: PendingCharacterMusicSyncInvite[] = []
  const pendingSeeks: PendingCharacterMusicSyncSeek[] = []
  const pendingPlays: PendingCharacterMusicSyncPlay[] = []

  for (const raw of merged) {
    const line = String(raw ?? '').trim()
    if (!line) continue
    const act = parseCharacterMusicSyncDirectiveFromArtifactLine(line)
    if (!act) {
      if (isCharacterMusicSyncDirectiveArtifactLine(line)) {
        const retry = parseCharacterMusicSyncDirective(line)
        if (retry && retry.kind !== 'invite') {
          if (retry.kind === 'play') {
            await planCharacterMusicSyncPlayOrInvite(
              retry,
              next.length,
              params.ctx,
              pendingInvites,
              pendingPlays,
              {
                onInviteResolved: params.onInviteResolved,
                onInviteFailed: params.onInviteFailed,
                onPlayPlanned: params.onPlayPlanned,
                onPlayConvertedToInvite: params.onPlayConvertedToInvite,
              },
            )
          } else if (retry.kind === 'seek') {
            const timeMs = resolveCharacterMusicSeekTimeMs(retry)
            if (timeMs != null) {
              const planned: PendingCharacterMusicSyncSeek = {
                insertAfterBubbleStep: next.length,
                timeMs,
                lyricHint: retry.lyric?.trim() || retry.time?.trim(),
              }
              pendingSeeks.push(planned)
              params.onSeekPlanned?.(planned)
            }
          } else {
            void applyCharacterMusicSyncDirective(retry, params.ctx).catch(() => {})
          }
        }
        continue
      }
      next.push(line)
      continue
    }
    if (act.kind === 'invite') {
      try {
        const result = await applyCharacterMusicSyncDirective(act, params.ctx)
        if (result.invite) {
          pendingInvites.push({
            insertAfterBubbleStep: next.length,
            invite: result.invite,
            replyText: act.replyText,
          })
          params.onInviteResolved?.(result.invite)
        } else {
          params.onInviteFailed?.({ title: act.title, artist: act.artist })
        }
      } catch (err) {
        params.onInviteFailed?.({ title: act.title, artist: act.artist })
        if (typeof console !== 'undefined') {
          console.warn('[music_sync] invite preprocess failed', err)
        }
      }
      continue
    }
    if (act.kind === 'play') {
      await planCharacterMusicSyncPlayOrInvite(
        act,
        next.length,
        params.ctx,
        pendingInvites,
        pendingPlays,
        {
          onInviteResolved: params.onInviteResolved,
          onInviteFailed: params.onInviteFailed,
          onPlayPlanned: params.onPlayPlanned,
          onPlayConvertedToInvite: params.onPlayConvertedToInvite,
        },
      )
      continue
    }
    if (act.kind === 'seek') {
      const timeMs = resolveCharacterMusicSeekTimeMs(act)
      if (timeMs != null) {
        const planned: PendingCharacterMusicSyncSeek = {
          insertAfterBubbleStep: next.length,
          timeMs,
          lyricHint: act.lyric?.trim() || act.time?.trim(),
        }
        pendingSeeks.push(planned)
        params.onSeekPlanned?.(planned)
      }
      continue
    }
    void applyCharacterMusicSyncDirective(act, params.ctx).catch(() => {})
    continue
  }

  return { bubbles: next, pendingInvites, pendingSeeks, pendingPlays }
}

export async function stripAndApplyCharacterMusicSyncDirectives(params: {
  bubbles: string[]
  ctx: CharacterMusicSyncSessionContext
}): Promise<{
  bubbles: string[]
  invites: WeChatMusicSyncInvitePayload[]
}> {
  const merged = mergeCharacterMusicSyncDirectiveBubbles(params.bubbles)
  const filtered = filterCharacterMusicSyncDirectives(merged)
  const invites: WeChatMusicSyncInvitePayload[] = []
  for (const directive of filtered.directives) {
    try {
      const result = await applyCharacterMusicSyncDirective(directive, params.ctx)
      if (result.invite) invites.push(result.invite)
    } catch {
      /* 单条失败不阻断 */
    }
  }
  return { bubbles: filtered.bubbles, invites }
}
