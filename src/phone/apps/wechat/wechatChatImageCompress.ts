import { logConsole } from './consoleLogger'

/** 微信聊天图片压到 1MB 以内，提升加载与存储效率 */
const MAX_BYTES = 1 * 1024 * 1024

async function blobToBase64DataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result || ''))
    fr.onerror = () => reject(fr.error ?? new Error('FileReader'))
    fr.readAsDataURL(blob)
  })
}

export async function compressChatImageToJpeg(params: {
  source: CanvasImageSource
  width: number
  height: number
}): Promise<string> {
  const { source } = params

  const clampTo = (maxSide: number) => {
    const w0 = params.width
    const h0 = params.height
    const max = Math.max(w0, h0)
    if (max <= maxSide) return { w: w0, h: h0 }
    const scale = maxSide / max
    return { w: Math.round(w0 * scale), h: Math.round(h0 * scale) }
  }

  const tryEncode = async (w: number, h: number, quality: number) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('无法处理图片')
    ctx.drawImage(source, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', quality))
    if (!blob) throw new Error('图片编码失败')
    return blob
  }

  let { w, h } = clampTo(1280)
  let q = 0.82
  for (let i = 0; i < 6; i += 1) {
    const blob = await tryEncode(w, h, q)
    if (blob.size <= MAX_BYTES) {
      logConsole('frontend', `图片压缩OK：${w}x${h} q=${q.toFixed(2)} bytes=${blob.size}`)
      const dataUrl = await blobToBase64DataUrl(blob)
      return dataUrl.replace(/^data:image\/jpeg;base64,/i, '').trim()
    }
    q = Math.max(0.5, q - 0.08)
  }

  ;({ w, h } = clampTo(960))
  q = 0.78
  for (let i = 0; i < 8; i += 1) {
    const blob = await tryEncode(w, h, q)
    if (blob.size <= MAX_BYTES) {
      logConsole('frontend', `图片压缩OK(降尺寸)：${w}x${h} q=${q.toFixed(2)} bytes=${blob.size}`)
      const dataUrl = await blobToBase64DataUrl(blob)
      return dataUrl.replace(/^data:image\/jpeg;base64,/i, '').trim()
    }
    q = Math.max(0.45, q - 0.06)
  }

  const last = await tryEncode(w, h, q)
  logConsole('frontend', `图片压缩仍超限仍返回：${w}x${h} q=${q.toFixed(2)} bytes=${last.size}`)
  const dataUrl = await blobToBase64DataUrl(last)
  return dataUrl.replace(/^data:image\/jpeg;base64,/i, '').trim()
}

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const el = new window.Image()
    el.onload = () => {
      URL.revokeObjectURL(url)
      resolve(el)
    }
    el.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败'))
    }
    el.src = url
  })
}
