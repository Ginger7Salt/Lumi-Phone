import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import type { ApiConfig } from '../../../api/types'
import { Pressable } from '../../../../components/Pressable'
import { useSimulatorStore } from '../useSimulatorStore'

function ScheduleActionSheet({
  open,
  busy,
  canAct,
  scoutCandidate,
  artistName,
  onClose,
  onRecruit,
  onNegotiate,
  onPromo,
}: {
  open: boolean
  busy: boolean
  canAct: boolean
  scoutCandidate: { name: string } | null
  artistName: string
  onClose: () => void
  onRecruit: () => void
  onNegotiate: () => void
  onPromo: () => void
}) {
  const disabled = !canAct || busy

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="absolute inset-0 z-[88] bg-black/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="关闭行动菜单"
            onClick={onClose}
          />
          <motion.div
            className="sm-schedule-action-sheet absolute inset-x-0 bottom-0 z-[89] px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-4"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-rose-200" aria-hidden />
            <p className="sm-serif text-center text-[16px] font-semibold text-[#2D2422]">今日安排</p>
            <p className="mt-1 text-center text-[12px] text-stone-500">每次行动推进四小时，每日共六次</p>
            <div className="mt-4 space-y-2.5">
              <Pressable
                disabled={disabled}
                onClick={onRecruit}
                className="sm-btn-primary w-full text-center text-[15px] disabled:opacity-40"
              >
                招募艺人{scoutCandidate ? ` · ${scoutCandidate.name}` : ''}
              </Pressable>
              <Pressable
                disabled={disabled || !artistName}
                onClick={onNegotiate}
                className="sm-btn-ghost w-full text-center text-[15px] disabled:opacity-40"
              >
                洽谈通告 · {artistName || '—'}
              </Pressable>
              <Pressable
                disabled={disabled}
                onClick={onPromo}
                className="sm-btn-ghost w-full text-center text-[15px] disabled:opacity-40"
              >
                舆论宣发
              </Pressable>
            </div>
            <Pressable onClick={onClose} className="mt-3 w-full py-2.5 text-center text-[14px] text-stone-500">
              取消
            </Pressable>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

export function ScheduleActionFab({ mainApi }: { mainApi: ApiConfig | null }) {
  const artists = useSimulatorStore((s) => s.artists)
  const selectedArtistId = useSimulatorStore((s) => s.selectedArtistId)
  const canAct = useSimulatorStore((s) => s.canAct)
  const scoutCandidate = useSimulatorStore((s) => s.scoutCandidate)
  const recruitArtist = useSimulatorStore((s) => s.recruitArtist)
  const negotiateGig = useSimulatorStore((s) => s.negotiateGig)
  const promoCampaign = useSimulatorStore((s) => s.promoCampaign)

  const [busy, setBusy] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const artist = artists.find((a) => a.id === selectedArtistId) ?? artists[0]

  async function run(fn: () => Promise<boolean> | boolean) {
    if (busy || !canAct()) return
    setBusy(true)
    try {
      await fn()
      setActionOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom,0px))] z-[85] flex justify-center">
        <Pressable
          disabled={busy}
          onClick={() => setActionOpen(true)}
          className="sm-schedule-fab pointer-events-auto disabled:opacity-40"
          aria-label="安排行程"
        >
          {busy ? '处理中…' : '安排行程'}
        </Pressable>
      </div>

      <ScheduleActionSheet
        open={actionOpen}
        busy={busy}
        canAct={canAct()}
        scoutCandidate={scoutCandidate}
        artistName={artist?.name ?? ''}
        onClose={() => setActionOpen(false)}
        onRecruit={() => void run(() => recruitArtist())}
        onNegotiate={() => void run(() => negotiateGig(artist!.id, mainApi))}
        onPromo={() => void run(() => promoCampaign(mainApi))}
      />
    </>
  )
}
