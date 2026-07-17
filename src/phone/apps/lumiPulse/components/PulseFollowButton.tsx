import { Pressable } from '../../../components/Pressable'
import { PULSE_COLORS } from '../constants'
import {
  pulseFollowRelationIsPrimary,
  pulseFollowRelationLabel,
  type PulseFollowRelation,
} from '../pulseFollowRelation'

/** 关注关系四态按钮：关注 / 已关注 / 回关 / 互相关注 */
export function PulseFollowButton({
  relation,
  onClick,
  className = '',
  compact = false,
}: {
  relation: PulseFollowRelation
  onClick: () => void
  className?: string
  /** 列表行内更紧凑 */
  compact?: boolean
}) {
  const primary = pulseFollowRelationIsPrimary(relation)
  return (
    <Pressable
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`shrink-0 rounded-full font-medium transition-colors ${
        compact ? 'px-3 py-1 text-[12px]' : 'px-4 py-1.5 text-[12px]'
      } ${className}`.trim()}
      style={{
        backgroundColor: primary ? PULSE_COLORS.dustyRose : '#F5F5F4',
        color: primary ? '#fff' : '#1C1C1E',
      }}
      aria-label={pulseFollowRelationLabel(relation)}
    >
      {pulseFollowRelationLabel(relation)}
    </Pressable>
  )
}
