import type { AppSlot } from '../../types'

export const LUMI_PULSE_NAVIGATE_EVENT = 'lumi-pulse:navigate'
/** 从聊天室微博卡片深链退出时，回到对应聊天 */
export const LUMI_PULSE_RETURN_TO_CHAT_EVENT = 'lumi-pulse:return-to-chat'
/** 点击正文 @昵称 打开对方微博主页 */
export const LUMI_PULSE_OPEN_USER_EVENT = 'lumi-pulse:open-user'

export type PulseOpenUserDetail = {
  povId: string
  /** 展示名兜底；监听方可再用 stats / 目录覆盖 */
  name?: string
}

/** 与微信 WxActiveChat 对齐的返回目标 */
export type PulseReturnToChat =
  | { kind: 'lumi' }
  | { kind: 'self' }
  | { kind: 'persona'; characterId: string }
  | { kind: 'group'; groupId: string }

let pendingPostId: string | null = null
/** 从聊天等处唤起时，发现页可能尚未挂载，需在挂载时补开微博广场 */
let pendingOpenWeibo = false
/** 从聊天室卡片进入时记下返回目标；退出微博时消费 */
let pendingReturnToChat: PulseReturnToChat | null = null

export function openLumiPulseApp(opts?: { postId?: string; returnToChat?: PulseReturnToChat }) {
  if (opts?.postId?.trim()) pendingPostId = opts.postId.trim()
  pendingOpenWeibo = true
  pendingReturnToChat = opts?.returnToChat ?? null
  window.dispatchEvent(new CustomEvent<{ id: AppSlot['id'] }>('phone:open-app', { detail: { id: 'wechat' } }))
  window.dispatchEvent(new CustomEvent(LUMI_PULSE_NAVIGATE_EVENT))
}

/** 打开角色/用户微博主页（由 LumiPulseApp 监听渲染） */
export function openPulseUserProfile(detail: PulseOpenUserDetail) {
  const povId = detail.povId?.trim()
  if (!povId) return
  window.dispatchEvent(
    new CustomEvent<PulseOpenUserDetail>(LUMI_PULSE_OPEN_USER_EVENT, {
      detail: { povId, name: detail.name?.trim() || undefined },
    }),
  )
}

export function consumePendingPulsePostId(): string | null {
  const id = pendingPostId
  pendingPostId = null
  return id
}

/** 发现页挂载或收到导航事件时：是否应进入微博广场 */
export function consumePendingPulseOpenWeibo(): boolean {
  const open = pendingOpenWeibo
  pendingOpenWeibo = false
  return open
}

export function peekPulseReturnToChat(): PulseReturnToChat | null {
  return pendingReturnToChat
}

export function takePulseReturnToChat(): PulseReturnToChat | null {
  const target = pendingReturnToChat
  pendingReturnToChat = null
  return target
}

/** 关闭微博广场并请求回到原聊天室（无 pending 时为空操作） */
export function requestPulseReturnToChat(): boolean {
  const target = takePulseReturnToChat()
  if (!target) return false
  window.dispatchEvent(
    new CustomEvent<PulseReturnToChat>(LUMI_PULSE_RETURN_TO_CHAT_EVENT, { detail: target }),
  )
  return true
}
