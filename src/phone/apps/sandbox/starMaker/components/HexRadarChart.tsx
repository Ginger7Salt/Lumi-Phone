function polar(cx: number, cy: number, r: number, i: number, total: number) {
  const angle = (Math.PI * 2 * i) / total - Math.PI / 2
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
}

export function HexRadarChart<K extends string>({
  stats,
  axes,
  labels,
  size = 120,
  maxValue = 100,
}: {
  stats: Record<K, number>
  axes: readonly K[]
  labels: Record<K, string>
  size?: number
  maxValue?: number
}) {
  const cx = size / 2
  const cy = size / 2
  const total = axes.length
  const maxR = size * 0.38
  const labelR = maxR + (size >= 160 ? 18 : 14)
  const levels = [0.25, 0.5, 0.75, 1]
  const fontSize = size >= 160 ? 9 : 8

  const dataPoints = axes.map((key, i) => {
    const v = Math.max(0, Math.min(maxValue, stats[key])) / maxValue
    return polar(cx, cy, maxR * v, i, total)
  })

  const gridPolys = levels.map((lv) =>
    axes
      .map((_, i) => polar(cx, cy, maxR * lv, i, total))
      .map((p) => `${p.x},${p.y}`)
      .join(' '),
  )

  const dataPoly = dataPoints.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {gridPolys.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="rgba(251,207,232,0.55)"
          strokeWidth="0.6"
        />
      ))}
      {axes.map((_, i) => {
        const p = polar(cx, cy, maxR, i, total)
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="rgba(251,207,232,0.45)"
            strokeWidth="0.5"
          />
        )
      })}
      <polygon
        points={dataPoly}
        fill="rgba(244,114,182,0.22)"
        stroke="rgba(225,29,72,0.45)"
        strokeWidth="1.2"
      />
      {axes.map((key, i) => {
        const p = polar(cx, cy, labelR, i, total)
        return (
          <text
            key={key}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#78716c"
            fontSize={fontSize}
            fontFamily="var(--phone-font)"
          >
            {labels[key]}
          </text>
        )
      })}
    </svg>
  )
}
