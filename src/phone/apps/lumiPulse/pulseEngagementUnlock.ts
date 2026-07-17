import { useEffect, useState } from 'react'

import type {
  PulseComment,
  PulseDmThread,
  PulseEngagementMetricsPlan,
  PulseInteraction,
  PulsePost,
} from './pulseTypes'

/** 与朋友圈异步互动同量级：约 30s～10min 错落解锁 */
export const PULSE_ENGAGEMENT_DELAY_MIN_SECONDS = 30
export const PULSE_ENGAGEMENT_DELAY_MAX_SECONDS = 600

function unitRandom(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function clampDelaySeconds(seconds: number): number {
  const n = Number.isFinite(seconds) ? seconds : PULSE_ENGAGEMENT_DELAY_MIN_SECONDS
  return Math.max(
    PULSE_ENGAGEMENT_DELAY_MIN_SECONDS,
    Math.min(PULSE_ENGAGEMENT_DELAY_MAX_SECONDS, Math.round(n)),
  )
}

/** 有机间隔（秒）：短则十几秒，长可跳数分钟 */
function nextOrganicGapSeconds(seed: string, index: number, remainingSlots: number): number {
  const u = unitRandom(`${seed}:gap:${index}`)
  const v = unitRandom(`${seed}:gap2:${index}`)
  let gap: number
  if (u < 0.32) gap = 12 + Math.floor(v * 38)
  else if (u < 0.58) gap = 45 + Math.floor(v * 85)
  else if (u < 0.8) gap = 90 + Math.floor(v * 130)
  else gap = 165 + Math.floor(v * 220)
  const budget = Math.max(14, Math.floor((PULSE_ENGAGEMENT_DELAY_MAX_SECONDS / Math.max(1, remainingSlots)) * 1.4))
  return Math.max(12, Math.min(gap, budget))
}

/** 为 N 个事件分配相对发帖时刻的 delaySeconds（单调递增） */
export function buildStaggeredDelaySeconds(count: number, seed: string): number[] {
  const n = Math.max(0, Math.floor(count))
  if (!n) return []
  const out: number[] = []
  let cursor = 18 + Math.floor(unitRandom(`${seed}:start`) * 22)
  for (let i = 0; i < n; i += 1) {
    if (i > 0) cursor += nextOrganicGapSeconds(seed, i, n - i)
    out.push(clampDelaySeconds(cursor))
  }
  // 保证末尾不超过上限，必要时等比压缩尾部
  const last = out[out.length - 1] ?? PULSE_ENGAGEMENT_DELAY_MIN_SECONDS
  if (last > PULSE_ENGAGEMENT_DELAY_MAX_SECONDS) {
    const scale = PULSE_ENGAGEMENT_DELAY_MAX_SECONDS / last
    return out.map((d) => clampDelaySeconds(d * scale))
  }
  return out
}

export function isPulseEngagementUnlocked(visibleAt: number | undefined, now: number): boolean {
  if (visibleAt == null || !Number.isFinite(visibleAt)) return true
  return visibleAt <= now
}

/** 赞/转里程碑：数个递增点，铺满延时窗口 */
export function buildEngagementMetricsPlan(params: {
  publishedAt: number
  likeTarget: number
  repostTarget: number
  seed: string
}): PulseEngagementMetricsPlan {
  const likeTarget = Math.max(0, Math.floor(params.likeTarget))
  const repostTarget = Math.max(0, Math.floor(params.repostTarget))
  const milestoneCount = Math.min(8, Math.max(3, 2 + Math.floor(likeTarget / 120)))
  const delays = buildStaggeredDelaySeconds(milestoneCount, `${params.seed}:metrics`)
  const milestones = delays.map((delaySec, i) => {
    const t = (i + 1) / milestoneCount
    // 前缓后促的增长曲线
    const ease = t * t
    return {
      visibleAt: params.publishedAt + delaySec * 1000,
      likeCount: Math.max(0, Math.round(likeTarget * ease)),
      repostCount: Math.max(0, Math.round(repostTarget * ease)),
    }
  })
  if (milestones.length) {
    const last = milestones[milestones.length - 1]!
    last.likeCount = likeTarget
    last.repostCount = repostTarget
  }
  return { likeTarget, repostTarget, milestones }
}

export function resolveUnlockedEngagementMetrics(
  plan: PulseEngagementMetricsPlan | undefined,
  now: number,
): { likeCount: number; repostCount: number } {
  if (!plan?.milestones?.length) return { likeCount: 0, repostCount: 0 }
  let likeCount = 0
  let repostCount = 0
  for (const m of plan.milestones) {
    if (m.visibleAt <= now) {
      likeCount = Math.max(likeCount, m.likeCount)
      repostCount = Math.max(repostCount, m.repostCount)
    }
  }
  return { likeCount, repostCount }
}

export function filterUnlockedPulseComments(
  comments: PulseComment[] | undefined,
  now: number,
): PulseComment[] {
  const list = comments ?? []
  const unlockedIds = new Set<string>()
  const out: PulseComment[] = []
  // 两遍：先一级，再回复（父未解锁则子不出现）
  for (const c of list) {
    if (!isPulseEngagementUnlocked(c.visibleAt, now)) continue
    if (c.parentId) continue
    unlockedIds.add(c.id)
    out.push(c)
  }
  for (const c of list) {
    if (!isPulseEngagementUnlocked(c.visibleAt, now)) continue
    if (!c.parentId) continue
    if (!unlockedIds.has(c.parentId)) continue
    unlockedIds.add(c.id)
    out.push(c)
  }
  return out.sort((a, b) => a.createdAt - b.createdAt)
}

export function filterUnlockedPulseInteractions(
  rows: PulseInteraction[] | undefined,
  now: number,
): PulseInteraction[] {
  return (rows ?? []).filter((i) => isPulseEngagementUnlocked(i.visibleAt, now))
}

export function filterUnlockedPulseDmThreads(
  rows: PulseDmThread[] | undefined,
  now: number,
): PulseDmThread[] {
  return (rows ?? []).filter((t) => isPulseEngagementUnlocked(t.visibleAt, now))
}

/** 展示用赞/转/评：有互动计划时按墙钟推进，否则用帖上已存数 */
export function resolvePulsePostDisplayCounts(
  post: Pick<PulsePost, 'likeCount' | 'repostCount' | 'commentCount' | 'engagementMetrics' | 'engagementStatus'>,
  unlockedCommentCount: number,
  now: number,
): { likeCount: number; repostCount: number; commentCount: number } {
  if (post.engagementStatus === 'ready' && post.engagementMetrics) {
    const m = resolveUnlockedEngagementMetrics(post.engagementMetrics, now)
    return {
      likeCount: Math.max(post.likeCount, m.likeCount),
      repostCount: Math.max(post.repostCount, m.repostCount),
      commentCount: unlockedCommentCount,
    }
  }
  if (post.engagementStatus === 'pending') {
    return {
      likeCount: post.likeCount,
      repostCount: post.repostCount,
      commentCount: unlockedCommentCount,
    }
  }
  return {
    likeCount: post.likeCount,
    repostCount: post.repostCount,
    commentCount: post.commentCount,
  }
}

/** 微博广场互动解锁时钟（默认 5s，与朋友圈一致） */
export function usePulseEngagementClock(intervalMs = 5000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
