import { useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'

type LongPressOptions = {
  delay?: number
  moveTolerance?: number
  onLongPress: (event: ReactPointerEvent<HTMLElement>) => void
}

type PointerHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onPointerLeave: () => void
}

export function useLongPress({
  delay = 500,
  moveTolerance = 10,
  onLongPress,
}: LongPressOptions): PointerHandlers {
  const timerRef = useRef<number | null>(null)
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const firedRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    originRef.current = null
    firedRef.current = false
  }, [])

  const handlers = useMemo<PointerHandlers>(() => ({
    onPointerDown: (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      clear()
      originRef.current = { x: event.clientX, y: event.clientY }
      timerRef.current = window.setTimeout(() => {
        firedRef.current = true
        onLongPress(event)
        clear()
      }, delay)
    },
    onPointerMove: (event) => {
      if (!originRef.current || firedRef.current) return
      const dx = event.clientX - originRef.current.x
      const dy = event.clientY - originRef.current.y
      if (Math.hypot(dx, dy) > moveTolerance) {
        clear()
      }
    },
    onPointerUp: () => {
      clear()
    },
    onPointerCancel: () => {
      clear()
    },
    onPointerLeave: () => {
      clear()
    },
  }), [clear, delay, moveTolerance, onLongPress])

  return handlers
}
