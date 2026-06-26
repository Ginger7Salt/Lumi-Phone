import type { TasteOrderPayload } from './types'
import { resolveOrderDeliveredAt, tasteOrderStatus } from './tasteOrderBridge'

export type DeliveryStepState = 'done' | 'active' | 'pending'

export type DeliveryTimelineStep = {
  id: string
  label: string
  timeLabel: string
  state: DeliveryStepState
}

const COURIER_NAMES = ['张师傅', '李师傅', '王师傅', '陈师傅', '赵师傅', '周师傅', '吴师傅']

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pickCourierName(orderId: string): string {
  const idx = hashSeed(orderId) % COURIER_NAMES.length
  return COURIER_NAMES[idx]!
}

export function formatClockTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function computeEtaTimestamp(order: TasteOrderPayload, _deliveryMinutes?: number): number {
  return resolveOrderDeliveredAt(order)
}

export function buildDeliveryTimeline(
  order: TasteOrderPayload,
  deliveryMinutes: number,
  now = Date.now(),
): DeliveryTimelineStep[] {
  const mins = Math.max(20, deliveryMinutes)
  const defs = [
    { id: 'confirmed', label: '订单已确认', offsetMin: 0 },
    { id: 'cooking', label: '主厨烹饪中', offsetMin: Math.max(2, Math.floor(mins * 0.08)) },
    { id: 'courier', label: '专员已接单', offsetMin: Math.max(5, Math.floor(mins * 0.22)) },
    { id: 'near', label: '正在向您靠近', offsetMin: Math.max(10, Math.floor(mins * 0.58)) },
    { id: 'delivered', label: '风味已送达', offsetMin: mins },
  ] as const

  const elapsedMin = (now - order.placedAt) / 60_000
  const isDone = tasteOrderStatus(order, now) === 'done'

  let activeIndex = defs.length - 1
  if (!isDone) {
    activeIndex = defs.findIndex((d) => elapsedMin < d.offsetMin)
    if (activeIndex === -1) activeIndex = defs.length - 1
    else activeIndex = Math.max(0, activeIndex - 1)
  }

  return defs.map((def, index) => {
    const ts = order.placedAt + def.offsetMin * 60_000
    let state: DeliveryStepState = 'pending'
    if (isDone || index < activeIndex) state = 'done'
    else if (index === activeIndex) state = isDone && index === defs.length - 1 ? 'done' : 'active'

    if (isDone) state = 'done'

    return {
      id: def.id,
      label: def.label,
      timeLabel: formatClockTime(ts),
      state,
    }
  })
}

/** 0–1，用于地图光点位置 */
export function deliveryProgress(order: TasteOrderPayload, _deliveryMinutes: number, now = Date.now()): number {
  if (tasteOrderStatus(order, now) === 'done') return 1
  const totalMs = Math.max(60_000, resolveOrderDeliveredAt(order) - order.placedAt)
  const elapsed = now - order.placedAt
  return Math.min(0.92, Math.max(0.12, elapsed / totalMs))
}

/** 角色赠予订单：骑手开始配送或已送达时可生成/查看角色↔骑手聊天记录 */
export function isCharacterCourierChatUnlocked(
  order: TasteOrderPayload,
  deliveryMinutes: number,
  now = Date.now(),
): boolean {
  if (tasteOrderStatus(order, now) === 'done') return true
  const timeline = buildDeliveryTimeline(order, deliveryMinutes, now)
  return timeline.some(
    (step) =>
      (step.id === 'courier' || step.id === 'near' || step.id === 'delivered') &&
      (step.state === 'active' || step.state === 'done'),
  )
}

export function etaHeadline(order: TasteOrderPayload, deliveryMinutes: number, now = Date.now()): {
  hour: string
  minute: string
  caption: string
} {
  const isDone = tasteOrderStatus(order, now) === 'done'
  const ts = isDone ? computeEtaTimestamp(order, deliveryMinutes) : computeEtaTimestamp(order, deliveryMinutes)
  const d = new Date(ts)
  return {
    hour: String(d.getHours()).padStart(2, '0'),
    minute: String(d.getMinutes()).padStart(2, '0'),
    caption: isDone ? '送达时间' : '预计送达时间',
  }
}
