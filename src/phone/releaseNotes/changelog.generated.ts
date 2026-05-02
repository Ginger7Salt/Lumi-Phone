/**
 * 由 scripts/sync-changelog-from-git.mjs 根据 git log 自动生成。
 * 请勿手改；运行 dev/build 时会覆盖。
 * 展示内容为每条提交的标题（与 git commit -m "..." 一致）。
 */

export const GIT_CHANGELOG: {
  version: string
  releasedAtMs: number
  messages: string[]
}[] = []
