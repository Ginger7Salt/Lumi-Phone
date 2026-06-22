import { emitWeChatStorageChanged, personaDb } from '../newFriendsPersona/idb'
import type { WeChatListenTrackSharePayload } from '../newFriendsPersona/types'
import { resolveAccountScopedPrivateConversationKey } from '../wechatAccountPrivateChatStorage'
import { findAccountById, loadAccountsBundle, resolveAccountSessionIdentityId } from '../wechatAccountPersistence'
import { enrichListenTrackSharePayload } from './listenShareAiContext'

export type SendListenTrackShareInput = {
  targetType: 'song' | 'playlist'
  targetId: number
  targetTitle: string
  targetArtist?: string
  targetCover?: string
  trackCount?: number
}

export type SendListenTrackShareResult = {
  sent: number
  messageIds: string[]
  characterIds: string[]
}

async function sendOneListenTrackShare(
  characterId: string,
  input: SendListenTrackShareInput,
): Promise<string> {
  const bundle = await loadAccountsBundle()
  if (!bundle) throw new Error('请先登录微信账号')
  const account = findAccountById(bundle, bundle.currentAccountId)
  if (!account) throw new Error('请先登录微信账号')

  const playerIdentityId = resolveAccountSessionIdentityId(account).trim()
  if (!playerIdentityId || playerIdentityId === '__none__') {
    throw new Error('请先设置玩家身份')
  }

  const conversationKey = await resolveAccountScopedPrivateConversationKey({
    wechatAccountId: account.accountId,
    characterId,
    appSessionPlayerIdentityId: playerIdentityId,
  })

  const nowMs = Date.now()
  const shareId = `lts-${nowMs}-${Math.random().toString(36).slice(2, 8)}`
  const messageId = `wxm-${nowMs}-lts-${Math.random().toString(36).slice(2, 8)}`
  const content = input.targetType === 'song' ? '[分享单曲]' : '[分享歌单]'

  const listenTrackShare: WeChatListenTrackSharePayload = await enrichListenTrackSharePayload(
    input,
    shareId,
  )

  await personaDb.appendWeChatChatMessage({
    id: messageId,
    characterId,
    playerIdentityId,
    type: 'player',
    content,
    listenTrackShare,
    timestamp: nowMs,
    isRead: true,
    conversationKey,
  })

  await personaDb.markWeChatConversationReadToLatest(conversationKey)
  return messageId
}

/** 向多名微信私聊联系人发送听一听单曲/歌单分享卡 */
export async function sendListenTrackShareToContacts(
  characterIds: string[],
  input: SendListenTrackShareInput,
): Promise<SendListenTrackShareResult> {
  const ids = [...new Set(characterIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) throw new Error('请选择至少一位好友')
  if (!input.targetId) throw new Error('缺少歌曲或歌单信息')
  if (!input.targetTitle.trim()) throw new Error('缺少标题')

  const messageIds: string[] = []
  for (const characterId of ids) {
    const messageId = await sendOneListenTrackShare(characterId, input)
    messageIds.push(messageId)
  }

  emitWeChatStorageChanged()
  return { sent: messageIds.length, messageIds, characterIds: ids }
}
