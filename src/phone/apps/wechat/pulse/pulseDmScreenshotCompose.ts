/**
 * 将「微博私信」对话合成一张截图感图片（Canvas，不依赖 html2canvas）。
 * 视觉对齐 PulseBubble：云朵气泡、淡玫瑰己方、白底对方。
 */

export type PulseDmScreenshotLine = {
  /** self=角色自己（截图右侧）；peer=网友 */
  from: 'self' | 'peer'
  content: string
}

export type PulseDmScreenshotComposeInput = {
  peerName: string
  lines: PulseDmScreenshotLine[]
  /** 可选状态栏时间展示 */
  clockLabel?: string
}

const W = 390
const PAD_X = 16
const BUBBLE_MAX_W = 260
const FONT =
  '15px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif'
const FONT_SM =
  '11px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif'
const FONT_TITLE =
  '16px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif'

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const src = text.replace(/\s+/g, ' ').trim() || '…'
  const lines: string[] = []
  let cur = ''
  for (const ch of src) {
    const next = cur + ch
    if (ctx.measureText(next).width > maxWidth && cur) {
      lines.push(cur)
      cur = ch
    } else {
      cur = next
    }
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 12)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** 合成 data URL（jpeg），失败返回 null */
export async function composePulseDmScreenshotDataUrl(
  input: PulseDmScreenshotComposeInput,
): Promise<string | null> {
  if (typeof document === 'undefined') return null
  const peerName = input.peerName.trim().slice(0, 18) || '网友'
  const lines = input.lines
    .map((l) => ({
      from: l.from === 'self' ? ('self' as const) : ('peer' as const),
      content: String(l.content ?? '').trim().slice(0, 280),
    }))
    .filter((l) => l.content)
    .slice(0, 10)
  if (!lines.length) return null

  const canvas = document.createElement('canvas')
  const scale = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2)
  const measureCtx = canvas.getContext('2d')
  if (!measureCtx) return null
  measureCtx.font = FONT

  type Laid = {
    from: 'self' | 'peer'
    textLines: string[]
    bubbleW: number
    bubbleH: number
  }
  const laid: Laid[] = []
  let contentH = 0
  for (const row of lines) {
    const textLines = wrapText(measureCtx, row.content, BUBBLE_MAX_W - 28)
    let tw = 0
    for (const tl of textLines) tw = Math.max(tw, measureCtx.measureText(tl).width)
    const bubbleW = Math.min(BUBBLE_MAX_W, Math.max(48, Math.ceil(tw) + 28))
    const bubbleH = textLines.length * 22 + 20
    laid.push({ from: row.from, textLines, bubbleW, bubbleH })
    contentH += bubbleH + 22
  }

  const headerH = 52
  const footerHintH = 28
  const H = headerH + 16 + contentH + footerHintH + 12
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(scale, scale)

  // bg
  ctx.fillStyle = '#F7F7F8'
  ctx.fillRect(0, 0, W, H)

  // header
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, headerH)
  ctx.fillStyle = 'rgba(0,0,0,0.06)'
  ctx.fillRect(0, headerH - 0.5, W, 0.5)
  ctx.fillStyle = '#2D2422'
  ctx.font = FONT_TITLE
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(peerName, W / 2, headerH / 2 - 6)
  ctx.font = FONT_SM
  ctx.fillStyle = '#A3A3A3'
  ctx.fillText('微博私信', W / 2, headerH / 2 + 12)

  // optional clock top-left like status
  const clock = input.clockLabel?.trim()
  if (clock) {
    ctx.textAlign = 'left'
    ctx.fillStyle = '#8A8A8A'
    ctx.font = FONT_SM
    ctx.fillText(clock, 14, 16)
  }

  let y = headerH + 16
  for (const row of laid) {
    const x = row.from === 'self' ? W - PAD_X - row.bubbleW : PAD_X
    if (row.from === 'self') {
      ctx.fillStyle = '#FFF5F7'
    } else {
      ctx.fillStyle = '#FFFFFF'
      ctx.strokeStyle = 'rgba(0,0,0,0.06)'
      ctx.lineWidth = 0.8
    }
    roundRect(ctx, x, y, row.bubbleW, row.bubbleH, 18)
    ctx.fill()
    if (row.from === 'peer') ctx.stroke()

    ctx.fillStyle = '#2D2422'
    ctx.font = FONT
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    let ty = y + 10
    for (const tl of row.textLines) {
      ctx.fillText(tl, x + 14, ty)
      ty += 22
    }
    y += row.bubbleH + 22
  }

  ctx.fillStyle = '#B0B0B0'
  ctx.font = FONT_SM
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('微博 · 私信截图', W / 2, H - footerHintH / 2)

  try {
    return canvas.toDataURL('image/jpeg', 0.92)
  } catch {
    return null
  }
}

export function dataUrlToWeChatImagePayload(dataUrl: string): {
  base64: string
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
} | null {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i.exec(dataUrl.trim())
  if (!m) return null
  const mime = m[1]!.toLowerCase() as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  const base64 = m[2]!.trim()
  if (!base64) return null
  return { base64, mime }
}
