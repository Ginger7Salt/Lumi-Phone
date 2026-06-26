/** 由 seed 生成有机灰度城市地图底纹（非方块马赛克） */

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededUnit(seed: number, salt: number): number {
  const x = Math.sin((seed + salt) * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function grayHex(seed: number, salt: number, min = 196, max = 232): string {
  const t = seededUnit(seed, salt)
  const v = Math.floor(min + t * (max - min))
  const h = v.toString(16).padStart(2, '0')
  return `#${h}${h}${h}`
}

type Pt = { x: number; y: number }

function pickPoints(seed: number, w: number, h: number, count: number): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < count; i += 1) {
    pts.push({
      x: w * (0.1 + seededUnit(seed, 20 + i * 3) * 0.8),
      y: h * (0.12 + seededUnit(seed, 21 + i * 3) * 0.76),
    })
  }
  return pts
}

function dist(a: Pt, b: Pt): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function nearestIndices(pts: Pt[], i: number, k: number): number[] {
  const scored = pts
    .map((p, j) => ({ j, d: i === j ? Infinity : dist(pts[i]!, p) }))
    .sort((a, b) => a.d - b.d)
  return scored.slice(0, k).map((x) => x.j)
}

function curveRoad(a: Pt, b: Pt, seed: number, salt: number): string {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy))
  const nx = -dy / len
  const ny = dx / len
  const bend = (seededUnit(seed, salt) - 0.5) * len * 0.35
  const cx = mx + nx * bend
  const cy = my + ny * bend
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

function riverPath(seed: number, w: number, h: number): string | null {
  if (seededUnit(seed, 900) < 0.35) return null
  const y0 = h * (0.55 + seededUnit(seed, 901) * 0.25)
  const c1x = w * (0.2 + seededUnit(seed, 902) * 0.25)
  const c1y = y0 - h * (0.08 + seededUnit(seed, 903) * 0.12)
  const c2x = w * (0.55 + seededUnit(seed, 904) * 0.25)
  const c2y = y0 + h * (0.06 + seededUnit(seed, 905) * 0.1)
  const x1 = w * 0.95
  const y1 = y0 + h * (seededUnit(seed, 906) - 0.5) * 0.08
  const width = 14 + seededUnit(seed, 907) * 22
  return `<path d="M -20 ${y0.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x1.toFixed(1)} ${(y1 + width).toFixed(1)} C ${c2x.toFixed(1)} ${(c2y + width * 0.6).toFixed(1)}, ${c1x.toFixed(1)} ${(c1y + width).toFixed(1)}, -20 ${(y0 + width).toFixed(1)} Z" fill="#e4e4e4" opacity="0.85"/>`
}

function parkEllipses(seed: number, w: number, h: number): string[] {
  const out: string[] = []
  const n = seededUnit(seed, 800) > 0.45 ? 2 : 1
  for (let i = 0; i < n; i += 1) {
    const cx = w * (0.15 + seededUnit(seed, 810 + i * 4) * 0.7)
    const cy = h * (0.15 + seededUnit(seed, 811 + i * 4) * 0.65)
    const rx = 28 + seededUnit(seed, 812 + i * 4) * 56
    const ry = 20 + seededUnit(seed, 813 + i * 4) * 40
    out.push(
      `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#e8ebe8" opacity="0.9"/>`,
    )
  }
  return out
}

function buildingFootprints(seed: number, hubs: Pt[]): string[] {
  const out: string[] = []
  let salt = 500
  for (let hi = 0; hi < hubs.length; hi += 1) {
    const hub = hubs[hi]!
    const clusterSize = 3 + Math.floor(seededUnit(seed, salt++) * 5)
    for (let j = 0; j < clusterSize; j += 1) {
      const angle = seededUnit(seed, salt++) * Math.PI * 2
      const radius = 8 + seededUnit(seed, salt++) * 42
      const bx = hub.x + Math.cos(angle) * radius
      const by = hub.y + Math.sin(angle) * radius
      const bw = 10 + seededUnit(seed, salt++) * 28
      const bh = 8 + seededUnit(seed, salt++) * 22
      const rot = (seededUnit(seed, salt++) - 0.5) * 28
      const rx = 2 + seededUnit(seed, salt++) * 4
      const fill = grayHex(seed, salt++, 188, 218)
      const op = 0.55 + seededUnit(seed, salt++) * 0.38
      out.push(
        `<rect x="${(-bw / 2).toFixed(1)}" y="${(-bh / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${rx.toFixed(1)}" fill="${fill}" opacity="${op.toFixed(2)}" transform="translate(${bx.toFixed(1)} ${by.toFixed(1)}) rotate(${rot.toFixed(1)})"/>`,
      )
    }
  }
  return out
}

function spineRoads(seed: number, w: number, h: number): string[] {
  const out: string[] = []
  const n = 3 + Math.floor(seededUnit(seed, 700) * 3)
  for (let i = 0; i < n; i += 1) {
    const horizontal = seededUnit(seed, 710 + i) > 0.5
    if (horizontal) {
      const y = h * (0.2 + seededUnit(seed, 720 + i) * 0.6)
      const c1x = w * (0.25 + seededUnit(seed, 730 + i) * 0.2)
      const c1y = y + (seededUnit(seed, 740 + i) - 0.5) * h * 0.15
      const c2x = w * (0.55 + seededUnit(seed, 750 + i) * 0.2)
      const c2y = y + (seededUnit(seed, 760 + i) - 0.5) * h * 0.12
      const d = `M 0 ${y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${w} ${(y + (seededUnit(seed, 770 + i) - 0.5) * 20).toFixed(1)}`
      const width = 5 + seededUnit(seed, 780 + i) * 4
      out.push(
        `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${width.toFixed(1)}" stroke-linecap="round" opacity="0.88"/>`,
      )
    } else {
      const x = w * (0.15 + seededUnit(seed, 720 + i) * 0.7)
      const c1y = h * (0.25 + seededUnit(seed, 730 + i) * 0.2)
      const c1x = x + (seededUnit(seed, 740 + i) - 0.5) * w * 0.12
      const c2y = h * (0.55 + seededUnit(seed, 750 + i) * 0.2)
      const c2x = x + (seededUnit(seed, 760 + i) - 0.5) * w * 0.1
      const d = `M ${x.toFixed(1)} 0 C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${(x + (seededUnit(seed, 770 + i) - 0.5) * 18).toFixed(1)} ${h}`
      const width = 4 + seededUnit(seed, 780 + i) * 3.5
      out.push(
        `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${width.toFixed(1)}" stroke-linecap="round" opacity="0.65"/>`,
      )
    }
  }
  return out
}

export function createMapImageSeed(): string {
  return `map-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function buildGrayscaleMapDataUrl(seed: string, w = 640, h = 360): string {
  const s = hashSeed(seed)
  const hubCount = 7 + Math.floor(seededUnit(s, 2) * 6)
  const hubs = pickPoints(s, w, h, hubCount)

  const connectorRoads: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < hubs.length; i += 1) {
    for (const j of nearestIndices(hubs, i, 2)) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (seen.has(key)) continue
      seen.add(key)
      const d = curveRoad(hubs[i]!, hubs[j]!, s, 100 + i * 7 + j)
      const width = 2.2 + seededUnit(s, 200 + i + j) * 2.2
      connectorRoads.push(
        `<path d="${d}" fill="none" stroke="#f7f7f7" stroke-width="${width.toFixed(1)}" stroke-linecap="round" opacity="0.8"/>`,
      )
    }
  }

  const blocks = buildingFootprints(s, hubs)
  const parks = parkEllipses(s, w, h)
  const spines = spineRoads(s, w, h)
  const river = riverPath(s, w, h)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#ececec"/>
<stop offset="55%" stop-color="#e2e2e2"/>
<stop offset="100%" stop-color="#d6d6d6"/>
</linearGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
${river ?? ''}
${parks.join('\n')}
${blocks.join('\n')}
${spines.join('\n')}
${connectorRoads.join('\n')}
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
