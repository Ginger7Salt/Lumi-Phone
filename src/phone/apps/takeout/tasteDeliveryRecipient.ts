import type { DeliveryAddressOption, TasteOrderPayload } from './types'

const RECIPIENT_NICKNAME_MAX = 32

export function sanitizeRecipientNickname(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, RECIPIENT_NICKNAME_MAX)
}

/** 构建配送目标：label=收货名，realRecipientName=真实姓名 */
export function buildSelfDeliveryAddress(
  slipNickname: string,
  realRecipientName?: string,
): DeliveryAddressOption {
  const real = sanitizeRecipientNickname(realRecipientName ?? slipNickname) || '我'
  const nick = sanitizeRecipientNickname(slipNickname) || real
  return {
    id: 'addr-self',
    kind: 'self',
    label: nick,
    realRecipientName: real,
    detail: '',
  }
}

export function buildDeliveryAddressFromSelection(
  selected: DeliveryAddressOption,
  slipNickname: string,
): DeliveryAddressOption {
  const real = selected.realRecipientName?.trim() || selected.label.trim() || '我'
  const nick = sanitizeRecipientNickname(slipNickname) || real
  return {
    ...selected,
    label: nick,
    realRecipientName: real,
    detail: '',
  }
}

/** 订单上的收货名（外卖单可见） */
export function resolveOrderRecipientNickname(order: TasteOrderPayload): string {
  const addr = order.deliveryAddress
  if (!addr) return '我'
  return addr.label?.trim() || resolveOrderRealRecipientName(order)
}

/** 真实收货人姓名 */
export function resolveOrderRealRecipientName(order: TasteOrderPayload): string {
  const addr = order.deliveryAddress
  if (!addr) return '我'
  return addr.realRecipientName?.trim() || addr.label?.trim() || '我'
}
