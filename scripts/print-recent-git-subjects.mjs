#!/usr/bin/env node
/**
 * 打印最近 15 条 git commit 标题（即 commit -m 那一行）。
 * 更新日志已改为构建时由 `npm run changelog:sync` / dev 自动生成；
 * 本脚本仅作快速查看近期提交用。
 *
 * 用法：在项目根目录执行 `node scripts/print-recent-git-subjects.mjs`
 */
import { execSync } from 'node:child_process'

try {
  const out = execSync('git log -15 --pretty=format:%s', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  console.log(out.trim())
} catch (e) {
  console.error('无法执行 git log（请在 git 仓库根目录运行）:', e?.message ?? e)
  process.exit(1)
}
