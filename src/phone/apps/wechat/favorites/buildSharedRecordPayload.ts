import type { WeChatSharedRecordPayload } from '../newFriendsPersona/types'
import type { FavoriteItem } from './favoriteItemTypes'
import { truncateTranscriptPreview } from './mapFavoriteToItem'
import { resolveCanonicalCharacterId } from '../wechatGlobalCharacterRegistry'
import { resolveCharacterRealNameForSharedRecord } from './sharedRecordOriginNames'
import { SHARED_RECORD_PLAYER_ORIGIN_ID } from './sharedRecordOrigin'

export async function buildSharedRecordPayloadFromFavorite(item: FavoriteItem): Promise<WeChatSharedRecordPayload> {
  const now = Date.now()
  const shareId = `sr-${now}-${Math.random().toString(36).slice(2, 8)}`
  const senderKind = item.sourceSenderKind ?? 'character'
  const rawOriginId = senderKind === 'player' ? SHARED_RECORD_PLAYER_ORIGIN_ID : item.sourceCharacterId.trim()
  const originalSenderCharacterId =
    senderKind === 'player' || !rawOriginId
      ? rawOriginId
      : (await resolveCanonicalCharacterId(rawOriginId)) || rawOriginId
  let originalSenderName = senderKind === 'player' ? '用户' : item.sourceName.trim() || '未知来源'
  if (senderKind === 'character' && originalSenderCharacterId) {
    originalSenderName = await resolveCharacterRealNameForSharedRecord(originalSenderCharacterId)
  }
  const base = {
    kind: 'shared_record' as const,
    shareId,
    originalSenderName,
    originalSenderCharacterId,
    originalSenderKind: senderKind,
    timestamp: item.timestamp,
  }

  if (item.type === 'voice') {
    const transcript = item.transcript?.trim() || ''
    const summary = transcript || `语音 ${Math.max(1, item.duration)} 秒`
    const audioUrl = item.audioUrl?.trim()
    let voiceAudioUrl: string | undefined
    let voiceAudioKvKey: string | undefined
    if (audioUrl) {
      const { persistSharedRecordVoiceAudio, shouldStoreVoiceAudioInKv } = await import('../wechatVoiceAudioCache')
      if (shouldStoreVoiceAudioInKv(audioUrl)) {
        await persistSharedRecordVoiceAudio(shareId, audioUrl)
        voiceAudioKvKey = shareId
      } else {
        voiceAudioUrl = audioUrl
      }
    } else if (item.voiceAudioKvKey?.trim()) {
      const { loadFavoriteVoiceAudio, persistSharedRecordVoiceAudio } = await import('../wechatVoiceAudioCache')
      const fromFavKv = await loadFavoriteVoiceAudio(item.voiceAudioKvKey.trim())
      if (fromFavKv) {
        await persistSharedRecordVoiceAudio(shareId, fromFavKv)
        voiceAudioKvKey = shareId
      }
    }
    return {
      ...base,
      recordType: 'voice',
      contentSummary: summary,
      voiceDurationSec: Math.max(1, item.duration),
      ...(transcript ? { voiceTranscript: transcript } : {}),
      ...(voiceAudioUrl ? { voiceAudioUrl } : {}),
      ...(voiceAudioKvKey ? { voiceAudioKvKey } : {}),
    }
  }

  if (item.type === 'image') {
    const urls = item.imageUrls.filter(Boolean).slice(0, 4)
    return {
      ...base,
      recordType: 'image',
      contentSummary: urls.length > 1 ? `图片收藏 ×${urls.length}` : '图片收藏',
      imageUrls: urls,
    }
  }

  return {
    ...base,
    recordType: 'text',
    contentSummary: item.content.trim() || '（空内容）',
  }
}

export function sharedRecordTranscriptPreview(payload: WeChatSharedRecordPayload): string {
  if (payload.recordType === 'voice') {
    const preview = truncateTranscriptPreview(payload.voiceTranscript || payload.contentSummary, 24)
    return preview || `语音 ${payload.voiceDurationSec ?? 0} 秒`
  }
  if (payload.recordType === 'image') {
    return payload.contentSummary.trim() || '图片收藏'
  }
  return payload.contentSummary.trim()
}
