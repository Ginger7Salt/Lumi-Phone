import { loadNeteaseCookie } from '../discoverListen/neteaseApiClient'
import {
  resolveSongLyricsExcerpt,
  formatListenTrackShareAiTranscriptLine,
} from '../../phone/apps/wechat/musicSync/listenShareAiContext'
import type { WeChatListenTrackSharePayload } from '../../phone/apps/wechat/newFriendsPersona/types'

export type MomentAttachedMusic = {
  title: string
  artist: string
  cover: string
  /** 网易云歌曲 id，有值时可唤起听一听播放 */
  songId?: number
  artistId?: number
  /** 发布/评论时拉取的歌词节选，供 AI 评论参考 */
  lyricsExcerpt?: string
}

export const MOMENT_MUSIC_DEFAULT_COVER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#e7e5e4"/><path d="M28 18v22.5a8 8 0 1 0 2 5.2V24.8l14-3.2v17.9a8 8 0 1 0 2 5.2V18z" fill="#a8a29e"/></svg>',
  )

const MAX_LYRICS_EXCERPT_CHARS = 2800

export function normalizeMomentAttachedMusic(raw: unknown): MomentAttachedMusic | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const title = typeof o.title === 'string' ? o.title.trim() : ''
  const artist = typeof o.artist === 'string' ? o.artist.trim() : ''
  const coverRaw = typeof o.cover === 'string' ? o.cover.trim() : ''
  if (!title) return undefined
  const songId =
    typeof o.songId === 'number' && Number.isFinite(o.songId) && o.songId > 0
      ? o.songId
      : undefined
  const artistId =
    typeof o.artistId === 'number' && Number.isFinite(o.artistId) && o.artistId > 0
      ? o.artistId
      : undefined
  const lyricsExcerpt =
    typeof o.lyricsExcerpt === 'string'
      ? o.lyricsExcerpt.trim().slice(0, MAX_LYRICS_EXCERPT_CHARS)
      : undefined
  return {
    title,
    artist,
    cover: coverRaw || MOMENT_MUSIC_DEFAULT_COVER,
    songId,
    artistId,
    ...(lyricsExcerpt ? { lyricsExcerpt } : {}),
  }
}

export function songShareToMomentMusic(song: {
  id: number
  title: string
  artist: string
  cover?: string
  artistId?: number
  lyricsExcerpt?: string
}): MomentAttachedMusic {
  return {
    title: song.title.trim() || '未知歌曲',
    artist: song.artist.trim() || '未知歌手',
    cover: song.cover?.trim() || MOMENT_MUSIC_DEFAULT_COVER,
    songId: song.id > 0 ? song.id : undefined,
    ...(song.artistId && song.artistId > 0 ? { artistId: song.artistId } : {}),
    ...(song.lyricsExcerpt?.trim() ? { lyricsExcerpt: song.lyricsExcerpt.trim() } : {}),
  }
}

function toListenTrackSharePayload(music: MomentAttachedMusic): WeChatListenTrackSharePayload {
  return {
    kind: 'listen_track_share',
    shareId: 'moment-attached',
    targetType: 'song',
    targetId: music.songId ?? 0,
    targetTitle: music.title,
    targetArtist: music.artist,
    targetCover: music.cover,
    ...(music.lyricsExcerpt?.trim() ? { lyricsExcerpt: music.lyricsExcerpt.trim() } : {}),
  }
}

/** 与一起听分享卡相同的 AI 上下文格式（含歌名、歌手、歌词节选） */
export function formatMomentAttachedMusicForAi(music: MomentAttachedMusic): string {
  return formatListenTrackShareAiTranscriptLine(toListenTrackSharePayload(music))
}

/** 拉取歌词并写入 attachedMusic（优先读本地播放缓存） */
export async function enrichMomentAttachedMusic(
  music: MomentAttachedMusic,
): Promise<MomentAttachedMusic> {
  if (music.lyricsExcerpt?.trim()) return music
  const songId = music.songId
  if (!songId) return music
  const cookie = loadNeteaseCookie().trim()
  const lyricsExcerpt = cookie ? await resolveSongLyricsExcerpt(songId, cookie) : ''
  return lyricsExcerpt ? { ...music, lyricsExcerpt } : music
}

export function buildMomentContentForAi(draft: {
  content: string
  attachedMusic?: MomentAttachedMusic
}): string {
  const text = draft.content.trim()
  const music = draft.attachedMusic
  if (!music) return text
  const musicLine = formatMomentAttachedMusicForAi(music)
  return text ? `${text}\n${musicLine}` : musicLine
}

export async function buildMomentContentForAiAsync(draft: {
  content: string
  attachedMusic?: MomentAttachedMusic
}): Promise<{ contentForAi: string; enrichedMusic?: MomentAttachedMusic }> {
  if (!draft.attachedMusic) {
    return { contentForAi: draft.content.trim() }
  }
  const enrichedMusic = await enrichMomentAttachedMusic(draft.attachedMusic)
  return {
    contentForAi: buildMomentContentForAi({
      content: draft.content,
      attachedMusic: enrichedMusic,
    }),
    enrichedMusic,
  }
}

export async function resolveMomentItemContentForAi(moment: {
  content: string
  attachedMusic?: MomentAttachedMusic
}): Promise<string> {
  let music = moment.attachedMusic
  if (music) {
    music = await enrichMomentAttachedMusic(music)
  }
  return buildMomentContentForAi({ content: moment.content, attachedMusic: music })
}

export type CharacterMomentSongDraft = {
  title: string
  artist: string
  songId?: number
}

/** 从 AI JSON 解析歌曲分享字段 */
export function parseCharacterMomentSongDraftFromAi(raw: unknown): CharacterMomentSongDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const title =
    typeof o.title === 'string'
      ? o.title.trim()
      : typeof o.trackTitle === 'string'
        ? o.trackTitle.trim()
        : typeof o.songTitle === 'string'
          ? o.songTitle.trim()
          : ''
  const artist =
    typeof o.artist === 'string'
      ? o.artist.trim()
      : typeof o.trackArtist === 'string'
        ? o.trackArtist.trim()
        : ''
  const songIdRaw = typeof o.songId === 'number' ? o.songId : Number(o.trackId ?? o.id)
  if (!title) return null
  return {
    title: title.slice(0, 120),
    artist: artist.slice(0, 120) || '未知歌手',
    ...(Number.isFinite(songIdRaw) && songIdRaw > 0 ? { songId: Math.floor(songIdRaw) } : {}),
  }
}

export const CHARACTER_MOMENT_MUSIC_POST_JSON_HINT =
  '"attachedMusic":{"title":"晴天","artist":"周杰伦"}'

export const CHARACTER_MOMENT_MUSIC_LOCALE_HINT = `
- **默认选华语歌**（国语/粤语流行、民谣、说唱、影视 OST、抖音热歌等）；歌名、歌手优先用**中文**填写。
- 仅当角色人设、近期私聊或一起听上下文**明确**提到某首日韩/欧美歌时，才选对应语种；勿为装文艺随手选 The Night We Met、City of Stars 等英文歌充数。
- 中国角色日常分享应像国内朋友圈：周杰伦、林俊杰、邓紫棋、毛不易、陈粒、告五人、薛之谦、孙燕姿等**网易云真实存在**的曲目均可；勿编造不存在的组合。
`.trim()

export function buildCharacterMomentMusicPostPrompt(localeHint = CHARACTER_MOMENT_MUSIC_LOCALE_HINT): string {
  return `
# Music Share Post (postType = music · 分享歌曲)
- 载体为**歌曲胶囊**（类似微信分享音乐到朋友圈），**禁止** imagePrompts / images。
- 必填 attachedMusic：**网易云音乐能搜到的真实歌曲**（歌名 + 歌手）。
${localeHint}
- content 可选：1～2 句分享理由/心情配文；也可留空仅分享歌曲。
- 须符合角色人设与近期上下文（例如一起听聊过的歌、私聊提到的歌、角色喜好）。
`.trim()
}

export const CHARACTER_MOMENT_MUSIC_POST_PROMPT = buildCharacterMomentMusicPostPrompt()

export const MOMENT_SONG_SHARE_AI_COMMENT_RULES = `
- 若正文含「分享单曲」及歌词节选：评论须基于**该曲名、歌手与已给出的歌词**有感而发；可聊某句歌词、旋律气质或共鸣点。
- **禁止**编造未出现在歌词节选中的词句、虚构歌手/专辑信息，或评论与歌曲明显无关的内容。
- 若无歌词节选，仅依据曲名与歌手评论，勿臆测具体歌词。
`.trim()
