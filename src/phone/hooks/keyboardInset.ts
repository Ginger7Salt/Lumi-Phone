import { isIOSWebKit } from '../utils/platform'

/**
 * 与微信 ChatRoom 一致的软键盘遮挡高度估算（visualViewport baseline）。
 * @see src/phone/apps/wechat/ChatRoom.tsx 内 keyboardInsetPx effect
 */

export function computeWeChatStyleKeyboardInset(baselineRef: { current: number }): number {
  const vv = window.visualViewport
  if (!vv) return 0

  const nav = navigator as Navigator & {
    virtualKeyboard?: { boundingRect?: { height?: number } }
  }
  const vkInset = Math.max(0, Math.round(nav.virtualKeyboard?.boundingRect?.height ?? 0))

  const visible = vv.height + vv.offsetTop
  const cssVhRaw = window.getComputedStyle(document.documentElement).getPropertyValue('--app-vh')
  const cssVh = Number.parseFloat(cssVhRaw)

  const baselineCandidate = Math.max(
    visible,
    Math.round(window.innerHeight || 0),
    Number.isFinite(cssVh) ? Math.round(cssVh) : 0,
  )
  if (baselineCandidate > baselineRef.current) baselineRef.current = baselineCandidate

  let inset = Math.max(
    0,
    Math.round(baselineRef.current - visible),
    Math.round((window.innerHeight || 0) - visible),
    Number.isFinite(cssVh) ? Math.round(cssVh - visible) : 0,
    vkInset,
  )

  inset = Math.min(inset, Math.round((baselineRef.current * 0.6) || 0))
  return inset
}

/** 输入栏底边超出可视区域底部时，补足抬升量（iOS 26 上 baseline 偶发为 0） */
export function measureComposerOverlapPx(el: HTMLElement | null): number {
  const vv = window.visualViewport
  if (!vv || !el) return 0
  const visibleBottom = vv.offsetTop + vv.height
  return Math.max(0, Math.round(el.getBoundingClientRect().bottom - visibleBottom + 8))
}

export function isAndroidMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent)
}

/** Android WebView / Chrome：软键盘常走 overlays-content，visualViewport 不收缩 */
export function isAndroidWeb(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

function readLayoutBottom(vv: VisualViewport): number {
  const cssVhRaw = window.getComputedStyle(document.documentElement).getPropertyValue('--app-vh')
  const cssVh = Number.parseFloat(cssVhRaw)
  return Math.max(
    window.innerHeight || 0,
    Number.isFinite(cssVh) ? cssVh : 0,
    vv.height + vv.offsetTop,
  )
}

/** Android 软键盘高度启发式（visualViewport 不收缩时的兜底） */
export function estimateAndroidKeyboardHeightPx(vv: VisualViewport): number {
  const layoutBottom = readLayoutBottom(vv)
  const vvShrink = Math.max(0, Math.round(layoutBottom - vv.height - vv.offsetTop))
  if (vvShrink > 80) return vvShrink

  const innerGap = Math.max(0, Math.round((window.outerHeight || 0) - (window.innerHeight || 0)))
  const heuristic = Math.round(layoutBottom * (layoutBottom > 700 ? 0.44 : 0.4))
  return Math.max(heuristic, innerGap > 120 ? Math.min(innerGap, Math.round(layoutBottom * 0.55)) : 0)
}

function isEditableElement(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false
  if (el instanceof HTMLInputElement) {
    const t = el.type
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'radio', 'range', 'reset', 'submit'].includes(t)
  }
  return true
}

export function findFocusedEditableWithin(root: HTMLElement | null | undefined): HTMLElement | null {
  const active = document.activeElement
  if (!active || !(active instanceof HTMLElement)) return null
  if (!root?.contains(active)) return null
  if (isEditableElement(active)) return active
  if (active.isContentEditable) return active
  const nested = active.closest(
    '[contenteditable="true"], textarea, input:not([type=hidden])',
  ) as HTMLElement | null
  if (nested && root.contains(nested)) return nested
  return null
}

/** Android 键盘占用高度：实测优先；输入聚焦且 overlay 模式时再保守估算 */
export function resolveAndroidKeyboardPadPx(assumeOpen = false): number {
  const vv = window.visualViewport
  if (!vv || !isAndroidWeb()) return 0

  const measured = measureAndroidKeyboardPadPx()
  if (measured > 40) return measured

  if (!assumeOpen) return 0

  const layoutBottom = readLayoutBottom(vv)
  const estimate = Math.min(
    estimateAndroidKeyboardHeightPx(vv),
    Math.round(layoutBottom * 0.4),
    Math.round(window.innerHeight * 0.42),
  )
  return estimate > 80 ? estimate : 0
}

/** Android 实测键盘占用高度（优先 VirtualKeyboard / visualViewport 收缩） */
export function measureAndroidKeyboardPadPx(): number {
  const vv = window.visualViewport
  if (!vv || !isAndroidWeb()) return 0

  const nav = navigator as Navigator & {
    virtualKeyboard?: { boundingRect?: { height?: number } }
  }
  const vkH = Math.max(0, Math.round(nav.virtualKeyboard?.boundingRect?.height ?? 0))
  if (vkH > 40) return vkH

  const shrink = Math.max(0, Math.round(readLayoutBottom(vv) - vv.height - vv.offsetTop))
  if (shrink > 40) return shrink

  return 0
}

/** Android：仅抬升「被键盘挡住」的那一段，避免整屏上推 */
export function measureAndroidFocusLiftPx(el: HTMLElement | null): number {
  if (!el || !isAndroidWeb()) return 0

  const direct = measureComposerOverlapPx(el)
  if (direct > 0) return Math.min(direct + 8, 240)

  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return 0
  if (active !== el && !el.contains(active) && !active.contains(el)) return 0

  const target = el.contains(active) ? active : el
  const vv = window.visualViewport
  if (!vv) return 0

  let kbH = measureAndroidKeyboardPadPx()
  if (kbH <= 0) {
    kbH = Math.round(readLayoutBottom(vv) * 0.36)
  }

  const layoutBottom = readLayoutBottom(vv)
  const kbTop = layoutBottom - kbH
  const rect = target.getBoundingClientRect()
  if (rect.bottom <= kbTop + 8) return 0

  return Math.min(Math.round(rect.bottom - kbTop + 12), 220)
}

/** @deprecated 使用 measureAndroidFocusLiftPx */
export function measureAndroidOverlayKeyboardOverlapPx(el: HTMLElement | null): number {
  return measureAndroidFocusLiftPx(el)
}

function findScrollableAncestor(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const style = window.getComputedStyle(node)
    const oy = style.overflowY
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && node.scrollHeight > node.clientHeight + 2) {
      return node
    }
    node = node.parentElement
  }
  return null
}

/** 软键盘遮挡时，将正在编辑的控件滚入 visualViewport（Android overlays-content 场景） */
export function ensureElementVisibleAboveKeyboard(el: HTMLElement | null, padding = 16): void {
  const vv = window.visualViewport
  if (!vv || !el) return
  const rect = el.getBoundingClientRect()
  let visibleTop = vv.offsetTop + padding
  let visibleBottom = vv.offsetTop + vv.height - padding

  if (isAndroidWeb()) {
    const kbH = measureAndroidKeyboardPadPx()
    if (kbH > 0) {
      const layoutBottom = readLayoutBottom(vv)
      visibleBottom = Math.min(visibleBottom, layoutBottom - kbH - padding)
    }
  }

  const scrollBy = (deltaY: number) => {
    if (Math.abs(deltaY) < 2) return
    const scrollParent = findScrollableAncestor(el)
    if (scrollParent) {
      scrollParent.scrollTop += deltaY
      return
    }
    window.scrollBy({ top: deltaY, behavior: 'auto' })
  }
  if (rect.bottom > visibleBottom) {
    scrollBy(rect.bottom - visibleBottom)
    return
  }
  if (rect.top < visibleTop) {
    scrollBy(rect.top - visibleTop)
  }
}

export function keyboardLiftStyle(insetPx: number): { transform?: string; transition?: string; willChange?: string } {
  if (insetPx <= 0 || isIOSWebKit()) return {}
  return {
    transform: `translate3d(0, -${insetPx}px, 0)`,
    transition: 'transform 220ms ease-out',
    willChange: 'transform',
  }
}

/** 软键盘弹起时，滚动区底部额外留白（含纯白安全区高度） */
export function keyboardScrollPaddingBottom(
  insetPx: number,
  opts?: { basePx?: number; safeArea?: boolean },
): string {
  const basePx = opts?.basePx ?? 0
  const safe = opts?.safeArea !== false
  const safeTail = safe ? 'max(0.75rem, env(safe-area-inset-bottom, 0px))' : '0px'
  const basePart = basePx > 0 ? `${basePx}px + ${safeTail}` : safeTail
  if (insetPx <= 0) return `calc(${basePart})`
  return `calc(${insetPx}px + ${basePart})`
}
