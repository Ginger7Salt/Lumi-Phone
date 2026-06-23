import {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js'
import { config } from './config.js'

const commands = [
  new SlashCommandBuilder()
    .setName('setup-verify')
    .setDescription('在本频道发布入门验证面板（仅管理员）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),
]

const rest = new REST({ version: '10' }).setToken(config.token)

export async function registerCommands() {
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: commands,
  })
  console.log(`已在服务器 ${config.guildId} 注册斜杠命令：/setup-verify`)
}

const isDirectRun = process.argv[1]?.endsWith('register-commands.js')
if (isDirectRun) {
  await registerCommands()
}
