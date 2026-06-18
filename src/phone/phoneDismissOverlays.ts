/** 离开微信等全屏应用时，关闭挂到 document.body 的临时浮层，避免挡住其它应用点击 */
export const PHONE_DISMISS_OVERLAYS_EVENT = 'phone:dismiss-overlays'

export function dispatchPhoneDismissOverlays() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PHONE_DISMISS_OVERLAYS_EVENT))
}
