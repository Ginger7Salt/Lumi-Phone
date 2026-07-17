import { PulseWeiboFaceText } from './PulseWeiboFaceText'

/** 私信气泡时间：今天 HH:mm / 昨天 HH:mm / 月日 HH:mm */
export function formatPulseDmBubbleTime(ts: number, nowMs = Date.now()): string {
  if (!Number.isFinite(ts) || ts <= 0) return ''
  const d = new Date(ts)
  const now = new Date(nowMs)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const clock = `${hh}:${mm}`

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((startOfToday - startOfThat) / 86_400_000)

  if (dayDiff === 0) return clock
  if (dayDiff === 1) return `昨天 ${clock}`
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${clock}`
  }
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${clock}`
}

/**
 * 微博私信「云朵」气泡 —— 大圆角纸条形态，无微信尾巴。
 * 网友：白底轻边；自己：极淡玫瑰灰。
 * 宽度随文本伸缩，最长不超过消息列。
 */
export function PulseBubble({
  fromSelf,
  content,
  timestamp,
  className = '',
}: {
  fromSelf: boolean
  content: string
  timestamp?: number
  className?: string
}) {
  const timeLabel =
    timestamp != null && Number.isFinite(timestamp) ? formatPulseDmBubbleTime(timestamp) : ''

  return (
    <div
      className={`mb-5 flex max-w-full flex-col ${fromSelf ? 'items-end' : 'items-start'} ${className}`.trim()}
    >
      <div
        className={`inline-block max-w-full rounded-[20px] px-3.5 py-2.5 text-[15px] leading-relaxed ${
          fromSelf
            ? 'bg-[#FFF5F7] text-[#2D2422] shadow-[0_2px_10px_rgba(229,152,155,0.06)]'
            : 'border-[0.5px] border-gray-100 bg-white text-[#2D2422] shadow-[0_2px_10px_rgba(0,0,0,0.02)]'
        }`}
      >
        <PulseWeiboFaceText text={content} className="break-words" />
      </div>
      {timeLabel ? (
        <p className="mt-1.5 px-1 text-[10px] tracking-wide text-neutral-300">{timeLabel}</p>
      ) : null}
    </div>
  )
}
