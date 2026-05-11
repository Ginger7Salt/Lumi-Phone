import type { EncounterNPC } from './meetTypes'
import { MEET_REUNION_COOLDOWN_MS } from './constants'

/** 可从宿命池重逢的 missed 角色（已过冷却） */
export function listReunionEligibleMissed(
  npcs: EncounterNPC[],
  now = Date.now(),
  cooldownMs = MEET_REUNION_COOLDOWN_MS,
): EncounterNPC[] {
  return npcs.filter(
    (n) => n.status === 'missed' && now - n.lastEncounterTime >= cooldownMs,
  )
}

export function pickRandom<T>(items: readonly T[]): T | null {
  if (!items.length) return null
  return items[Math.floor(Math.random() * items.length)]!
}
