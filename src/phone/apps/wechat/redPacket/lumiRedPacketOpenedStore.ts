/**
 * 红包「已领取」UI 态：与转账气泡同构——独立于聊天 items / IndexedDB hydrate。
 * 领取瞬间写入 + 广播事件，气泡组件自行订阅刷新，避免被 wechat-storage-changed 回灌盖掉。
 */

const LS_KEY = 'wechat-lumi-redpacket-opened-v1'
export const LUMI_REDPACKET_OPENED_CHANGED_EVENT = 'lumi-redpacket-opened-changed'

function readIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()))
  } catch {
    return new Set()
  }
}

function writeIds(ids: Set<string>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore quota */
  }
}

export function emitLumiRedPacketOpenedChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LUMI_REDPACKET_OPENED_CHANGED_EVENT))
}

export function isLumiRedPacketOpenedUi(messageId: string): boolean {
  const id = messageId.trim()
  if (!id) return false
  return readIds().has(id)
}

/** 标记消息气泡为已领取并立刻通知所有订阅方（样式不依赖 ChatRoom items） */
export function markLumiRedPacketOpenedUi(messageId: string): void {
  const id = messageId.trim()
  if (!id) return
  const ids = readIds()
  if (ids.has(id)) {
    emitLumiRedPacketOpenedChanged()
    return
  }
  ids.add(id)
  writeIds(ids)
  emitLumiRedPacketOpenedChanged()
}

/** 重新回复等场景：撤销本会话若干红包的本地已领标记 */
export function clearLumiRedPacketOpenedUi(messageIds: Iterable<string>): void {
  const ids = readIds()
  let changed = false
  for (const raw of messageIds) {
    const id = String(raw ?? '').trim()
    if (!id) continue
    if (ids.delete(id)) changed = true
  }
  if (!changed) return
  writeIds(ids)
  emitLumiRedPacketOpenedChanged()
}
