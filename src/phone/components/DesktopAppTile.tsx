import { motion, type HTMLMotionProps } from 'framer-motion'
import type { AppSlot } from '../types'
import { AppIconTile } from './AppIconTile'
import { Pressable } from './Pressable'
import { useCustomization } from '../CustomizationContext'
import { useEffect, useState } from 'react'

type Props = {
  app: AppSlot
  onOpen: (id: AppSlot['id']) => void
  className?: string
  compact?: boolean
  /** 主屏 / Dock 角标（如微信未读） */
  badgeCount?: number
  isEditMode?: boolean
  isActiveDrag?: boolean
  isLongPressPrimed?: boolean
  isGhosted?: boolean
  pointerHandlers?: Pick<
    HTMLMotionProps<'button'>,
    'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onPointerLeave'
  >
}

export function DesktopAppTile({
  app,
  onOpen,
  className,
  compact = false,
  badgeCount = 0,
  isEditMode = false,
  isActiveDrag = false,
  isLongPressPrimed = false,
  isGhosted = false,
  pointerHandlers,
}: Props) {
  const { state } = useCustomization()
  const { theme } = state
  const iconBg = compact ? 54 : 64
  const iconGlyph = compact ? 36 : 42
  const labelSize = compact ? 'clamp(8px, 1.15vh, 9px)' : 'clamp(9px, 1.35vh, 10px)'
  const [rejectPulse, setRejectPulse] = useState(false)

  useEffect(() => {
    if (!rejectPulse) return
    const timer = window.setTimeout(() => setRejectPulse(false), 220)
    return () => window.clearTimeout(timer)
  }, [rejectPulse])

  return (
    <Pressable
      data-desktop-tile="true"
      onClick={() => {
        if (isEditMode) {
          setRejectPulse(true)
          return
        }
        onOpen(app.id)
      }}
      className={`flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-[var(--phone-radius-md)] bg-transparent px-1 py-0.5 ${className ?? ''}`}
      style={{
        background: 'transparent',
        color: theme.text,
        border: 'none',
        boxShadow: 'none',
        opacity: isGhosted ? 0.02 : 1,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'none',
      }}
      whileTap={isEditMode ? { scale: 0.985, x: [0, -1.2, 1.2, 0] } : { scale: 0.96 }}
      animate={
        isActiveDrag || isLongPressPrimed
          ? {
              scale: 1.1,
              y: -2,
              filter: 'brightness(1.02)',
            }
          : rejectPulse
            ? {
                x: [0, -1.8, 1.8, -1, 1, 0],
                scale: 1,
              }
            : {
                x: 0,
                scale: 1,
                y: 0,
                filter: 'brightness(1)',
              }
      }
      transition={
        isActiveDrag || isLongPressPrimed
          ? { type: 'spring', stiffness: 340, damping: 28 }
          : rejectPulse
            ? { duration: 0.2, ease: 'easeOut' }
            : { type: 'spring', stiffness: 420, damping: 34 }
      }
      {...pointerHandlers}
      onContextMenu={(event) => event.preventDefault()}
    >
      <motion.div
        className="rounded-[22px]"
        animate={
          isActiveDrag || isLongPressPrimed
            ? {
                boxShadow: '0 20px 44px rgba(28, 28, 30, 0.22)',
              }
            : {
                boxShadow: isEditMode ? '0 10px 22px rgba(28, 28, 30, 0.08)' : '0 0 0 rgba(0,0,0,0)',
              }
        }
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <AppIconTile
          appId={app.id}
          bgSize={iconBg}
          glyphSize={iconGlyph}
          badgeCount={app.id === 'wechat' ? badgeCount : 0}
        />
      </motion.div>
      <span
        className="w-full max-w-full truncate px-1 text-center font-medium tracking-tight"
        style={{
          fontSize: labelSize,
          lineHeight: 1.25,
          color: theme.appLabelColor,
          opacity: isEditMode ? 0.94 : 1,
        }}
      >
        {app.label}
      </span>
    </Pressable>
  )
}
