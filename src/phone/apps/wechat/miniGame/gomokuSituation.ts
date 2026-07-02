import {
  type GomokuCell,
  gomokuCheckWin,
  GOMOKU_SIZE,
} from './games/gomokuAi'

const DIRS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const

function inBounds(r: number, c: number) {
  return r >= 0 && r < GOMOKU_SIZE && c >= 0 && c < GOMOKU_SIZE
}

type LineSpan = {
  length: number
  openEnds: number
}

/** 以 (r,c) 为落点、沿 (dr,dc) 统计连子长度与两端空位数（(r,c) 须已有 player 棋子） */
function lineSpanAt(
  board: GomokuCell[][],
  r: number,
  c: number,
  dr: number,
  dc: number,
  player: 1 | 2,
): LineSpan {
  if (board[r]![c] !== player) return { length: 0, openEnds: 0 }

  let length = 1
  let openEnds = 0

  let rr = r + dr
  let cc = c + dc
  while (inBounds(rr, cc) && board[rr]![cc] === player) {
    length++
    rr += dr
    cc += dc
  }
  if (inBounds(rr, cc) && board[rr]![cc] === 0) openEnds++

  rr = r - dr
  cc = c - dc
  while (inBounds(rr, cc) && board[rr]![cc] === player) {
    length++
    rr -= dr
    cc -= dc
  }
  if (inBounds(rr, cc) && board[rr]![cc] === 0) openEnds++

  return { length, openEnds }
}

/** 五子棋局面反应键 — 用于预生成台词库索引 */
export type GomokuReactionKey =
  | 'blockFour'
  | 'blockWin'
  | 'playerBlockFour'
  | 'playerBlockWin'
  | 'aiOpenFour'
  | 'aiOpenThree'
  | 'playerOpenFour'
  | 'playerMove'
  | 'brilliant'
  | 'routine'
  | 'thinking'
  | 'firstMove'
  | 'charFirstMove'
  | 'drawPlayerFirst'
  | 'drawCharFirst'
  | 'win'
  | 'lose'
  | 'draw'

function wouldPlayerWin(board: GomokuCell[][], r: number, c: number): boolean {
  if (board[r]![c] !== 0) return false
  board[r]![c] = 1
  const win = gomokuCheckWin(board, r, c, 1)
  board[r]![c] = 0
  return win
}

function wouldPlayerFourThreat(board: GomokuCell[][], r: number, c: number): boolean {
  if (board[r]![c] !== 0) return false
  board[r]![c] = 1
  let threat = false
  for (const [dr, dc] of DIRS) {
    const { length } = lineSpanAt(board, r, c, dr, dc, 1)
    if (length >= 4) threat = true
  }
  board[r]![c] = 0
  return threat
}

function scanPlayerWinCells(board: GomokuCell[][]): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  for (let r = 0; r < GOMOKU_SIZE; r += 1) {
    for (let c = 0; c < GOMOKU_SIZE; c += 1) {
      if (board[r]![c] !== 0) continue
      if (wouldPlayerWin(board, r, c)) cells.push([r, c])
    }
  }
  return cells
}

function scanPlayerFourThreatCells(board: GomokuCell[][]): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  for (let r = 0; r < GOMOKU_SIZE; r += 1) {
    for (let c = 0; c < GOMOKU_SIZE; c += 1) {
      if (board[r]![c] !== 0) continue
      if (wouldPlayerFourThreat(board, r, c)) cells.push([r, c])
    }
  }
  return cells
}

function cellInList(r: number, c: number, list: Array<[number, number]>): boolean {
  return list.some(([rr, cc]) => rr === r && cc === c)
}

function aiHasOpenFour(board: GomokuCell[][], r: number, c: number): boolean {
  if (board[r]![c] !== 2) return false
  for (const [dr, dc] of DIRS) {
    const { length, openEnds } = lineSpanAt(board, r, c, dr, dc, 2)
    if (length >= 4 && openEnds >= 1) return true
  }
  return false
}

function aiHasOpenThree(board: GomokuCell[][], r: number, c: number): boolean {
  if (board[r]![c] !== 2) return false
  for (const [dr, dc] of DIRS) {
    const { length, openEnds } = lineSpanAt(board, r, c, dr, dc, 2)
    if (length >= 3 && openEnds >= 1) return true
  }
  return false
}

function playerHasOpenFour(board: GomokuCell[][], r: number, c: number): boolean {
  if (board[r]![c] !== 1) return false
  for (const [dr, dc] of DIRS) {
    const { length, openEnds } = lineSpanAt(board, r, c, dr, dc, 1)
    if (length >= 4 && openEnds >= 1) return true
  }
  return false
}

function wouldAiWin(board: GomokuCell[][], r: number, c: number): boolean {
  if (board[r]![c] !== 0) return false
  board[r]![c] = 2
  const win = gomokuCheckWin(board, r, c, 2)
  board[r]![c] = 0
  return win
}

function wouldAiFourThreat(board: GomokuCell[][], r: number, c: number): boolean {
  if (board[r]![c] !== 0) return false
  board[r]![c] = 2
  let threat = false
  for (const [dr, dc] of DIRS) {
    const { length } = lineSpanAt(board, r, c, dr, dc, 2)
    if (length >= 4) threat = true
  }
  board[r]![c] = 0
  return threat
}

function scanAiWinCells(board: GomokuCell[][]): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  for (let r = 0; r < GOMOKU_SIZE; r += 1) {
    for (let c = 0; c < GOMOKU_SIZE; c += 1) {
      if (board[r]![c] !== 0) continue
      if (wouldAiWin(board, r, c)) cells.push([r, c])
    }
  }
  return cells
}

function scanAiFourThreatCells(board: GomokuCell[][]): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  for (let r = 0; r < GOMOKU_SIZE; r += 1) {
    for (let c = 0; c < GOMOKU_SIZE; c += 1) {
      if (board[r]![c] !== 0) continue
      if (wouldAiFourThreat(board, r, c)) cells.push([r, c])
    }
  }
  return cells
}

/** 分析玩家落子是否封堵了角色威胁（在玩家已落子后调用） */
function classifyPlayerBlock(
  board: GomokuCell[][],
  r: number,
  c: number,
): 'playerBlockWin' | 'playerBlockFour' | null {
  const playerStone = board[r]![c]
  if (playerStone !== 1) return null

  board[r]![c] = 0
  const winCells = scanAiWinCells(board)
  const fourCells = scanAiFourThreatCells(board)
  board[r]![c] = playerStone

  if (cellInList(r, c, winCells)) return 'playerBlockWin'
  if (cellInList(r, c, fourCells)) return 'playerBlockFour'
  return null
}

/** 分析 AI 落子是否封堵了玩家威胁（在 AI 已落子后调用） */
function classifyAiBlock(
  board: GomokuCell[][],
  r: number,
  c: number,
): 'blockWin' | 'blockFour' | null {
  const aiStone = board[r]![c]
  if (aiStone !== 2) return null

  board[r]![c] = 0
  const winCells = scanPlayerWinCells(board)
  const fourCells = scanPlayerFourThreatCells(board)
  board[r]![c] = aiStone

  if (cellInList(r, c, winCells)) return 'blockWin'
  if (cellInList(r, c, fourCells)) return 'blockFour'
  return null
}

export function analyzeAfterAiMove(
  board: GomokuCell[][],
  move: { r: number; c: number; brilliant: boolean },
): GomokuReactionKey {
  const { r, c, brilliant } = move

  const block = classifyAiBlock(board, r, c)
  if (block === 'blockWin') return 'blockWin'
  if (block === 'blockFour') return 'blockFour'

  if (aiHasOpenFour(board, r, c)) return 'aiOpenFour'
  if (aiHasOpenThree(board, r, c)) return 'aiOpenThree'
  if (brilliant) return 'brilliant'
  return 'routine'
}

export function analyzeAfterPlayerMove(
  board: GomokuCell[][],
  move: { r: number; c: number },
  isFirstStone: boolean,
): GomokuReactionKey {
  if (isFirstStone) return 'firstMove'
  const { r, c } = move

  const block = classifyPlayerBlock(board, r, c)
  if (block === 'playerBlockWin') return 'playerBlockWin'
  if (block === 'playerBlockFour') return 'playerBlockFour'

  if (playerHasOpenFour(board, r, c)) return 'playerOpenFour'
  return 'playerMove'
}

export function isAiTacticalBrilliant(
  board: GomokuCell[][],
  move: { r: number; c: number },
): boolean {
  const saved = board[move.r]![move.c]
  board[move.r]![move.c] = 2
  const openFour = aiHasOpenFour(board, move.r, move.c)
  const blockWin = classifyAiBlock(board, move.r, move.c) === 'blockWin'
  board[move.r]![move.c] = saved
  return openFour || blockWin
}
