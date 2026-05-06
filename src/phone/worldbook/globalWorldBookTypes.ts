import type { WorldBookItem } from '../apps/wechat/newFriendsPersona/types'

/** 微信侧全局世界书生效板块（与注入上下文对应） */
export type GlobalWechatPlate = 'private_chat' | 'group_chat' | 'offline_plot' | 'vn'

export type GlobalWechatWorldBookScope =
  | { mode: 'all' }
  | { mode: 'plates'; plates: GlobalWechatPlate[] }

export type GlobalWechatWorldBook = {
  id: string
  name: string
  enabled: boolean
  collapsed?: boolean
  /** 全部场景生效，或限定微信内若干板块 */
  scope: GlobalWechatWorldBookScope
  items: WorldBookItem[]
  updatedAt: number
}

export const GLOBAL_WECHAT_PLATE_LABELS: Record<GlobalWechatPlate, string> = {
  private_chat: '私聊',
  group_chat: '群聊',
  offline_plot: '线下普通剧情',
  vn: 'VN 模式',
}

export function normalizeGlobalWechatWorldBookScope(raw: unknown): GlobalWechatWorldBookScope {
  if (!raw || typeof raw !== 'object') return { mode: 'all' }
  const o = raw as Record<string, unknown>
  if (o.mode === 'plates' && Array.isArray(o.plates)) {
    const allowed: GlobalWechatPlate[] = ['private_chat', 'group_chat', 'offline_plot', 'vn']
    const plates = o.plates
      .map((x) => String(x ?? '').trim())
      .filter((x): x is GlobalWechatPlate => (allowed as string[]).includes(x))
    return plates.length ? { mode: 'plates', plates: [...new Set(plates)] } : { mode: 'all' }
  }
  return { mode: 'all' }
}
