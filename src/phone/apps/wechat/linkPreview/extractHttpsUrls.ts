const HTTP_URL_RE = /https?:\/\/[^\s<>"')\]}，。；、]+/gi

const TRAILING_PUNCT_RE = /[)\]}>,.;!?，。；、：:]+$/u

/** 分享短链常带 http，解析前统一升为 https */
function upgradeInsecureShareUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:') return url
    const host = u.hostname.toLowerCase()
    const shareHost =
      host.includes('xhslink.com') ||
      host.includes('douyin.com') ||
      host.includes('iesdouyin.com') ||
      host.includes('xiaohongshu.com') ||
      host.includes('b23.tv') ||
      host.includes('bilibili.com')
    if (!shareHost) return url
    u.protocol = 'https:'
    return u.href
  } catch {
    return url
  }
}

function cleanExtractedUrl(raw: string): string {
  return upgradeInsecureShareUrl(raw.replace(TRAILING_PUNCT_RE, '').trim())
}

/** 从用户消息文本中提取 http(s) 链接（去重、保序）；口令/营销文案会被忽略 */
export function extractHttpsUrls(text: string, max = 3): string[] {
  const raw = String(text ?? '')
  if (!raw.trim()) return []
  const matches = raw.match(HTTP_URL_RE) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of matches) {
    const cleaned = cleanExtractedUrl(m)
    if (!cleaned || seen.has(cleaned)) continue
    seen.add(cleaned)
    out.push(cleaned)
    if (out.length >= max) break
  }
  return out
}

/** 合并多条用户消息中的链接（例如连发 burst） */
export function extractHttpsUrlsFromTexts(texts: string[], max = 3): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const text of texts) {
    for (const url of extractHttpsUrls(text, max)) {
      if (seen.has(url)) continue
      seen.add(url)
      out.push(url)
      if (out.length >= max) break
    }
    if (out.length >= max) break
  }
  return out
}
