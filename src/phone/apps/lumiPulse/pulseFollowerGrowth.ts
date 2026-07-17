/**
 * 微博粉丝自然增长（用户 + 已有社交基数的角色）：
 * - 被动：按墙钟与当前体量上涨，关网页也能在下次进入时补齐
 * - 发帖：用户额外小幅涨粉
 * - 起步：用户无粉时小起步；角色必须已有社交/粉丝基数，不从 0 瞎种
 */

const MAX_CATCHUP_HOURS = 48
const MIN_PASSIVE_INTERVAL_MS = 3 * 60_000

function unitRandom(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function randInt(min: number, max: number, seed: string): number {
  const a = Math.ceil(min)
  const b = Math.floor(max)
  if (b <= a) return a
  return a + Math.floor(unitRandom(seed) * (b - a + 1))
}

export type FollowerGrowthRole = 'player' | 'character'

/**
 * 每小时期望涨粉（均值）。
 * 体量越大绝对增量越高（明星/公众账号自然涨更多），但相对增速边际递减。
 * 角色在中高粉档略快于用户，模拟艺人/公众人设热度。
 */
export function expectedHourlyFollowerGain(
  followersRaw: number,
  role: FollowerGrowthRole = 'player',
): number {
  const n = Math.max(0, Math.floor(followersRaw || 0))
  let base: number
  if (n < 50) base = 2.4
  else if (n < 500) base = 6.5
  else if (n < 5_000) base = 18
  else if (n < 50_000) base = 52
  else if (n < 500_000) base = 120
  else base = 220

  if (role === 'character') {
    if (n >= 50_000) base *= 1.4
    else if (n >= 5_000) base *= 1.25
    else if (n >= 500) base *= 1.1
  }
  return base
}

/** 尚无粉丝时的小起步（仅用户；角色禁止瞎种） */
export function seedStarterFollowers(seed: string): number {
  return randInt(12, 80, `${seed}:starter`)
}

/** 发帖带动的额外涨粉（用户） */
export function computePostFollowerBoost(followersRaw: number, seed: string): number {
  const n = Math.max(0, Math.floor(followersRaw || 0))
  if (n < 50) return randInt(1, 5, `${seed}:post`)
  if (n < 500) return randInt(2, 12, `${seed}:post`)
  if (n < 5_000) return randInt(5, 35, `${seed}:post`)
  if (n < 50_000) return randInt(12, 80, `${seed}:post`)
  if (n < 500_000) return randInt(30, 160, `${seed}:post`)
  return randInt(50, 260, `${seed}:post`)
}

/**
 * 被动涨粉增量（可跨离线补齐，单次最多折算 MAX_CATCHUP_HOURS）。
 * 返回 0 表示本时段不足以产生可见涨幅。
 */
export function computePassiveFollowerDelta(params: {
  followers: number
  elapsedMs: number
  seed: string
  role?: FollowerGrowthRole
}): number {
  const elapsedMs = Math.max(0, params.elapsedMs)
  if (elapsedMs < MIN_PASSIVE_INTERVAL_MS) return 0

  const hours = Math.min(MAX_CATCHUP_HOURS, elapsedMs / 3_600_000)
  const mean = expectedHourlyFollowerGain(params.followers, params.role ?? 'player') * hours
  const jitter = 0.55 + unitRandom(`${params.seed}:jitter`) * 0.9
  const damp = 1 / (1 + Math.log10(1 + hours))
  const raw = mean * jitter * damp
  const hardCap = Math.max(2, Math.ceil(mean * 1.6))
  return Math.max(0, Math.min(hardCap, Math.floor(raw)))
}

export type FollowerGrowthApplyResult = {
  followers: number
  delta: number
  seeded: boolean
  followersSyncedAt: number
}

/** 纯函数：根据上一同步点计算应写回的粉丝数 */
export function planFollowerGrowthCatchUp(params: {
  followers: number
  followersSyncedAt?: number
  now: number
  seed: string
  role?: FollowerGrowthRole
  /** 粉丝为 0 时是否小起步；角色应传 false */
  allowSeed?: boolean
}): FollowerGrowthApplyResult {
  const now = params.now
  const role = params.role ?? 'player'
  const allowSeed = params.allowSeed !== false && role === 'player'
  let followers = Math.max(0, Math.floor(params.followers || 0))
  let seeded = false
  let syncedAt =
    typeof params.followersSyncedAt === 'number' && Number.isFinite(params.followersSyncedAt)
      ? params.followersSyncedAt
      : 0

  if (followers <= 0) {
    if (!allowSeed) {
      return {
        followers: 0,
        delta: 0,
        seeded: false,
        followersSyncedAt: syncedAt || now,
      }
    }
    followers = seedStarterFollowers(params.seed)
    seeded = true
    syncedAt = now
    return { followers, delta: followers, seeded, followersSyncedAt: syncedAt }
  }

  if (!syncedAt || syncedAt > now) {
    // 已有粉丝但从未记同步点：锚定现在，不补历史爆炸涨幅
    return { followers, delta: 0, seeded: false, followersSyncedAt: now }
  }

  const delta = computePassiveFollowerDelta({
    followers,
    elapsedMs: now - syncedAt,
    seed: `${params.seed}:${Math.floor(syncedAt / 60_000)}`,
    role,
  })
  if (delta <= 0) {
    return { followers, delta: 0, seeded: false, followersSyncedAt: syncedAt }
  }
  return {
    followers: followers + delta,
    delta,
    seeded: false,
    followersSyncedAt: now,
  }
}

/** 是否具备角色涨粉资格：已有社交/粉丝基数（>0）的主要角色 */
export function isCharacterEligibleForFollowerGrowth(
  povId: string,
  followers: number,
): boolean {
  return povId.startsWith('char:') && Math.max(0, Math.floor(followers || 0)) > 0
}
