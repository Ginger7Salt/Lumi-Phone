/** 系统演进录入机推送 · 今日关闭 / 会话关闭 */

const TODAY_DISMISS_KEY = 'lumi-evolution-push-dismissed-date-v1'
const SESSION_DISMISS_KEY = 'lumi-evolution-push-session-dismissed-v1'

export function evolutionPushTodayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayDismissToken(version: string): string {
  return `${evolutionPushTodayKey()}::${version.trim()}`
}

export function isEvolutionPushHiddenToday(version: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(TODAY_DISMISS_KEY) === todayDismissToken(version)
  } catch {
    return false
  }
}

export function dismissEvolutionPushForToday(version: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TODAY_DISMISS_KEY, todayDismissToken(version))
  } catch {
    // ignore
  }
}

export function isEvolutionPushDismissedThisSession(version: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.sessionStorage.getItem(SESSION_DISMISS_KEY) === version.trim()
  } catch {
    return false
  }
}

export function dismissEvolutionPushThisSession(version: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SESSION_DISMISS_KEY, version.trim())
  } catch {
    // ignore
  }
}

export function shouldOfferEvolutionPush(version: string): boolean {
  const v = version.trim()
  if (!v) return false
  return !isEvolutionPushHiddenToday(v) && !isEvolutionPushDismissedThisSession(v)
}
