import { Fragment, type ReactNode } from 'react'

const QL = '\u201C'
const QR = '\u201D'

/** 内心 OS：浅灰字，无衬底、无描边 */
const osCls = 'text-[15px] font-normal italic leading-[1.75] text-[#b8b8bc]'

type Match = { end: number; node: ReactNode }

/**
 * 三种语义：**内心**、对白（「」/弯引号/英文引号）、其余为旁白。
 * 对白与旁白同一视觉流：**不**再加灰底方框（旧版曾用卡片式台词块）。
 * 优先级：** → * → 「」 → “” → ""
 */
export function parsePlotRichText(s: string, depth = 0): ReactNode[] {
  if (!s) return []
  if (depth > 24) return [<Fragment key="deep">{s}</Fragment>]

  const out: ReactNode[] = []
  let plainStart = 0
  let i = 0
  let key = 0
  const nextKey = () => {
    key += 1
    return `k-${depth}-${key}`
  }

  const emitPlain = (from: number, to: number) => {
    if (from >= to) return
    const t = s.slice(from, to)
    out.push(<Fragment key={nextKey()}>{t}</Fragment>)
  }

  const tryOs = (): Match | null => {
    if (!s.slice(i).startsWith('**')) return null
    const end = s.indexOf('**', i + 2)
    if (end === -1) return null
    const inner = s.slice(i + 2, end)
    const k = nextKey()
    return {
      end: end + 2,
      node: (
        <span key={k} className={osCls}>
          {parsePlotRichText(inner, depth + 1)}
        </span>
      ),
    }
  }

  const trySingleOs = (): Match | null => {
    if (s[i] !== '*') return null
    // 双星号由 tryOs 处理；这里只兜底单星号。
    if (s[i + 1] === '*') return null
    const end = s.indexOf('*', i + 1)
    if (end === -1) return null
    const inner = s.slice(i + 1, end)
    if (!inner.trim()) return null
    const k = nextKey()
    return {
      end: end + 1,
      node: (
        <span key={k} className={osCls}>
          {parsePlotRichText(inner, depth + 1)}
        </span>
      ),
    }
  }

  const tryCorner = (): Match | null => {
    if (s[i] !== '「') return null
    const end = s.indexOf('」', i + 1)
    if (end === -1) return null
    const inner = s.slice(i + 1, end)
    const k = nextKey()
    return {
      end: end + 1,
      node: (
        <Fragment key={k}>
          「{parsePlotRichText(inner, depth + 1)}」
        </Fragment>
      ),
    }
  }

  const tryCurve = (): Match | null => {
    if (s[i] !== QL) return null
    const end = s.indexOf(QR, i + 1)
    if (end === -1) return null
    const inner = s.slice(i + 1, end)
    const k = nextKey()
    return {
      end: end + 1,
      node: (
        <Fragment key={k}>
          {QL}
          {parsePlotRichText(inner, depth + 1)}
          {QR}
        </Fragment>
      ),
    }
  }

  const tryAscii = (): Match | null => {
    if (s[i] !== '"') return null
    const end = s.indexOf('"', i + 1)
    if (end === -1 || end === i + 1) return null
    const inner = s.slice(i + 1, end)
    const k = nextKey()
    return {
      end: end + 1,
      node: (
        <Fragment key={k}>
          {'"'}
          {parsePlotRichText(inner, depth + 1)}
          {'"'}
        </Fragment>
      ),
    }
  }

  while (i < s.length) {
    const m = tryOs() ?? trySingleOs() ?? tryCorner() ?? tryCurve() ?? tryAscii()
    if (m) {
      emitPlain(plainStart, i)
      out.push(m.node)
      i = m.end
      plainStart = i
      continue
    }
    i += 1
  }
  emitPlain(plainStart, s.length)
  return out
}

export function PlotRichParagraph({ content, className }: { content: string; className?: string }) {
  return <span className={className}>{parsePlotRichText(content)}</span>
}
