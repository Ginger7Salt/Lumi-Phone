/** 去掉分享追踪参数，提高短视频/图文平台解析成功率 */
export function normalizeShareUrlForParse(url: string): string {
  const raw = String(url ?? '').trim()
  if (!raw) return raw
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    if (host.includes('xiaohongshu.com')) {
      return `${u.origin}${u.pathname}`
    }
    if (host.includes('douyin.com') || host.includes('iesdouyin.com')) {
      if (u.pathname.startsWith('/video/') || u.pathname.startsWith('/note/')) {
        return `${u.origin}${u.pathname}`
      }
    }
    if (host === 'xhslink.com' || host.endsWith('.xhslink.com')) {
      return raw
    }
    return raw
  } catch {
    return raw
  }
}
