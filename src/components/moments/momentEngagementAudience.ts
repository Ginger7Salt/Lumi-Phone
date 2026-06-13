import type { AllowedMomentCharacter } from './momentPrivacyAudience'

function hashEngagementSeed(seed: number, charId: string, index: number): number {
  let h = (seed ^ index * 2654435761) >>> 0
  for (let i = 0; i < charId.length; i++) {
    h = Math.imul(h ^ charId.charCodeAt(i), 16777619) >>> 0
  }
  return h
}

/**
 * 并非每位可见角色都会调用 AI 生成点赞/评论。
 * 被 @ 的角色必参与；其余按种子抽样，避免「全员互动」。
 */
export function selectCharactersForMomentEngagement(
  allowed: AllowedMomentCharacter[],
  mentionedCharacterIds: ReadonlySet<string>,
  seed: number,
): AllowedMomentCharacter[] {
  const mentioned: AllowedMomentCharacter[] = []
  const pool: AllowedMomentCharacter[] = []
  for (const c of allowed) {
    const id = c.charId.trim()
    if (!id) continue
    if (mentionedCharacterIds.has(id)) mentioned.push(c)
    else pool.push(c)
  }
  if (!pool.length) return mentioned

  const cap = Math.min(5, Math.max(1, Math.ceil(pool.length * 0.35)))
  const scored = pool
    .map((c, index) => ({ c, score: hashEngagementSeed(seed, c.charId, index) }))
    .sort((a, b) => a.score - b.score)

  return [...mentioned, ...scored.slice(0, cap).map((row) => row.c)]
}
