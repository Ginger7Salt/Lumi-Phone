import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`缺少环境变量：${name}`)
  return value
}

function optionalEnv(name) {
  return process.env[name]?.trim() || ''
}

function sanitizeDiscordToken(raw) {
  const token = raw.trim().replace(/^Bot\s+/i, '').replace(/^['"]|['"]$/g, '')
  if (!token || /[^\x21-\x7E]/.test(token)) {
    throw new Error(
      'DISCORD_TOKEN 无效：请把 .env 里的中文占位符换成 Bot 页复制的英文 Token（保存文件后再 npm start）',
    )
  }
  if (token.length < 50 || token.split('.').length < 3) {
    throw new Error('DISCORD_TOKEN 格式不对：应类似「三段英文+数字用点连接」，请到 Developer Portal → Bot → Reset Token 重新复制')
  }
  return token
}

export const config = {
  token: sanitizeDiscordToken(requireEnv('DISCORD_TOKEN')),
  clientId: requireEnv('DISCORD_CLIENT_ID'),
  guildId: requireEnv('GUILD_ID'),
  verifiedRoleId: optionalEnv('VERIFIED_ROLE_ID'),
  verifiedRoleName: optionalEnv('VERIFIED_ROLE_NAME') || 'Lumi',
  cooldownMinutes: Math.max(1, Number.parseInt(process.env.COOLDOWN_MINUTES || '10', 10) || 10),
  announceChannelId: optionalEnv('ANNOUNCE_CHANNEL_ID'),
}

const questionsPath = join(__dirname, '..', 'questions.json')
export const quiz = JSON.parse(readFileSync(questionsPath, 'utf8'))

export function formatMessage(template, vars = {}) {
  let text = template
  for (const [key, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${key}}`, String(value))
  }
  return text
}
