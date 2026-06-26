import { animate, motion, useMotionValue } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

const SWIPE_ACTION_W = 72
const SWIPE_SPRING = { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.85 }
const SWIPE_DRAG_THRESHOLD = 7
const SWIPE_COMMIT_RATIO = 0.28
const SWIPE_FLING_PX_PER_SEC = 520

export function TasteSwipeDeleteRow({
  rowId,
  swipeOpen,
  onSwipeOpenChange,
  onDelete,
  children,
}: {
  rowId: string
  swipeOpen: boolean
  onSwipeOpenChange: (open: boolean) => void
  onDelete: () => void
  children: ReactNode
}) {
  const x = useMotionValue(0)
  const pointerIdRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const startClientXRef = useRef(0)
  const startClientYRef = useRef(0)
  const startXRef = useRef(0)
  const startOpenRef = useRef(false)
  const samplesRef = useRef<Array<{ t: number; clientX: number }>>([])

  useEffect(() => {
    void animate(x, swipeOpen ? -SWIPE_ACTION_W : 0, SWIPE_SPRING)
  }, [swipeOpen, x, rowId])

  const endDrag = () => {
    draggingRef.current = false
    const cur = x.get()
    const samples = samplesRef.current
    let vx = 0
    if (samples.length >= 2) {
      const a = samples[samples.length - 2]!
      const b = samples[samples.length - 1]!
      const dt = Math.max(1, b.t - a.t)
      vx = ((b.clientX - a.clientX) / dt) * 1000
    }
    const startOpen = startOpenRef.current
    let shouldOpen = startOpen
    if (!startOpen) {
      if (cur <= -SWIPE_ACTION_W * SWIPE_COMMIT_RATIO || vx < -SWIPE_FLING_PX_PER_SEC) {
        shouldOpen = true
      }
    } else if (cur >= -SWIPE_ACTION_W * (1 - SWIPE_COMMIT_RATIO) || vx > SWIPE_FLING_PX_PER_SEC) {
      shouldOpen = false
    }
    onSwipeOpenChange(shouldOpen)
    void animate(x, shouldOpen ? -SWIPE_ACTION_W : 0, SWIPE_SPRING)
    samplesRef.current = []
  }

  const runDelete = () => {
    onSwipeOpenChange(false)
    void animate(x, 0, SWIPE_SPRING)
    onDelete()
  }

  return (
    <div data-swipe-row-root className="relative overflow-hidden rounded-2xl">
      <div
        className="absolute inset-y-0 right-0 z-0 flex bg-[#fa5151]"
        style={{ width: SWIPE_ACTION_W }}
        aria-hidden={!swipeOpen}
      >
        <button
          type="button"
          data-swipe-action
          className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-white transition-colors active:bg-[#e04545]"
          onClick={runDelete}
          aria-label="删除"
        >
          <Trash2 className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>删除</span>
        </button>
      </div>

      <motion.div
        className="relative z-[1] touch-pan-y"
        style={{ x }}
        onPointerDownCapture={(e) => {
          if ((e.target as HTMLElement).closest('[data-swipe-action]')) return
          pointerIdRef.current = e.pointerId
          draggingRef.current = false
          startClientXRef.current = e.clientX
          startClientYRef.current = e.clientY
          startXRef.current = x.get()
          startOpenRef.current = swipeOpen
          samplesRef.current = [{ t: performance.now(), clientX: e.clientX }]
        }}
        onPointerMoveCapture={(e) => {
          if (pointerIdRef.current !== e.pointerId) return
          const dx = e.clientX - startClientXRef.current
          const dy = e.clientY - startClientYRef.current
          if (!draggingRef.current) {
            if (Math.abs(dx) < SWIPE_DRAG_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return
            draggingRef.current = true
            try {
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            } catch {
              /* ignore */
            }
          }
          e.preventDefault()
          const now = performance.now()
          const samples = samplesRef.current
          samples.push({ t: now, clientX: e.clientX })
          if (samples.length > 6) samples.splice(0, samples.length - 6)
          let next = startXRef.current + dx
          const min = -SWIPE_ACTION_W
          const max = 0
          const rubber = 0.22
          if (next > max) next = max + (next - max) * rubber
          else if (next < min) next = min + (next - min) * rubber
          x.set(next)
        }}
        onPointerUpCapture={(e) => {
          if (pointerIdRef.current !== e.pointerId) return
          pointerIdRef.current = null
          try {
            ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
          } catch {
            /* ignore */
          }
          if (draggingRef.current) endDrag()
        }}
        onPointerCancelCapture={(e) => {
          if (pointerIdRef.current !== e.pointerId) return
          pointerIdRef.current = null
          if (draggingRef.current) endDrag()
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
