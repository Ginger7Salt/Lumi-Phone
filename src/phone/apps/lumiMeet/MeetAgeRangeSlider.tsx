import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'

type Props = {
  minBound?: number
  maxBound?: number
  low: number
  high: number
  onChange: (low: number, high: number) => void
  className?: string
}

/** 极细双端年龄轨（铂金柄） */
export function MeetAgeRangeSlider({
  minBound = 18,
  maxBound = 55,
  low,
  high,
  onChange,
  className = '',
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<'low' | 'high' | null>(null)

  const clamp = useCallback(
    (v: number) => Math.max(minBound, Math.min(maxBound, Math.round(v))),
    [minBound, maxBound],
  )

  const posFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return low
      const r = el.getBoundingClientRect()
      const u = (clientX - r.left) / Math.max(1, r.width)
      return clamp(minBound + u * (maxBound - minBound))
    },
    [clamp, low, maxBound, minBound],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const mode = draggingRef.current
      if (!mode) return
      const x = posFromClientX(e.clientX)
      const gap = 2
      if (mode === 'low') {
        const nextLow = Math.min(x, high - gap)
        onChange(clamp(nextLow), high)
      } else {
        const nextHigh = Math.max(x, low + gap)
        onChange(low, clamp(nextHigh))
      }
    },
    [clamp, high, low, onChange, posFromClientX],
  )

  const endDrag = useCallback(() => {
    draggingRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
    window.removeEventListener('pointercancel', endDrag)
  }, [onPointerMove])

  const startDrag = useCallback(
    (mode: 'low' | 'high') => (ev: ReactPointerEvent<HTMLButtonElement>) => {
      ev.preventDefault()
      draggingRef.current = mode
      ;(ev.target as HTMLElement).setPointerCapture(ev.pointerId)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', endDrag)
      window.addEventListener('pointercancel', endDrag)
    },
    [endDrag, onPointerMove],
  )

  const pct = (v: number) => ((v - minBound) / Math.max(1, maxBound - minBound)) * 100

  return (
    <div className={`select-none touch-none ${className}`}>
      <p className="mb-3 text-center font-mono text-[11px] tracking-wide text-[#5c574f]">
        {low} – {high}{' '}
        <span className="font-serif text-[12px] font-light italic text-[#8a8278]">岁</span>
      </p>
      <div
        ref={trackRef}
        className="relative mx-auto h-px w-full max-w-[280px] bg-gray-200"
        style={{ marginTop: 14, marginBottom: 14 }}
      >
        <div
          className="absolute top-1/2 h-px -translate-y-1/2 bg-[#D4AF37]/55"
          style={{
            left: `${pct(low)}%`,
            width: `${Math.max(0, pct(high) - pct(low))}%`,
          }}
        />
        <button
          type="button"
          aria-label="最小年龄"
          onPointerDown={startDrag('low')}
          className="absolute top-1/2 z-[2] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#D4AF37]/90 bg-white shadow-[0_0_0_1px_rgba(212,175,55,0.35)]"
          style={{ left: `${pct(low)}%` }}
        />
        <button
          type="button"
          aria-label="最大年龄"
          onPointerDown={startDrag('high')}
          className="absolute top-1/2 z-[2] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#D4AF37]/90 bg-white shadow-[0_0_0_1px_rgba(212,175,55,0.35)]"
          style={{ left: `${pct(high)}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider text-gray-400">
        <span>{minBound}</span>
        <span>{maxBound}</span>
      </div>
    </div>
  )
}
