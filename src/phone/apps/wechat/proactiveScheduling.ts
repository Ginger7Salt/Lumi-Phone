import type { ChatConversationSettingsRow } from './newFriendsPersona/types'
import { resolveProactiveMessageEffectiveIntervalSeconds } from './proactiveVariableInterval'

/** 触发时刻与计划时刻相差在此范围内，视为「刚好上线时发送」，时间戳用实际上线时刻 */
export const PROACTIVE_LIVE_FIRE_SLACK_MS = 90_000

/** 单次上线最多补发轮数，避免长期离线时 API 爆炸 */
export const PROACTIVE_MAX_CATCHUP_ROUNDS = 24

export function resolveProactiveMessageIntervalMs(
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
  return resolveProactiveMessageEffectiveIntervalSeconds(row, options) * 1000
}

export function computeProactiveMessageScheduledFireAtMs(
  row: Pick<
    ChatConversationSettingsRow,
    | 'proactiveMessageLastFiredAtMs'
    | 'proactiveMessageVariableIntervalEnabled'
    | 'proactiveMessageNextIntervalSeconds'
    | 'proactiveMessageIntervalSeconds'
    | 'proactiveMessageIntervalMinutes'
    | 'proactiveMessageVariableIntervalMinSeconds'
    | 'proactiveMessageVariableIntervalMaxSeconds'
  >,
  realNow = Date.now(),
  options?: { characterExplicitlyBusy?: boolean },
): number {
  const intervalMs = resolveProactiveMessageIntervalMs(row, options)
  const lastFired = row.proactiveMessageLastFiredAtMs ?? 0
  if (lastFired <= 0) return realNow
  return lastFired + intervalMs
}

/** 离线/逾期时应补发几轮（每轮独立 AI 输出 + 各自历史时间戳） */
export function computeMissedProactiveMessageRoundCount(
  row: Pick<
    ChatConversationSettingsRow,
    | 'proactiveMessageLastFiredAtMs'
    | 'proactiveMessageVariableIntervalEnabled'
    | 'proactiveMessageNextIntervalSeconds'
    | 'proactiveMessageIntervalSeconds'
    | 'proactiveMessageIntervalMinutes'
    | 'proactiveMessageVariableIntervalMinSeconds'
    | 'proactiveMessageVariableIntervalMaxSeconds'
  >,
  realNow = Date.now(),
  options?: { characterExplicitlyBusy?: boolean },
): number {
  const intervalMs = resolveProactiveMessageIntervalMs(row, options)
  const lastFired = row.proactiveMessageLastFiredAtMs ?? 0
  if (lastFired <= 0 || intervalMs <= 0) return 0
  const overdueMs = realNow - lastFired
  if (overdueMs < intervalMs) return 0
  return Math.min(PROACTIVE_MAX_CATCHUP_ROUNDS, Math.floor(overdueMs / intervalMs))
}

/** slot 从 1 开始：anchor + 1×interval 为第一轮到期时刻 */
export function computeProactiveMessageSlotScheduledAtMs(
  anchorLastFiredMs: number,
  intervalMs: number,
  slotIndex1Based: number,
): number {
  return anchorLastFiredMs + slotIndex1Based * intervalMs
}

/** 离线补发用计划触发时刻；仅「刚好上线时发送」用 actualNowMs */
export function resolveProactiveHistoricalDisplayTimestampMs(
  scheduledAtMs: number,
  actualNowMs = Date.now(),
): number {
  if (actualNowMs - scheduledAtMs <= PROACTIVE_LIVE_FIRE_SLACK_MS) return actualNowMs
  return scheduledAtMs
}
