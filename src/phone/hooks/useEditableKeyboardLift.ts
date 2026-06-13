import { useEffect, type RefObject } from 'react'

import { isIOSWebKit } from '../utils/platform'
import { ensureElementVisibleAboveKeyboard, isAndroidWeb } from './keyboardInset'
import { useKeyboardInset, type KeyboardInsetMetrics } from './useKeyboardInset'

const ZERO: KeyboardInsetMetrics = { padPx: 0, liftPx: 0 }

/**
 * Android 软键盘：返回 padPx（滚动留白）与 liftPx（整块抬升）。
 * iOS 返回全 0，各页保留原有 visualViewport 逻辑。
 */
export function useEditableKeyboardLift(
  anchorRef: RefObject<HTMLElement | null>,
  editableRef?: RefObject<HTMLElement | null>,
): KeyboardInsetMetrics {
  const metrics = useKeyboardInset(anchorRef)
  if (isIOSWebKit()) return ZERO

  useEffect(() => {
    if (!isAndroidWeb()) return
    const root = anchorRef.current
    if (!root) return

    const resolveEditable = () => editableRef?.current ?? root.querySelector('textarea, input:not([type=hidden])')

    const nudgeVisible = () => {
      const el = resolveEditable()
      if (!el || !(el instanceof HTMLElement)) return
      if (document.activeElement !== el && !el.contains(document.activeElement)) return
      ensureElementVisibleAboveKeyboard(el)
    }

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target
      if (!(t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement)) return
      if (!root.contains(t)) return
      requestAnimationFrame(nudgeVisible)
      window.setTimeout(nudgeVisible, 120)
    }

    root.addEventListener('focusin', onFocusIn)
    return () => root.removeEventListener('focusin', onFocusIn)
  }, [anchorRef, editableRef])

  useEffect(() => {
    if (!isAndroidWeb() || metrics.padPx <= 0) return
    const el = editableRef?.current ?? anchorRef.current
    if (!el) return
    if (document.activeElement !== el && !el.contains(document.activeElement)) return
    requestAnimationFrame(() => ensureElementVisibleAboveKeyboard(el))
    window.setTimeout(() => ensureElementVisibleAboveKeyboard(el), 180)
  }, [metrics.padPx, anchorRef, editableRef])

  return metrics
}
