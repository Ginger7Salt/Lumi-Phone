import { formatChangelogDateZh, formatVersionLabel, getLatestChangelog } from './releaseNotes/changelog'

const latest = getLatestChangelog()

/** 当前对外版本号（与 changelog 首条一致） */
export const APP_VERSION_LABEL = formatVersionLabel(latest.version)

/** 当前版本发布日时间戳（毫秒） */
export const APP_LAST_UPDATE_AT_MS = latest.releasedAtMs

/** @deprecated 使用 {@link formatChangelogDateZh}；保留兼容旧引用 */
export function formatLastUpdateDateZh(ms: number = APP_LAST_UPDATE_AT_MS): string {
  return formatChangelogDateZh(ms)
}
