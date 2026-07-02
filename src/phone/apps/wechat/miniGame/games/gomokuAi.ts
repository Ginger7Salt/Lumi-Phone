/** 五子棋 · Alpha-Beta 剪枝 Minimax 本地 AI */
import {
  type GomokuDifficultyLevel,
  GOMOKU_DIFFICULTY_DEFAULT,
  gomokuMoveCandidateCap,
  gomokuSearchDepth,
  pickRankWithDifficulty,
  shouldSkipMandatoryBlock,
  shouldTakeWinningMove,
} from './gomokuDifficulty'
import { isAiTacticalBrilliant } from '../gomokuSituation'

export type GomokuCell = 0 | 1 | 2 // 0=空 1=黑(玩家) 2=白(AI)

const SIZE = 15
const WIN = 5
const INF = 1_000_000

const DIRS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const

function inBounds(r: number, c: number) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE
}

function countLine(board: GomokuCell[][], r: number, c: number, dr: number, dc: number, player: 1 | 2) {
  let n = 0
  let rr = r
  let cc = c
  while (inBounds(rr, cc) && board[rr]![cc] === player) {
    n++
    rr += dr
    cc += dc
  }
  return n
}

function evaluatePoint(board: GomokuCell[][], r: number, c: number, player: 1 | 2): number {
  if (board[r]![c] !== 0) return 0
  let score = 0
  for (const [dr, dc] of DIRS) {
    const fwd = countLine(board, r + dr, c + dc, dr, dc, player)
    const bwd = countLine(board, r - dr, c - dc, -dr, -dc, player)
    const len = fwd + bwd
    if (len >= 4) score += 12000
    else if (len === 3) score += 800
    else if (len === 2) score += 80
    else if (len === 1) score += 8
  }
  const center = Math.abs(r - 7) + Math.abs(c - 7)
  score += Math.max(0, 14 - center)
  return score
}

function evaluateBoard(board: GomokuCell[][], ai: 2, human: 1): number {
  let s = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r]![c] === 0) {
        s += evaluatePoint(board, r, c, ai) * 1.05
        s -= evaluatePoint(board, r, c, human)
      }
    }
  }
  return s
}

function checkWin(board: GomokuCell[][], r: number, c: number, player: 1 | 2): boolean {
  for (const [dr, dc] of DIRS) {
    const fwd = countLine(board, r + dr, c + dc, dr, dc, player)
    const bwd = countLine(board, r - dr, c - dc, -dr, -dc, player)
    if (fwd + bwd + 1 >= WIN) return true
  }
  return false
}

function orderedMoves(board: GomokuCell[][], cap: number): [number, number][] {
  const moves: { r: number; c: number; s: number }[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r]![c] !== 0) continue
      let near = false
      for (let dr = -2; dr <= 2 && !near; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr
          const nc = c + dc
          if (inBounds(nr, nc) && board[nr]![nc] !== 0) {
            near = true
            break
          }
        }
      }
      if (!near && board.flat().some((x) => x !== 0)) continue
      const s = evaluatePoint(board, r, c, 2) + evaluatePoint(board, r, c, 1)
      moves.push({ r, c, s })
    }
  }
  moves.sort((a, b) => b.s - a.s)
  return moves.slice(0, cap).map((m) => [m.r, m.c] as [number, number])
}

function minimax(
  board: GomokuCell[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board[r]![c]
      if (v === 0) continue
      if (checkWin(board, r, c, v)) return v === 2 ? INF - (4 - depth) : -INF + (4 - depth)
    }
  }
  if (depth === 0) return evaluateBoard(board, 2, 1)

  const moves = orderedMoves(board, 16)
  if (!moves.length) return 0

  if (maximizing) {
    let best = -INF
    for (const [r, c] of moves) {
      board[r]![c] = 2
      const val = minimax(board, depth - 1, alpha, beta, false)
      board[r]![c] = 0
      best = Math.max(best, val)
      alpha = Math.max(alpha, val)
      if (beta <= alpha) break
    }
    return best
  }

  let best = INF
  for (const [r, c] of moves) {
    board[r]![c] = 1
    const val = minimax(board, depth - 1, alpha, beta, true)
    board[r]![c] = 0
    best = Math.min(best, val)
    beta = Math.min(beta, val)
    if (beta <= alpha) break
  }
  return best
}

export function createEmptyBoard(): GomokuCell[][] {
  return Array.from({ length: SIZE }, () => Array<GomokuCell>(SIZE).fill(0))
}

export type GomokuAiMoveOptions = {
  difficulty?: GomokuDifficultyLevel
}

export function gomokuAiMove(
  board: GomokuCell[][],
  options?: GomokuAiMoveOptions,
): { r: number; c: number; brilliant: boolean } | null {
  const difficulty = options?.difficulty ?? GOMOKU_DIFFICULTY_DEFAULT
  const moveCap = gomokuMoveCandidateCap(difficulty)
  const moves = orderedMoves(board, moveCap)
  if (!moves.length) {
    return { r: 7, c: 7, brilliant: false }
  }

  const stoneCount = board.flat().filter((x) => x !== 0).length

  if (shouldTakeWinningMove(difficulty)) {
    for (const [r, c] of moves) {
      board[r]![c] = 2
      const win = checkWin(board, r, c, 2)
      board[r]![c] = 0
      if (win) return { r, c, brilliant: true }
    }
  }

  if (!shouldSkipMandatoryBlock(difficulty)) {
    for (const [r, c] of moves) {
      board[r]![c] = 1
      const block = checkWin(board, r, c, 1)
      board[r]![c] = 0
      if (block) return { r, c, brilliant: false }
    }
  }

  const scored: { r: number; c: number; score: number }[] = []
  const depth = gomokuSearchDepth(difficulty, stoneCount)

  for (const [r, c] of moves) {
    board[r]![c] = 2
    const score = minimax(board, depth, -INF, INF, false)
    board[r]![c] = 0
    scored.push({ r, c, score })
  }
  scored.sort((a, b) => b.score - a.score)

  const pickIdx = pickRankWithDifficulty(difficulty, scored.length)
  const picked = scored[pickIdx] ?? scored[0]!
  board[picked.r]![picked.c] = 2
  const tacticalBrilliant = isAiTacticalBrilliant(board, picked)
  board[picked.r]![picked.c] = 0
  const brilliant = picked.score > INF - 100 || tacticalBrilliant
  return { r: picked.r, c: picked.c, brilliant }
}

export const GOMOKU_SIZE = SIZE

export function gomokuCheckWin(board: GomokuCell[][], r: number, c: number, player: 1 | 2) {
  return checkWin(board, r, c, player)
}

/** 返回连成五子的一串坐标（含落点），用于胜负高亮 */
export function gomokuFindWinLine(
  board: GomokuCell[][],
  r: number,
  c: number,
  player: 1 | 2,
): Array<{ r: number; c: number }> | null {
  if (board[r]![c] !== player) return null
  for (const [dr, dc] of DIRS) {
    const line: Array<{ r: number; c: number }> = [{ r, c }]
    let rr = r + dr
    let cc = c + dc
    while (inBounds(rr, cc) && board[rr]![cc] === player) {
      line.push({ r: rr, c: cc })
      rr += dr
      cc += dc
    }
    rr = r - dr
    cc = c - dc
    while (inBounds(rr, cc) && board[rr]![cc] === player) {
      line.unshift({ r: rr, c: cc })
      rr -= dr
      cc -= dc
    }
    if (line.length >= WIN) {
      const idx = line.findIndex((p) => p.r === r && p.c === c)
      const anchor = idx >= 0 ? idx : Math.floor(line.length / 2)
      let start = anchor - Math.floor((WIN - 1) / 2)
      start = Math.max(0, Math.min(start, line.length - WIN))
      return line.slice(start, start + WIN)
    }
  }
  return null
}

export function gomokuIsFull(board: GomokuCell[][]) {
  return board.every((row) => row.every((c) => c !== 0))
}
