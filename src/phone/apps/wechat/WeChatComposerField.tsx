import type { CSSProperties, HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { useEffect, useLayoutEffect, useRef } from 'react'

import {
  applyWeChatComposerText,
  serializeWeChatComposerEl,
} from './stickers/wechatClassicEmojiComposer'

type Props = {
  value: string
  onChange: (next: string) => void
  onKeyDown?: (e: ReactKeyboardEvent<HTMLDivElement>) => void
  className?: string
  style?: CSSProperties
  placeholder?: string
  'aria-label'?: string
} & Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'onKeyDown' | 'children' | 'dangerouslySetInnerHTML'>

export function WeChatComposerField({
  value,
  onChange,
  onKeyDown,
  className,
  style,
  placeholder,
  'aria-label': ariaLabel,
  ref,
  ...rest
}: Props & { ref?: RefObject<HTMLDivElement | null> }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const lastEmittedRef = useRef(value)
  const composingRef = useRef(false)

  useEffect(() => {
    if (ref) ref.current = rootRef.current
  }, [ref])

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const current = serializeWeChatComposerEl(el)
    if (current === value) {
      lastEmittedRef.current = value
      return
    }
    applyWeChatComposerText(el, value)
    lastEmittedRef.current = value
  }, [value])

  const emitFromDom = () => {
    const el = rootRef.current
    if (!el) return
    const next = serializeWeChatComposerEl(el)
    lastEmittedRef.current = next
    onChange(next)
  }

  return (
    <div
      ref={rootRef}
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder || undefined}
      className={`${className ?? ''} whitespace-pre-wrap break-words outline-none empty:before:pointer-events-none empty:before:text-[#8E8E93] empty:before:content-[attr(data-placeholder)]`}
      style={style}
      {...rest}
      onInput={() => {
        if (composingRef.current) return
        emitFromDom()
      }}
      onCompositionStart={() => {
        composingRef.current = true
      }}
      onCompositionEnd={() => {
        composingRef.current = false
        emitFromDom()
      }}
      onKeyDown={onKeyDown}
      onPaste={(e) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        if (!text) return
        document.execCommand('insertText', false, text)
        emitFromDom()
      }}
    />
  )
}
