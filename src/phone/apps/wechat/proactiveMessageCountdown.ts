import type { ChatConversationSettingsRow } from './newFriendsPersona/types'
import {
  PROACTIVE_MESSAGE_NUMBER_FONT,
  hasProactiveMessageScheduleSaved,
} from './proactivePrivateMessageTypes'
import {
  formatProactiveVariableIntervalCountdownHint,
  isProactiveVariableIntervalEnabled,
  resolveProactiveMessageEffectiveIntervalSeconds,
} from './proactiveVariableInterval'

export type ProactiveMessageBlockReason = 'busy' | 'generating' | null

export type ProactiveMessageCountdownState = {
  visible: boolean
  remainingMs: number
  intervalMs: number
  blockedReason: ProactiveMessageBlockReason
  blockedHint: string
  /** 灵动间隔开启时的本次随机说明 */
  variableIntervalHint?: string
}

export function computeProactiveMessageRemainingMs(
  settings: Pick<
    ChatConversationSettingsRow,
    | 'proactiveMessageEnabled'
    | 'proactiveMessageVariableIntervalEnabled'
    | 'proactiveMessageNextIntervalSeconds'
    | 'proactiveMessageIntervalSeconds'
    | 'proactiveMessageIntervalMinutes'
    | 'proactiveMessageLastFiredAtMs'
    | 'updatedAt'
  >,
  now: number,
  options?: { characterExplicitlyBusy?: boolean },
): number {
  if (!settings.proactiveMessageEnabled) return 0
  if (!hasProactiveMessageScheduleSaved(settings)) return 0
  const intervalMs =
    resolveProactiveMessageEffectiveIntervalSeconds(settings, options) * 1000
  const lastFired = settings.proactiveMessageLastFiredAtMs ?? 0
  const anchor = lastFired > 0 ? lastFired : now
  return Math.max(0, anchor + intervalMs - now)
}

export function resolveProactiveMessageBlockReason(params: {
  isBusyActive: boolean
  inFlight: boolean
}): ProactiveMessageBlockReason {
  if (params.inFlight) return 'generating'
  if (params.isBusyActive) return 'busy'
  return null
}

export function proactiveBlockReasonHint(reason: ProactiveMessageBlockReason): string {
  switch (reason) {
    case 'busy':
      return '忙碌中暂停'
    case 'generating':
      return '角色正在输入'
    default:
      return ''
  }
}

export function formatProactiveCountdownClock(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  if (m > 0) return `${pad(m)}:${pad(s)}`
  return `${s}`
}

export function buildProactiveMessageCountdownState(params: {
  settings: ChatConversationSettingsRow | null
  now: number
  isBusyActive: boolean
  inFlight: boolean
  characterExplicitlyBusy?: boolean
}): ProactiveMessageCountdownState | null {
  const settings = params.settings
  if (!settings?.proactiveMessageEnabled) return null
  if (!hasProactiveMessageScheduleSaved(settings)) return null

  const intervalMs =
    resolveProactiveMessageEffectiveIntervalSeconds(settings, {
      characterExplicitlyBusy: params.characterExplicitlyBusy,
    }) * 1000
  const remainingMs = computeProactiveMessageRemainingMs(settings, params.now, {
    characterExplicitlyBusy: params.characterExplicitlyBusy,
  })
  const blockedReason = resolveProactiveMessageBlockReason({
    isBusyActive: params.isBusyActive,
    inFlight: params.inFlight,
  })
  const blockedHint = proactiveBlockReasonHint(blockedReason)
  const variableIntervalHint = isProactiveVariableIntervalEnabled(settings)
    ? formatProactiveVariableIntervalCountdownHint(intervalMs / 1000)
    : undefined

  return {
    visible: true,
    remainingMs,
    intervalMs,
    blockedReason,
    blockedHint,
    variableIntervalHint,
  }
}

export const proactiveCountdownNumberStyle = {
  fontFamily: PROACTIVE_MESSAGE_NUMBER_FONT,
} as const
