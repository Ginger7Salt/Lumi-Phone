import type { WeChatUserDataClearOp } from './wechatDataInventory'

/** 避免 idb ↔ inventory 循环依赖：在 IndexedDB 写操作后异步记账 */
export function notifyUserWeChatDataClear(
  op: WeChatUserDataClearOp,
  meta?: {
    wechatAccountId?: string
    characterId?: string
    conversationKey?: string
    note?: string
  },
): void {
  void import('./wechatDataInventory')
    .then((m) => m.recordUserWeChatDataClear(op, meta))
    .catch(() => {})
}
