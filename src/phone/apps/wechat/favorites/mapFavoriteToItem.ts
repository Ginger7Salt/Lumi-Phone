import type { Favorite, WeChatChatMessage } from '../newFriendsPersona/types'
import { buildUserImageDataUrl } from '../wechatCharacterProfileImageApply'
import type { FavoriteItem } from './favoriteItemTypes'
import { SHARED_RECORD_PLAYER_ORIGIN_ID } from './sharedRecordOrigin'

const PLAYER_SOURCE_NAME = '用户'

function resolveSourceName(characterId: string, nameByCharId: Map<string, string>): string {
  const id = characterId.trim()
  if (!id) return '未知来源'
  return nameByCharId.get(id)?.trim() || '未命名'
}

function resolveSourceAvatar(characterId: string, avatarByCharId: Map<string, string>): string | undefined {
  const id = characterId.trim()
  if (!id) return undefined
  return avatarByCharId.get(id)
}

function buildTags(msg: WeChatChatMessage | null): string[] | undefined {
  const tags: string[] = []
  const emotion = msg?.voice?.emotionLabel?.trim()
  if (emotion) tags.push(emotion)
  return tags.length ? tags : undefined
}

export function mapFavoriteToItem(
  fav: Favorite,
  msg: WeChatChatMessage | null,
  nameByCharId: Map<string, string>,
  avatarByCharId: Map<string, string>,
): FavoriteItem {
  const isPlayerMessage = msg?.type === 'player'
  const sourceSenderKind: FavoriteItem['sourceSenderKind'] = isPlayerMessage ? 'player' : 'character'
  const sourceCharacterId = isPlayerMessage
    ? SHARED_RECORD_PLAYER_ORIGIN_ID
    : (msg?.characterId?.trim() || fav.characterId.trim())
  const sourceName = isPlayerMessage
    ? PLAYER_SOURCE_NAME
    : resolveSourceName(sourceCharacterId, nameByCharId)
  const base = {
    id: fav.id,
    messageId: fav.messageId,
    sourceCharacterId,
    sourceName,
    sourceSenderKind,
    sourceAvatarUrl: isPlayerMessage ? undefined : resolveSourceAvatar(sourceCharacterId, avatarByCharId),
    timestamp: fav.timestamp,
    savedAt: fav.createdAt,
    tags: buildTags(msg),
  }

  if (msg?.voice || fav.voiceDurationSec) {
    const duration = Math.max(
      1,
      Math.floor(fav.voiceDurationSec ?? msg?.voice?.durationSec ?? 0),
    )
    const transcript =
      fav.voiceTranscript?.trim() ||
      msg?.voice?.transcriptText?.trim() ||
      msg?.content?.trim() ||
      undefined
    return {
      ...base,
      type: 'voice',
      duration,
      audioUrl: fav.voiceAudioUrl?.trim() || msg?.voice?.audioUrl?.trim() || undefined,
      transcript,
      voiceAudioKvKey: fav.voiceAudioKvKey?.trim() || undefined,
    }
  }

  if (msg?.images?.length) {
    const imageUrls = msg.images
      .map((img) => buildUserImageDataUrl(img.base64, img.type))
      .filter(Boolean)
    if (imageUrls.length) {
      return { ...base, type: 'image', imageUrls }
    }
  }

  const content = (msg?.content ?? fav.content).trim() || '（空内容）'
  return { ...base, type: 'text', content }
}

function padTimeUnit(n: number): string {
  return String(n).padStart(2, '0')
}

function formatFavoriteHms(d: Date): string {
  return `${padTimeUnit(d.getHours())}:${padTimeUnit(d.getMinutes())}:${padTimeUnit(d.getSeconds())}`
}

function formatFavoriteDayDiffLabel(d: Date, now: Date): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.floor((startOfToday - startOfTarget) / 86400000)
  if (dayDiff === 0) return '今天'
  if (dayDiff === 1) return '昨天'
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatFavoriteRelativeTime(ts: number): string {
  const t = typeof ts === 'number' && Number.isFinite(ts) ? ts : Date.now()
  const now = new Date()
  const d = new Date(t)
  return `${formatFavoriteDayDiffLabel(d, now)} ${formatFavoriteHms(d)}`
}

export function formatFavoriteSavedAt(ts: number): string {
  const t = typeof ts === 'number' && Number.isFinite(ts) ? ts : Date.now()
  const now = new Date()
  const d = new Date(t)
  const hm = `${padTimeUnit(d.getHours())}:${padTimeUnit(d.getMinutes())}`
  const dayLabel = formatFavoriteDayDiffLabel(d, now)
  return `${dayLabel} ${hm}`
}

export function formatVoiceDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function truncateTranscriptPreview(text: string | undefined, max = 18): string {
  const t = text?.trim()
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}
