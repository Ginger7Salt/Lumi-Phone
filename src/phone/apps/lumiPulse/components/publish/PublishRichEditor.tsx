import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import { parsePublishSyntax, PUBLISH_SYNTAX_COLORS } from '../../pulsePublishSyntax'
import { resolveWeiboFaceUrl } from '../../pulseWeiboFace'

const FACE_ATTR = 'data-pulse-weibo-face'
const SYNTAX_ATTR = 'data-pulse-syntax'

/** 两层/输入区共用排版 */
const EDITOR_STYLE: CSSProperties = {
  fontFamily: 'var(--phone-font, "Noto Serif SC", Georgia, serif)',
  fontSize: 18,
  lineHeight: 1.625,
  fontWeight: 400,
  fontStyle: 'normal',
  letterSpacing: 'normal',
  wordSpacing: 'normal',
  padding: 24,
  margin: 0,
  border: 0,
  boxSizing: 'border-box',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  tabSize: 4,
  WebkitFontSmoothing: 'antialiased',
  color: PUBLISH_SYNTAX_COLORS.ink,
  minHeight: 200,
  outline: 'none',
}

export type PublishRichEditorHandle = {
  focus: () => void
  blur: () => void
  /** 在光标处插入纯文本或 [表情名]；cursorOffsetInInsert 控制插入后光标相对插入串的位置 */
  insertToken: (token: string, cursorOffsetInInsert?: number) => void
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
    if (el.tagName === 'DIV' || el.tagName === 'P') {
      // contentEditable 换行常包成块；块前补换行（首块除外）
      if (out.length && !out.endsWith('\n')) out += '\n'
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
  // 固定宽高，避免占满 [表情名] 文本宽度造成大空隙
  img.className = 'inline-block size-[22px] align-[-5px] object-contain'
  img.contentEditable = 'false'
  img.style.margin = '0 1px'
  return img
}

function createSyntaxSpan(
  kind: 'hashtag' | 'mention' | 'supertopic',
  raw: string,
): HTMLSpanElement {
  const span = document.createElement('span')
  span.setAttribute(SYNTAX_ATTR, kind)
  span.textContent = raw
  if (kind === 'hashtag') {
    span.style.color = PUBLISH_SYNTAX_COLORS.hashtag
  } else if (kind === 'mention') {
    span.style.color = PUBLISH_SYNTAX_COLORS.mention
  } else {
    span.style.color = '#3A3A3C'
    span.style.backgroundColor = PUBLISH_SYNTAX_COLORS.supertopicBg
    span.style.borderRadius = '4px'
  }
  return span
}

function fillComposerFromValue(root: HTMLElement, value: string) {
  root.replaceChildren()
  if (!value) return
  const parts = parsePublishSyntax(value)
  for (const part of parts) {
    if (part.type === 'text') {
      if (part.value) root.appendChild(document.createTextNode(part.value))
      continue
    }
    if (part.type === 'face') {
      root.appendChild(createFaceImg(part.name, part.url))
      continue
    }
    if (part.type === 'hashtag') {
      root.appendChild(createSyntaxSpan('hashtag', part.raw))
      continue
    }
    if (part.type === 'mention') {
      root.appendChild(createSyntaxSpan('mention', part.raw))
      continue
    }
    if (part.type === 'supertopic') {
      root.appendChild(createSyntaxSpan('supertopic', part.raw))
    }
  }
}

/** 将选区映射为序列化正文中的偏移 */
function getCaretSerializedOffset(root: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !root.contains(sel.focusNode)) {
    return serializeComposer(root).length
  }
  const range = sel.getRangeAt(0).cloneRange()
  range.selectNodeContents(root)
  range.setEnd(sel.focusNode!, sel.focusOffset)
  const probe = document.createElement('div')
  probe.appendChild(range.cloneContents())
  return serializeComposer(probe).length
}

function setCaretSerializedOffset(root: HTMLElement, offset: number) {
  const sel = window.getSelection()
  if (!sel) return
  let remaining = Math.max(0, offset)
  let placed = false

  const placeAt = (node: Node, o: number) => {
    const range = document.createRange()
    range.setStart(node, o)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    placed = true
  }

  const walk = (node: Node): boolean => {
    if (placed) return true
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0
      if (remaining <= len) {
        placeAt(node, remaining)
        return true
      }
      remaining -= len
      return false
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return false
    const el = node as HTMLElement
    const face = el.getAttribute(FACE_ATTR)
    if (face) {
      const tokenLen = `[${face}]`.length
      if (remaining <= 0) {
        placeAt(el, 0)
        return true
      }
      if (remaining < tokenLen) {
        // 落在表情 token 内 → 整枚前后择近端
        if (remaining <= tokenLen / 2) {
          const range = document.createRange()
          range.setStartBefore(el)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        } else {
          const range = document.createRange()
          range.setStartAfter(el)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        }
        placed = true
        return true
      }
      remaining -= tokenLen
      return false
    }
    if (el.tagName === 'BR') {
      if (remaining <= 0) {
        const range = document.createRange()
        range.setStartBefore(el)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        placed = true
        return true
      }
      remaining -= 1
      return false
    }
    for (const child of Array.from(el.childNodes)) {
      if (walk(child)) return true
    }
    return false
  }

  for (const child of Array.from(root.childNodes)) {
    if (walk(child)) break
  }
  if (!placed) {
    const range = document.createRange()
    range.selectNodeContents(root)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
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

function insertNodeAtSelection(root: HTMLElement, node: Node, focusRoot = true) {
  if (focusRoot) root.focus()
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

/** 退格/删除时整枚吞掉表情图，避免露出 [打call] 字符 */
function tryDeleteAdjacentFace(root: HTMLElement, direction: 'backward' | 'forward'): boolean {
  const sel = window.getSelection()
  if (!sel || !sel.isCollapsed || !sel.rangeCount) return false
  const range = sel.getRangeAt(0)
  const { startContainer, startOffset } = range

  const isFace = (n: Node | null): n is HTMLElement =>
    Boolean(n && n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).hasAttribute(FACE_ATTR))

  let face: HTMLElement | null = null

  if (direction === 'backward') {
    if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
      face = isFace(startContainer.previousSibling)
        ? (startContainer.previousSibling as HTMLElement)
        : isFace(startContainer.parentElement?.previousSibling ?? null)
          ? (startContainer.parentElement!.previousSibling as HTMLElement)
          : null
    } else if (startContainer === root && startOffset > 0) {
      const prev = root.childNodes[startOffset - 1] ?? null
      face = isFace(prev) ? prev : null
    } else if (startContainer.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
      const prev = startContainer.childNodes[startOffset - 1] ?? null
      face = isFace(prev) ? prev : null
    }
  } else {
    if (
      startContainer.nodeType === Node.TEXT_NODE &&
      startOffset === (startContainer.textContent?.length ?? 0)
    ) {
      face = isFace(startContainer.nextSibling)
        ? (startContainer.nextSibling as HTMLElement)
        : isFace(startContainer.parentElement?.nextSibling ?? null)
          ? (startContainer.parentElement!.nextSibling as HTMLElement)
          : null
    } else if (startContainer === root && startOffset < root.childNodes.length) {
      const next = root.childNodes[startOffset] ?? null
      face = isFace(next) ? next : null
    } else if (
      startContainer.nodeType === Node.ELEMENT_NODE &&
      startOffset < startContainer.childNodes.length
    ) {
      const next = startContainer.childNodes[startOffset] ?? null
      face = isFace(next) ? next : null
    }
  }

  if (!face || !root.contains(face)) return false
  const after = document.createRange()
  if (direction === 'backward') {
    after.setStartBefore(face)
  } else {
    after.setStartAfter(face)
  }
  after.collapse(true)
  face.remove()
  sel.removeAllRanges()
  sel.addRange(after)
  return true
}

/**
 * 发布正文编辑器：contentEditable + 表情原子图。
 * 对外 value 仍是带 [doge] 的纯文本；#/@/【】高亮同步渲染。
 */
export const PublishRichEditor = forwardRef<
  PublishRichEditorHandle,
  {
    value: string
    onChange: (next: string) => void
    placeholder?: string
    autoFocus?: boolean
    /** 弹层打开时锁定，防止 iOS 误弹键盘 */
    editable?: boolean
    onFocusChange?: (focused: boolean) => void
  }
>(function PublishRichEditor(
  {
    value,
    onChange,
    placeholder = '此刻想说…',
    autoFocus,
    editable = true,
    onFocusChange,
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const lastEmittedRef = useRef(value)
  const composingRef = useRef(false)
  /** 失焦/弹层前记住光标，避免插入落到开头 */
  const lastCaretOffsetRef = useRef(0)
  const [isFocused, setIsFocused] = useState(false)

  const setFocused = useCallback(
    (next: boolean) => {
      setIsFocused(next)
      onFocusChange?.(next)
    },
    [onFocusChange],
  )

  const rememberCaret = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const sel = window.getSelection()
    if (!sel?.rangeCount || !root.contains(sel.focusNode)) return
    lastCaretOffsetRef.current = getCaretSerializedOffset(root)
  }, [])

  const restoreCaretIfNeeded = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const sel = window.getSelection()
    if (sel?.rangeCount && root.contains(sel.anchorNode)) return
    root.focus({ preventScroll: true })
    setCaretSerializedOffset(root, lastCaretOffsetRef.current)
  }, [])

  const emitFromDom = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const next = serializeComposer(root)
    lastEmittedRef.current = next
    onChange(next)
  }, [onChange])

  const syncHighlightKeepCaret = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const caret = getCaretSerializedOffset(root)
    const next = serializeComposer(root)
    fillComposerFromValue(root, next)
    lastEmittedRef.current = next
    onChange(next)
    setCaretSerializedOffset(root, caret)
    lastCaretOffsetRef.current = caret
  }, [onChange])

  useEffect(() => {
    const onSelChange = () => {
      const root = rootRef.current
      if (!root || document.activeElement !== root) return
      rememberCaret()
    }
    document.addEventListener('selectionchange', onSelChange)
    return () => document.removeEventListener('selectionchange', onSelChange)
  }, [rememberCaret])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (!editable) return
        rootRef.current?.focus({ preventScroll: true })
      },
      blur: () => {
        rememberCaret()
        rootRef.current?.blur()
        setFocused(false)
      },
      insertToken: (token: string, cursorOffsetInInsert?: number) => {
        const root = rootRef.current
        if (!root || !editable) return
        restoreCaretIfNeeded()
        const faceMatch = /^\s*\[([\u4e00-\u9fa5a-zA-Z0-9_]+?)\]\s*$/.exec(token)
        const faceName = faceMatch?.[1]
        const face = faceName ? resolveWeiboFaceUrl(faceName) : undefined

        if (face) {
          insertNodeAtSelection(root, createFaceImg(face.name, face.url))
          emitFromDom()
          rememberCaret()
          return
        }

        // 纯文本插入（如 ## / @昵称 ）
        const offset = Math.min(
          Math.max(0, cursorOffsetInInsert ?? token.length),
          token.length,
        )
        const before = token.slice(0, offset)
        const after = token.slice(offset)
        if (before) insertNodeAtSelection(root, document.createTextNode(before))
        if (after) {
          const afterNode = document.createTextNode(after)
          insertNodeAtSelection(root, afterNode)
          // 光标应落在 before|after 之间
          const sel = window.getSelection()
          if (sel) {
            const range = document.createRange()
            range.setStart(afterNode, 0)
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
          }
        }
        syncHighlightKeepCaret()
      },
    }),
    [
      editable,
      emitFromDom,
      rememberCaret,
      restoreCaretIfNeeded,
      setFocused,
      syncHighlightKeepCaret,
    ],
  )

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (composingRef.current) return
    if (value === lastEmittedRef.current && serializeComposer(root) === value) return
    const hadFocus = document.activeElement === root
    const caret = hadFocus ? getCaretSerializedOffset(root) : value.length
    fillComposerFromValue(root, value)
    lastEmittedRef.current = value
    if (hadFocus) setCaretSerializedOffset(root, caret)
  }, [value])

  useEffect(() => {
    if (editable) return
    rememberCaret()
    rootRef.current?.blur()
    setFocused(false)
  }, [editable, rememberCaret, setFocused])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    fillComposerFromValue(root, value)
    lastEmittedRef.current = value
    if (autoFocus) {
      root.focus({ preventScroll: true })
      placeCaretAtEnd(root)
    }
    // mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const empty = !value
  const showFocusChrome = editable && isFocused

  return (
    <div ref={shellRef} className="px-5 pb-2 pt-3">
      <div
        role="presentation"
        onClick={() => {
          if (!editable || isFocused) return
          rootRef.current?.focus({ preventScroll: true })
        }}
        className={`rounded-[20px] transition-[background-color,box-shadow] duration-200 ${
          !editable
            ? 'bg-[#FAFAFA]/80'
            : showFocusChrome
              ? 'bg-[#F8F7F5] shadow-[inset_0_0_0_1.5px_rgba(229,152,155,0.32)]'
              : 'bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]'
        }`}
      >
        <div className="relative w-full" style={{ minHeight: 168 }}>
          {empty ? (
            <span
              className="pointer-events-none absolute select-none"
              style={{
                ...EDITOR_STYLE,
                color: showFocusChrome ? '#C8C8C8' : '#D4D4D4',
                position: 'absolute',
                inset: 0,
                minHeight: 168,
                paddingTop: 20,
                paddingBottom: 20,
              }}
            >
              {placeholder}
            </span>
          ) : null}
          <div
            ref={rootRef}
            role="textbox"
            aria-multiline="true"
            aria-placeholder={placeholder}
            contentEditable={editable}
            suppressContentEditableWarning
            onFocus={() => setFocused(true)}
            onCompositionStart={() => {
              composingRef.current = true
            }}
            onCompositionEnd={() => {
              composingRef.current = false
              syncHighlightKeepCaret()
            }}
            onInput={() => {
              if (composingRef.current) return
              emitFromDom()
            }}
            onBlur={() => {
              setFocused(false)
              if (composingRef.current) return
              syncHighlightKeepCaret()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace') {
                if (tryDeleteAdjacentFace(rootRef.current!, 'backward')) {
                  e.preventDefault()
                  emitFromDom()
                }
                return
              }
              if (e.key === 'Delete') {
                if (tryDeleteAdjacentFace(rootRef.current!, 'forward')) {
                  e.preventDefault()
                  emitFromDom()
                }
              }
            }}
            onPaste={(e) => {
              e.preventDefault()
              const text = e.clipboardData.getData('text/plain').replace(/\r\n/g, '\n')
              if (!text) return
              insertNodeAtSelection(rootRef.current!, document.createTextNode(text))
              syncHighlightKeepCaret()
            }}
            className={`relative z-[1] w-full ${editable ? '' : 'pointer-events-none'}`}
            style={{
              ...EDITOR_STYLE,
              minHeight: 168,
              paddingTop: 20,
              paddingBottom: 20,
            }}
          />
        </div>
      </div>
      {!isFocused && editable && !empty ? (
        <p className="mt-1.5 px-1 text-[10px] text-neutral-300">点击输入框继续编辑</p>
      ) : null}
    </div>
  )
})
