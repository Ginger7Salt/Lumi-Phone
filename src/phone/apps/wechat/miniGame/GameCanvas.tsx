import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import { Pressable } from '../../../components/Pressable'
import { getGameLabel } from './gameCatalog'
import type { GomokuSessionSetup } from './gomokuReactionBank'
import { CompanionPod } from './CompanionPod'
import { GameResultOverlay } from './GameResultOverlay'
import { GomokuCompanionBar } from './GomokuCompanionBar'
import { GomokuFirstMoveDraw } from './GomokuFirstMoveDraw'
import { useGameReactionEngine } from './useGameReactionEngine'
import type { WeChatMiniGameMatchResult } from '../newFriendsPersona/types'
import type { GameEvent, MiniGameType } from './types'
import { BubbleShooterGame } from './games/BubbleShooterGame'
import { GomokuGame } from './games/GomokuGame'
import { GravityMergeGame } from './games/GravityMergeGame'
import { SerpentGame } from './games/SerpentGame'
import { StarMatchGame } from './games/StarMatchGame'
import { TetrominoGame } from './games/TetrominoGame'

function resolveGomokuMatchResult(event: GameEvent): WeChatMiniGameMatchResult | null {
  if (event.type !== 'gameOver') return null
  if (event.detail?.includes('和')) return 'draw'
  if (event.won === true) return 'player_win'
  if (event.won === false) return 'char_win'
  return null
}

function GameView({
  gameType,
  emitEvent,
  gomokuProps,
}: {
  gameType: MiniGameType
  emitEvent: ReturnType<typeof useGameReactionEngine>['emitEvent']
  gomokuProps?: {
    difficulty: ReturnType<typeof useGameReactionEngine>['gomokuDifficulty']
    pickThinkDelayMs: ReturnType<typeof useGameReactionEngine>['pickThinkDelayMs']
    setAiThinking: ReturnType<typeof useGameReactionEngine>['setAiThinking']
    getGomokuDifficulty: ReturnType<typeof useGameReactionEngine>['getGomokuDifficulty']
    setupReady: boolean
    playerGoesFirst: boolean
    onStoneCountsChange?: (counts: { player: number; ai: number }) => void
  }
}) {
  switch (gameType) {
    case 'gravity':
      return <GravityMergeGame emitEvent={emitEvent} />
    case 'gomoku':
      return gomokuProps ? (
        <GomokuGame
          emitEvent={emitEvent}
          difficulty={gomokuProps.difficulty}
          pickThinkDelayMs={gomokuProps.pickThinkDelayMs}
          getDifficulty={gomokuProps.getGomokuDifficulty}
          onAiThinkingChange={gomokuProps.setAiThinking}
          disabled={!gomokuProps.setupReady}
          playerGoesFirst={gomokuProps.playerGoesFirst}
          onStoneCountsChange={gomokuProps.onStoneCountsChange}
        />
      ) : null
    case 'serpent':
      return <SerpentGame emitEvent={emitEvent} />
    case 'tetromino':
      return <TetrominoGame emitEvent={emitEvent} />
    case 'bubble':
      return <BubbleShooterGame emitEvent={emitEvent} />
    case 'stars':
      return <StarMatchGame emitEvent={emitEvent} />
    default:
      return null
  }
}

export function GameCanvas({
  open,
  gameType,
  charId,
  charName,
  avatarUrl,
  playerAvatarUrl,
  conversationKey,
  inviteId,
  preloadedGomokuSetup,
  onClose,
  onGameFinished,
}: {
  open: boolean
  gameType: MiniGameType
  charId: string
  charName?: string
  avatarUrl?: string
  playerAvatarUrl?: string
  conversationKey?: string
  inviteId?: string
  preloadedGomokuSetup?: GomokuSessionSetup
  onClose: () => void
  onGameFinished?: (params: { inviteId: string; matchResult: WeChatMiniGameMatchResult }) => void
}) {
  const {
    reactionText,
    reactionVisible,
    settlementReactionText,
    emitEvent,
    setAiThinking,
    syncGomokuContext,
    triggerGomokuGameStartReaction,
    triggerGomokuDrawResultReaction,
    aiThinking,
    pickThinkDelayMs,
    gomokuDifficulty,
    getGomokuDifficulty,
    gomokuSetupReady,
  } = useGameReactionEngine(charId, gameType, true, {
    conversationKey,
    peerDisplayName: charName,
    preloadedGomokuSetup,
  })

  const isGomoku = gameType === 'gomoku'
  const [gomokuStoneCounts, setGomokuStoneCounts] = useState({ player: 0, ai: 0 })
  const [firstMoveDrawDone, setFirstMoveDrawDone] = useState(false)
  const [playerGoesFirst, setPlayerGoesFirst] = useState(true)
  const [settlementResult, setSettlementResult] = useState<WeChatMiniGameMatchResult | null>(null)
  const finishedReportedRef = useRef(false)
  const stoneCountRef = useRef(0)

  const handleFirstMoveDrawComplete = useCallback(
    (goesFirst: boolean) => {
      setPlayerGoesFirst(goesFirst)
      setFirstMoveDrawDone(true)
      syncGomokuContext({
        stoneCount: 0,
        playerGoesFirst: goesFirst,
        gameEnded: false,
      })
      triggerGomokuDrawResultReaction(goesFirst)
    },
    [syncGomokuContext, triggerGomokuDrawResultReaction],
  )

  const handleGomokuStoneCountsChange = useCallback(
    (counts: { player: number; ai: number }) => {
      const total = counts.player + counts.ai
      stoneCountRef.current = total
      syncGomokuContext({
        stoneCount: total,
        playerGoesFirst,
        gameEnded: settlementResult != null,
      })
      setGomokuStoneCounts((prev) =>
        prev.player === counts.player && prev.ai === counts.ai ? prev : counts,
      )
    },
    [playerGoesFirst, settlementResult, syncGomokuContext],
  )

  useEffect(() => {
    if (open) {
      setSettlementResult(null)
      setFirstMoveDrawDone(false)
      setPlayerGoesFirst(true)
      setGomokuStoneCounts({ player: 0, ai: 0 })
      finishedReportedRef.current = false
      stoneCountRef.current = 0
      setAiThinking(false)
      syncGomokuContext({ stoneCount: 0, playerGoesFirst: true, gameEnded: false })
    }
  }, [open, inviteId, setAiThinking, syncGomokuContext])

  const totalStoneCount = gomokuStoneCounts.player + gomokuStoneCounts.ai

  const reportGameFinished = useCallback(() => {
    const id = inviteId?.trim()
    if (!id || !settlementResult || finishedReportedRef.current) return
    finishedReportedRef.current = true
    onGameFinished?.({ inviteId: id, matchResult: settlementResult })
  }, [inviteId, onGameFinished, settlementResult])

  useEffect(() => {
    reportGameFinished()
  }, [reportGameFinished])

  const wrappedEmitEvent = useCallback(
    (event: GameEvent) => {
      if (isGomoku) {
        const pendingResult = resolveGomokuMatchResult(event)
        syncGomokuContext({
          stoneCount: stoneCountRef.current,
          playerGoesFirst,
          gameEnded: settlementResult != null || pendingResult != null,
        })
      }
      emitEvent(event)
      if (isGomoku && !settlementResult) {
        const result = resolveGomokuMatchResult(event)
        if (result) setSettlementResult(result)
      }
    },
    [emitEvent, isGomoku, playerGoesFirst, settlementResult, syncGomokuContext],
  )

  const handleSettlementReturn = useCallback(() => {
    reportGameFinished()
    onClose()
  }, [onClose, reportGameFinished])

  const showSettlement = settlementResult != null
  const showFirstMoveDraw = isGomoku && !firstMoveDrawDone && !showSettlement
  const gomokuBoardReady = gomokuSetupReady && firstMoveDrawDone

  useEffect(() => {
    if (!isGomoku) return
    syncGomokuContext({
      stoneCount: totalStoneCount,
      playerGoesFirst,
      gameEnded: showSettlement,
    })
  }, [isGomoku, playerGoesFirst, showSettlement, syncGomokuContext, totalStoneCount])

  useEffect(() => {
    if (!isGomoku || !gomokuBoardReady || showSettlement) return
    triggerGomokuGameStartReaction()
  }, [gomokuBoardReady, isGomoku, showSettlement, triggerGomokuGameStartReaction])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1400] flex flex-col bg-[#F9FAFB]"
        >
          {!isGomoku ? (
            <CompanionPod avatarUrl={avatarUrl} reactionText={reactionText} visible={reactionVisible} />
          ) : null}

          <div
            className="flex shrink-0 items-center justify-between px-3 pb-2"
            style={{ paddingTop: 'max(52px, calc(env(safe-area-inset-top, 0px) + 44px))' }}
          >
            <Pressable
              className="flex items-center gap-1 rounded-full px-2 py-1.5 text-[#374151] active:bg-black/5"
              onClick={showSettlement ? handleSettlementReturn : onClose}
            >
              <ChevronLeft size={18} strokeWidth={1.5} />
              <span className="text-[13px]">返回</span>
            </Pressable>
            <div
              className="text-[12px] tracking-[0.14em] text-[#6B7280]"
              style={{ fontFamily: 'var(--phone-font, "Noto Serif SC", serif)' }}
            >
              {showSettlement ? `${getGameLabel(gameType)} · 结算` : getGameLabel(gameType)}
            </div>
            <div className="w-[52px]" />
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            {isGomoku ? (
              <GomokuCompanionBar
                playerAvatarUrl={playerAvatarUrl}
                charAvatarUrl={avatarUrl}
                charName={charName}
                reactionText={reactionText}
                reactionVisible={reactionVisible}
                playerStoneCount={gomokuStoneCounts.player}
                charStoneCount={gomokuStoneCounts.ai}
                playerGoesFirst={playerGoesFirst}
                aiThinking={aiThinking}
                gameOver={showSettlement}
              />
            ) : null}
            <div className="relative flex w-full max-w-[min(88vw,400px)] items-center justify-center">
              {isGomoku && firstMoveDrawDone ? (
                <GameView
                  key={`${inviteId ?? 'gomoku'}-${playerGoesFirst ? 'player' : 'char'}`}
                  gameType={gameType}
                  emitEvent={wrappedEmitEvent}
                  gomokuProps={{
                    difficulty: gomokuDifficulty,
                    pickThinkDelayMs,
                    setAiThinking,
                    getGomokuDifficulty,
                    setupReady: gomokuBoardReady,
                    playerGoesFirst,
                    onStoneCountsChange: handleGomokuStoneCountsChange,
                  }}
                />
              ) : !isGomoku ? (
                <GameView gameType={gameType} emitEvent={wrappedEmitEvent} />
              ) : (
                <div className="aspect-square w-full max-w-[min(88vw,400px)] rounded-2xl bg-[#E8DCC8]/40" />
              )}
              <GomokuFirstMoveDraw
                open={showFirstMoveDraw}
                playerAvatarUrl={playerAvatarUrl}
                charAvatarUrl={avatarUrl}
                charName={charName}
                onComplete={handleFirstMoveDrawComplete}
              />
            </div>
            <GameResultOverlay
              open={showSettlement}
              gameType={gameType}
              charName={charName}
              charAvatarUrl={avatarUrl}
              result={settlementResult}
              reactionText={settlementReactionText ?? reactionText}
              onReturn={handleSettlementReturn}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
