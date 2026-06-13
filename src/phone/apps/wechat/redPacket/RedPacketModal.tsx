import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'

const PLATINUM = '#D4AF37'
const PLATINUM_SOFT = 'rgba(212, 175, 55, 0.28)'

function formatYuan(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 暗金几何圆扣（非「開」字金币） */
function PlatinumSealButton({
  disabled,
  onActivate,
}: {
  disabled: boolean
  onActivate: () => void
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onActivate}
      className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full outline-none active:scale-[0.97] disabled:pointer-events-none"
      style={{
        background: 'radial-gradient(circle at 32% 28%, #4a4234 0%, #2a2620 42%, #1a1814 100%)',
        boxShadow: `
          0 0 0 1px ${PLATINUM_SOFT},
          0 8px 28px rgba(15, 23, 42, 0.18),
          inset 0 1px 0 rgba(255,255,255,0.12)
        `,
      }}
      aria-label="拆开红包"
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full animate-pulse opacity-90"
        style={{
          boxShadow: `0 0 22px 4px rgba(212, 175, 55, 0.22)`,
        }}
        aria-hidden
      />
      <svg viewBox="0 0 40 40" className="relative h-8 w-8" aria-hidden>
        <circle cx="20" cy="20" r="16" fill="none" stroke={PLATINUM} strokeOpacity={0.45} strokeWidth="1" />
        <circle cx="20" cy="20" r="10" fill="none" stroke={PLATINUM} strokeOpacity={0.35} strokeWidth="0.85" />
        <path d="M20 10 L26 26 L14 26 Z" fill="none" stroke={PLATINUM} strokeOpacity={0.5} strokeWidth="1" strokeLinejoin="round" />
      </svg>
    </motion.button>
  )
}

type CeremonyPhase = 'idle' | 'seal_spin' | 'reveal' | 'fade_out'

/**
 * 浅色铂金拆红包：毛玻璃遮罩 + 修长信封 + 暗金圆扣 Y 轴翻转，随后信封上掀露出金额。
 */
export function RedPacketModal({
  open,
  amountYuan,
  remark,
  senderName,
  senderAvatarUrl,
  subcaption,
  onClose,
  onFlowComplete,
}: {
  open: boolean
  amountYuan: number
  remark: string
  senderAvatarUrl?: string
  senderName: string
  subcaption?: string
  onClose: () => void
  onFlowComplete: () => void | Promise<void>
}) {
  const [phase, setPhase] = useState<CeremonyPhase>('idle')
  const finishedRef = useRef(false)
  const flowRef = useRef(onFlowComplete)
  flowRef.current = onFlowComplete

  useEffect(() => {
    if (!open) {
      setPhase('idle')
      finishedRef.current = false
    }
  }, [open])

  const runComplete = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    void Promise.resolve(flowRef.current()).catch(() => {})
  }, [])

  const startCeremony = useCallback(() => {
    if (phase !== 'idle' || finishedRef.current) return
    setPhase('seal_spin')
  }, [phase])

  useEffect(() => {
    if (phase !== 'seal_spin') return
    const t = window.setTimeout(() => setPhase('reveal'), 800)
    return () => window.clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'reveal') return
    const t = window.setTimeout(() => setPhase('fade_out'), 720)
    return () => window.clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'fade_out') return
    const t = window.setTimeout(() => runComplete(), 420)
    return () => window.clearTimeout(t)
  }, [phase, runComplete])

  useEffect(() => {
    if (!open || phase === 'idle') return
    const t = window.setTimeout(() => runComplete(), 3200)
    return () => window.clearTimeout(t)
  }, [open, phase, runComplete])

  const amtLine = `¥ ${formatYuan(amountYuan)}`

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="rp-overlay"
          role="presentation"
          className="fixed inset-0 z-[210] flex items-center justify-center bg-[#f4f4f6] px-5 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'fade_out' ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: phase === 'fade_out' ? 0.38 : 0.28 }}
          style={{
            paddingTop: 'max(16px, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && phase === 'idle') onClose()
          }}
        >
          <motion.div
            layout
            className="relative w-full max-w-[300px]"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{
              opacity: phase === 'fade_out' ? 0 : 1,
              y: phase === 'fade_out' ? -8 : 0,
              scale: phase === 'fade_out' ? 0.96 : 1,
            }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-5 text-center">
              <p className="text-[10px] font-semibold tracking-[0.26em] text-[#64748B]">RED PACKET</p>
              <div className="mt-4 flex flex-col items-center gap-2">
                {senderAvatarUrl?.trim() ? (
                  <img
                    src={senderAvatarUrl.trim()}
                    alt=""
                    className="h-12 w-12 rounded-2xl border border-[#D4AF37]/25 object-cover shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-[15px] text-gray-400">
                    ?
                  </div>
                )}
                <p className="max-w-[260px] truncate text-[15px] font-medium text-[#1e293b]">{senderName}</p>
              </div>
              <p className="mx-auto mt-4 max-w-[260px] text-[13px] leading-relaxed text-[#64748B]">
                {remark.trim() || 'Best Wishes'}
              </p>
              {subcaption?.trim() ? (
                <p className="mx-auto mt-2 max-w-[260px] text-center text-[11px] leading-relaxed text-[#94a3b8]">
                  {subcaption.trim()}
                </p>
              ) : null}
            </div>

            {/* 修长竖向信封 */}
            <div
              className="relative mx-auto mt-2 w-[min(200px,52vw)] overflow-visible rounded-[18px] border border-[#D4AF37]/28 bg-gradient-to-b from-white via-white to-[#f8fafc] shadow-[0_10px_40px_rgba(212,175,55,0.1)]"
              style={{ minHeight: 260, perspective: 1100 }}
            >
              <div
                className="pointer-events-none absolute inset-x-3 top-2 h-px rounded-full opacity-70"
                style={{
                  background: `linear-gradient(90deg, transparent, ${PLATINUM}55, transparent)`,
                }}
              />

              {/* 内层金额（拆封后） */}
              <motion.div
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-10"
                initial={false}
                animate={{
                  opacity: phase === 'reveal' || phase === 'fade_out' ? 1 : 0,
                  y: phase === 'reveal' || phase === 'fade_out' ? 0 : 8,
                }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-[11px] font-medium tracking-[0.2em] text-[#94a3b8]">AMOUNT</p>
                <p className="mt-2 text-[28px] tabular-nums tracking-tight text-[#1e293b]">
                  {amtLine}
                </p>
              </motion.div>

              {/* 上盖：向上掀开 */}
              <motion.div
                className="absolute inset-x-0 top-0 z-[1] rounded-t-[18px] border-b border-[#D4AF37]/15 bg-gradient-to-b from-white to-[#f1f5f9]"
                style={{
                  height: '52%',
                  transformOrigin: '50% 0%',
                  transformStyle: 'preserve-3d',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
                }}
                initial={false}
                animate={{
                  rotateX: phase === 'reveal' || phase === 'fade_out' ? -118 : 0,
                }}
                transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
              />

              {/* 圆扣层 */}
              <motion.div
                className="absolute inset-0 z-[2] flex items-center justify-center"
                style={{ perspective: 900 }}
                initial={false}
                animate={{
                  opacity: phase === 'idle' || phase === 'seal_spin' ? 1 : 0,
                  pointerEvents: phase === 'idle' || phase === 'seal_spin' ? 'auto' : 'none',
                }}
                transition={{ duration: 0.25 }}
              >
                <motion.div
                  animate={{ rotateY: phase === 'idle' ? 0 : 360 }}
                  transition={
                    phase === 'idle'
                      ? { duration: 0 }
                      : { duration: 0.8, ease: [0.33, 0.9, 0.32, 1] }
                  }
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <PlatinumSealButton disabled={phase !== 'idle'} onActivate={startCeremony} />
                </motion.div>
              </motion.div>

              <p className="pointer-events-none absolute bottom-3 inset-x-0 text-center text-[10px] tracking-[0.18em] text-[#94a3b8]">
                PLATINUM SEAL
              </p>
            </div>

            <p className="mt-4 text-center text-[10px] tracking-[0.16em] text-[#94a3b8]">轻触圆扣以启封</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
