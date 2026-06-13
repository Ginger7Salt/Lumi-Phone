import type { ReactNode } from 'react'

import { resolveMomentsContentBackgroundUrl } from './momentsCoverDefaults'

type MomentsContentBackdropProps = {
  children: ReactNode
  className?: string
}

/**
 * 钉在「朋友圈页」可视区域内的内容区壁纸（不随列表滚动）。
 * 须放在 `relative overflow-hidden` 的页面根容器内，与 `overflow-y-auto` 滚动层为兄弟节点。
 */
export function MomentsContentBackgroundLayer() {
  const bgUrl = resolveMomentsContentBackgroundUrl()

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bgUrl})` }}
    />
  )
}

/** 封面下方正文区：内容叠在固定壁纸之上 */
export function MomentsContentBackdrop({ children, className = '' }: MomentsContentBackdropProps) {
  return <div className={`relative z-[1] ${className}`.trim()}>{children}</div>
}
