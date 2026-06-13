import { useEffect, useState, type RefObject } from 'react'

import { isIOSWebKit } from '../utils/platform'
import {
  findFocusedEditableWithin,
  measureAndroidFocusLiftPx,
  measureAndroidKeyboardPadPx,
  measureComposerOverlapPx,
} from './keyboardInset'

export type KeyboardInsetMetrics = {
  /** 滚动区底部留白 / 白底高度 */
  padPx: number
  /** 整块 translate 抬升（仅刚好露出输入框） */
  liftPx: number
}

const ZERO_METRICS: KeyboardInsetMetrics = { padPx: 0, liftPx: 0 }

/**
 * 软键盘占用：iOS 不在此 hook 处理；Android 区分 pad（留白）与 lift（抬升）。
 */
export function useKeyboardInset(
  composerRef?: RefObject<HTMLElement | null>,
): KeyboardInsetMetrics {
  const [metrics, setMetrics] = useState<KeyboardInsetMetrics>(ZERO_METRICS)

  useEffect(() => {
    if (isIOSWebKit()) {
      setMetrics(ZERO_METRICS)
      return
    }

    const vv = window.visualViewport
    if (!vv) return

    const nav = navigator as Navigator & {
      virtualKeyboard?: {
        addEventListener?: (type: 'geometrychange', listener: () => void) => void
        removeEventListener?: (type: 'geometrychange', listener: () => void) => void
      }
    }
    const virtualKeyboard = nav.virtualKeyboard

    const update = () => {
      const focused = findFocusedEditableWithin(composerRef?.current ?? null)
      if (!focused) {
        setMetrics((prev) => (prev.padPx === 0 && prev.liftPx === 0 ? prev : ZERO_METRICS))
        return
      }

      let padPx = measureAndroidKeyboardPadPx()
      const liftPx = measureAndroidFocusLiftPx(focused)

      if (padPx <= 0 && liftPx > 0) {
        padPx = liftPx
      }

      const overlap = measureComposerOverlapPx(focused)
      if (overlap > padPx) padPx = overlap

      const cap = Math.round(Math.max(window.innerHeight || 0, vv.height) * 0.42)
      padPx = Math.min(padPx, cap)

      setMetrics((prev) => {
        if (Math.abs(prev.padPx - padPx) < 4 && Math.abs(prev.liftPx - liftPx) < 4) return prev
        return { padPx, liftPx }
      })
    }

    const onFocusChange = () => {
      update()
      window.setTimeout(update, 120)
      window.setTimeout(update, 320)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    virtualKeyboard?.addEventListener?.('geometrychange', update)
    window.addEventListener('orientationchange', update)
    document.addEventListener('focusin', onFocusChange, true)
    document.addEventListener('focusout', onFocusChange, true)

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      virtualKeyboard?.removeEventListener?.('geometrychange', update)
      window.removeEventListener('orientationchange', update)
      document.removeEventListener('focusin', onFocusChange, true)
      document.removeEventListener('focusout', onFocusChange, true)
    }
  }, [composerRef])

  return metrics
}
