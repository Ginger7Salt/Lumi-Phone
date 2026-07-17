import type { LucideIcon } from 'lucide-react'

import { Pressable } from '../../../components/Pressable'
import { PulseNumericText } from './PulseNum'

function formatUnreadLabel(count: number): string {
  return count > 99 ? '99+' : String(Math.max(0, Math.floor(count)))
}

export function NotificationCell({
  label,
  Icon,
  tintBg,
  iconColor,
  unreadCount = 0,
  active,
  onPress,
}: {
  label: string
  Icon: LucideIcon
  tintBg: string
  iconColor: string
  /** 未读条数；>0 显示数字红点 */
  unreadCount?: number
  active?: boolean
  onPress?: () => void
}) {
  const unread = Math.max(0, Math.floor(unreadCount))
  return (
    <Pressable
      type="button"
      onClick={onPress}
      className={`relative flex flex-1 flex-col items-center gap-2 rounded-2xl px-1 py-3.5 shadow-[0_2px_15px_rgba(0,0,0,0.03)] ${
        active ? 'bg-[#FCFCFC] ring-1 ring-[#E5989B]/25' : 'bg-white'
      }`}
    >
      <div
        className="relative flex size-12 items-center justify-center rounded-full"
        style={{ backgroundColor: tintBg }}
      >
        <Icon className="size-5" strokeWidth={1.4} style={{ color: iconColor }} />
        {unread > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-[4px] text-[9px] font-bold leading-none text-white ring-[1.5px] ring-white"
            style={{ background: '#fa5151' }}
            aria-label={`${unread} 条未读`}
          >
            <PulseNumericText
              text={formatUnreadLabel(unread)}
              className="text-[9px] font-bold leading-none text-white"
            />
          </span>
        ) : null}
      </div>
      <span className="text-[12px] text-[#1C1C1E]">{label}</span>
    </Pressable>
  )
}
