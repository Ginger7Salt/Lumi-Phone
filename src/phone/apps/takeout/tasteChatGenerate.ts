import { pickCourierName } from './tasteDeliveryTracking'
import type { TasteChatKind, TasteChatMessage, TasteOrderPayload } from './types'

function msgId(prefix: string, index: number): string {
  return `gen-${prefix}-${index}-${Math.random().toString(36).slice(2, 7)}`
}

function itemSummary(order: TasteOrderPayload): string {
  const parts = order.items.map((item) =>
    item.quantity > 1 ? `${item.name}×${item.quantity}` : item.name,
  )
  if (parts.length <= 2) return parts.join('、')
  return `${parts.slice(0, 2).join('、')}等 ${order.itemCount} 件`
}

type ScriptLine = { from: 'character' | 'peer'; text: string; senderName?: string }

function buildMerchantPostOrderScript(order: TasteOrderPayload, _characterName: string): ScriptLine[] {
  const merchantName = `${order.storeName}·店长`
  const items = itemSummary(order)
  const recipient = order.deliveryAddress.label.trim() || '朋友'
  return [
    { from: 'peer', senderName: merchantName, text: `您好，寻味这边看到您刚下的订单了，${items}，对吗？` },
    { from: 'character', text: '对的，麻烦按订单正常做就行。' },
    { from: 'peer', senderName: merchantName, text: `收货昵称是「${recipient}」，我这边核对无误。` },
    { from: 'character', text: '嗯，就是这个。' },
    { from: 'peer', senderName: merchantName, text: '已开始备餐，大概十五到二十分钟可以出餐。' },
    { from: 'character', text: '辛苦，做好告诉我就行。' },
    { from: 'peer', senderName: merchantName, text: '好的，出餐后专员会立即取餐配送。' },
  ]
}

function buildCourierDeliveryScript(order: TasteOrderPayload, _characterName: string): ScriptLine[] {
  const courier = pickCourierName(order.orderId)
  const recipient = order.deliveryAddress.label.trim() || '朋友'
  return [
    { from: 'peer', senderName: courier, text: `您好，我是配送专员${courier}，已到${order.storeName}取餐。` },
    { from: 'character', text: `麻烦尽快送到 ${recipient} 那边。` },
    { from: 'peer', senderName: courier, text: '收到，我会注意保温，预计二十分钟内送达。' },
    { from: 'character', text: '到了放门口就行，不用敲门。' },
    { from: 'peer', senderName: courier, text: '好的，已取餐出发，送达后我在系统里更新状态。' },
    { from: 'character', text: '谢谢，辛苦了。' },
  ]
}

function scriptToMessages(
  threadId: string,
  script: ScriptLine[],
  characterName: string,
  endTs: number,
  gapMs = 48_000,
): TasteChatMessage[] {
  const startTs = endTs - gapMs * script.length
  return script.map((line, index) => ({
    id: msgId(threadId, index),
    threadId,
    from: line.from,
    text: line.text,
    senderName: line.from === 'peer' ? line.senderName : characterName,
    ts: startTs + index * gapMs + Math.floor(Math.random() * 8000),
  }))
}

export function generateCharacterChatHistoryMessages(
  order: TasteOrderPayload,
  kind: 'character-merchant' | 'character-courier',
  threadId: string,
  characterName: string,
): TasteChatMessage[] {
  const name = characterName.trim() || 'TA'
  if (kind === 'character-merchant') {
    const script = buildMerchantPostOrderScript(order, name)
    return scriptToMessages(threadId, script, name, order.placedAt + 7 * 60_000, 42_000)
  }
  const script = buildCourierDeliveryScript(order, name)
  const courierStart = order.placedAt + Math.max(5, 12) * 60_000
  return scriptToMessages(threadId, script, name, courierStart + script.length * 40_000, 42_000)
}

export function isCharacterObserverChatKind(
  kind: TasteChatKind,
): kind is 'character-merchant' | 'character-courier' {
  return kind === 'character-merchant' || kind === 'character-courier'
}
