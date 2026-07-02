import type { CSSProperties, ReactNode } from 'react'

import { phoneNumStyle } from '../../../types'

/** 微博内纯数字展示（全局 phone-num-font） */
export function PulseNum({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className={`tabular-nums ${className}`.trim()} style={{ ...phoneNumStyle, ...style }}>
      {children}
    </span>
  )
}

/** 混排文本中的数字片段自动套用全局数字字体 */
export function PulseNumericText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\d+)/)
  return (
    <span className={className}>
      {parts.map((part, index) =>
        /^\d+$/.test(part) ? (
          <span key={index} style={phoneNumStyle}>
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  )
}
