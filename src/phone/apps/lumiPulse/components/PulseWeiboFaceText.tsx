import { useMemo } from 'react'

import { parsePulseWeiboFaceText } from '../pulseWeiboFace'
import { PulseNumericText } from './PulseNum'

/** 渲染含 [doge] 等微博专属表情的正文 */
export function PulseWeiboFaceText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const parts = useMemo(() => parsePulseWeiboFaceText(text), [text])

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === 'text' ? (
          <PulseNumericText key={`t-${i}`} text={part.value} className="whitespace-pre-wrap" />
        ) : (
          <img
            key={`f-${i}-${part.name}`}
            src={part.url}
            alt={`[${part.name}]`}
            title={`[${part.name}]`}
            className="mx-px inline-block size-[18px] align-[-4px] object-contain"
            draggable={false}
          />
        ),
      )}
    </span>
  )
}
