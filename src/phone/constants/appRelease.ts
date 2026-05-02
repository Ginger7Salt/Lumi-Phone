/** 桌面展示的版本号文案 */
export const LUMI_APP_VERSION_LABEL = 'V1.1.0'

/**
 * 最近一次面向用户发布的更新时间（UTC 毫秒）。
 * 发版时请与版本号一并修改，便于「距今多久」准确。
 */
export const LUMI_LAST_RELEASE_TIME_MS = Date.UTC(2026, 4, 2, 8, 0, 0)

export function formatRelativeTimeZh(fromMs: number, nowMs = Date.now()): string {
  const diff = Math.max(0, nowMs - fromMs)
  const sec = Math.floor(diff / 1000)
  if (sec < 45) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  const mon = Math.floor(day / 30)
  if (mon < 12) return `${mon} 个月前`
  const yr = Math.floor(day / 365)
  return yr < 1 ? '约 1 年前' : `${yr} 年前`
}

export function formatReleaseAbsoluteZh(ms: number): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ms))
  } catch {
    return new Date(ms).toISOString()
  }
}
