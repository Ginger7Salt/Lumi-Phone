import { pickStableNetizenAvatarForChatHistoryNpc } from '../wechat/chatHistory/ephemeralNpcChatHistoryAvatar'
import { getStoreById } from './tasteCatalog'
import { pickCourierName } from './tasteDeliveryTracking'
import { isCharacterObserverChatKind } from './tasteChatGenerate'
export { isCharacterObserverChatKind } from './tasteChatGenerate'
import { generateCharacterObserverChatWithAi } from './tasteCharacterObserverChatAi'
import {
  appendTasteChatMessages,
  isTasteChatThreadHidden,
  purgeTasteChatThreadMessages,
  readTasteChatMessages,
  replaceTasteChatMessages,
  unhideTasteChatThread,
  upsertTasteChatThread,
} from './tasteChatStore'
import type { TasteChatKind, TasteChatMessage, TasteChatThread, TasteOrderPayload } from './types'

export function tasteChatThreadId(orderId: string, kind: TasteChatKind): string {
  return `${orderId.trim()}:${kind}`
}

export function parseTasteChatThreadId(threadId: string): { orderId: string; kind: TasteChatKind } | null {
  const parts = threadId.split(':')
  if (parts.length < 2) return null
  const kindRaw = parts[parts.length - 1]!
  const kind =
    kindRaw === 'merchant' ||
    kindRaw === 'courier' ||
    kindRaw === 'group' ||
    kindRaw === 'character-merchant' ||
    kindRaw === 'character-courier'
      ? (kindRaw as TasteChatKind)
      : null
  if (!kind) return null
  const orderId = parts.slice(0, -1).join(':')
  return orderId ? { orderId, kind } : null
}

function msgId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function resolveOrderChatAvatars(order: TasteOrderPayload) {
  const store = getStoreById(order.storeId)
  return {
    merchantAvatarUrl:
      store?.logoImage || pickStableNetizenAvatarForChatHistoryNpc(`merchant-${order.storeId}`),
    courierAvatarUrl: pickStableNetizenAvatarForChatHistoryNpc(`courier-${order.orderId}`),
  }
}

export function resolvePeerMessageAvatar(
  order: TasteOrderPayload,
  thread: Pick<TasteChatThread, 'kind' | 'merchantAvatarUrl' | 'courierAvatarUrl' | 'avatarUrl'>,
  message: Pick<TasteChatMessage, 'from' | 'senderName'>,
): string | undefined {
  if (message.from === 'user' || message.from === 'character') return undefined
  const avatars = resolveOrderChatAvatars(order)
  if (thread.kind === 'merchant') return thread.merchantAvatarUrl ?? avatars.merchantAvatarUrl
  if (thread.kind === 'courier') return thread.courierAvatarUrl ?? avatars.courierAvatarUrl

  const courier = pickCourierName(order.orderId)
  const name = message.senderName?.trim() ?? ''
  if (name.includes('店长') || name.includes(order.storeName)) {
    return thread.merchantAvatarUrl ?? avatars.merchantAvatarUrl
  }
  if (name === courier || name.includes('专员') || name.includes('师傅')) {
    return thread.courierAvatarUrl ?? avatars.courierAvatarUrl
  }
  return thread.merchantAvatarUrl ?? avatars.merchantAvatarUrl
}

function buildThreadMeta(
  order: TasteOrderPayload,
  kind: TasteChatKind,
  characterName?: string,
): TasteChatThread {
  const courier = pickCourierName(order.orderId)
  const id = tasteChatThreadId(order.orderId, kind)
  const avatars = resolveOrderChatAvatars(order)
  const charLabel = characterName?.trim() || order.orderSourceCharacterName?.trim() || 'TA'

  if (kind === 'character-merchant') {
    return {
      id,
      orderId: order.orderId,
      kind,
      title: `${charLabel} · 与商家`,
      subtitle: `${order.storeName}·店长`,
      avatarUrl: avatars.merchantAvatarUrl,
      merchantAvatarUrl: avatars.merchantAvatarUrl,
      characterObserverName: charLabel,
      updatedAt: Date.now(),
    }
  }
  if (kind === 'character-courier') {
    return {
      id,
      orderId: order.orderId,
      kind,
      title: `${charLabel} · 与骑手`,
      subtitle: courier,
      avatarUrl: avatars.courierAvatarUrl,
      courierAvatarUrl: avatars.courierAvatarUrl,
      characterObserverName: charLabel,
      updatedAt: Date.now(),
    }
  }

  if (kind === 'merchant') {
    return {
      id,
      orderId: order.orderId,
      kind,
      title: `${order.storeName}·店长`,
      subtitle: '商家客服',
      avatarUrl: avatars.merchantAvatarUrl,
      updatedAt: Date.now(),
    }
  }
  if (kind === 'courier') {
    return {
      id,
      orderId: order.orderId,
      kind,
      title: courier,
      subtitle: '配送专员',
      avatarUrl: avatars.courierAvatarUrl,
      updatedAt: Date.now(),
    }
  }
  return {
    id,
    orderId: order.orderId,
    kind,
    title: `${order.storeName}·配送群`,
    subtitle: '商家与专员',
    avatarUrl: avatars.merchantAvatarUrl,
    merchantAvatarUrl: avatars.merchantAvatarUrl,
    courierAvatarUrl: avatars.courierAvatarUrl,
    updatedAt: Date.now(),
  }
}

function welcomeMessages(order: TasteOrderPayload, kind: TasteChatKind): TasteChatMessage[] {
  const threadId = tasteChatThreadId(order.orderId, kind)
  const courier = pickCourierName(order.orderId)
  const merchantName = `${order.storeName}·店长`
  const ts = Date.now()

  if (kind === 'merchant') {
    return [
      {
        id: msgId('welcome'),
        threadId,
        from: 'peer',
        senderName: merchantName,
        text: `您好，我是${merchantName}。订单已收到，共 ${order.itemCount} 件，正在为您备餐。`,
        ts,
      },
    ]
  }
  if (kind === 'courier') {
    return [
      {
        id: msgId('welcome'),
        threadId,
        from: 'peer',
        senderName: courier,
        text: `您好，我是配送专员${courier}，稍后到店取餐并为您配送。`,
        ts,
      },
    ]
  }
  return [
    {
      id: msgId('welcome-m'),
      threadId,
      from: 'peer',
      senderName: merchantName,
      text: `本群已建立。我是${merchantName}，订单备餐中。`,
      ts,
    },
    {
      id: msgId('welcome-c'),
      threadId,
      from: 'peer',
      senderName: courier,
      text: `我是${courier}，取餐后会在群里同步配送进度。`,
      ts: ts + 1,
    },
  ]
}

function ensureSingleThread(accountId: string, order: TasteOrderPayload, kind: TasteChatKind) {
  const threadId = tasteChatThreadId(order.orderId, kind)
  if (isCharacterObserverChatKind(kind) && isTasteChatThreadHidden(accountId, threadId)) {
    purgeTasteChatThreadMessages(accountId, threadId)
  }
  const existing = readTasteChatMessages(accountId, threadId)
  const thread = buildThreadMeta(order, kind)
  if (isCharacterObserverChatKind(kind)) {
    upsertTasteChatThread(accountId, {
      ...thread,
      updatedAt: existing[existing.length - 1]?.ts ?? thread.updatedAt,
    })
    return
  }
  if (existing.length === 0) {
    const welcome = welcomeMessages(order, kind)
    upsertTasteChatThread(accountId, { ...thread, updatedAt: welcome[welcome.length - 1]?.ts ?? Date.now() })
    appendTasteChatMessages(accountId, threadId, welcome)
  } else {
    upsertTasteChatThread(accountId, {
      ...thread,
      updatedAt: existing[existing.length - 1]?.ts ?? thread.updatedAt,
    })
  }
}

/** 下单后默认仅创建配送群 */
export function ensureTasteOrderGroupThread(accountId: string, order: TasteOrderPayload) {
  ensureSingleThread(accountId, order, 'group')
}

/** 角色赠予订单：确保观察者线程（不写入欢迎语） */
export function ensureCharacterObserverChatThread(
  accountId: string,
  order: TasteOrderPayload,
  kind: 'character-merchant' | 'character-courier',
) {
  ensureSingleThread(accountId, order, kind)
}

export async function generateCharacterObserverChatHistory(params: {
  accountId: string
  order: TasteOrderPayload
  kind: 'character-merchant' | 'character-courier'
  characterName: string
}): Promise<TasteChatMessage[]> {
  const threadId = tasteChatThreadId(params.order.orderId, params.kind)
  unhideTasteChatThread(params.accountId, threadId)
  ensureCharacterObserverChatThread(params.accountId, params.order, params.kind)
  const messages = await generateCharacterObserverChatWithAi({
    order: params.order,
    kind: params.kind,
    threadId,
    characterName: params.characterName,
  })
  const thread = buildThreadMeta(params.order, params.kind, params.characterName)
  replaceTasteChatMessages(params.accountId, threadId, messages, {
    ...thread,
    characterHistoryGenerated: true,
    characterObserverName: params.characterName.trim() || 'TA',
  })
  return messages
}

/** 从送餐追踪进入私聊时按需创建 */
export function ensureTastePrivateChatThread(
  accountId: string,
  order: TasteOrderPayload,
  kind: 'merchant' | 'courier',
) {
  ensureSingleThread(accountId, order, kind)
}

/** @deprecated 兼容旧调用：仅确保配送群 */
export function ensureTasteOrderChatThreads(accountId: string, order: TasteOrderPayload) {
  ensureTasteOrderGroupThread(accountId, order)
}

export function resolveTasteChatThread(
  accountId: string,
  order: TasteOrderPayload,
  kind: TasteChatKind,
  characterName?: string,
): TasteChatThread {
  if (kind === 'group') ensureTasteOrderGroupThread(accountId, order)
  else if (kind === 'merchant' || kind === 'courier') ensureTastePrivateChatThread(accountId, order, kind)
  else ensureCharacterObserverChatThread(accountId, order, kind)
  return buildThreadMeta(order, kind, characterName)
}

export function threadHasUserMessages(accountId: string, threadId: string): boolean {
  return readTasteChatMessages(accountId, threadId).some((m) => m.from === 'user')
}

function pickPeerReply(order: TasteOrderPayload, kind: TasteChatKind, userText: string): TasteChatMessage[] {
  const threadId = tasteChatThreadId(order.orderId, kind)
  const courier = pickCourierName(order.orderId)
  const merchantName = `${order.storeName}·店长`
  const text = userText.trim()
  const ts = Date.now() + 600

  const has = (keys: string[]) => keys.some((k) => text.includes(k))

  if (kind === 'merchant') {
    let reply = '好的，已为您备注，出餐后会第一时间通知。'
    if (has(['多久', '什么时候', '几点', '时间'])) reply = '预计备餐 15–20 分钟，完成后专员会立即取餐。'
    else if (has(['少辣', '不要辣', '微辣', '备注'])) reply = '收到，会按您的口味要求制作。'
    else if (has(['取消', '退款'])) reply = '如需取消请说明原因，我会尽快为您处理。'
    else if (has(['谢谢', '感谢'])) reply = '不客气，祝您用餐愉快。'
    return [{ id: msgId('reply'), threadId, from: 'peer', senderName: merchantName, text: reply, ts }]
  }

  if (kind === 'courier') {
    let reply = '收到，我会尽快为您送达。'
    if (has(['在哪', '位置', '到了吗', '多久'])) reply = '正在配送途中，预计 10–15 分钟内到达。'
    else if (has(['放门口', '放前台', '不用敲门'])) reply = '好的，会按您的要求放置并拍照确认。'
    else if (has(['谢谢', '感谢'])) reply = '应该的，请慢用。'
    return [{ id: msgId('reply'), threadId, from: 'peer', senderName: courier, text: reply, ts }]
  }

  const merchantReply = has(['取消', '退款', '备注', '少辣', '不要'])
    ? { name: merchantName, text: '商家已收到，会按您的要求处理备餐。' }
    : { name: merchantName, text: '餐品已打包完毕，等待专员取餐。' }
  const courierReply = has(['在哪', '位置', '到了吗', '多久'])
    ? { name: courier, text: '我已取餐，正在前往您的地址。' }
    : { name: courier, text: '收到，我会与商家同步配送进度。' }

  return [
    { id: msgId('reply-m'), threadId, from: 'peer', senderName: merchantReply.name, text: merchantReply.text, ts },
    {
      id: msgId('reply-c'),
      threadId,
      from: 'peer',
      senderName: courierReply.name,
      text: courierReply.text,
      ts: ts + 480,
    },
  ]
}

export function sendTasteChatMessage(params: {
  accountId: string
  order: TasteOrderPayload
  threadId: string
  text: string
}) {
  const trimmed = params.text.trim()
  if (!trimmed) return
  const parsed = parseTasteChatThreadId(params.threadId)
  if (!parsed) return
  if (isCharacterObserverChatKind(parsed.kind)) return

  if (parsed.kind === 'group') ensureTasteOrderGroupThread(params.accountId, params.order)
  else ensureTastePrivateChatThread(params.accountId, params.order, parsed.kind)

  const userMsg: TasteChatMessage = {
    id: msgId('user'),
    threadId: params.threadId,
    from: 'user',
    text: trimmed,
    ts: Date.now(),
  }
  appendTasteChatMessages(params.accountId, params.threadId, [userMsg])

  window.setTimeout(() => {
    const replies = pickPeerReply(params.order, parsed.kind, trimmed)
    appendTasteChatMessages(params.accountId, params.threadId, replies)
  }, 720)
}

export function resolveCharacterOrderPersona(
  order: TasteOrderPayload,
  contacts: ReadonlyArray<{ characterId: string; remarkName?: string; avatarUrl?: string }>,
): { name: string; avatarUrl?: string } {
  const cid = order.orderSourceCharacterId?.trim()
  const contact = cid ? contacts.find((c) => c.characterId === cid) : undefined
  const name = order.orderSourceCharacterName?.trim() || contact?.remarkName?.trim() || 'TA'
  const avatarUrl = contact?.avatarUrl?.trim() || undefined
  return { name, avatarUrl }
}
