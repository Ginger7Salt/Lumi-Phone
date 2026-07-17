import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

import {
  computeWeChatStyleKeyboardInset,
  findFocusedEditableWithin,
  measureComposerOverlapPx,
} from '../../../hooks/keyboardInset'

export type PulseCommentKeyboardLayout = {
  /** 贴到 visualViewport 时绑在全屏容器上 */
  sheetStyle: CSSProperties | undefined
  /** 盖在键盘上的底栏抬升（overlay 模式） */
  barLiftPx: number
  /** 列表底部额外留白 */
  scrollPadPx: number
}

/**
 * 微博详情评论 / 私信：键盘避让。
 * 1) visualViewport 收缩 → 整页高度贴合可见区（输入栏自然贴在键盘顶）
 * 2) 键盘 overlay 不缩视口 → 仅把底栏 translate 抬起
 * @param onKeyboardLayout 键盘几何变化后回调（用于把聊天气泡贴到输入栏上方）
 */
export function usePulseCommentKeyboardLayout(
  sheetRef: RefObject<HTMLElement | null>,
  barRef: RefObject<HTMLElement | null>,
  onKeyboardLayout?: () => void,
): PulseCommentKeyboardLayout {
  const [sheetBox, setSheetBox] = useState<{ top: number; height: number } | null>(null)
  const [barLiftPx, setBarLiftPx] = useState(0)
  const baselineRef = useRef({ current: 0 })
  const onLayoutRef = useRef(onKeyboardLayout)
  onLayoutRef.current = onKeyboardLayout

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const seedBaseline = () => {
      const cssVhRaw = window.getComputedStyle(document.documentElement).getPropertyValue('--app-vh')
      const cssVh = Number.parseFloat(cssVhRaw)
      const candidate = Math.max(
        window.innerHeight || 0,
        document.documentElement.clientHeight || 0,
        Number.isFinite(cssVh) ? Math.round(cssVh) : 0,
        Math.round(vv.height + vv.offsetTop),
      )
      if (candidate > baselineRef.current.current) {
        baselineRef.current.current = candidate
      }
    }
    seedBaseline()

    const nav = navigator as Navigator & {
      virtualKeyboard?: {
        addEventListener?: (type: 'geometrychange', listener: () => void) => void
        removeEventListener?: (type: 'geometrychange', listener: () => void) => void
      }
    }
    const virtualKeyboard = nav.virtualKeyboard
    let rafId: number | null = null

    const notifyLayout = () => {
      const cb = onLayoutRef.current
      if (!cb) return
      cb()
      window.setTimeout(cb, 60)
      window.setTimeout(cb, 160)
      window.setTimeout(cb, 320)
    }

    const measure = () => {
      rafId = null
      seedBaseline()

      const focused = findFocusedEditableWithin(barRef.current)
      const vvShrink = Math.max(0, Math.round(baselineRef.current.current - vv.height - vv.offsetTop))
      const fromVv = focused ? computeWeChatStyleKeyboardInset(baselineRef.current) : 0
      const overlap = focused ? measureComposerOverlapPx(barRef.current) : 0
      // iOS：视口收缩；Android overlay：inset/overlap 也会起来 —— 都把整页贴到可见区顶部
      const pinToViewport =
        Boolean(focused) && (vvShrink > 40 || fromVv > 40 || overlap > 40)

      if (pinToViewport) {
        const kbInset = Math.max(vvShrink, fromVv, overlap)
        // 视口收缩：贴 visualViewport；overlay：总高减去键盘抬升，顶边贴可视区顶
        const next = {
          top: Math.max(0, Math.round(vv.offsetTop)),
          height: Math.max(
            120,
            Math.round(
              vvShrink > 40
                ? vv.height
                : Math.max(120, baselineRef.current.current - vv.offsetTop - kbInset),
            ),
          ),
        }
        setSheetBox((prev) =>
          prev && prev.top === next.top && prev.height === next.height ? prev : next,
        )
        setBarLiftPx(0)
        // 直接写 DOM，避免 framer-motion / React 批处理延迟一帧仍被挡住
        const sheet = sheetRef.current
        if (sheet) {
          sheet.style.top = `${next.top}px`
          sheet.style.height = `${next.height}px`
          sheet.style.bottom = 'auto'
          sheet.style.left = '0'
          sheet.style.right = '0'
        }
        const bar = barRef.current
        if (bar) {
          bar.style.transform = ''
          bar.style.willChange = ''
        }
        notifyLayout()
        return
      }

      setSheetBox((prev) => (prev ? null : prev))
      const sheet = sheetRef.current
      if (sheet) {
        sheet.style.top = ''
        sheet.style.height = ''
        sheet.style.bottom = ''
        sheet.style.left = ''
        sheet.style.right = ''
      }

      if (!focused) {
        setBarLiftPx((prev) => (prev === 0 ? prev : 0))
        const bar = barRef.current
        if (bar) {
          bar.style.transform = ''
          bar.style.willChange = ''
          bar.style.paddingBottom = 'max(12px, env(safe-area-inset-bottom, 0px))'
        }
        return
      }

      const nextLift = Math.max(0, Math.round(Math.max(fromVv, overlap, vvShrink)))
      setBarLiftPx((prev) => (Math.abs(prev - nextLift) < 4 ? prev : nextLift))
      const bar = barRef.current
      if (bar) {
        if (nextLift > 0) {
          bar.style.transform = `translate3d(0, -${nextLift}px, 0)`
          bar.style.willChange = 'transform'
          bar.style.paddingBottom = '12px'
        } else {
          bar.style.transform = ''
          bar.style.willChange = ''
          bar.style.paddingBottom = 'max(12px, env(safe-area-inset-bottom, 0px))'
        }
      }
      if (nextLift > 0) notifyLayout()
    }

    const schedule = () => {
      if (rafId != null) return
      rafId = window.requestAnimationFrame(measure)
    }

    const onFocusChange = () => {
      schedule()
      window.setTimeout(schedule, 60)
      window.setTimeout(schedule, 160)
      window.setTimeout(schedule, 320)
      window.setTimeout(schedule, 480)
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
      const sheet = sheetRef.current
      if (sheet) {
        sheet.style.top = ''
        sheet.style.height = ''
        sheet.style.bottom = ''
        sheet.style.left = ''
        sheet.style.right = ''
      }
      const bar = barRef.current
      if (bar) {
        bar.style.transform = ''
        bar.style.willChange = ''
        bar.style.paddingBottom = ''
      }
    }
  }, [barRef, sheetRef])

  const sheetStyle: CSSProperties | undefined = sheetBox
    ? {
        top: sheetBox.top,
        height: sheetBox.height,
        bottom: 'auto',
      }
    : undefined

  return {
    sheetStyle,
    barLiftPx,
    scrollPadPx: barLiftPx,
  }
}
