import type { ChatConversationSettingsRow, WeChatChatMessage } from './newFriendsPersona/types'
import { personaDb } from './newFriendsPersona/idb'
import { resolveProactiveMessageIntervalSeconds } from './proactivePrivateMessageTypes'

/** 灵动间隔：非忙碌时随机下限（秒） */
export const PROACTIVE_VARIABLE_INTERVAL_MIN_SECONDS = 1
/** 灵动间隔：非忙碌时随机上限（秒）= 5 分钟 */
export const PROACTIVE_VARIABLE_INTERVAL_MAX_SECONDS = 5 * 60
/** 角色明确表示忙碌时的随机下限（秒）= 5 分钟 */
export const PROACTIVE_VARIABLE_BUSY_MIN_SECONDS = 5 * 60
/** 角色明确表示忙碌时的随机上限（秒）= 2 小时 */
export const PROACTIVE_VARIABLE_BUSY_MAX_SECONDS = 2 * 60 * 60
/** 自定义灵动区间允许的最小值（秒） */
export const PROACTIVE_VARIABLE_CUSTOM_MIN_FLOOR_SECONDS = 1
/** 自定义灵动区间允许的最大值（秒） */
export const PROACTIVE_VARIABLE_CUSTOM_MAX_CEILING_SECONDS = PROACTIVE_VARIABLE_BUSY_MAX_SECONDS

export const PROACTIVE_VARIABLE_IDLE_PRESETS = [
  { id: 'default', label: '默认', minSeconds: 1, maxSeconds: 5 * 60 },
  { id: 'quick', label: '较快', minSeconds: 30, maxSeconds: 2 * 60 },
  { id: 'relaxed', label: '悠闲', minSeconds: 2 * 60, maxSeconds: 15 * 60 },
  { id: 'sparse', label: '稀疏', minSeconds: 10 * 60, maxSeconds: 60 * 60 },
] as const

const EXPLICIT_BUSY_MESSAGE_WINDOW_MS = 45 * 60 * 1000

export type ProactiveVariableIdleBounds = {
  minSeconds: number
  maxSeconds: number
}

function randomIntInclusive(min: number, max: number): number {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

export function clampProactiveVariableBoundSeconds(raw: number): number {
  if (!Number.isFinite(raw)) return PROACTIVE_VARIABLE_INTERVAL_MIN_SECONDS
  return Math.min(
    PROACTIVE_VARIABLE_CUSTOM_MAX_CEILING_SECONDS,
    Math.max(PROACTIVE_VARIABLE_CUSTOM_MIN_FLOOR_SECONDS, Math.round(raw)),
  )
}

export function normalizeProactiveVariableIdleBounds(
  minRaw: number,
  maxRaw: number,
): ProactiveVariableIdleBounds {
  const minSeconds = clampProactiveVariableBoundSeconds(minRaw)
  const maxSeconds = clampProactiveVariableBoundSeconds(maxRaw)
  return {
    minSeconds: Math.min(minSeconds, maxSeconds),
    maxSeconds: Math.max(minSeconds, maxSeconds),
  }
}

export function hasCustomProactiveVariableIdleBounds(
  row:
    | Pick<
        ChatConversationSettingsRow,
        'proactiveMessageVariableIntervalMinSeconds' | 'proactiveMessageVariableIntervalMaxSeconds'
      >
    | null
    | undefined,
): boolean {
  const min = row?.proactiveMessageVariableIntervalMinSeconds
  const max = row?.proactiveMessageVariableIntervalMaxSeconds
  return (
    (typeof min === 'number' && Number.isFinite(min) && min > 0) ||
    (typeof max === 'number' && Number.isFinite(max) && max > 0)
  )
}

export function resolveProactiveVariableIdleBounds(
  row:
    | Pick<
        ChatConversationSettingsRow,
        'proactiveMessageVariableIntervalMinSeconds' | 'proactiveMessageVariableIntervalMaxSeconds'
      >
    | null
    | undefined,
): ProactiveVariableIdleBounds {
  if (!hasCustomProactiveVariableIdleBounds(row)) {
    return {
      minSeconds: PROACTIVE_VARIABLE_INTERVAL_MIN_SECONDS,
      maxSeconds: PROACTIVE_VARIABLE_INTERVAL_MAX_SECONDS,
    }
  }
  return normalizeProactiveVariableIdleBounds(
    row?.proactiveMessageVariableIntervalMinSeconds ?? PROACTIVE_VARIABLE_INTERVAL_MIN_SECONDS,
    row?.proactiveMessageVariableIntervalMaxSeconds ?? PROACTIVE_VARIABLE_INTERVAL_MAX_SECONDS,
  )
}

export function clampProactiveVariableIntervalSeconds(raw: number): number {
  if (!Number.isFinite(raw)) return PROACTIVE_VARIABLE_INTERVAL_MIN_SECONDS
  return Math.min(
    PROACTIVE_VARIABLE_BUSY_MAX_SECONDS,
    Math.max(PROACTIVE_VARIABLE_INTERVAL_MIN_SECONDS, Math.round(raw)),
  )
}

export function drawProactiveVariableIntervalSeconds(
  characterExplicitlyBusy: boolean,
  row?:
    | Pick<
        ChatConversationSettingsRow,
        'proactiveMessageVariableIntervalMinSeconds' | 'proactiveMessageVariableIntervalMaxSeconds'
      >
    | null,
): number {
  if (characterExplicitlyBusy) {
    return randomIntInclusive(
      PROACTIVE_VARIABLE_BUSY_MIN_SECONDS,
      PROACTIVE_VARIABLE_BUSY_MAX_SECONDS,
    )
  }
  const bounds = resolveProactiveVariableIdleBounds(row)
  return randomIntInclusive(bounds.minSeconds, bounds.maxSeconds)
}

const EXPLICIT_BUSY_TEXT_RE =
  /(?:去忙|在忙|忙着|没空|先忙|要忙|我来忙|有事要|顾不上|晚点(?:再)?说|回头(?:再)?说|等会(?:儿)?再(?:说|聊)|暂时忙|忙一会|忙一会儿|先不聊|先不说了)/

export function messageSignalsCharacterExplicitBusy(content: string): boolean {
  const t = String(content ?? '').trim()
  if (!t) return false
  if (/\[BUSY\]/i.test(t)) return true
  return EXPLICIT_BUSY_TEXT_RE.test(t)
}

export function detectCharacterExplicitBusyInMessages(
  messages: WeChatChatMessage[],
  now: number,
  windowMs = EXPLICIT_BUSY_MESSAGE_WINDOW_MS,
): boolean {
  const cutoff = now - windowMs
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (!m || m.isRecalled || m.type !== 'character') continue
    if (m.timestamp < cutoff) break
    if (messageSignalsCharacterExplicitBusy(m.content ?? '')) return true
  }
  return false
}

export async function resolveCharacterExplicitBusyForProactive(params: {
  row: ChatConversationSettingsRow
  now: number
}): Promise<boolean> {
  const gs = await personaDb.getGlobalSettings()
  if (gs.busyMode === 'character') {
    const busyRow = await personaDb.getCharacterBusySettings(params.row.peerCharacterId)
    if (busyRow?.enabled !== false && busyRow?.isBusy && (busyRow.busyEndTime ?? 0) > params.now) {
      return true
    }
  } else {
    const kv = await personaDb.getPhoneKv(`busy-conv:${params.row.conversationKey.trim()}`)
    const busyEnabled = typeof kv === 'boolean' ? kv : true
    if (busyEnabled) {
      const busyRow = await personaDb.getCharacterBusySettings(params.row.peerCharacterId)
      if (busyRow?.isBusy && (busyRow.busyEndTime ?? 0) > params.now) return true
    }
  }

  const messages = await personaDb.listWeChatChatMessagesByConversationKey(params.row.conversationKey)
  return detectCharacterExplicitBusyInMessages(messages, params.now)
}

export function isProactiveVariableIntervalEnabled(
  row: Pick<ChatConversationSettingsRow, 'proactiveMessageVariableIntervalEnabled'> | null | undefined,
): boolean {
  return !!row?.proactiveMessageVariableIntervalEnabled
}

export function resolveProactiveMessageEffectiveIntervalSeconds(
  row: Pick<
    ChatConversationSettingsRow,
    | 'proactiveMessageVariableIntervalEnabled'
    | 'proactiveMessageNextIntervalSeconds'
    | 'proactiveMessageIntervalSeconds'
    | 'proactiveMessageIntervalMinutes'
    | 'proactiveMessageVariableIntervalMinSeconds'
    | 'proactiveMessageVariableIntervalMaxSeconds'
  >,
  options?: { characterExplicitlyBusy?: boolean },
): number {
  if (isProactiveVariableIntervalEnabled(row)) {
    const stored = row.proactiveMessageNextIntervalSeconds
    if (typeof stored === 'number' && Number.isFinite(stored) && stored > 0) {
      return clampProactiveVariableIntervalSeconds(stored)
    }
    return drawProactiveVariableIntervalSeconds(!!options?.characterExplicitlyBusy, row)
  }
  return resolveProactiveMessageIntervalSeconds(row)
}

export function formatProactiveVariableBoundLabel(seconds: number): string {
  const s = clampProactiveVariableBoundSeconds(seconds)
  if (s < 60) return `${s} 秒`
  if (s < 3600) {
    const m = Math.round(s / 60)
    return `${m} 分钟`
  }
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
}

export function formatProactiveVariableIdleRangeLabel(
  row:
    | Pick<
        ChatConversationSettingsRow,
        'proactiveMessageVariableIntervalMinSeconds' | 'proactiveMessageVariableIntervalMaxSeconds'
      >
    | null
    | undefined,
): string {
  const bounds = resolveProactiveVariableIdleBounds(row)
  return `${formatProactiveVariableBoundLabel(bounds.minSeconds)}～${formatProactiveVariableBoundLabel(bounds.maxSeconds)}`
}

export function formatProactiveVariableIntervalRangeLabel(
  characterExplicitlyBusy: boolean,
  row?:
    | Pick<
        ChatConversationSettingsRow,
        'proactiveMessageVariableIntervalMinSeconds' | 'proactiveMessageVariableIntervalMaxSeconds'
      >
    | null,
): string {
  if (characterExplicitlyBusy) {
    return '约 5 分钟～2 小时（角色忙碌中）'
  }
  return `约 ${formatProactiveVariableIdleRangeLabel(row)}`
}

export function formatProactiveVariableIntervalCountdownHint(seconds: number): string {
  const s = clampProactiveVariableIntervalSeconds(seconds)
  if (s < 60) return `本次随机 ${s} 秒`
  if (s < 3600) {
    const m = Math.round(s / 60)
    return `本次随机约 ${m} 分钟`
  }
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m > 0 ? `本次随机约 ${h} 小时 ${m} 分钟` : `本次随机约 ${h} 小时`
}
