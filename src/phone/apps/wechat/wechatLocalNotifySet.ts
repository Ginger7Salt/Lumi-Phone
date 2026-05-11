/** localStorage 中的 string[] Set，用于「系统灰条 / 定时器」类一次性提示去重 */

export const LS_TRANSFER_RETURN_NOTIFIED_KEY = 'wechat-transfer-return-notified-v1'
export const LS_REDPACKET_EXPIRED_NOTIFIED_KEY = 'wechat-redpacket-expired-notified-v1'

export function readNotifiedSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string' && !!String(x).trim()).map((s) => String(s).trim()))
  } catch {
    return new Set()
  }
}

export function writeNotifiedSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
}
