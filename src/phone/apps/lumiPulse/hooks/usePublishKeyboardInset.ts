import { useEffect, useRef, useState } from 'react'

import {
  computeWeChatStyleKeyboardInset,
  findFocusedEditableWithin,
  measureComposerOverlapPx,
} from '../../../hooks/keyboardInset'

function isComposerFocused(root: HTMLElement | null): boolean {
  return Boolean(findFocusedEditableWithin(root))
}

/**
 * 发布页 / 评论底栏：软键盘弹起时底部抬升量。
 * 与微信 ChatRoom 同源（baseline + overlap），并识别 contentEditable。
 */
export function usePublishKeyboardInset(active: boolean) {
  const [keyboardPadPx, setKeyboardPadPx] = useState(0)
  const composerRef = useRef<HTMLDivElement>(null)
  const baselineRef = useRef({ current: 0 })

  useEffect(() => {
    if (!active) {
      setKeyboardPadPx(0)
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

    let rafId: number | null = null

    const measure = () => {
      rafId = null
      const root = composerRef.current
      if (!isComposerFocused(root)) {
        setKeyboardPadPx((prev) => (prev === 0 ? prev : 0))
        return
      }
      const fromVv = computeWeChatStyleKeyboardInset(baselineRef.current)
      const overlap = measureComposerOverlapPx(root)
      const next = Math.max(0, Math.round(Math.max(fromVv, overlap)))
      setKeyboardPadPx((prev) => (Math.abs(prev - next) < 4 ? prev : next))
    }

    const schedule = () => {
      if (rafId != null) return
      rafId = window.requestAnimationFrame(measure)
    }

    const onFocusChange = () => {
      schedule()
      window.setTimeout(schedule, 80)
      window.setTimeout(schedule, 220)
      window.setTimeout(schedule, 400)
    }

    measure()
    vv.addEventListener('resize', schedule)
    vv.addEventListener('scroll', schedule)
    virtualKeyboard?.addEventListener?.('geometrychange', schedule)
    window.addEventListener('orientationchange', schedule)
    document.addEventListener('focusin', onFocusChange, true)
    document.addEventListener('focusout', onFocusChange, true)

    return () => {
      if (rafId != null) window.cancelAnimationFrame(rafId)
      vv.removeEventListener('resize', schedule)
      vv.removeEventListener('scroll', schedule)
      virtualKeyboard?.removeEventListener?.('geometrychange', schedule)
      window.removeEventListener('orientationchange', schedule)
      document.removeEventListener('focusin', onFocusChange, true)
      document.removeEventListener('focusout', onFocusChange, true)
    }
  }, [active])

  return {
    composerRef,
    keyboardPadPx,
  }
}
