import { Pressable } from '../../../components/Pressable'
import { PULSE_COLORS } from '../constants'
import type { PulseTrendingTag, PulseTrendingTopic } from '../pulseTypes'
import { formatPulseCount } from '../pulseTypes'
import { PulseNum, PulseNumericText } from './PulseNum'
import { PulseWeiboFaceText } from './PulseWeiboFaceText'

const TAG_STYLE: Record<PulseTrendingTag, string> = {
  新: 'bg-[#A3C4BC] text-white',
  热: 'bg-[#E5989B] text-white',
  爆: 'bg-[#D4AF37] text-white',
}

/** 热搜榜标题：去掉包裹的 #话题#，按普通文案显示 */
function plainTrendingTitle(title: string): string {
  const t = title.trim()
  if (t.startsWith('#') && t.endsWith('#') && t.length > 2) {
    return t.slice(1, -1).trim() || t
  }
  return t.replace(/#([^#\n]+)#/g, '$1').trim() || t
}

function rankColor(rank: number): string {
  if (rank === 1) return PULSE_COLORS.lightGold
  if (rank === 2) return PULSE_COLORS.dustyRose
  if (rank === 3) return PULSE_COLORS.dustyRose
  return '#D1D5DB'
}

export function TrendingItem({
  topic,
  index,
  onPress,
}: {
  topic: PulseTrendingTopic
  index: number
  onPress?: () => void
}) {
  const rank = index + 1

  const body = (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_2px_15px_rgba(0,0,0,0.03)]">
      <PulseNum
        className="w-7 shrink-0 text-center text-[17px] font-semibold"
        style={{ color: rankColor(rank) }}
      >
        {rank}
      </PulseNum>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[15px] text-[#1C1C1E]">
          <PulseNumericText text={plainTrendingTitle(topic.title)} />
        </p>
        {topic.excerpt ? (
          <p className="mt-0.5 truncate text-[12px] text-neutral-400">
            <PulseWeiboFaceText text={topic.excerpt} />
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {topic.tag ? (
          <span
            className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${TAG_STYLE[topic.tag]}`}
          >
            {topic.tag}
          </span>
        ) : null}
        {topic.postCount && topic.postCount > 0 ? (
          <PulseNum className="text-[10px] text-neutral-400">
            {formatPulseCount(topic.postCount)}
          </PulseNum>
        ) : topic.heatLabel ? (
          <PulseNum className="text-[10px] text-neutral-400">{topic.heatLabel}</PulseNum>
        ) : null}
      </div>
    </div>
  )

  if (!onPress) return body
  return (
    <Pressable type="button" onClick={onPress} className="block w-full text-left">
      {body}
    </Pressable>
  )
}
