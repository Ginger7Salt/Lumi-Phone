import type { LinkPreviewQuotaSnapshot } from './linkPreviewQuota'

export const LINK_PREVIEW_QUOTA_TOAST_EVENT = 'lumi:link-preview-quota-toast'
export const LINK_PREVIEW_QUOTA_UPDATED_EVENT = 'lumi:link-preview-quota-updated'

export type LinkPreviewQuotaToastDetail = {
  consumed: { web: number; video: number }
  snapshot: LinkPreviewQuotaSnapshot
}

export type LinkPreviewFailureToastDetail = {
  message: string
}

export function dispatchLinkPreviewQuotaToast(detail: LinkPreviewQuotaToastDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LINK_PREVIEW_QUOTA_TOAST_EVENT, { detail }))
}

export const LINK_PREVIEW_FAILURE_TOAST_EVENT = 'lumi:link-preview-failure-toast'

export function dispatchLinkPreviewFailureToast(detail: LinkPreviewFailureToastDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LINK_PREVIEW_FAILURE_TOAST_EVENT, { detail }))
}

export function dispatchLinkPreviewQuotaUpdated(snapshot: LinkPreviewQuotaSnapshot): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LINK_PREVIEW_QUOTA_UPDATED_EVENT, { detail: snapshot }))
}
