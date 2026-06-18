import { emitWeChatStorageChanged, personaDb } from '../newFriendsPersona/idb'
import type { WeChatChatHistoryPayload } from '../newFriendsPersona/types'
import { resolveAccountScopedPrivateConversationKey } from '../wechatAccountPrivateChatStorage'
import { findAccountById, loadAccountsBundle, resolveAccountSessionIdentityId } from '../wechatAccountPersistence'

export type SendChatHistoryResult = {
  characterId: string
  conversationKey: string
  messageId: string
}

export async function sendChatHistoryToContact(
  characterId: string,
  payload: WeChatChatHistoryPayload,
): Promise<SendChatHistoryResult> {
  const id = characterId.trim()
  if (!id) throw new Error('请选择好友')

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
    characterId: id,
    appSessionPlayerIdentityId: playerIdentityId,
  })

  const nowMs = Date.now()
  const messageId = `wxm-${nowMs}-ch-${Math.random().toString(36).slice(2, 8)}`

  await personaDb.appendWeChatChatMessage({
    id: messageId,
    characterId: id,
    playerIdentityId,
    type: 'player',
    content: '[聊天记录]',
    chatHistory: payload,
    timestamp: nowMs,
    isRead: true,
    conversationKey,
  })

  await personaDb.markWeChatConversationReadToLatest(conversationKey)
  emitWeChatStorageChanged()
  return { characterId: id, conversationKey, messageId }
}
