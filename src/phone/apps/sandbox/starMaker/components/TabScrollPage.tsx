import type { ReactNode } from 'react'
import { SimNumText } from './SimNum'

/** 各 Tab 统一可滚动页面容器 */
export function TabScrollPage({ children }: { children: ReactNode }) {
  return (
    <div className="sm-tab-scroll h-full min-h-0 w-full">
      <div className="sm-tab-scroll-inner">{children}</div>
    </div>
  )
}

export function TabSection({
  title,
  hint,
  children,
}: {
  title?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="sm-tab-section">
      {title ? <h3 className="sm-serif sm-tab-section-title">{title}</h3> : null}
      {hint ? (
        <p className="sm-tab-section-hint">
          <SimNumText text={hint} />
        </p>
      ) : null}
      {children}
    </section>
  )
}
