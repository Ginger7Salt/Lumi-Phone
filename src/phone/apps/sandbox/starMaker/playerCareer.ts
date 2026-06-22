import type { PlayerProfile, PlayerStats } from './types'
import { PROLOGUE_QUIZ } from './presets'

export type PlayerStatKey = keyof PlayerStats

export const PLAYER_STAT_KEYS: PlayerStatKey[] = ['pr', 'charm', 'eloquence', 'insight', 'stamina', 'resource']

export const PLAYER_STAT_LABELS: Record<PlayerStatKey, string> = {
  pr: '公关',
  charm: '魅力',
  eloquence: '口才',
  insight: '洞察',
  stamina: '精力',
  resource: '资源',
}

export const PR_STYLE_LABELS: Record<PlayerProfile['prStyle'], string> = {
  calm: '沉稳公关',
  bold: '强势破局',
  scandal: '舆论操盘',
}

export const ROMANCE_STYLE_LABELS: Record<PlayerProfile['romanceStyle'], string> = {
  career: '事业优先',
  secret: '地下恋情',
  public: '高调恋爱',
}

export interface IdentityTier {
  id: string
  title: string
  desc: string
  minAvg: number
  minReputation: number
}

/** 由低到高；满足属性均值与声望双门槛后解锁 */
export const IDENTITY_TIERS: IdentityTier[] = [
  {
    id: 'intern',
    title: '实习经纪人',
    desc: '刚入行的你，正在学习合约、通告与艺人脾性。',
    minAvg: 0,
    minReputation: 0,
  },
  {
    id: 'assistant',
    title: '助理经纪人',
    desc: '能独立跟进日常行程，开始被艺人信任。',
    minAvg: 18,
    minReputation: 22,
  },
  {
    id: 'agent',
    title: '经纪人',
    desc: '可主导小型项目，在圈内有了姓名。',
    minAvg: 30,
    minReputation: 38,
  },
  {
    id: 'senior',
    title: '资深经纪人',
    desc: '操盘中型艺人矩阵，舆论与资源两手抓。',
    minAvg: 45,
    minReputation: 52,
  },
  {
    id: 'chief',
    title: '首席经纪人',
    desc: '公司核心骨干，一言可定档期与方向。',
    minAvg: 60,
    minReputation: 68,
  },
  {
    id: 'gold',
    title: '金牌制作人',
    desc: '行业顶流操盘手，名字本身就是招牌。',
    minAvg: 75,
    minReputation: 82,
  },
]

export const DEFAULT_PLAYER_STATS: PlayerStats = {
  pr: 14,
  charm: 14,
  eloquence: 14,
  insight: 13,
  stamina: 13,
  resource: 13,
}

export function clampPlayerStat(value: number) {
  return Math.max(0, Math.min(99, Math.round(value)))
}

export function normalizePlayerStats(stats?: Partial<PlayerStats> | null): PlayerStats {
  if (!stats) return { ...DEFAULT_PLAYER_STATS }

  const pr = clampPlayerStat(stats.pr ?? DEFAULT_PLAYER_STATS.pr)
  const charm = clampPlayerStat(stats.charm ?? DEFAULT_PLAYER_STATS.charm)
  const eloquence = clampPlayerStat(stats.eloquence ?? DEFAULT_PLAYER_STATS.eloquence)
  const legacyAvg = (pr + charm + eloquence) / 3
  const legacyOnly = stats.insight == null && stats.stamina == null && stats.resource == null

  return {
    pr,
    charm,
    eloquence,
    insight: clampPlayerStat(stats.insight ?? (legacyOnly ? legacyAvg - 1 : DEFAULT_PLAYER_STATS.insight)),
    stamina: clampPlayerStat(stats.stamina ?? (legacyOnly ? legacyAvg - 2 : DEFAULT_PLAYER_STATS.stamina)),
    resource: clampPlayerStat(stats.resource ?? (legacyOnly ? legacyAvg : DEFAULT_PLAYER_STATS.resource)),
  }
}

export function playerStatAvg(stats: PlayerStats) {
  return (stats.pr + stats.charm + stats.eloquence) / 3
}

export function isIdentityUnlocked(stats: PlayerStats, reputation: number, tier: IdentityTier) {
  return playerStatAvg(stats) >= tier.minAvg && reputation >= tier.minReputation
}

export function resolveIdentityTier(stats: PlayerStats, reputation: number): IdentityTier {
  let current = IDENTITY_TIERS[0]
  for (const tier of IDENTITY_TIERS) {
    if (isIdentityUnlocked(stats, reputation, tier)) current = tier
  }
  return current
}

export function resolveNextIdentityTier(stats: PlayerStats, reputation: number): IdentityTier | null {
  const current = resolveIdentityTier(stats, reputation)
  const idx = IDENTITY_TIERS.findIndex((t) => t.id === current.id)
  return IDENTITY_TIERS[idx + 1] ?? null
}

export function bumpPlayerStats(stats: PlayerStats, delta: Partial<PlayerStats>): PlayerStats {
  return {
    pr: clampPlayerStat(stats.pr + (delta.pr ?? 0)),
    charm: clampPlayerStat(stats.charm + (delta.charm ?? 0)),
    eloquence: clampPlayerStat(stats.eloquence + (delta.eloquence ?? 0)),
    insight: clampPlayerStat(stats.insight + (delta.insight ?? 0)),
    stamina: clampPlayerStat(stats.stamina + (delta.stamina ?? 0)),
    resource: clampPlayerStat(stats.resource + (delta.resource ?? 0)),
  }
}

const MBTI_STAT_BIAS: Record<string, Partial<PlayerStats>> = {
  INFJ: { charm: 4, pr: 2, insight: 3 },
  INFP: { charm: 5, eloquence: 1, insight: 2 },
  INTJ: { pr: 5, eloquence: 2, resource: 3 },
  ENFP: { eloquence: 5, charm: 2, stamina: 2 },
  ISTP: { pr: 3, eloquence: 3, stamina: 3 },
  ISFP: { charm: 4, eloquence: 2, insight: 2 },
  ENTP: { eloquence: 5, pr: 2, insight: 3 },
  ENTJ: { pr: 4, eloquence: 4, resource: 4 },
}

export function buildInitialPlayerStats(
  profile: Omit<PlayerProfile, 'stats'>,
  answers: Record<string, string>,
): PlayerStats {
  let stats = normalizePlayerStats(DEFAULT_PLAYER_STATS)
  const mbtiBias = MBTI_STAT_BIAS[profile.mbti.toUpperCase()]
  if (mbtiBias) stats = bumpPlayerStats(stats, mbtiBias)

  if (profile.prStyle === 'calm') stats = bumpPlayerStats(stats, { pr: 5, insight: 2 })
  if (profile.prStyle === 'bold') stats = bumpPlayerStats(stats, { eloquence: 5, stamina: 2 })
  if (profile.prStyle === 'scandal') stats = bumpPlayerStats(stats, { charm: 5, resource: 2 })

  if (profile.romanceStyle === 'career') stats = bumpPlayerStats(stats, { pr: 3, resource: 2 })
  if (profile.romanceStyle === 'secret') stats = bumpPlayerStats(stats, { charm: 3, insight: 2 })
  if (profile.romanceStyle === 'public') stats = bumpPlayerStats(stats, { eloquence: 3, stamina: 2 })

  for (const q of PROLOGUE_QUIZ) {
    const choice = q.choices.find((c) => c.id === answers[q.id])
    if (!choice?.effects.playerStats) continue
    stats = bumpPlayerStats(stats, choice.effects.playerStats)
  }

  return stats
}

export function normalizePlayerProfile(player: PlayerProfile | null | undefined): PlayerProfile | null {
  if (!player) return null
  return {
    ...player,
    stats: normalizePlayerStats(player.stats),
  }
}
