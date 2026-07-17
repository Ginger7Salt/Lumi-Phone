import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { Character } from '../wechat/newFriendsPersona/types'
import { formatWorldBackgroundForPrompt } from '../wechat/newFriendsPersona/worldBackgroundFormat'
import { getCharacterBoundPlayerIdentityId } from '../wechat/wechatCharacterPlayerIdentity'
import {
  buildCharacterCard,
  buildWeChatPlayerIdentityPromptBlock,
  buildWorldBookTextForPrompt,
} from '../wechat/wechatChatAi'

const DEFAULT_BIO_MAX = 2400
const DEFAULT_WB_MAX = 3200
const DEFAULT_WBG_MAX = 2800

export type PulsePersonaLoadCaps = {
  bioMaxChars?: number
  worldBookMaxChars?: number
  worldBackgroundMaxChars?: number
  /** 是否注入与该角色绑定的用户身份；默认 true */
  includeBoundPlayerIdentity?: boolean
}

/**
 * 加载角色人设（基础信息卡 + 世界背景 + 世界书）与（可选）绑定用户身份，
 * 供热搜/主页等微博生成锚定真实设定，禁止模型凭空编人设。
 */
export async function loadPulseCharacterPersonaContext(
  characterId: string,
  caps?: PulsePersonaLoadCaps,
): Promise<{
  character: Character | null
  personaSummary: string
}> {
  const cid = characterId.trim()
  if (!cid) return { character: null, personaSummary: '' }

  const character = await personaDb.getCharacter(cid)
  if (!character) return { character: null, personaSummary: '' }

  const bioMax = Math.max(200, caps?.bioMaxChars ?? DEFAULT_BIO_MAX)
  const wbMax = Math.max(400, caps?.worldBookMaxChars ?? DEFAULT_WB_MAX)
  const wbgMax = Math.max(200, caps?.worldBackgroundMaxChars ?? DEFAULT_WBG_MAX)

  const name = (character.name || character.wechatNickname || '').trim() || '未命名'
  const chunks: string[] = []
  chunks.push(`【参考角色：${name}】`)
  chunks.push(`【角色档案｜基础信息】\n${buildCharacterCard(character, { bioMaxChars: bioMax })}`)

  if (character.worldBackgroundEnabled !== false && character.worldBackgroundId?.trim()) {
    try {
      const wb = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
      const block = formatWorldBackgroundForPrompt(wb).trim().slice(0, wbgMax)
      if (block) chunks.push(`【世界背景】\n${block}`)
    } catch {
      /* 无世界背景仍继续拼世界书 */
    }
  }

  const worldBook = (await buildWorldBookTextForPrompt(character, wbMax)).trim()
  if (worldBook) chunks.push(`【世界书】\n${worldBook}`)

  if (caps?.includeBoundPlayerIdentity !== false) {
    const boundPid = getCharacterBoundPlayerIdentityId(character)
    if (boundPid) {
      try {
        const player = await personaDb.getPlayerIdentity(boundPid)
        const playerBlock = buildWeChatPlayerIdentityPromptBlock(player).trim()
        if (playerBlock) {
          chunks.push(
            `【与该角色绑定的用户身份｜须严格遵守，禁止另编用户人设】\n${playerBlock}`,
          )
        }
      } catch {
        /* 身份缺失则跳过 */
      }
    }
  }

  return { character, personaSummary: chunks.join('\n\n') }
}

/**
 * 加载当前用户身份的基础信息卡 +（可选）世界背景 + 世界书，
 * 供社交账号「认证」等字段锚定真实人设，禁止凭空编用户身份。
 */
export async function loadPulsePlayerIdentityPersonaContext(
  playerIdentityId: string,
  caps?: Omit<PulsePersonaLoadCaps, 'includeBoundPlayerIdentity'>,
): Promise<string> {
  const pid = playerIdentityId.trim()
  if (!pid) return ''

  const player = await personaDb.getPlayerIdentity(pid)
  if (!player) return ''

  const bioMax = Math.max(200, caps?.bioMaxChars ?? DEFAULT_BIO_MAX)
  const wbMax = Math.max(400, caps?.worldBookMaxChars ?? DEFAULT_WB_MAX)
  const wbgMax = Math.max(200, caps?.worldBackgroundMaxChars ?? DEFAULT_WBG_MAX)

  const name = (player.name || player.wechatNickname || '').trim() || '用户'
  const chunks: string[] = []
  chunks.push(`【用户身份：${name}】`)
  chunks.push(
    `【用户身份档案｜基础信息｜须严格遵守，禁止另编用户人设】\n${buildCharacterCard(player, {
      bioMaxChars: bioMax,
    })}`,
  )

  if (player.worldBackgroundEnabled !== false && player.worldBackgroundId?.trim()) {
    try {
      const wb = await personaDb.getWorldBackground(player.worldBackgroundId.trim())
      const block = formatWorldBackgroundForPrompt(wb).trim().slice(0, wbgMax)
      if (block) chunks.push(`【世界背景】\n${block}`)
    } catch {
      /* 无世界背景仍继续拼世界书 */
    }
  }

  const worldBook = (await buildWorldBookTextForPrompt(player, wbMax)).trim()
  if (worldBook) chunks.push(`【用户身份世界书】\n${worldBook}`)

  const fullBlock = buildWeChatPlayerIdentityPromptBlock(player).trim()
  if (fullBlock && !chunks.some((c) => c.includes('玩家身份'))) {
    chunks.push(fullBlock)
  }

  return chunks.join('\n\n').slice(0, 8_000)
}
