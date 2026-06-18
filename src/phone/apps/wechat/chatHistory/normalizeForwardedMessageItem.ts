import type {
  WeChatChatMessage,
  WeChatForwardedMessageItem,
  WeChatImageMime,
  WeChatRedPacketPayload,
  WeChatTransferPayload,
  WeChatVoicePayload,
} from '../newFriendsPersona/types'
import { messageContentSummary } from './buildChatHistoryPayload'

function normalizeImages(raw: unknown): { base64: string; type: WeChatImageMime }[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const images = raw
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const it = x as { base64?: unknown; type?: unknown }
      const base64 = typeof it.base64 === 'string' ? it.base64 : ''
      const type =
        it.type === 'image/jpeg' || it.type === 'image/png' || it.type === 'image/gif' || it.type === 'image/webp'
          ? it.type
          : null
      if (!base64.trim() || !type) return null
      const clipped = base64.length > 14_000_000 ? base64.slice(0, 14_000_000) : base64
      return { base64: clipped, type }
    })
    .filter((x): x is { base64: string; type: WeChatImageMime } => !!x)
  return images.length ? images.slice(0, 1) : undefined
}

function normalizeRedPacket(raw: unknown): WeChatRedPacketPayload | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const packetId = typeof r.packetId === 'string' ? r.packetId.trim() : ''
  const amountRaw = typeof r.amountYuan === 'number' ? r.amountYuan : Number.NaN
  const amountYuan = Number.isFinite(amountRaw) ? Math.round(amountRaw * 100) / 100 : Number.NaN
  const remark = typeof r.remark === 'string' ? r.remark.slice(0, 64) : ''
  const opened = !!r.opened
  const expired = typeof r.expired === 'boolean' ? r.expired : undefined
  if (!packetId || !Number.isFinite(amountYuan) || amountYuan <= 0) return undefined
  return { packetId, amountYuan, remark, opened, ...(expired ? { expired } : {}) }
}

function normalizeTransfer(raw: unknown): WeChatTransferPayload | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const transferId = typeof (raw as { transferId?: unknown }).transferId === 'string'
    ? (raw as { transferId: string }).transferId.trim()
    : ''
  return transferId ? { transferId } : undefined
}

function normalizeVoice(raw: unknown): WeChatVoicePayload | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const rawDuration = typeof r.durationSec === 'number' ? r.durationSec : Number.NaN
  if (!Number.isFinite(rawDuration) || rawDuration <= 0) return undefined
  const durationSec = Math.max(1, Math.floor(rawDuration))
  const emotionAnalyzed = !!r.emotionAnalyzed
  const emotionLabel = typeof r.emotionLabel === 'string' ? r.emotionLabel.trim().slice(0, 16) : ''
  const ttsScript = typeof r.ttsScript === 'string' ? r.ttsScript.trim().slice(0, 2000) : ''
  const audioUrl = typeof r.audioUrl === 'string' ? r.audioUrl.trim() : ''
  const transcriptText = typeof r.transcriptText === 'string' ? r.transcriptText.trim() : ''
  return {
    durationSec,
    emotionAnalyzed,
    emotionLabel: emotionLabel || undefined,
    ttsScript: ttsScript || undefined,
    audioUrl: audioUrl || undefined,
    transcriptText: transcriptText || undefined,
  }
}

/** 从 IndexedDB 原始行规范化单条转发摘要 */
export function normalizeForwardedMessageItem(raw: unknown): WeChatForwardedMessageItem | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const senderName = typeof row.senderName === 'string' ? row.senderName.trim().slice(0, 64) : ''
  const content = typeof row.content === 'string' ? row.content.trim().slice(0, 500) : ''
  const tsRaw = typeof row.timestamp === 'number' ? row.timestamp : Number(row.timestamp)
  const timestamp = Number.isFinite(tsRaw) ? Math.floor(tsRaw) : undefined
  const senderKindRaw = row.senderKind
  const senderKind = senderKindRaw === 'player' || senderKindRaw === 'character' ? senderKindRaw : undefined
  const senderCharacterId =
    typeof row.senderCharacterId === 'string' ? row.senderCharacterId.trim().slice(0, 128) : undefined
  const senderAvatarUrl =
    typeof row.senderAvatarUrl === 'string' ? row.senderAvatarUrl.trim().slice(0, 2048) : undefined
  const isRecalled = row.isRecalled === true
  const images = normalizeImages(row.images)
  const isSticker = row.isSticker === true
  const voice = normalizeVoice(row.voice)
  const redPacket = normalizeRedPacket(row.redPacket)
  const transfer = normalizeTransfer(row.transfer)
  if (!senderName && !content && !images && !voice && !redPacket && !transfer && !isRecalled) return null
  return {
    senderName: senderName || '未知',
    content: content || '...',
    ...(timestamp != null ? { timestamp } : {}),
    ...(senderKind ? { senderKind } : {}),
    ...(senderCharacterId ? { senderCharacterId } : {}),
    ...(senderAvatarUrl ? { senderAvatarUrl } : {}),
    ...(isRecalled ? { isRecalled } : {}),
    ...(images ? { images } : {}),
    ...(isSticker ? { isSticker } : {}),
    ...(voice ? { voice } : {}),
    ...(redPacket ? { redPacket } : {}),
    ...(transfer ? { transfer } : {}),
  }
}

export function buildForwardedMessageFromChat(params: {
  message: WeChatChatMessage
  userName: string
  peerName: string
  peerCharacterId?: string
}): WeChatForwardedMessageItem {
  const { message: m, userName, peerName, peerCharacterId } = params
  const item: WeChatForwardedMessageItem = {
    senderName: m.type === 'player' ? userName : peerName,
    content: messageContentSummary(m).slice(0, 500),
    timestamp: m.timestamp,
    senderKind: m.type === 'player' ? 'player' : 'character',
    ...(m.type === 'character' && peerCharacterId ? { senderCharacterId: peerCharacterId } : {}),
  }
  if (m.isRecalled) {
    item.isRecalled = true
    return item
  }
  if (m.images?.length) {
    item.images = m.images.slice(0, 1)
    const text = (m.content ?? '').trim()
    if (text.startsWith('[表情包]') || text === '[表情包]') {
      item.isSticker = true
    }
  }
  if (m.voice) item.voice = { ...m.voice }
  if (m.redPacket) item.redPacket = { ...m.redPacket }
  if (m.transfer) item.transfer = { ...m.transfer }
  return item
}
