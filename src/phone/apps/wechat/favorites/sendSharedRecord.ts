import { emitWeChatStorageChanged, personaDb } from '../newFriendsPersona/idb'
import type { WeChatSharedRecordPayload } from '../newFriendsPersona/types'
import { resolveAccountScopedPrivateConversationKey } from '../wechatAccountPrivateChatStorage'
import { findAccountById, loadAccountsBundle, resolveAccountSessionIdentityId } from '../wechatAccountPersistence'

export type SendSharedRecordResult = {
  characterId: string
  conversationKey: string
  messageId: string
}

async function sendOneSharedRecord(
  characterId: string,
  payload: WeChatSharedRecordPayload,
): Promise<SendSharedRecordResult> {
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
  const messageId = `wxm-${nowMs}-sr-${Math.random().toString(36).slice(2, 8)}`

  await personaDb.appendWeChatChatMessage({
    id: messageId,
    characterId,
    playerIdentityId,
    type: 'player',
    content: '[收藏]',
    sharedRecord: payload,
    timestamp: nowMs,
    isRead: true,
    conversationKey,
  })

  await personaDb.markWeChatConversationReadToLatest(conversationKey)
  return { characterId, conversationKey, messageId }
}

/** 向一名微信私聊联系人发送收藏记忆切片转发卡 */
export async function sendSharedRecordToContact(
  characterId: string,
  payload: WeChatSharedRecordPayload,
): Promise<SendSharedRecordResult> {
  const id = characterId.trim()
  if (!id) throw new Error('请选择好友')
  const result = await sendOneSharedRecord(id, payload)
  emitWeChatStorageChanged()
  return result
}
