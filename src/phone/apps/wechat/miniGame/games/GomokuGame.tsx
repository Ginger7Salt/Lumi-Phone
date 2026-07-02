import { useCallback, useEffect, useRef } from 'react'

import type { GomokuDifficultyLevel } from './gomokuDifficulty'
import { analyzeAfterAiMove, analyzeAfterPlayerMove } from '../gomokuSituation'
import { MONO, type GameEventEmitter } from '../types'
import {
  createEmptyBoard,
  gomokuAiMove,
  gomokuCheckWin,
  gomokuFindWinLine,
  gomokuIsFull,
  GOMOKU_SIZE,
  type GomokuCell,
} from './gomokuAi'

const GOMOKU_WIN_LINE_REVEAL_MS = 1_600

export function GomokuGame({
  emitEvent,
  difficulty,
  pickThinkDelayMs,
  onAiThinkingChange,
  getDifficulty,
  disabled = false,
  playerGoesFirst = true,
  onStoneCountsChange,
}: {
  emitEvent: GameEventEmitter
  difficulty: GomokuDifficultyLevel
  pickThinkDelayMs: () => number
  onAiThinkingChange?: (thinking: boolean) => void
  getDifficulty?: () => GomokuDifficultyLevel
  disabled?: boolean
  /** 为 false 时由 AI 先手 */
  playerGoesFirst?: boolean
  onStoneCountsChange?: (counts: { player: number; ai: number }) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardRef = useRef<GomokuCell[][]>(createEmptyBoard())
  const gameOverRef = useRef(false)
  const aiThinkingRef = useRef(false)
  const stoneCountRef = useRef(0)
  const playerStonesRef = useRef(0)
  const aiStonesRef = useRef(0)
  const aiTimerRef = useRef<number | null>(null)
  const difficultyRef = useRef(difficulty)
  const lastMoveRef = useRef<{ r: number; c: number } | null>(null)
  const winLineRef = useRef<Array<{ r: number; c: number }> | null>(null)
  const winLinePlayerRef = useRef<1 | 2 | null>(null)
  const winRevealTimerRef = useRef<number | null>(null)
  const pulsePhaseRef = useRef(0)
  const pulseFrameRef = useRef<number | null>(null)
  difficultyRef.current = getDifficulty?.() ?? difficulty

  const notifyStoneCounts = useCallback(() => {
    onStoneCountsChange?.({
      player: playerStonesRef.current,
      ai: aiStonesRef.current,
    })
  }, [onStoneCountsChange])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const size = Math.min(rect.width, rect.height)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const pad = size * 0.06
    const grid = (size - pad * 2) / (GOMOKU_SIZE - 1)
    const board = boardRef.current

    ctx.fillStyle = MONO.bg
    ctx.fillRect(0, 0, size, size)

    ctx.strokeStyle = MONO.gray300
    ctx.lineWidth = 1
    for (let i = 0; i < GOMOKU_SIZE; i++) {
      const p = pad + i * grid
      ctx.beginPath()
      ctx.moveTo(pad, p)
      ctx.lineTo(size - pad, p)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(p, pad)
      ctx.lineTo(p, size - pad)
      ctx.stroke()
    }

    const starPts = [3, 7, 11]
    ctx.fillStyle = MONO.gray400
    for (const r of starPts) {
      for (const c of starPts) {
        ctx.beginPath()
        ctx.arc(pad + c * grid, pad + r * grid, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    for (let r = 0; r < GOMOKU_SIZE; r++) {
      for (let c = 0; c < GOMOKU_SIZE; c++) {
        const v = board[r]![c]
        if (!v) continue
        const x = pad + c * grid
        const y = pad + r * grid
        const rad = grid * 0.38
        const grad = ctx.createRadialGradient(x - rad * 0.2, y - rad * 0.2, rad * 0.1, x, y, rad)
        if (v === 1) {
          grad.addColorStop(0, MONO.inkSoft)
          grad.addColorStop(1, MONO.ink)
        } else {
          grad.addColorStop(0, MONO.platinumBright)
          grad.addColorStop(1, MONO.gray300)
        }
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x, y, rad, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = v === 1 ? MONO.ink : MONO.gray400
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
    }

    const winLine = winLineRef.current
    if (winLine && winLine.length >= 2) {
      const winner = winLinePlayerRef.current ?? board[winLine[0]!.r]![winLine[0]!.c]
      const accent =
        winner === 1 ? 'rgba(16, 185, 129, 0.92)' : winner === 2 ? 'rgba(245, 158, 11, 0.92)' : 'rgba(239, 68, 68, 0.92)'
      const head = winLine[0]!
      const tail = winLine[winLine.length - 1]!
      ctx.save()
      ctx.strokeStyle = accent
      ctx.lineWidth = Math.max(3, grid * 0.1)
      ctx.lineCap = 'round'
      ctx.shadowColor = accent
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.moveTo(pad + head.c * grid, pad + head.r * grid)
      ctx.lineTo(pad + tail.c * grid, pad + tail.r * grid)
      ctx.stroke()
      ctx.restore()
    }

    const lastMove = lastMoveRef.current
    if (lastMove && !winLine) {
      const { r, c } = lastMove
      const x = pad + c * grid
      const y = pad + r * grid
      const rad = grid * 0.38
      const pulse = 0.5 + Math.sin(pulsePhaseRef.current) * 0.5
      const ringRad = rad + 3 + pulse * 3
      const cell = board[r]![c]
      const accent =
        cell === 1 ? 'rgba(16, 185, 129,' : cell === 2 ? 'rgba(245, 158, 11,' : 'rgba(99, 102, 241,'
      ctx.save()
      ctx.strokeStyle = `${accent}${0.45 + pulse * 0.45})`
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.arc(x, y, ringRad, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = `${accent}${0.18 + pulse * 0.12})`
      ctx.beginPath()
      ctx.arc(x, y, rad + 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }, [])

  const revealWinAndFinish = useCallback(
    (
      params: {
        r: number
        c: number
        player: 1 | 2
        won: boolean
        detail: string
        gomokuKey: 'win' | 'lose'
      },
    ) => {
      const board = boardRef.current
      gameOverRef.current = true
      if (aiTimerRef.current != null) {
        window.clearTimeout(aiTimerRef.current)
        aiTimerRef.current = null
      }
      aiThinkingRef.current = false
      onAiThinkingChange?.(false)
      winLineRef.current = gomokuFindWinLine(board, params.r, params.c, params.player)
      winLinePlayerRef.current = params.player
      draw()
      if (winRevealTimerRef.current != null) {
        window.clearTimeout(winRevealTimerRef.current)
      }
      winRevealTimerRef.current = window.setTimeout(() => {
        winRevealTimerRef.current = null
        emitEvent({
          type: 'gameOver',
          detail: params.detail,
          won: params.won,
          gomokuKey: params.gomokuKey,
        })
      }, GOMOKU_WIN_LINE_REVEAL_MS)
    },
    [draw, emitEvent, onAiThinkingChange],
  )

  const runAiTurn = useCallback(() => {
    const board = boardRef.current
    let move: ReturnType<typeof gomokuAiMove> = null
    try {
      move = gomokuAiMove(board, { difficulty: difficultyRef.current })
    } finally {
      aiThinkingRef.current = false
      onAiThinkingChange?.(false)
    }
    if (!move || gameOverRef.current) return
    const openingMove = stoneCountRef.current === 0
    board[move.r]![move.c] = 2
    lastMoveRef.current = { r: move.r, c: move.c }
    stoneCountRef.current += 1
    aiStonesRef.current += 1
    draw()
    notifyStoneCounts()

    if (gomokuCheckWin(board, move.r, move.c, 2)) {
      revealWinAndFinish({
        r: move.r,
        c: move.c,
        player: 2,
        won: false,
        detail: 'AI 获胜',
        gomokuKey: 'win',
      })
      return
    }

    if (openingMove && !playerGoesFirst) {
      emitEvent({ type: 'milestone', detail: '角色首子', gomokuKey: 'charFirstMove' })
    } else {
      const gomokuKey = analyzeAfterAiMove(board, move)
      emitEvent({
        type: move.brilliant ? 'opponentMove' : 'crisis',
        detail: move.brilliant ? '妙手' : '角色落子',
        gomokuKey,
      })
    }

    if (gomokuIsFull(board)) {
      gameOverRef.current = true
      emitEvent({ type: 'gameOver', detail: '和棋', gomokuKey: 'draw' })
    }
  }, [draw, emitEvent, notifyStoneCounts, onAiThinkingChange, playerGoesFirst, revealWinAndFinish])

  const scheduleAiTurn = useCallback(
    (delayMs?: number, opts?: { opening?: boolean }) => {
      if (gameOverRef.current) return false
      if (aiThinkingRef.current && !opts?.opening) return false
      if (aiTimerRef.current != null) return false
      aiThinkingRef.current = true
      onAiThinkingChange?.(true)
      const rawDelay = delayMs ?? pickThinkDelayMs()
      const delay = opts?.opening
        ? Math.max(350, Math.min(1400, rawDelay))
        : Math.max(1000, Math.min(10_000, rawDelay))
      aiTimerRef.current = window.setTimeout(() => {
        aiTimerRef.current = null
        runAiTurn()
      }, delay)
      return true
    },
    [onAiThinkingChange, pickThinkDelayMs, runAiTurn],
  )

  const tryScheduleAiOpening = useCallback(() => {
    if (playerGoesFirst || disabled || gameOverRef.current) return false
    if (stoneCountRef.current > 0) return false
    return scheduleAiTurn(Math.max(400, pickThinkDelayMs() * 0.45), { opening: true })
  }, [disabled, pickThinkDelayMs, playerGoesFirst, scheduleAiTurn])

  const handleTap = useCallback(
    (clientX: number, clientY: number) => {
      if (gameOverRef.current || aiThinkingRef.current || disabled) return
      const totalStones = stoneCountRef.current
      const isPlayerTurn = playerGoesFirst ? totalStones % 2 === 0 : totalStones % 2 === 1
      if (!isPlayerTurn) return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const size = Math.min(rect.width, rect.height)
      const pad = size * 0.06
      const grid = (size - pad * 2) / (GOMOKU_SIZE - 1)
      const lx = clientX - rect.left
      const ly = clientY - rect.top
      const c = Math.round((lx - pad) / grid)
      const r = Math.round((ly - pad) / grid)
      if (r < 0 || r >= GOMOKU_SIZE || c < 0 || c >= GOMOKU_SIZE) return
      const board = boardRef.current
      if (board[r]![c] !== 0) return

      const isBoardFirstStone = stoneCountRef.current === 0
      board[r]![c] = 1
      lastMoveRef.current = { r, c }
      stoneCountRef.current += 1
      playerStonesRef.current += 1
      draw()
      notifyStoneCounts()

      const playerWins = gomokuCheckWin(board, r, c, 1)
      if (!playerWins) {
        const playerKey = analyzeAfterPlayerMove(board, { r, c }, isBoardFirstStone && playerGoesFirst)
        emitEvent({
          type: isBoardFirstStone && playerGoesFirst ? 'milestone' : 'opponentMove',
          detail: isBoardFirstStone && playerGoesFirst ? '首子落定' : '玩家落子',
          gomokuKey: playerKey,
        })
      }

      if (playerWins) {
        revealWinAndFinish({
          r,
          c,
          player: 1,
          won: true,
          detail: '玩家获胜',
          gomokuKey: 'lose',
        })
        return
      }
      if (gomokuIsFull(board)) {
        gameOverRef.current = true
        emitEvent({ type: 'gameOver', detail: '和棋', gomokuKey: 'draw' })
        return
      }

      scheduleAiTurn()
    },
    [draw, disabled, emitEvent, notifyStoneCounts, playerGoesFirst, revealWinAndFinish, scheduleAiTurn],
  )

  useEffect(() => {
    tryScheduleAiOpening()
  }, [tryScheduleAiOpening])

  useEffect(() => {
    return () => {
      if (aiTimerRef.current != null) {
        window.clearTimeout(aiTimerRef.current)
        aiTimerRef.current = null
      }
      if (winRevealTimerRef.current != null) {
        window.clearTimeout(winRevealTimerRef.current)
        winRevealTimerRef.current = null
      }
      aiThinkingRef.current = false
      onAiThinkingChange?.(false)
    }
  }, [onAiThinkingChange])

  useEffect(() => {
    notifyStoneCounts()
  }, [notifyStoneCounts])

  useEffect(() => {
    const tick = () => {
      pulsePhaseRef.current += 0.08
      draw()
      pulseFrameRef.current = window.requestAnimationFrame(tick)
    }
    pulseFrameRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (pulseFrameRef.current != null) window.cancelAnimationFrame(pulseFrameRef.current)
    }
  }, [draw])

  useEffect(() => {
    draw()
    const onResize = () => draw()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className={`aspect-square w-full max-w-[min(88vw,400px)] touch-none ${disabled ? 'opacity-60' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault()
        handleTap(e.clientX, e.clientY)
      }}
    />
  )
}
