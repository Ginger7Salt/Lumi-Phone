/** 五子棋 AI 难度：1=明显放水 … 5=全力 */
export type GomokuDifficultyLevel = 1 | 2 | 3 | 4 | 5

export const GOMOKU_DIFFICULTY_DEFAULT: GomokuDifficultyLevel = 3

export function clampGomokuDifficultyLevel(raw: unknown): GomokuDifficultyLevel {
  const n = typeof raw === 'number' ? Math.round(raw) : Number.parseInt(String(raw ?? ''), 10)
  if (n <= 1) return 1
  if (n === 2) return 2
  if (n === 4) return 4
  if (n >= 5) return 5
  return 3
}

export function gomokuSearchDepth(difficulty: GomokuDifficultyLevel, stoneCount: number): number {
  const early = stoneCount < 4
  if (difficulty <= 1) return 1
  if (difficulty === 2) return early ? 1 : 2
  if (difficulty === 3) return early ? 2 : 3
  if (difficulty === 4) return early ? 2 : 3
  return early ? 3 : 4
}

export function gomokuMoveCandidateCap(difficulty: GomokuDifficultyLevel): number {
  if (difficulty <= 1) return 5
  if (difficulty === 2) return 8
  if (difficulty === 3) return 12
  if (difficulty === 4) return 14
  return 16
}

/** 是否跳过必防（难度越低越容易漏防） */
export function shouldSkipMandatoryBlock(difficulty: GomokuDifficultyLevel): boolean {
  if (difficulty <= 1) return Math.random() < 0.72
  if (difficulty === 2) return Math.random() < 0.38
  if (difficulty === 3) return Math.random() < 0.12
  return false
}

/** 是否主动抓住己方必胜手（低难度更常错过） */
export function shouldTakeWinningMove(difficulty: GomokuDifficultyLevel): boolean {
  if (difficulty <= 1) return Math.random() < 0.25
  if (difficulty === 2) return Math.random() < 0.62
  return true
}

/** 从候选里故意选次优（放水） */
export function pickRankWithDifficulty(
  difficulty: GomokuDifficultyLevel,
  candidateCount: number,
): number {
  if (candidateCount <= 1) return 0
  if (difficulty <= 1) {
    const r = Math.random()
    if (r < 0.55) return Math.min(2 + Math.floor(Math.random() * 3), candidateCount - 1)
    if (r < 0.85) return Math.min(1, candidateCount - 1)
    return 0
  }
  if (difficulty === 2) {
    if (Math.random() < 0.42) return Math.min(1 + Math.floor(Math.random() * 2), candidateCount - 1)
    return 0
  }
  if (difficulty === 3 && Math.random() < 0.18) return Math.min(1, candidateCount - 1)
  return 0
}
