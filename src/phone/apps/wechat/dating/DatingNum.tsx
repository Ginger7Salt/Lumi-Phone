import type { ReactNode } from 'react'
import { datingNumStyle } from './datingTypography'

export function DatingNum({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`tabular-nums ${className}`.trim()} style={datingNumStyle}>
      {children}
    </span>
  )
}
