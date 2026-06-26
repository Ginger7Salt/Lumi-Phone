import type { ProactiveCharacterMomentSchedule } from './proactiveCharacterMomentTypes'
import { resolveProactiveCharacterMomentIntervalSeconds } from './proactiveCharacterMomentTypes'
import { PROACTIVE_LIVE_FIRE_SLACK_MS } from '../../phone/apps/wechat/proactiveScheduling'

export function computeProactiveMomentScheduledPublishAtMs(
  schedule: Pick<ProactiveCharacterMomentSchedule, 'lastFiredAtMs' | 'intervalSeconds'>,
  realNow = Date.now(),
): number {
  const intervalMs = resolveProactiveCharacterMomentIntervalSeconds(schedule) * 1000
  const lastFired = schedule.lastFiredAtMs ?? 0
  if (lastFired <= 0) return realNow
  return lastFired + intervalMs
}

export function resolveProactiveMomentHistoricalTimestampMs(
  scheduledAtMs: number,
  actualNowMs = Date.now(),
): number {
  if (actualNowMs - scheduledAtMs <= PROACTIVE_LIVE_FIRE_SLACK_MS) return actualNowMs
  return scheduledAtMs
}
