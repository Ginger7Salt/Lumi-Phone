import type { CSSProperties, ReactNode } from 'react'
import { PHONE_NUM_FONT_FAMILY } from '../../../../types'

/** 与全站 .font-num 一致 */
export const simNumStyle: CSSProperties = {
  fontFamily: PHONE_NUM_FONT_FAMILY,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1, "lnum" 1',
  fontWeight: 700,
}

export const simPlainNumStyle: CSSProperties = {
  fontFamily: PHONE_NUM_FONT_FAMILY,
  fontVariantNumeric: 'proportional-nums',
  fontFeatureSettings: '"lnum" 1',
  fontWeight: 700,
}

export const simNumClass = 'font-num tabular-nums tracking-tight'

export function simNumMetaClass(extra = '') {
  return [simNumClass, extra].filter(Boolean).join(' ')
}

export function SimNum({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className={simNumMetaClass(className)} style={{ ...simNumStyle, ...style }}>
      {children}
    </span>
  )
}

/** 混排文案中的数字片段走全局衬线数字字体 */
export function SimNumText({ text, className = '' }: { text: string; className?: string }) {
  const parts = text.split(/(\d+[.,\d%\-:]*)/)
  return (
    <span className={className}>
      {parts.map((part, index) =>
        /\d/.test(part) ? (
          <span key={index} className={simNumMetaClass()} style={simNumStyle}>
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  )
}

export function formatFunds(n: number) {
  return `¥${n.toLocaleString('zh-CN')}`
}

export function formatFans(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return String(n)
}

export function SimFunds({ amount, className = '' }: { amount: number; className?: string }) {
  return <SimNumText text={formatFunds(amount)} className={className} />
}
