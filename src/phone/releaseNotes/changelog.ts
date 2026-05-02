import { GIT_CHANGELOG } from './changelog.generated'

/** localStorage：用户已确认「知道了」的版本号（与 {@link ChangelogEntry.version} 一致） */
export const WHATS_NEW_STORAGE_KEY = 'lumi_whats_new_seen_version'

/**
 * 变更记录（桌面「更新日志」与首次打开提示共用）。
 *
 * 默认列表来自构建/启动时脚本 {@link ../../scripts/sync-changelog-from-git.mjs} 写入的 {@link GIT_CHANGELOG}，
 * 每条对应一次 `git commit -m "..."` 的标题；git 不可用时回退到下方静态兜底。
 */
export type ChangelogEntry = {
  /** 通常为短 commit hash；若手工维护兜底则为语义化版本号 */
  version: string
  /** 提交时间（UTC 毫秒） */
  releasedAtMs: number
  messages: string[]
}

/** git sync 失败或未执行时使用 */
const STATIC_FALLBACK: ChangelogEntry[] = [
  {
    version: '1.1.0',
    releasedAtMs: Date.UTC(2026, 4, 2, 0, 0, 0),
    messages: [
      'feat(data-center): 数据中心 IndexedDB/本地缓存视图、归档 v2 与自定义导出文件名',
      'feat(release): 桌面「更新日志」应用与发版后首次打开提示',
      'feat(desktop): 右下角版本条改为桌面应用入口（已移除）',
      'fix(voice): Minimax 海外节点 api.minimax.io 与区域记忆',
      'fix(persona): 人设包导入追加副本、须先选择当前身份再绑定',
    ],
  },
]

export const RELEASE_CHANGELOG: ChangelogEntry[] =
  GIT_CHANGELOG.length > 0 ? GIT_CHANGELOG : STATIC_FALLBACK

export function formatVersionLabel(version: string): string {
  const v = version.trim()
  if (/^[0-9a-f]{7,40}$/i.test(v)) return v
  return v.startsWith('V') ? v : `V${v}`
}

export function getLatestChangelog(): ChangelogEntry {
  const first = RELEASE_CHANGELOG[0]
  if (!first) throw new Error('RELEASE_CHANGELOG is empty')
  return first
}

export function formatChangelogDateZh(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
