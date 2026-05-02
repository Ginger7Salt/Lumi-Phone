#!/usr/bin/env node
/**
 * 从 git log 生成 src/phone/releaseNotes/changelog.generated.ts
 * 每条提交对应一条记录：version = 短 hash，messages = commit subject（即 -m "..." 那一行）。
 *
 * 浏览器运行时读不到 .git，因此这是构建/启动时的快照。
 *
 * 用法：在项目根目录 `node scripts/sync-changelog-from-git.mjs`
 * 或由 npm scripts（dev/build）自动调用。
 */
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = join(root, 'src/phone/releaseNotes/changelog.generated.ts')

const MAX_COMMITS = 100

function writeFile(body) {
  const header = `/**\n * 由 scripts/sync-changelog-from-git.mjs 根据 git log 自动生成。\n * 请勿手改；运行 dev/build 时会覆盖。\n * 展示内容为每条提交的标题（与 git commit -m "..." 一致）。\n */\n\n`
  writeFileSync(outFile, header + body, 'utf8')
}

function writeEmpty(reason) {
  if (reason) console.warn(`[changelog] ${reason}`)
  writeFile(
    `export const GIT_CHANGELOG: {\n  version: string\n  releasedAtMs: number\n  messages: string[]\n}[] = []\n`,
  )
  console.log('[changelog] 已写入空列表 → 将使用 changelog.ts 内静态兜底')
}

try {
  const raw = execSync(`git log -${MAX_COMMITS} --pretty=format:%h%x09%ct%x09%s`, {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const commits = []
  for (const line of raw.trim().split('\n')) {
    if (!line) continue
    const t1 = line.indexOf('\t')
    const t2 = line.indexOf('\t', t1 + 1)
    if (t1 === -1 || t2 === -1) continue
    const hash = line.slice(0, t1)
    const ct = Number(line.slice(t1 + 1, t2))
    const subject = line.slice(t2 + 1)
    if (!hash || !Number.isFinite(ct)) continue
    commits.push({ hash, ct, subject })
  }

  const blocks = commits.map(
    (c) =>
      `  {\n    version: ${JSON.stringify(c.hash)},\n    releasedAtMs: ${c.ct * 1000},\n    messages: [${JSON.stringify(c.subject)}],\n  },`,
  )

  writeFile(
    `export const GIT_CHANGELOG: {\n  version: string\n  releasedAtMs: number\n  messages: string[]\n}[] = [\n${blocks.join('\n')}\n]\n`,
  )
  console.log(`[changelog] 已写入 ${commits.length} 条提交 → changelog.generated.ts`)
} catch (e) {
  writeEmpty(`git log 不可用（请在仓库根目录运行或检查 git 安装）: ${e?.message ?? e}`)
}
