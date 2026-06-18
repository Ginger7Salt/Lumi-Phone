import {
  isApizeroContentExtractEndpoint,
  isLinkPreviewReady,
  readLinkPreviewSettingsSync,
  resolveLinkPreviewApiBase,
} from '../../api/linkPreviewSettingsUtils'

export function getLinkPreviewApiBase(): string {
  return resolveLinkPreviewApiBase()
}

export function isLinkPreviewConfigured(): boolean {
  return isLinkPreviewReady()
}

export function getLinkPreviewSettings() {
  return readLinkPreviewSettingsSync()
}

export { isApizeroContentExtractEndpoint }
