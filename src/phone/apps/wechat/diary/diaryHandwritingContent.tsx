import type { ReactNode } from 'react'

/** 涂改标记：[涂]错字|正字 */
const SCRIBBLE_RE = /\[涂\]([^|]+)\|([^[\]]+)/g

export function stripDiaryMarkupForMeasure(text: string): string {
  return text
    .replace(SCRIBBLE_RE, (_m, _wrong, right: string) => right)
    .replace(/\s+/g, ' ')
    .trim()
}

function ScribbleCorrection({ wrong, correct }: { wrong: string; correct: string }) {
  return (
    <span className="inline align-baseline whitespace-nowrap">
      <span className="relative inline-block align-baseline px-[1px]">
        <span className="text-gray-600">{wrong}</span>
        <svg
          className="pointer-events-none absolute left-[-3px] top-[38%] h-[0.62em] w-[calc(100%+6px)] overflow-visible"
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M2,14 C22,4 38,18 58,10 S88,16 98,8"
            fill="none"
            stroke="rgba(35,35,35,0.58)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M0,19 C28,11 44,22 72,14 S96,20 100,15"
            fill="none"
            stroke="rgba(35,35,35,0.32)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M8,8 C30,16 50,6 78,12"
            fill="none"
            stroke="rgba(35,35,35,0.22)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="ml-[2px]">{correct}</span>
    </span>
  )
}

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'scribble'; wrong: string; correct: string }

function parseDiaryContentSegments(content: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  const re = new RegExp(SCRIBBLE_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    if (match.index > last) {
      segments.push({ kind: 'text', value: content.slice(last, match.index) })
    }
    segments.push({ kind: 'scribble', wrong: match[1]!, correct: match[2]! })
    last = match.index + match[0].length
  }
  if (last < content.length) {
    segments.push({ kind: 'text', value: content.slice(last) })
  }
  return segments.length ? segments : [{ kind: 'text', value: content }]
}

export function DiaryHandwritingContent({ content }: { content: string }) {
  const segments = parseDiaryContentSegments(content)
  const nodes: ReactNode[] = []

  segments.forEach((seg, i) => {
    if (seg.kind === 'scribble') {
      nodes.push(<ScribbleCorrection key={`s-${i}`} wrong={seg.wrong} correct={seg.correct} />)
      return
    }
    const parts = seg.value.split('\n')
    parts.forEach((part, j) => {
      if (j > 0) nodes.push(<br key={`br-${i}-${j}`} />)
      if (part) nodes.push(<span key={`t-${i}-${j}`}>{part}</span>)
    })
  })

  return <>{nodes}</>
}
