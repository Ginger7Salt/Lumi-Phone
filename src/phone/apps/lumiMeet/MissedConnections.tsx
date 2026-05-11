import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useState } from 'react'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { aiMeetPostMatchOpeningLines } from './lumiMeetAi'
import { computeMeetNpcStaggerDelayMs, sleep, yieldToPaint } from './lumiMeetChatReveal'
import { useLumiMeetStore } from './LumiMeetStore'
import type { EncounterNPC } from './meetTypes'

const BLUR_STYLE = {
  filter: 'blur(4px) grayscale(50%)',
  opacity: 0.4,
} as const

export function MissedConnections() {
  const apiConfig = useCurrentApiConfig('chatCard')
  const { state, rewindMissedToMatched, pushChatMessage, bumpIntimacy } = useLumiMeetStore()
  const missed = state.npcs.filter((n) => n.status === 'missed')
  const charges = state.rewindChargesRemaining

  const [confirmNpc, setConfirmNpc] = useState<EncounterNPC | null>(null)
  const [revealingId, setRevealingId] = useState<string | null>(null)

  const closeModal = useCallback(() => setConfirmNpc(null), [])

  const onConfirmRewind = useCallback(() => {
    if (!confirmNpc) return
    const id = confirmNpc.id
    const npc = confirmNpc
    const ok = rewindMissedToMatched(id)
    if (!ok) {
      closeModal()
      return
    }
    const threadBefore = state.chatThreads[id] ?? []
    bumpIntimacy(id, 22)
    closeModal()
    setRevealingId(id)
    window.setTimeout(() => setRevealingId(null), 1600)
    void (async () => {
      if (!threadBefore.length) {
        const lines = await aiMeetPostMatchOpeningLines({
          apiConfig,
          npc,
          userProfile: state.meetProfile,
        })
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!
          if (i > 0) await sleep(computeMeetNpcStaggerDelayMs(lines[i - 1]!))
          else if (lines.length > 1) await sleep(320)
          pushChatMessage(id, { role: 'npc', content: line })
          await yieldToPaint()
        }
      }
    })()
  }, [
    apiConfig,
    bumpIntimacy,
    closeModal,
    confirmNpc,
    pushChatMessage,
    rewindMissedToMatched,
    state.chatThreads,
    state.meetProfile,
  ])

  if (!missed.length) return null

  return (
    <section className="mt-16 border-t border-black/[0.05] pt-10">
      <div className="mb-6 flex flex-col gap-1">
        <h3 className="meet-caption-en text-[10px] uppercase tracking-[0.42em] text-[#b8b5ad]">
          MISSED CONNECTIONS
        </h3>
        <p className="font-elegant-serif text-[15px] font-medium tracking-[0.06em] text-[#6e6860]">
          擦肩而过
        </p>
        <p className="meet-caption-en text-[9px] tracking-[0.28em] text-[#c9c4bc]">
          Rewinds remaining · {charges}
        </p>
      </div>

      <div className="-mx-1 flex gap-4 overflow-x-auto pb-3 pt-1 [scrollbar-width:thin]">
        {missed.map((n) => {
          const activeReveal = revealingId === n.id
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setConfirmNpc(n)}
              className="relative shrink-0 flex-col items-center focus:outline-none"
              aria-label={`回溯 ${n.nickname}`}
            >
              <motion.div
                className="relative size-[56px] overflow-hidden rounded-[18px] ring-1 ring-black/[0.06]"
                initial={false}
                animate={
                  activeReveal
                    ? {
                        filter: 'blur(0px) grayscale(0%)',
                        opacity: 1,
                        boxShadow:
                          '0 0 0 1px rgba(212,175,140,0.35), 0 12px 40px rgba(200,180,150,0.35)',
                      }
                    : {
                        filter: BLUR_STYLE.filter,
                        opacity: BLUR_STYLE.opacity,
                        boxShadow: 'none',
                      }
                }
                transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <img src={n.avatarUrl} alt="" className="size-full object-cover" draggable={false} />
              </motion.div>
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {confirmNpc ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-6 backdrop-blur-[3px]"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="w-full max-w-[300px] rounded-[22px] border border-white/75 bg-white/88 p-6 shadow-[0_28px_90px_rgba(28,24,18,0.2)] backdrop-blur-xl"
            >
              <p className="font-elegant-serif text-center text-[15px] leading-relaxed text-[#4a4540]">
                要消耗一次回溯机会，重新向他发送心动信号吗？
              </p>
              <p className="meet-caption-en mt-3 text-center text-[10px] tracking-[0.22em] text-[#b0aaa4]">
                Initiate a rewind signal?
              </p>
              <p className="meet-caption-en mt-4 text-center text-[9px] tracking-[0.2em] text-[#c9c4bc]">
                remaining · {charges}
              </p>
              <div className="mt-6 flex gap-3">
                <button type="button" className="meet-btn-secondary flex-1 py-3 text-[12px]" onClick={closeModal}>
                  取消
                </button>
                <button
                  type="button"
                  disabled={charges <= 0}
                  className="meet-btn-primary flex-1 py-3 text-[12px] disabled:opacity-40"
                  onClick={onConfirmRewind}
                >
                  确认
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
