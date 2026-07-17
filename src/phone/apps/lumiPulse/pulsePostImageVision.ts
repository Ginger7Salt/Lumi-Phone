import { compressAvatarDataUrl } from '../wechat/avatarCompress'
import {
  pulsePostReadyImageUrls,
  type PulsePost,
} from './pulseTypes'

const MAX_VISION_IMAGES = 4
/** vision 单张上限：本地相册图可能很大，压后再送 Gemini */
const MAX_VISION_DATA_URL_LEN = 900_000

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}

/** data URL / blob / 同源路径 → vision 可用的 data:image/...;base64,... */
export async function resolvePulseVisionImageDataUrl(rawUrl: string): Promise<string> {
  const url = rawUrl.trim()
  if (!url) return ''
  if (/^data:image\//i.test(url) && /;base64,/i.test(url)) return url

  try {
    const res = await fetch(url)
    if (!res.ok) return ''
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return ''
    return await blobToDataUrl(blob)
  } catch {
    return ''
  }
}

/**
 * 收集帖子配图为可注入 Gemini / OpenAI vision 的 data URL。
 * 本地上传图本身就是 data URL；远程/blob 会先拉取再压缩。
 */
export async function collectPulsePostVisionImageDataUrls(
  post: Pick<PulsePost, 'images' | 'imageUrls'>,
): Promise<string[]> {
  const urls = pulsePostReadyImageUrls(post).slice(0, MAX_VISION_IMAGES)
  if (!urls.length) return []

  const out: string[] = []
  for (const url of urls) {
    const resolved = await resolvePulseVisionImageDataUrl(url)
    if (!resolved) continue
    try {
      const compressed = await compressAvatarDataUrl(resolved, MAX_VISION_DATA_URL_LEN)
      if (/^data:image\//i.test(compressed) && /;base64,/i.test(compressed)) {
        out.push(compressed)
        continue
      }
    } catch {
      /* 压缩失败则尝试原图 */
    }
    if (/^data:image\//i.test(resolved) && /;base64,/i.test(resolved)) {
      out.push(resolved)
    }
  }
  return out
}
