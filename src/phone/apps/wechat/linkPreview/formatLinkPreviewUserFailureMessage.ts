import type { LinkPreviewItem } from './fetchLinkPreviews'
import { lowTrustLinkPreviewLabel } from './linkPreviewHostPolicy'
import {
  LINK_PREVIEW_ACTION_LABEL,
  LINK_PREVIEW_FEATURE_TITLE,
  LINK_PREVIEW_PROVIDER_LABEL,
} from '../../api/linkPreviewDisplayLabels'

function clipErr(err: string | undefined, max = 80): string {
  const s = String(err ?? '').trim()
  if (!s) return ''
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

function describeOneFailure(p: LinkPreviewItem): string {
  const label = lowTrustLinkPreviewLabel(p.url)
  const err = clipErr(p.error)
  if (/风控|sec_server|5021|拦截/.test(err)) {
    return `${label}：平台风控拦截`
  }
  if (/4029|过快/.test(err)) {
    return `${label}：请求过快`
  }
  if (/余额不足|余额不够/.test(err)) {
    return `${label}：账户余额不足`
  }
  if (/4030|4015|额度|quota|次数|今日免费|今日套餐/.test(err)) {
    return `${label}：今日额度已用完`
  }
  if (err) return `${label}：${err}`
  return `${label}：${LINK_PREVIEW_ACTION_LABEL}失败`
}

/** 聊天里网页链接识别失败时，给用户看的简短说明 */
export function formatLinkPreviewUserFailureMessage(items: LinkPreviewItem[]): string {
  const failed = items.filter((p) => !p.ok)
  if (!failed.length) return ''

  if (failed.length === 1) {
    const p = failed[0]!
    const label = lowTrustLinkPreviewLabel(p.url)
    const err = clipErr(p.error)
    if (/风控|sec_server|5021|拦截/.test(err)) {
      return `${label}链接被平台风控拦截，${LINK_PREVIEW_ACTION_LABEL}失败。请发截图或复制正文给角色`
    }
    if (/4029|过快/.test(err)) {
      return `${LINK_PREVIEW_ACTION_LABEL}请求过快，请稍后再发一次`
    }
    if (/余额不足|余额不够/.test(err)) {
      return `${LINK_PREVIEW_PROVIDER_LABEL}账户余额不足，请充值后再发链接；或发截图/正文给角色`
    }
    if (/4030|4015|额度|quota|次数|今日免费|今日套餐/.test(err)) {
      return `今日${LINK_PREVIEW_FEATURE_TITLE}免费额度已用完；若已开通按次付费请确认账户有余额，或明日再试`
    }
    if (err) return `${label}${LINK_PREVIEW_ACTION_LABEL}失败：${err}`
    return `${label}${LINK_PREVIEW_ACTION_LABEL}失败，角色无法读取内容`
  }

  const parts = failed.map(describeOneFailure)
  return `${failed.length} 条链接均未识别成功（${parts.join('；')}）。请发截图或复制正文`
}
