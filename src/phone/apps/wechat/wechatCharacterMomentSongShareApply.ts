import type { ApiConfig } from '../api/types'
import { loadNeteaseCookie } from '../../../components/discoverListen/neteaseApiClient'
import {
  enrichMomentAttachedMusic,
  songShareToMomentMusic,
} from '../../../components/moments/momentAttachedMusic'
import { upsertUserMoment } from '../../../components/moments/momentsFeedStorage'
import { isMomentsChatApiConfigured } from '../../../components/moments/momentsChatApiReady'
import { resolveMomentsChatPublishContext } from '../../../components/moments/momentsChatPublishContext'
import { characterPostToMomentItem } from '../../../components/moments/publishMomentUtils'
import { sanitizeMomentBodyText } from '../../../components/moments/momentTextSanitize'
import { resolveCharacterAvatarUrl } from '../../utils/characterAvatarUrl'
import { personaDb } from './newFriendsPersona/idb'
import {
  fetchNeteaseSongDetails,
  searchNeteaseSongs,
  type NeteaseSongItem,
} from '../../../components/discoverListen/neteaseMusicApi'
import { scheduleCharacterMomentArchive } from '../../../components/moments/momentArchiverService'
import { buildMomentsUserContactRef } from '../../../components/moments/momentMentionUtils'
import { useMusicStore } from '../../../stores/useMusicStore'

export type CharacterMomentSongShareDirective = {
  trackId?: number
  title?: string
  artist?: string
  coverUrl?: string
  /** 随歌曲附带的文字说明 */
  content?: string
}

const MOMENT_SHARE_SONG_RE =
  /^\[(?:MOMENT_SHARE_SONG|朋友圈分享歌曲)\](?:\s*(\{[\s\S]*\}))?\s*$/i

function parseDirectiveJson(inline: string): Record<string, unknown> | null {
  try {
    const j = JSON.parse(inline) as Record<string, unknown>
    return j && typeof j === 'object' && !Array.isArray(j) ? j : null
  } catch {
    return null
  }
}

function pickSongShareFields(j: Record<string, unknown> | null): CharacterMomentSongShareDirective {
  if (!j) return {}
  const trackId = Number(j.trackId ?? j.songId ?? j.id)
  const title =
    typeof j.title === 'string'
      ? j.title.trim()
      : typeof j.trackTitle === 'string'
        ? j.trackTitle.trim()
        : ''
  const artist =
    typeof j.artist === 'string'
      ? j.artist.trim()
      : typeof j.trackArtist === 'string'
        ? j.trackArtist.trim()
        : ''
  const coverUrl =
    typeof j.coverUrl === 'string'
      ? j.coverUrl.trim()
      : typeof j.cover === 'string'
        ? j.cover.trim()
        : ''
  const content =
    typeof j.content === 'string'
      ? j.content.trim()
      : typeof j.caption === 'string'
        ? j.caption.trim()
        : typeof j.text === 'string'
          ? j.text.trim()
          : ''
  return {
    ...(Number.isFinite(trackId) && trackId > 0 ? { trackId: Math.floor(trackId) } : {}),
    ...(title ? { title } : {}),
    ...(artist ? { artist } : {}),
    ...(coverUrl ? { coverUrl } : {}),
    ...(content ? { content: content.slice(0, 500) } : {}),
  }
}

export function parseCharacterMomentSongShareDirective(
  line: string,
): CharacterMomentSongShareDirective | null {
  const t = String(line ?? '').trim()
  if (!t) return null
  const match = MOMENT_SHARE_SONG_RE.exec(t)
  if (!match) return null
  const jsonRaw = match[1]?.trim()
  return pickSongShareFields(jsonRaw ? parseDirectiveJson(jsonRaw) : null)
}

export function mergeCharacterMomentSongShareDirectiveLines(
  currentLine: string,
  nextLine?: string,
): string {
  const current = String(currentLine ?? '')
    .trim()
    .replace(/^`+|`+$/g, '')
    .trim()
    .replace(/［/g, '[')
    .replace(/］/g, ']')
  const next = String(nextLine ?? '')
    .trim()
    .replace(/^`+|`+$/g, '')
    .trim()
  if (/^\[(?:MOMENT_SHARE_SONG|朋友圈分享歌曲)\]$/i.test(current) && next.startsWith('{') && next.endsWith('}')) {
    return `${current}${next}`
  }
  return current
}

export function filterCharacterMomentSongShareDirectives(bubbles: string[]): {
  bubbles: string[]
  directives: CharacterMomentSongShareDirective[]
} {
  const directives: CharacterMomentSongShareDirective[] = []
  const next = bubbles.filter((line) => {
    const directive = parseCharacterMomentSongShareDirective(line)
    if (!directive) return true
    directives.push(directive)
    return false
  })
  return { bubbles: next, directives }
}

async function resolveTrackForSongShare(
  fields: CharacterMomentSongShareDirective,
): Promise<NeteaseSongItem | null> {
  const cookie = loadNeteaseCookie().trim()
  if (fields.trackId) {
    try {
      const rows = await fetchNeteaseSongDetails(cookie, [fields.trackId])
      if (rows[0]) return rows[0]
    } catch {
      /* fallback search */
    }
  }

  const title = fields.title?.trim()
  const artist = fields.artist?.trim()
  const query = [title, artist].filter(Boolean).join(' ').trim()
  if (query) {
    try {
      const songs = await searchNeteaseSongs(cookie, query, 8)
      if (!songs.length) return null
      if (title) {
        const exact = songs.find((s) => s.name.trim() === title)
        if (exact) return exact
      }
      return songs[0]!
    } catch {
      return null
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

  return null
}

export async function applyCharacterMomentSongShareDirectives(params: {
  accountId: string | null | undefined
  characterId: string
  playerIdentityId: string
  playerDisplayName: string
  apiConfig: ApiConfig | null | undefined
  directives: CharacterMomentSongShareDirective[]
}): Promise<{ published: number }> {
  const cid = params.characterId.trim()
  if (!cid || !params.directives.length) return { published: 0 }
  if (!isMomentsChatApiConfigured(params.apiConfig)) return { published: 0 }

  const ctx = await resolveMomentsChatPublishContext({
    accountId: params.accountId,
    characterId: cid,
    playerIdentityId: params.playerIdentityId,
    playerDisplayName: params.playerDisplayName,
    apiConfig: params.apiConfig,
  })
  if (!ctx) return { published: 0 }

  const character = await personaDb.getCharacter(cid)
  const displayName =
    ctx.characterContact.name.trim() ||
    character?.remark?.trim() ||
    character?.wechatNickname?.trim() ||
    character?.name?.trim() ||
    '未命名'
  const avatarUrl =
    resolveCharacterAvatarUrl({
      avatarUrl: ctx.characterContact.avatarUrl ?? character?.avatarUrl,
    }) || resolveCharacterAvatarUrl({ avatarUrl: '' })

  let published = 0

  for (const directive of params.directives) {
    try {
      const track = await resolveTrackForSongShare(directive)
      if (!track?.id) continue

      let attachedMusic = songShareToMomentMusic({
        id: track.id,
        title: track.name,
        artist: track.artist,
        cover: track.cover || directive.coverUrl,
        artistId: track.artistId,
      })
      attachedMusic = await enrichMomentAttachedMusic(attachedMusic)

      const content = sanitizeMomentBodyText(directive.content ?? '')
      const userContact = buildMomentsUserContactRef(params.playerDisplayName)
      const item = characterPostToMomentItem({
        characterId: cid,
        authorName: displayName,
        authorAvatar: avatarUrl,
        postType: content ? 'mixed' : 'text',
        content,
        imageUrls: [],
        attachedMusic,
        privacy: { mode: 'only_user', hideFromCharacterIds: [] },
        userContact,
        momentContacts: ctx.momentContacts,
      })

      await upsertUserMoment(params.accountId, item)
      scheduleCharacterMomentArchive({
        moment: item,
        apiConfig: params.apiConfig,
        wechatAccountId: params.accountId,
        playerIdentityId: params.playerIdentityId,
        playerDisplayName: params.playerDisplayName,
        contactDirectory: ctx.contactDirectory,
      })
      published += 1
    } catch {
      // 单条失败不阻断
    }
  }

  return { published }
}

export async function stripAndApplyCharacterMomentSongShareDirectives(params: {
  accountId: string | null | undefined
  characterId: string
  playerIdentityId: string
  playerDisplayName: string
  apiConfig: ApiConfig | null | undefined
  bubbles: string[]
}): Promise<string[]> {
  const filtered = filterCharacterMomentSongShareDirectives(params.bubbles)
  if (filtered.directives.length) {
    await applyCharacterMomentSongShareDirectives({
      accountId: params.accountId,
      characterId: params.characterId,
      playerIdentityId: params.playerIdentityId,
      playerDisplayName: params.playerDisplayName,
      apiConfig: params.apiConfig,
      directives: filtered.directives,
    })
  }
  return filtered.bubbles
}

export const WECHAT_CHARACTER_MOMENT_SONG_SHARE_APPENDIX = `
---------------------
【朋友圈分享歌曲（可选 · 对用户不可见）】
---------------------
当你想**把某首歌分享到朋友圈**（而不只是私聊发卡片或一起听）时：
- 先用 1～2 句口语说明为什么要分享这首歌。
- 再**单独一行**输出机器指令（用户看不到该行）：
  - \`[MOMENT_SHARE_SONG]\` — 分享当前正在聊/一起听的歌
  - \`[MOMENT_SHARE_SONG]{"trackId":歌曲id}\`
  - \`[MOMENT_SHARE_SONG]{"title":"歌名","artist":"歌手"}\`
  - 可选附带配文：\`[MOMENT_SHARE_SONG]{"trackId":123,"content":"分享理由…"}\`
- 客户端会静默发布带歌曲胶囊的朋友圈；**不要**在聊天里写出完整歌词。
- 未在对话里明确提到外语歌时，**默认分享华语歌**（中文歌名+中文歌手名）；勿随手选英文小众独立音乐。
- 与 \`[MUSIC_PLAY]\` / \`[MUSIC_SYNC_INVITE]\` 可同轮搭配：先口语聊歌，再选其一执行。
- 用户没提、你也不打算分享时，**不要**输出该指令。
`.trim()
