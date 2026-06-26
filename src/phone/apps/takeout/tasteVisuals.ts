/** 柔和黑白极简风 · 程序化 editorial 配图（无外链依赖） */

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function unit(seed: number, salt: number): number {
  const x = Math.sin((seed + salt) * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function buildTasteEditorialImage(seedKey: string, aspect: 'wide' | 'square' = 'wide'): string {
  const seed = hashSeed(seedKey)
  const w = aspect === 'wide' ? 840 : 400
  const h = aspect === 'wide' ? 360 : 400
  const base = Math.floor(240 + unit(seed, 1) * 24)
  const accent = Math.floor(base - 18 - unit(seed, 2) * 12)
  const shapes: string[] = []
  const count = aspect === 'wide' ? 5 : 3
  for (let i = 0; i < count; i += 1) {
    const cx = w * (0.15 + unit(seed, 10 + i * 3) * 0.7)
    const cy = h * (0.2 + unit(seed, 20 + i * 3) * 0.6)
    const rw = w * (0.08 + unit(seed, 30 + i) * 0.18)
    const rh = h * (0.06 + unit(seed, 40 + i) * 0.14)
    const rot = unit(seed, 50 + i) * 24 - 12
    shapes.push(
      `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rw.toFixed(1)}" ry="${rh.toFixed(1)}" fill="rgb(${accent},${accent},${accent})" opacity="0.35" transform="rotate(${rot.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`,
    )
  }
  const lineY = h * (0.55 + unit(seed, 7) * 0.25)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgb(${base + 8},${base + 8},${base + 10})"/>
      <stop offset="100%" stop-color="rgb(${base - 6},${base - 4},${base - 2})"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  ${shapes.join('')}
  <line x1="${(w * 0.08).toFixed(1)}" y1="${lineY.toFixed(1)}" x2="${(w * 0.92).toFixed(1)}" y2="${lineY.toFixed(1)}" stroke="rgba(212,175,55,0.22)" stroke-width="0.5"/>
</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
