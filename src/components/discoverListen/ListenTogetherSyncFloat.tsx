import { motion } from 'framer-motion'
import { Plus, UserRound } from 'lucide-react'
import { useId } from 'react'

import type { SyncListeningState } from '../../stores/useMusicStore'
import { ListenNumericText } from './ListenNum'
import { useSyncListeningDurationLabel } from './useSyncListeningDurationLabel'

type Props = {
  sync: SyncListeningState | null
  userAvatar: string
  userName: string
  onInviteClick: () => void
}

const AVATAR_PX = 52
/** 两头像重叠后行宽约 92px：52 + 52 - 12 */
const AVATAR_ROW_W = 92
/** 耳机线与头像外缘的水平间距 */
const WIRE_GAP = 10
/** 容器两侧留白，容纳外移的耳机线 */
const SIDE_PAD = 16
const GROUP_W = AVATAR_ROW_W + SIDE_PAD * 2
const WIRE_BELOW = 50
const TOTAL_H = AVATAR_PX + WIRE_BELOW

const AVATAR_GROUP_LEFT = SIDE_PAD
const WIRE_LEFT_X = AVATAR_GROUP_LEFT - WIRE_GAP
const WIRE_RIGHT_X = AVATAR_GROUP_LEFT + AVATAR_ROW_W + WIRE_GAP

function UserAvatar({ src, name }: { src: string; name: string }) {
  return (
    <div
      className="relative z-10 h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full ring-[2.5px] ring-white shadow-[0_4px_16px_rgba(120,113,108,0.12)]"
      title={name}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-stone-100 text-stone-400">
          <UserRound className="size-6" strokeWidth={1.5} aria-hidden />
        </div>
      )}
    </div>
  )
}

/**
 * 从头像两侧垂下的耳机线：顶部向外小弧，再垂直向下渐隐
 */
function SyncVerticalHeadphoneWires({ connected }: { connected: boolean }) {
  const uid = useId().replace(/:/g, '')
  const wireGradId = `sync-wire-grad-${uid}`

  const wireStroke = connected ? '#f9a8d4' : '#d6d3d1'
  const budFill = connected ? '#fb7185' : '#a8a29e'

  const leftX = WIRE_LEFT_X
  const rightX = WIRE_RIGHT_X
  const wireTopY = AVATAR_PX / 2
  const wireBottomY = TOTAL_H
  /** 顶部向外弯折后，垂直段 x 偏移 */
  const arcOutset = 5
  const arcDrop = 11

  const leftVertX = leftX - arcOutset
  const rightVertX = rightX + arcOutset
  const leftPath = `M ${leftX} ${wireTopY} C ${leftX - 2} ${wireTopY + 2}, ${leftVertX + 1} ${wireTopY + 6}, ${leftVertX} ${wireTopY + arcDrop} L ${leftVertX} ${wireBottomY}`
  const rightPath = `M ${rightX} ${wireTopY} C ${rightX + 2} ${wireTopY + 2}, ${rightVertX - 1} ${wireTopY + 6}, ${rightVertX} ${wireTopY + arcDrop} L ${rightVertX} ${wireBottomY}`

  return (
    <svg
      width={GROUP_W}
      height={TOTAL_H}
      viewBox={`0 0 ${GROUP_W} ${TOTAL_H}`}
      fill="none"
      className="pointer-events-none absolute inset-0"
      aria-hidden
    >
      <defs>
        <linearGradient
          id={wireGradId}
          x1="0"
          y1={wireTopY}
          x2="0"
          y2={wireBottomY}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={wireStroke} stopOpacity="0.95" />
          <stop offset="55%" stopColor={wireStroke} stopOpacity="0.55" />
          <stop offset="100%" stopColor={wireStroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 左线：外缘小弧 → 垂直向下 */}
      <path
        d={leftPath}
        stroke={`url(#${wireGradId})`}
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* 右线：外缘小弧 → 垂直向下 */}
      <path
        d={rightPath}
        stroke={`url(#${wireGradId})`}
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={connected ? undefined : '3.5 2.5'}
        opacity={connected ? 1 : 0.75}
      />

      {/* 左耳塞（贴外缘） */}
      <circle cx={leftX} cy={wireTopY} r="3" fill={budFill} opacity="0.92" />
      {/* 右耳塞（贴外缘） */}
      <circle
        cx={rightX}
        cy={wireTopY}
        r="3"
        fill={budFill}
        opacity={connected ? 0.92 : 0.42}
      />
    </svg>
  )
}

/** 全屏播放器：一起听（双头像 + 两侧垂直耳机线） */
export function ListenTogetherSyncFloat({
  sync,
  userAvatar,
  userName,
  onInviteClick,
}: Props) {
  const connected = Boolean(sync)
  const durationLabel = useSyncListeningDurationLabel(connected ? sync!.companion : null)

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto relative z-20 mb-1 flex flex-col items-center"
    >
      <div
        className="relative flex flex-col items-center"
        style={{ width: GROUP_W, height: TOTAL_H }}
      >
        <div className="relative z-10 flex items-center justify-center">
          <UserAvatar src={userAvatar} name={userName} />

          {connected ? (
            <div
              className="relative z-0 -ml-3 h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full ring-[2.5px] ring-white shadow-[0_4px_16px_rgba(120,113,108,0.12)]"
              title={sync!.companion.name}
            >
              {sync!.companion.avatar ? (
                <img
                  src={sync!.companion.avatar}
                  alt={sync!.companion.name}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-stone-100 text-stone-400">
                  <UserRound className="size-6" strokeWidth={1.5} aria-hidden />
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onInviteClick()
              }}
              aria-label="邀请角色一起听"
              className="group relative z-0 -ml-3 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-dashed border-stone-300/90 bg-white/40 text-stone-400 shadow-[0_2px_12px_rgba(120,113,108,0.08)] ring-[2.5px] ring-white transition-all hover:border-rose-300 hover:bg-rose-50/50 hover:text-rose-400 active:scale-95"
            >
              <Plus
                className="size-5 transition-transform group-hover:scale-110"
                strokeWidth={1.75}
              />
            </button>
          )}
        </div>

        <SyncVerticalHeadphoneWires connected={connected} />
      </div>

      {connected ? (
        <div className="mt-0.5 max-w-[min(100%,280px)] text-center">
          <p className="text-[12px] leading-relaxed text-stone-500">
            与 <span className="font-medium text-stone-700">{sync!.companion.name}</span> 一起听
          </p>
          {durationLabel ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-stone-400">
              已累计一起听{' '}
              <ListenNumericText text={durationLabel} className="font-medium text-stone-600" />
            </p>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  )
}
