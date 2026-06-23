import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js'
import { config, quiz, formatMessage } from './config.js'

/** @type {Map<string, { questionIndex: number }>} */
const sessions = new Map()

/** @type {Map<string, number>} userId -> cooldown ends at timestamp */
const cooldowns = new Map()

const BEGIN_ID = 'verify:begin'
const AGREE_ID = 'verify:agree'
const ANSWER_PREFIX = 'verify:ans:'

export function buildVerifyPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(quiz.panel.title)
    .setDescription(quiz.panel.description)

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BEGIN_ID)
      .setLabel('开始验证')
      .setStyle(ButtonStyle.Primary),
  )

  return { embeds: [embed], components: [row] }
}

function buildAgreementPayload() {
  const embed = new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle(quiz.agreement.title)
    .setDescription(quiz.agreement.description)

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(AGREE_ID)
      .setLabel(quiz.agreement.buttonLabel.slice(0, 80))
      .setStyle(ButtonStyle.Success),
  )

  return { embeds: [embed], components: [row], ephemeral: true }
}

function buildQuestionPayload(questionIndex) {
  const item = quiz.questions[questionIndex]
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('入门验证')
    .setDescription(item.question)
    .setFooter({ text: `须全部答对 · 当前第 ${questionIndex + 1} / ${quiz.questions.length} 题` })

  const row = new ActionRowBuilder()
  for (let i = 0; i < item.options.length; i += 1) {
    const opt = item.options[i]
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${ANSWER_PREFIX}${questionIndex}:${i}`)
        .setLabel(opt.label.slice(0, 80))
        .setStyle(ButtonStyle.Secondary),
    )
  }

  return { embeds: [embed], components: [row], ephemeral: true }
}

function getCooldownRemainingMinutes(userId) {
  const endsAt = cooldowns.get(userId)
  if (!endsAt) return 0
  const remainingMs = endsAt - Date.now()
  if (remainingMs <= 0) {
    cooldowns.delete(userId)
    return 0
  }
  return Math.ceil(remainingMs / 60_000)
}

function startCooldown(userId) {
  cooldowns.set(userId, Date.now() + config.cooldownMinutes * 60_000)
}

async function resolveVerifiedRole(guild) {
  if (config.verifiedRoleId) {
    return guild.roles.cache.get(config.verifiedRoleId) ?? null
  }
  return guild.roles.cache.find((role) => role.name === config.verifiedRoleName) ?? null
}

function memberHasVerifiedRole(member, role) {
  return role ? member.roles.cache.has(role.id) : false
}

export async function handleVerifyInteraction(interaction) {
  if (!interaction.isButton()) return false

  const { customId, user, member, guild } = interaction
  if (!customId.startsWith('verify:')) return false
  if (!guild || !member) {
    await interaction.reply({ content: '此验证仅可在服务器频道内使用。', ephemeral: true })
    return true
  }

  const verifiedRole = await resolveVerifiedRole(guild)

  if (customId === BEGIN_ID) {
    if (verifiedRole && memberHasVerifiedRole(member, verifiedRole)) {
      await interaction.reply({
        content: quiz.messages.alreadyVerified,
        ephemeral: true,
      })
      return true
    }

    const cooldownMin = getCooldownRemainingMinutes(user.id)
    if (cooldownMin > 0) {
      await interaction.reply({
        content: formatMessage(quiz.messages.cooldown, { minutes: cooldownMin }),
        ephemeral: true,
      })
      return true
    }

    await interaction.reply(buildAgreementPayload())
    return true
  }

  if (customId === AGREE_ID) {
    sessions.set(user.id, { questionIndex: 0 })
    await interaction.update(buildQuestionPayload(0))
    return true
  }

  if (customId.startsWith(ANSWER_PREFIX)) {
    const session = sessions.get(user.id)
    if (!session) {
      await interaction.reply({ content: quiz.messages.sessionExpired, ephemeral: true })
      return true
    }

    const suffix = customId.slice(ANSWER_PREFIX.length)
    const [qIdxRaw, oIdxRaw] = suffix.split(':')
    const questionIndex = Number.parseInt(qIdxRaw, 10)
    const optionIndex = Number.parseInt(oIdxRaw, 10)

    if (questionIndex !== session.questionIndex) {
      await interaction.reply({ content: quiz.messages.sessionExpired, ephemeral: true })
      sessions.delete(user.id)
      return true
    }

    const question = quiz.questions[questionIndex]
    const chosen = question?.options?.[optionIndex]
    if (!chosen) {
      await interaction.reply({ content: quiz.messages.sessionExpired, ephemeral: true })
      sessions.delete(user.id)
      return true
    }

    if (!chosen.correct) {
      sessions.delete(user.id)
      startCooldown(user.id)
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('验证未通过')
            .setDescription(quiz.messages.wrongAnswer),
        ],
        components: [],
      })
      return true
    }

    const nextIndex = questionIndex + 1
    if (nextIndex < quiz.questions.length) {
      session.questionIndex = nextIndex
      sessions.set(user.id, session)
      await interaction.update(buildQuestionPayload(nextIndex))
      return true
    }

    sessions.delete(user.id)

    if (!verifiedRole) {
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('配置错误')
            .setDescription(quiz.messages.noRoleConfigured),
        ],
        components: [],
      })
      return true
    }

    try {
      await member.roles.add(verifiedRole)
    } catch {
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('无法分配身份组')
            .setDescription(quiz.messages.roleAssignFailed),
        ],
        components: [],
      })
      return true
    }

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('验证通过')
          .setDescription(quiz.messages.success),
      ],
      components: [],
    })
    return true
  }

  return false
}

export async function handleSetupVerifyCommand(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'setup-verify') {
    return false
  }

  await interaction.reply(buildVerifyPanel())
  return true
}
