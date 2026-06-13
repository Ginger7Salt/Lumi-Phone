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

const EXPLICIT_BUSY_MESSAGE_WINDOW_MS = 45 * 60 * 1000

function randomIntInclusive(min: number, max: number): number {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

export function clampProactiveVariableIntervalSeconds(raw: number): number {
  if (!Number.isFinite(raw)) return PROACTIVE_VARIABLE_INTERVAL_MIN_SECONDS
  return Math.min(
    PROACTIVE_VARIABLE_BUSY_MAX_SECONDS,
    Math.max(PROACTIVE_VARIABLE_INTERVAL_MIN_SECONDS, Math.round(raw)),
  )
}

export function drawProactiveVariableIntervalSeconds(characterExplicitlyBusy: boolean): number {
  if (characterExplicitlyBusy) {
    return randomIntInclusive(
      PROACTIVE_VARIABLE_BUSY_MIN_SECONDS,
      PROACTIVE_VARIABLE_BUSY_MAX_SECONDS,
    )
  }
  return randomIntInclusive(
    PROACTIVE_VARIABLE_INTERVAL_MIN_SECONDS,
    PROACTIVE_VARIABLE_INTERVAL_MAX_SECONDS,
  )
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
  >,
  options?: { characterExplicitlyBusy?: boolean },
): number {
  if (isProactiveVariableIntervalEnabled(row)) {
    const stored = row.proactiveMessageNextIntervalSeconds
    if (typeof stored === 'number' && Number.isFinite(stored) && stored > 0) {
      return clampProactiveVariableIntervalSeconds(stored)
    }
    return drawProactiveVariableIntervalSeconds(!!options?.characterExplicitlyBusy)
  }
  return resolveProactiveMessageIntervalSeconds(row)
}

export function formatProactiveVariableIntervalRangeLabel(characterExplicitlyBusy: boolean): string {
  if (characterExplicitlyBusy) {
    return '约 5 分钟～2 小时（角色忙碌中）'
  }
  return '约 1 秒～5 分钟'
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
