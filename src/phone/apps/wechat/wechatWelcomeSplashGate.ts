/** 仅内存：本次微信进程内「刚完成首次注册」时置位，绝不靠 sessionStorage 反复触发 */
let welcomeSplashArmed = false

/** 首次注册完成、即将展示欢迎动效前调用（仅内存） */
export function armWeChatWelcomeSplash(): void {
  welcomeSplashArmed = true
}

export function isWeChatWelcomeSplashArmed(): boolean {
  return welcomeSplashArmed
}

/** 动效播完或用户离开：解除武装，后续进微信不再播 */
export function disarmWeChatWelcomeSplash(): void {
  welcomeSplashArmed = false
}

/** @deprecated 保留空实现，避免旧调用报错；不再写 sessionStorage */
export function markWeChatWelcomeSplashPending(): void {
  armWeChatWelcomeSplash()
}

export function resetWeChatWelcomeSplashGate(): void {
  disarmWeChatWelcomeSplash()
}
