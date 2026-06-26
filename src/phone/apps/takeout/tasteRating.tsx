import { useId } from 'react'

import { tasteNumStyle } from './tasteTypography'

const STAR_POINTS = '12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26'

function StarIcon({
  fillRatio,
  size = 12,
  color = '#1C1C1E',
  clipId,
}: {
  fillRatio: number
  size?: number
  color?: string
  clipId: string
}) {
  const clamped = Math.max(0, Math.min(1, fillRatio))

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={24 * clamped} height="24" />
        </clipPath>
      </defs>
      <polygon
        points={STAR_POINTS}
        fill="none"
        stroke={color}
        strokeWidth="1.15"
        opacity={0.28}
      />
      {clamped > 0 ? (
        <polygon
          points={STAR_POINTS}
          fill={color}
          stroke={color}
          strokeWidth="1.15"
          clipPath={`url(#${clipId})`}
        />
      ) : null}
    </svg>
  )
}

export function TasteStarRating({
  value,
  size = 12,
  showValue = false,
  className = '',
}: {
  value: number
  size?: number
  showValue?: boolean
  className?: string
}) {
  const baseId = useId()
  const clampedValue = Math.max(0, Math.min(5, value))

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="inline-flex items-center gap-0.5" aria-label={`评分 ${clampedValue.toFixed(1)}`}>
        {Array.from({ length: 5 }, (_, i) => {
          const fillRatio = Math.max(0, Math.min(1, clampedValue - i))
          return (
            <StarIcon
              key={i}
              fillRatio={fillRatio}
              size={size}
              clipId={`${baseId}-star-${i}`}
            />
          )
        })}
      </span>
      {showValue ? (
        <span className="text-[12px] font-medium text-[#1C1C1E]" style={tasteNumStyle}>
          {clampedValue.toFixed(1)}
        </span>
      ) : null}
    </span>
  )
}

export function TasteReviewIcon({ size = 13, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TasteDeliveryIcon({ size = 13, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
