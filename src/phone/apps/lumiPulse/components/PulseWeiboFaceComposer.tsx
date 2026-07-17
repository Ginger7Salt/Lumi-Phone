import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from 'react'

import { parsePulseWeiboFaceText, resolveWeiboFaceUrl } from '../pulseWeiboFace'

const FACE_ATTR = 'data-pulse-weibo-face'

export type PulseWeiboFaceComposerHandle = {
  focus: () => void
  /** 在光标处插入纯文本或 [表情名] */
  insertToken: (token: string) => void
}

function serializeComposer(root: HTMLElement): string {
  let out = ''
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? ''
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const face = el.getAttribute(FACE_ATTR)
    if (face) {
      out += `[${face}]`
      return
    }
    if (el.tagName === 'BR') {
      out += '\n'
      return
    }
    for (const child of Array.from(el.childNodes)) walk(child)
  }
  for (const child of Array.from(root.childNodes)) walk(child)
  return out
}

function createFaceImg(name: string, url: string): HTMLImageElement {
  const img = document.createElement('img')
  img.setAttribute(FACE_ATTR, name)
  img.src = url
  img.alt = `[${name}]`
  img.title = `[${name}]`
  img.draggable = false
  img.className = 'mx-px inline-block size-[18px] align-[-4px] object-contain'
  img.contentEditable = 'false'
  return img
}

function fillComposerFromValue(root: HTMLElement, value: string) {
  root.replaceChildren()
  const parts = parsePulseWeiboFaceText(value)
  for (const part of parts) {
    if (part.type === 'face') {
      root.appendChild(createFaceImg(part.name, part.url))
    } else if (part.value) {
      // 单行输入：换行压成空格，避免 contentEditable 折行失控
      root.appendChild(document.createTextNode(part.value.replace(/\n/g, ' ')))
    }
  }
}

function placeCaretAtEnd(el: HTMLElement) {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

function insertNodeAtSelection(root: HTMLElement, node: Node) {
  root.focus()
  const sel = window.getSelection()
  if (!sel) {
    root.appendChild(node)
    placeCaretAtEnd(root)
    return
  }
  if (!sel.rangeCount || !root.contains(sel.anchorNode)) {
    root.appendChild(node)
    const range = document.createRange()
    range.setStartAfter(node)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    return
  }
  const range = sel.getRangeAt(0)
  range.deleteContents()
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

/** 评论/短输入：界面渲染微博表情图，对外 value 仍是带 [doge] 的纯文本 */
export const PulseWeiboFaceComposer = forwardRef<
  PulseWeiboFaceComposerHandle,
  {
    value: string
    onChange: (next: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
    onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void
  }
>(function PulseWeiboFaceComposer(
  { value, onChange, placeholder, disabled, className = '', onKeyDown },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const lastEmittedRef = useRef(value)
  const composingRef = useRef(false)

  const emitFromDom = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const next = serializeComposer(root)
    lastEmittedRef.current = next
    onChange(next)
  }, [onChange])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => rootRef.current?.focus({ preventScroll: true }),
      insertToken: (token: string) => {
        const root = rootRef.current
        if (!root || disabled) return
        const faceMatch = /^\s*\[([\u4e00-\u9fa5a-zA-Z0-9_]+?)\]\s*$/.exec(token)
        const faceName = faceMatch?.[1]
        const face = faceName ? resolveWeiboFaceUrl(faceName) : undefined
        if (face) {
          insertNodeAtSelection(root, createFaceImg(face.name, face.url))
        } else {
          insertNodeAtSelection(root, document.createTextNode(token))
        }
        emitFromDom()
      },
    }),
    [disabled, emitFromDom],
  )

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (composingRef.current) return
    if (value === lastEmittedRef.current && serializeComposer(root) === value) return
    // 外部清空 / 同步
    fillComposerFromValue(root, value)
    lastEmittedRef.current = value
    if (value) placeCaretAtEnd(root)
  }, [value])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    fillComposerFromValue(root, value)
    lastEmittedRef.current = value
    // mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const empty = !value.trim()

  return (
    <div className={`relative min-w-0 flex-1 ${className}`.trim()}>
      {empty && placeholder ? (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-[13px] text-neutral-400">
          {placeholder}
        </span>
      ) : null}
      <div
        ref={rootRef}
        role="textbox"
        aria-multiline="false"
        aria-placeholder={placeholder}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onCompositionStart={() => {
          composingRef.current = true
        }}
        onCompositionEnd={() => {
          composingRef.current = false
          emitFromDom()
        }}
        onInput={() => {
          if (composingRef.current) return
          emitFromDom()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onKeyDown?.(e)
            return
          }
          onKeyDown?.(e)
        }}
        onPaste={(e) => {
          e.preventDefault()
          const text = e.clipboardData.getData('text/plain').replace(/\r?\n/g, ' ')
          if (!text) return
          insertNodeAtSelection(rootRef.current!, document.createTextNode(text))
          // 粘贴后把其中的 [表情] 再规整成图
          const merged = serializeComposer(rootRef.current!)
          fillComposerFromValue(rootRef.current!, merged)
          lastEmittedRef.current = merged
          onChange(merged)
          placeCaretAtEnd(rootRef.current!)
        }}
        className={`relative z-[1] max-h-20 min-h-[22px] w-full overflow-y-auto whitespace-pre-wrap break-words bg-transparent py-0.5 text-[13px] leading-[22px] text-[#1C1C1E] outline-none empty:before:content-[''] disabled:opacity-60 ${
          disabled ? 'pointer-events-none opacity-60' : ''
        }`}
      />
    </div>
  )
})
