import type { LinkPreviewItem } from './fetchLinkPreviews'
import { extractHttpsUrlsFromTexts } from './extractHttpsUrls'
import { fetchLinkPreviews } from './fetchLinkPreviews'
import { isLinkPreviewConfigured } from './linkPreviewApiConfig'
import { isVideoPlatformLink, lowTrustLinkPreviewLabel } from './linkPreviewHostPolicy'
import { sanitizeLinkPreviewText } from './sanitizeLinkPreviewText'
import { isApizeroQuotaExhaustedError } from './formatApizeroFetchError'
import { formatLinkPreviewUserFailureMessage } from './formatLinkPreviewUserFailureMessage'

function clip(s: string | undefined, max: number): string {
  return sanitizeLinkPreviewText(s, max)
}

function isWeakPreviewContent(item: LinkPreviewItem): boolean {
  if (item.visionEnriched) return false
  const title = clip(item.title, 200)
  const desc = clip(item.description, 400)
  const excerpt = clip(item.excerpt, 900)
  const body = [title, desc, excerpt].filter(Boolean).join(' ')
  if (!body) return true
  if (body.length < 24) return true
  if (/^(抖音|小红书|微博|哔哩哔哩|知乎|加载中|请登录|打开.*查看)/i.test(body) && body.length < 80) return true
  return false
}

function formatFailureBlock(previews: LinkPreviewItem[]): string {
  const lines = previews.map((p, i) => {
    const label = lowTrustLinkPreviewLabel(p.url)
    const err = clip(p.error, 120)
    if (isVideoPlatformLink(p.url)) {
      return `链接 ${i + 1}：${p.url}\n状态：${label}链接，视频元数据解析失败${err ? `（${err}）` : ''}`
    }
    return `链接 ${i + 1}：${p.url}\n状态：抓取失败${err ? `（${err}）` : ''}`
  })
  const platformBlocked = previews.some((p) => /风控|sec_server|5021|拦截/.test(p.error ?? ''))
  const balanceLow = previews.some((p) => /余额不足|余额不够/.test(p.error ?? ''))
  const quotaExhausted = previews.some((p) => isApizeroQuotaExhaustedError(p.error))
  const tail = [
    '硬性约束：你**没有**看过原文；**禁止**编造标题、剧情、人物关系或「绝对服从」等摘要里不存在的细节。',
    balanceLow
      ? '须诚实说明「链接解析账户余额不足，我这边读不到链接内容」；请主人充值或发截图/正文。'
      : quotaExhausted
        ? '须诚实说明「今天链接解析套餐次数用完了（若已按次付费可能还需充值余额）」；可先根据用户消息里的**文字**接话，并请主人发截图或复制正文。不要假装已点开链接。'
      : platformBlocked
        ? '须诚实说明「解析服务被平台拦截，我这边读不到这篇笔记/视频」；请主人发截图或复制几段正文。不要描述自己手机浏览器「一直转圈加载」。'
        : '须用人设口吻诚实说明「链接我打不开 / 系统读不到，你复制几段文字或截图给我」；可表达好奇，但不得假装已读完全文。',
  ]
  return ['【用户分享了网页链接，但系统未能可靠读取正文（重要）】', ...lines, ...tail].join('\n\n')
}

function formatSuccessBlock(okItems: LinkPreviewItem[]): string {
  const weak = okItems.some(isWeakPreviewContent)
  const sections = okItems.map((p, i) => {
    const lines = [`链接 ${i + 1}：${p.url}`]
    const title = clip(p.title, 200)
    const desc = clip(p.description, 400)
    const excerptLimit = p.visionEnriched ? 2200 : 900
    const excerpt = clip(p.excerpt, excerptLimit)
    if (title) lines.push(`标题：${title}`)
    if (desc) lines.push(`摘要：${desc}`)
    if (excerpt && excerpt !== desc) {
      lines.push(p.visionEnriched ? `正文摘录（含识图）：${excerpt}` : `正文摘录：${excerpt}`)
    }
    return lines.join('\n')
  })

  const lines = [
    '【用户分享的网页链接（系统代读的公开页摘要；可能不完整）】',
    ...sections,
    '接话要求：只能依据上方摘要接话；摘要未写明的细节**禁止编造**；若摘要含糊或与用户描述冲突，应追问或请用户粘贴原文片段。',
  ]
  const hasVision = okItems.some((p) => p.visionEnriched)
  const hasVideoWithoutVision = okItems.some(
    (p) => p.previewKind === 'video' && !p.visionEnriched,
  )
  if (hasVision) {
    lines.push(
      '注意：含「识图」段落的内容来自 vision 模型对链接内图片/视频截帧的分析，可据此讨论画面与图内文字，但仍可能不完整；未出现的口播/剧情勿编造。',
    )
  } else if (hasVideoWithoutVision) {
    lines.push(
      '注意：视频/图文链接仅含标题、作者与互动等元数据，**不含**完整口播或笔记正文；不得假装已看完视频/图文全文。',
    )
  }
  if (weak) {
    lines.push(
      '注意：本条摘要过短或疑似平台壳页，可信度低——勿当成全文，优先请用户复制正文或发截图。',
    )
  }
  return lines.join('\n\n')
}

/** 将抓取结果格式化为 system prompt 块 */
export function formatLinkPreviewPromptBlock(previews: LinkPreviewItem[]): string {
  if (!previews.length) return ''

  const okItems = previews.filter((p) => p.ok && !isWeakPreviewContent(p))
  const failedItems = previews.filter((p) => !p.ok || isWeakPreviewContent(p))

  if (!okItems.length) return formatFailureBlock(failedItems.length ? failedItems : previews)
  const success = formatSuccessBlock(okItems)
  if (!failedItems.length) return success
  return `${success}\n\n${formatFailureBlock(failedItems)}`
}

export type LinkPreviewPromptBuildResult = {
  block: string
  /** 给用户看的失败说明（聊天输入框上方提示） */
  userNotice: string
}

function mightContainUnparsedShareLink(texts: string[]): boolean {
  const raw = texts.join('\n')
  if (!raw.trim()) return false
  if (extractHttpsUrlsFromTexts(texts).length > 0) return false
  return /xhslink|xiaohongshu|douyin|v\.douyin|复制此链接|复制口令|口令复制|打开抖音|打开【?小红书/i.test(raw)
}

/** 从用户文本抓取并格式化；失败时注入「禁止编造」说明 */
export async function buildLinkPreviewPromptBlockFromTexts(
  texts: string[],
): Promise<LinkPreviewPromptBuildResult> {
  const empty = { block: '', userNotice: '' }
  if (!isLinkPreviewConfigured()) return empty

  if (!extractHttpsUrlsFromTexts(texts).length) {
    if (mightContainUnparsedShareLink(texts)) {
      return {
        block: '',
        userNotice: '检测到分享口令但未识别出链接，请单独发送 http(s) 链接',
      }
    }
    return empty
  }

  const urls = extractHttpsUrlsFromTexts(texts)
  const fetched = await fetchLinkPreviews(urls, { notifyQuota: true, failureToast: false })
  const userNotice = formatLinkPreviewUserFailureMessage(fetched)
  return {
    block: formatLinkPreviewPromptBlock(fetched),
    userNotice,
  }
}
