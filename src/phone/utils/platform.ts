/** iOS / iPadOS Safari 或主屏幕 Web App（WebKit） */
export function isIOSWebKit(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOs =
    navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1
  return iOS || iPadOs
}

/** 「添加到主屏幕」后的独立 PWA（非 Safari 标签页） */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.matchMedia?.('(display-mode: fullscreen)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** 后台保活是否使用静音音频（iOS）；安卓走 Web Locks + SW 心跳 */
export function usesKeepAliveAudioPlayback(): boolean {
  return isIOSWebKit()
}

/**
 * iOS Safari / 主屏幕 PWA 的 Web 通知会忽略 Notification.icon / image，
 * 左侧固定显示 manifest 里的 App 图标，无法按消息换角色头像（Apple 平台限制，截至 iOS 18）。
 */
export function supportsPerNotificationCustomIcon(): boolean {
  return !isIOSWebKit()
}
