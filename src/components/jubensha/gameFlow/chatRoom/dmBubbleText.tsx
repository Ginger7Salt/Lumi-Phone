import type { ReactNode } from 'react'

import type { DmTextHighlightRange } from './jbsFlowTypes'

/** 旁白面板：去掉仅含空白的行，避免气泡里出现空行 */
export function compactDmNarrationLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .join('\n')
}

/** 去空行后，按原文高亮片段重新定位区间 */
export function remapDmHighlightAfterLineCompact(
  text: string,
  highlight: DmTextHighlightRange,
): DmTextHighlightRange | undefined {
  const compacted = compactDmNarrationLines(text)
  const excerpt = text.slice(highlight.start, highlight.end)
  const compactExcerpt = compactDmNarrationLines(excerpt)
  if (!compactExcerpt) return undefined

  const start = compacted.indexOf(compactExcerpt)
  if (start >= 0) {
    const end = start + compactExcerpt.length
    return end > start ? { ...highlight, start, end } : undefined
  }

  const anchor =
    excerpt
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? compactExcerpt
  const anchorStart = compacted.indexOf(anchor)
  if (anchorStart < 0) return undefined

  const end = Math.min(compacted.length, anchorStart + compactExcerpt.length)
  return end > anchorStart ? { ...highlight, start: anchorStart, end } : undefined
}

/** 高亮区间已按整轨文案定位；打字机 partial 正文时勿 remap，避免空金条 */
export function resolveDmHighlightForDisplay(
  displayBody: string,
  highlight?: DmTextHighlightRange,
): DmTextHighlightRange | undefined {
  if (!highlight || highlight.end <= highlight.start) return undefined
  if (displayBody.length <= highlight.start) return undefined
  const end = Math.min(highlight.end, displayBody.length)
  if (end <= highlight.start) return undefined
  return { ...highlight, end }
}

function TypewriterCursor() {
  return (
    <span className="jbs-gf-chat-typewriter-cursor ml-0.5 inline-block w-[2px] align-middle" />
  )
}

/** 将 DM 气泡正文按高亮区间渲染（用于打字机逐字输出） */
export function renderDmBubbleText(
  body: string,
  highlight?: DmTextHighlightRange,
  isTyping?: boolean,
): ReactNode {
  const cursor = isTyping ? <TypewriterCursor /> : null

  if (!highlight || highlight.end <= highlight.start || body.length <= highlight.start) {
    return (
      <>
        {body}
        {cursor}
      </>
    )
  }

  if (highlight.mode === 'block') {
    const before = body.slice(0, highlight.start)
    const blockTypedEnd = Math.min(body.length, highlight.end)
    const blockTyped = body.slice(highlight.start, blockTypedEnd)
    const stillTypingBlock = body.length < highlight.end

    if (!blockTyped && !stillTypingBlock) {
      return (
        <>
          {before}
          {body.slice(highlight.end)}
          {cursor}
        </>
      )
    }

    return (
      <>
        {before}
        <span className="jbs-gf-chat-dm-highlight-block">
          {blockTyped}
          {stillTypingBlock && isTyping ? <TypewriterCursor /> : null}
        </span>
        {!stillTypingBlock ? (
          <>
            {body.slice(highlight.end)}
            {isTyping ? <TypewriterCursor /> : null}
          </>
        ) : null}
      </>
    )
  }

  const hlEnd = Math.min(body.length, highlight.end)
  return (
    <>
      {body.slice(0, highlight.start)}
      <span className="jbs-gf-chat-dm-highlight">{body.slice(highlight.start, hlEnd)}</span>
      {body.slice(hlEnd)}
      {cursor}
    </>
  )
}
