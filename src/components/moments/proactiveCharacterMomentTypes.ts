import {
  PROACTIVE_MESSAGE_INTERVAL_UNITS,
  PROACTIVE_MESSAGE_NUMBER_FONT,
  type ProactiveMessageIntervalUnit,
} from '../../phone/apps/wechat/proactivePrivateMessageTypes'
import {
  DEFAULT_PROACTIVE_MOMENT_MUSIC_LANGUAGE_RATIO,
  normalizeProactiveMomentMusicLanguageRatio,
  type ProactiveMomentMusicLanguageRatioSettings,
} from './proactiveCharacterMomentMusicLanguageRatio'
import {
  DEFAULT_PROACTIVE_MOMENT_FOLLOW_USER_MUSIC_TASTE,
  normalizeProactiveMomentFollowUserMusicTaste,
  type ProactiveMomentFollowUserMusicTasteSettings,
} from './proactiveCharacterMomentUserMusicTaste'

export { PROACTIVE_MESSAGE_INTERVAL_UNITS, PROACTIVE_MESSAGE_NUMBER_FONT }

/** 角色主动发朋友圈：最短 30 分钟，最长 7 天 */
export const PROACTIVE_CHARACTER_MOMENT_INTERVAL_MIN_SECONDS = 30 * 60
export const PROACTIVE_CHARACTER_MOMENT_INTERVAL_MAX_SECONDS = 7 * 24 * 60 * 60
export const PROACTIVE_CHARACTER_MOMENT_INTERVAL_DEFAULT_SECONDS = 6 * 60 * 60

export const PROACTIVE_CHARACTER_MOMENT_PRESETS = [
  { id: 'rare', label: '很少', seconds: 12 * 60 * 60 },
  { id: 'normal', label: '适中', seconds: 6 * 60 * 60 },
  { id: 'often', label: '频繁', seconds: 3 * 60 * 60 },
] as const

/** 全局模式每轮抽取角色数 */
export const PROACTIVE_CHARACTER_MOMENT_PICK_COUNT_MIN = 1
export const PROACTIVE_CHARACTER_MOMENT_PICK_COUNT_MAX = 8
export const PROACTIVE_CHARACTER_MOMENT_PICK_COUNT_DEFAULT = 2

export const PROACTIVE_CHARACTER_MOMENT_PICK_COUNT_PRESETS = [
  { id: 'one', label: '1 人', count: 1 },
  { id: 'few', label: '2 人', count: 2 },
  { id: 'some', label: '3 人', count: 3 },
  { id: 'many', label: '5 人', count: 5 },
] as const

export type ProactiveCharacterMomentMode = 'global' | 'per_character'

/** 单条调度：全局或某一角色 */
export type ProactiveCharacterMomentSchedule = {
  enabled: boolean
  intervalSeconds: number
  lastFiredAtMs: number
}

export type ProactiveCharacterMomentsSettings = {
  /** global：从通讯录随机挑选；per_character：仅调度已开启的指定角色 */
  mode: ProactiveCharacterMomentMode
  global: ProactiveCharacterMomentSchedule
  /** 全局模式每轮抽取几名角色发朋友圈 */
  globalPickCount: number
  /** 主动发布分享歌曲时的语种权重（归一化后注入生成 prompt） */
  musicShareLanguageRatio: ProactiveMomentMusicLanguageRatioSettings
  /** 主动发布分享歌曲时是否向用户当前听歌偏好靠拢 */
  followUserMusicTaste: ProactiveMomentFollowUserMusicTasteSettings
  /** key = buildProactiveCharacterMomentKey(accountId, characterId) */
  byCharacter: Record<string, ProactiveCharacterMomentSchedule>
}

export const DEFAULT_PROACTIVE_CHARACTER_MOMENT_SCHEDULE: ProactiveCharacterMomentSchedule = {
  enabled: false,
  intervalSeconds: PROACTIVE_CHARACTER_MOMENT_INTERVAL_DEFAULT_SECONDS,
  lastFiredAtMs: 0,
}

export const DEFAULT_PROACTIVE_CHARACTER_MOMENTS_SETTINGS: ProactiveCharacterMomentsSettings = {
  mode: 'global',
  global: { ...DEFAULT_PROACTIVE_CHARACTER_MOMENT_SCHEDULE },
  globalPickCount: PROACTIVE_CHARACTER_MOMENT_PICK_COUNT_DEFAULT,
  musicShareLanguageRatio: { ...DEFAULT_PROACTIVE_MOMENT_MUSIC_LANGUAGE_RATIO },
  followUserMusicTaste: { ...DEFAULT_PROACTIVE_MOMENT_FOLLOW_USER_MUSIC_TASTE },
  byCharacter: {},
}

export function clampProactiveCharacterMomentPickCount(raw: number): number {
  if (!Number.isFinite(raw)) return PROACTIVE_CHARACTER_MOMENT_PICK_COUNT_DEFAULT
  return Math.min(
    PROACTIVE_CHARACTER_MOMENT_PICK_COUNT_MAX,
    Math.max(PROACTIVE_CHARACTER_MOMENT_PICK_COUNT_MIN, Math.round(raw)),
  )
}

export function buildProactiveCharacterMomentKey(
  accountId: string | null | undefined,
  characterId: string | null | undefined,
): string {
  const acc = accountId?.trim() ?? ''
  const cid = characterId?.trim() ?? ''
  if (!acc || !cid) return ''
  return `${acc}::${cid}`
}

export function clampProactiveCharacterMomentIntervalSeconds(raw: number): number {
  if (!Number.isFinite(raw)) return PROACTIVE_CHARACTER_MOMENT_INTERVAL_DEFAULT_SECONDS
  return Math.min(
    PROACTIVE_CHARACTER_MOMENT_INTERVAL_MAX_SECONDS,
    Math.max(PROACTIVE_CHARACTER_MOMENT_INTERVAL_MIN_SECONDS, Math.round(raw)),
  )
}

export function normalizeProactiveCharacterMomentSchedule(raw: unknown): ProactiveCharacterMomentSchedule {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PROACTIVE_CHARACTER_MOMENT_SCHEDULE }
  const o = raw as Record<string, unknown>
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : DEFAULT_PROACTIVE_CHARACTER_MOMENT_SCHEDULE.enabled,
    intervalSeconds: clampProactiveCharacterMomentIntervalSeconds(
      typeof o.intervalSeconds === 'number' ? o.intervalSeconds : NaN,
    ),
    lastFiredAtMs:
      typeof o.lastFiredAtMs === 'number' && Number.isFinite(o.lastFiredAtMs)
        ? Math.max(0, Math.round(o.lastFiredAtMs))
        : 0,
  }
}

export function normalizeProactiveCharacterMomentsSettings(raw: unknown): ProactiveCharacterMomentsSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PROACTIVE_CHARACTER_MOMENTS_SETTINGS }
  const o = raw as Record<string, unknown>

  if (o.mode === 'global' || o.mode === 'per_character') {
    const byCharacter: Record<string, ProactiveCharacterMomentSchedule> = {}
    if (o.byCharacter && typeof o.byCharacter === 'object') {
      for (const [key, value] of Object.entries(o.byCharacter as Record<string, unknown>)) {
        const k = key.trim()
        if (!k) continue
        byCharacter[k] = normalizeProactiveCharacterMomentSchedule(value)
      }
    }
    return {
      mode: o.mode,
      global: normalizeProactiveCharacterMomentSchedule(o.global),
      globalPickCount: clampProactiveCharacterMomentPickCount(
        typeof o.globalPickCount === 'number' ? o.globalPickCount : NaN,
      ),
      musicShareLanguageRatio: normalizeProactiveMomentMusicLanguageRatio(o.musicShareLanguageRatio),
      followUserMusicTaste: normalizeProactiveMomentFollowUserMusicTaste(o.followUserMusicTaste),
      byCharacter,
    }
  }

  // 兼容旧版扁平结构
  const legacy = normalizeProactiveCharacterMomentSchedule(raw)
  return {
    mode: 'global',
    global: legacy,
    globalPickCount: PROACTIVE_CHARACTER_MOMENT_PICK_COUNT_DEFAULT,
    musicShareLanguageRatio: { ...DEFAULT_PROACTIVE_MOMENT_MUSIC_LANGUAGE_RATIO },
    followUserMusicTaste: { ...DEFAULT_PROACTIVE_MOMENT_FOLLOW_USER_MUSIC_TASTE },
    byCharacter: {},
  }
}

export function resolveProactiveCharacterMomentIntervalSeconds(
  schedule: Pick<ProactiveCharacterMomentSchedule, 'intervalSeconds'> | null | undefined,
): number {
  return clampProactiveCharacterMomentIntervalSeconds(schedule?.intervalSeconds ?? NaN)
}

export function hasProactiveCharacterMomentScheduleSaved(
  schedule: Pick<ProactiveCharacterMomentSchedule, 'lastFiredAtMs'> | null | undefined,
): boolean {
  return (schedule?.lastFiredAtMs ?? 0) > 0
}

export function resolveCharacterProactiveMomentSchedule(
  settings: ProactiveCharacterMomentsSettings,
  accountId: string,
  characterId: string,
): ProactiveCharacterMomentSchedule {
  const key = buildProactiveCharacterMomentKey(accountId, characterId)
  return settings.byCharacter[key] ?? { ...DEFAULT_PROACTIVE_CHARACTER_MOMENT_SCHEDULE }
}

export function isCharacterProactiveMomentDue(
  schedule: ProactiveCharacterMomentSchedule,
  now: number,
): boolean {
  if (!schedule.enabled) return false
  if (!hasProactiveCharacterMomentScheduleSaved(schedule)) return false
  const intervalMs = resolveProactiveCharacterMomentIntervalSeconds(schedule) * 1000
  return now - (schedule.lastFiredAtMs ?? 0) >= intervalMs
}

export function formatProactiveCharacterMomentIntervalLabel(seconds: number): string {
  const s = clampProactiveCharacterMomentIntervalSeconds(seconds)
  if (s < 3600) {
    const m = Math.round(s / 60)
    return `约每 ${m} 分钟`
  }
  if (s % 3600 === 0) return `约每 ${s / 3600} 小时`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m > 0 ? `约每 ${h} 小时 ${m} 分钟` : `约每 ${h} 小时`
}

export function momentUnitInputMinMax(unit: ProactiveMessageIntervalUnit): {
  min: number
  max: number
  step: number
} {
  if (unit === 'second') {
    return {
      min: PROACTIVE_CHARACTER_MOMENT_INTERVAL_MIN_SECONDS,
      max: PROACTIVE_CHARACTER_MOMENT_INTERVAL_MAX_SECONDS,
      step: 60,
    }
  }
  if (unit === 'minute') {
    return { min: 30, max: 7 * 24 * 60, step: 1 }
  }
  return { min: 1, max: 7 * 24, step: 1 }
}

export function momentSecondsToUnitValue(
  seconds: number,
  unit: ProactiveMessageIntervalUnit,
): number {
  const s = clampProactiveCharacterMomentIntervalSeconds(seconds)
  if (unit === 'second') return s
  if (unit === 'minute') return Math.max(30, Math.round(s / 60))
  const hours = s / 3600
  return hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10
}

export function momentUnitValueToSeconds(
  value: number,
  unit: ProactiveMessageIntervalUnit,
): number {
  const v = Number(value)
  if (!Number.isFinite(v) || v <= 0) return PROACTIVE_CHARACTER_MOMENT_INTERVAL_MIN_SECONDS
  if (unit === 'second') return clampProactiveCharacterMomentIntervalSeconds(v)
  if (unit === 'minute') return clampProactiveCharacterMomentIntervalSeconds(v * 60)
  return clampProactiveCharacterMomentIntervalSeconds(v * 3600)
}

export function momentPickDisplayUnitForSeconds(seconds: number): ProactiveMessageIntervalUnit {
  const s = clampProactiveCharacterMomentIntervalSeconds(seconds)
  if (s < 3600) return 'minute'
  return 'hour'
}
