import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

import { useJBSFlow } from './JBSFlowEngine'
import { ClueCollector } from './ClueCollector'
import { CLUE_DISCOVERY_TOAST_MS, ClueDiscoveryToast } from './ClueDiscoveryToast'

export type ClueCollectorLayerProps = {
  collectTargetRef: React.RefObject<HTMLElement | null>
}

type RevealPhase = 'toast' | 'card'

/** 管理飞牌队列：每批线索仅一次「发现新线索」，随后逐张收牌 */
export function ClueCollectorLayer({ collectTargetRef }: ClueCollectorLayerProps) {
  const {
    clues,
    activeDispersalClueId,
    completeClueDispersal,
    pendingDiscoveryToast,
    dispersalBatchSize,
    acknowledgeDiscoveryToast,
  } = useJBSFlow()
  const clue = clues.find((c) => c.id === activeDispersalClueId)
  const handledRef = useRef<string | null>(null)
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('card')

  useEffect(() => {
    handledRef.current = null
    if (!activeDispersalClueId) return

    if (pendingDiscoveryToast) {
      setRevealPhase('toast')
      const timer = window.setTimeout(() => {
        acknowledgeDiscoveryToast()
        setRevealPhase('card')
      }, CLUE_DISCOVERY_TOAST_MS)
      return () => window.clearTimeout(timer)
    }

    setRevealPhase('card')
  }, [activeDispersalClueId, acknowledgeDiscoveryToast, pendingDiscoveryToast])

  if (!clue || !activeDispersalClueId) return null

  return (
    <>
      <AnimatePresence>
        {revealPhase === 'toast' ? (
          <ClueDiscoveryToast key="discovery-batch" clueCount={dispersalBatchSize} />
        ) : null}
      </AnimatePresence>
      {revealPhase === 'card' ? (
        <ClueCollector
          key={activeDispersalClueId}
          clue={clue}
          collectTargetRef={collectTargetRef}
          onCollectComplete={(id) => {
            if (handledRef.current === id) return
            handledRef.current = id
            completeClueDispersal(id)
          }}
        />
      ) : null}
    </>
  )
}
