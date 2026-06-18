/** 当前 v1 网页正文提取难以可靠读取的域名；若启用视频解析则改走 ApiZero video-parse */
const LOW_TRUST_HOST_SUFFIXES = [
  'douyin.com',
  'iesdouyin.com',
  'xiaohongshu.com',
  'xhslink.com',
  'weibo.com',
  'weibo.cn',
  'b23.tv',
  'bilibili.com',
  'b23.com',
  'zhihu.com',
  'toutiao.com',
  'mp.weixin.qq.com',
]

export function isLowTrustLinkPreviewHost(url: string): boolean {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase()
    return LOW_TRUST_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
  } catch {
    return false
  }
}

export function lowTrustLinkPreviewLabel(url: string): string {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase()
    if (host.includes('douyin') || host.includes('iesdouyin')) return '抖音'
    if (host.includes('xiaohongshu') || host.includes('xhslink')) return '小红书'
    if (host.includes('weibo') || host.includes('b23')) return '微博'
    if (host.includes('bilibili')) return 'B站'
    if (host.includes('zhihu')) return '知乎'
    if (host.includes('mp.weixin.qq.com')) return '微信公众号'
    return '该平台'
  } catch {
    return '该平台'
  }
}

/** 短视频 / 图文平台链接，应走 ApiZero video-parse 而非网页正文提取 */
export function isVideoPlatformLink(url: string): boolean {
  return isLowTrustLinkPreviewHost(url)
}
