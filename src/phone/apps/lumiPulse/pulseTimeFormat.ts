/** 微博动态 / 评论列表时间展示（时分必带；仅跨年带年份） */
export function formatPulseFeedTime(ts: number, nowMs = Date.now()): string {
  if (!Number.isFinite(ts) || ts <= 0) return ''
  const d = new Date(ts)
  const now = new Date(nowMs)
  const diffMin = Math.floor((nowMs - ts) / 60_000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`

  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const time = `${hh}:${mm}`
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return time

  const md = `${d.getMonth() + 1}月${d.getDate()}日`
  if (d.getFullYear() !== now.getFullYear()) {
    return `${d.getFullYear()}年${md} ${time}`
  }
  return `${md} ${time}`
}

function saltInt(salt: string): number {
  let h = 2166136261
  for (let i = 0; i < salt.length; i++) {
    h ^= salt.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) >>> 0
}

/**
 * 为帖子评论分配错开时间：不规则间隔 + 时段跳跃，避免清一色同一分钟连发。
 * 结果严格介于发帖之后与 now 之前，且单调递增。
 */
export function distributePulseCommentTimestamps(params: {
  postCreatedAt: number
  count: number
  now?: number
  /** 稳定伪随机（如 postId） */
  salt?: string
}): number[] {
  const count = Math.max(0, Math.floor(params.count))
  if (!count) return []
  const now = params.now ?? Date.now()
  const postAt = Math.min(params.postCreatedAt, now - 90_000)
  const salt = saltInt(params.salt ?? String(postAt))
  /** 评论窗：发帖后最长约 5 天，且不超过当前 */
  const horizon = Math.min(now - 20_000, postAt + 5 * 24 * 3600_000)
  const usable = Math.max(3 * 60_000, horizon - postAt)

  /** 分钟级不规则间隔，混入小时级跳跃 */
  const gapMinutes = [3, 9, 17, 6, 31, 14, 48, 22, 73, 11, 95, 28, 120, 41, 8, 155]
  const times: number[] = []
  let cursor = postAt + (2 + (salt % 10)) * 60_000

  for (let i = 0; i < count; i++) {
    const gapMin = gapMinutes[(i * 5 + salt) % gapMinutes.length]!
    const jitterMin = (salt + i * 13) % 7
    let next = cursor + (gapMin + jitterMin) * 60_000

    // 每隔若干条跳到另一时段（午后 / 傍晚等），避免都挤在同一小时
    if (i > 0 && (i + salt) % 3 === 0) {
      next += (2 + ((i * 2 + salt) % 7)) * 3600_000
    }
    // 偶尔跨到隔天清晨段
    if (i > 1 && (i + salt) % 5 === 0) {
      next += (8 + ((i + salt) % 6)) * 3600_000
    }

    const remainSlots = count - i
    const hardCap = Math.min(horizon, now - remainSlots * 45_000)
    next = Math.min(hardCap, Math.max(cursor + 90_000, next))

    // 可用窗很短时（刚生成的热搜帖），均匀压进剩余区间并加抖动
    if (usable < 40 * 60_000) {
      const frac = (i + 1) / (count + 1)
      const wobble = (((salt >> (i % 8)) & 7) - 3) * 45_000
      next = Math.min(
        hardCap,
        Math.max(cursor + 60_000, postAt + Math.floor(usable * frac) + wobble),
      )
    }

    times.push(next)
    cursor = next
  }

  for (let i = 1; i < times.length; i++) {
    if (times[i]! <= times[i - 1]!) {
      times[i] = Math.min(now - 10_000, times[i - 1]! + (2 + (i % 4)) * 60_000)
    }
  }
  return times
}
