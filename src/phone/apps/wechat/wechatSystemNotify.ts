import {
  isBackgroundPushEnabledLocally,
  isLumiPageVisibleToUser,
  showLumiOsNotification,
} from '../backgroundNotify/backgroundPushClient'
import { cancelBackgroundCloudFallbackAfterLocalNotify } from '../backgroundNotify/backgroundKeepAlive'

/** 当前前台正在打开的会话 key（仅用于 App 内 UI，不再拦截后台系统通知） */
let foregroundConversationKey: string | null = null

export function setWeChatForegroundConversationKey(key: string | null): void {
  foregroundConversationKey = key?.trim() || null
}

export function getWeChatForegroundConversationKey(): string | null {
  return foregroundConversationKey
}

/**
 * 对方新消息入库后调用：仅在用户已开启「后台推送」、会话未免打扰且离开 Lumi 页面时弹 OS 级系统通知。
 * 私聊标题为角色微信备注（无备注时回退昵称/姓名）；群聊标题为群备注（无备注时回退群名）。
 */
export function maybeNotifyWeChatCharacterMessage(params: {
  conversationKey: string
  peerDisplayName: string
  preview: string
  /** 私聊为角色头像，群聊为群头像（仅安卓等支持自定义 icon 的平台生效；iOS 固定 App 图标） */
  iconUrl?: string
  isMuted: boolean
}): void {
  const k = params.conversationKey.trim()
  if (!k) return
  if (!isBackgroundPushEnabledLocally()) return
  if (isLumiPageVisibleToUser()) return
  if (params.isMuted) return

  if (typeof window === 'undefined' || typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return

  const title = params.peerDisplayName.trim() || '微信'
  const body = params.preview.trim().slice(0, 120) || '新消息'
  const iconUrl = params.iconUrl?.trim() || undefined
  void showLumiOsNotification({
    title,
    body,
    tag: `wechat-${k}`,
    icon: iconUrl,
    data: { conversationKey: k, type: 'wechat-message' },
  }).then((shown) => {
    if (shown) void cancelBackgroundCloudFallbackAfterLocalNotify()
  })
}
