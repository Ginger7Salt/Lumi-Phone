const KEEPALIVE_ENABLED_KEY = 'lumi-keepalive-enabled'
const RESET_QUERY = 'lumi_reset_keepalive'

/** Safari 打开 `?lumi_reset_keepalive=1` 可强制关闭保活，救回白屏 PWA */
export function maybeRecoverFromBrokenKeepAlivePwa(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get(RESET_QUERY) !== '1') return false
    window.localStorage.setItem(KEEPALIVE_ENABLED_KEY, '0')
    url.searchParams.delete(RESET_QUERY)
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(null, '', next || url.pathname)
    return true
  } catch {
    return false
  }
}
