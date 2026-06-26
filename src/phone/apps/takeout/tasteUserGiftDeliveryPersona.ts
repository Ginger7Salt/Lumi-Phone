import {
  buildCharacterCard,
  buildWeChatPlayerIdentityPromptBlock,
  buildWeChatPlayerThirdPersonPronounIronRule,
  buildWorldBookText,
} from '../wechat/wechatChatAi'
import { resolvePrivateChatNetworkRootId } from '../wechat/privateChatNetworkNpcPronoun'
import { getCharacterBoundPlayerIdentityId } from '../wechat/wechatCharacterPlayerIdentity'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { Character, PlayerIdentity, PlayerNetworkLink } from '../wechat/newFriendsPersona/types'
import { resolveOrderRealRecipientName, resolveOrderRecipientNickname } from './tasteDeliveryRecipient'
import { resolveUserGiftCharacterId } from './types'
import type { TasteOrderPayload } from './types'

const CHARACTER_WB_MAX = 1600
const PLAYER_WB_MAX = 1200

export type UserGiftDeliveryPersonaContext = {
  characterId: string
  characterName: string
  recipientPersonaName: string
  recipientCallName?: string
  orderRecipientNickname: string
  characterPersonaBlock: string
  playerPersonaBlock: string
  relationshipBlock: string
  personaGuardBlock: string
}

function clip(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function buildCharacterPersonaBlock(character: Character | null, characterName: string): string {
  if (!character) {
    return `【角色人设】\n姓名/常用称呼：${characterName}\n（未加载完整档案，语气仍须贴合已知称呼）`
  }
  const card = buildCharacterCard(character, { bioMaxChars: 900 })
  const wb = buildWorldBookText(character, CHARACTER_WB_MAX).trim()
  const chunks = [`【角色人设档案】\n${card}`]
  if (wb) chunks.push(`【角色世界书】\n${wb}`)
  return chunks.join('\n\n')
}

function buildPlayerPersonaBlock(playerIdentity: PlayerIdentity | null): string {
  if (!playerIdentity) return ''
  const cardBlock = buildWeChatPlayerIdentityPromptBlock(playerIdentity).trim()
  if (cardBlock) return cardBlock
  const card = buildCharacterCard(playerIdentity, { bioMaxChars: 700 })
  const wb = buildWorldBookText(playerIdentity, PLAYER_WB_MAX, { voice: 'player_identity' }).trim()
  const chunks = [`【用户（玩家身份）档案】\n${card}`]
  if (wb) chunks.push(`【用户世界书】\n${wb}`)
  return chunks.join('\n\n')
}

function buildRelationshipBlock(characterName: string, link: PlayerNetworkLink | null): string {
  if (!link) return ''
  const bits = [
    link.relationThemToYou?.trim()
      ? `${characterName}与你的关系：${clip(link.relationThemToYou, 100)}`
      : '',
    link.theySeeYou?.trim() ? `${characterName}怎么看你：${clip(link.theySeeYou, 140)}` : '',
    link.theyCallYou?.trim()
      ? `${characterName}平时称呼你：「${clip(link.theyCallYou, 48)}」`
      : '',
    link.relationYouToThem?.trim() ? `你与${characterName}的关系词：${clip(link.relationYouToThem, 60)}` : '',
    link.youSeeThem?.trim() ? `你怎么看${characterName}：${clip(link.youSeeThem, 100)}` : '',
  ].filter(Boolean)
  if (!bits.length) return ''
  return `【角色 ↔ 用户关系（对话语气与称呼须遵守）】\n${bits.map((b) => `- ${b}`).join('\n')}`
}

function buildPersonaGuardBlock(params: {
  characterName: string
  recipientPersonaName: string
  recipientCallName?: string
  playerIdentity: PlayerIdentity | null
}): string {
  const callHint = params.recipientCallName?.trim()
    ? `称呼用户时优先用关系称呼「${params.recipientCallName.trim()}」或「${params.recipientPersonaName}」，`
    : `称呼用户时用「${params.recipientPersonaName}」等人设向称呼，`
  const wxNick = params.playerIdentity?.wechatNickname?.trim()
  const forbidParts = [
    wxNick && wxNick !== params.recipientPersonaName ? `微信昵称「${wxNick}」` : '',
  ].filter(Boolean)
  const forbidLine = forbidParts.length
    ? `**禁止**在消息里把用户叫做：${forbidParts.join('、')}。`
    : '**禁止**用微信昵称、通讯录备注代替用户人设姓名。'
  const pronounRule = buildWeChatPlayerThirdPersonPronounIronRule(params.playerIdentity).trim()

  return [
    '【人设铁律】',
    `- 用户（玩家身份「${params.recipientPersonaName}」）刚为${params.characterName}远程点了外卖，餐品**刚刚送达**，${params.characterName}已收到。`,
    `- ${params.characterName}正在给用户发微信私聊：可惊喜确认、道谢、尝后反馈等，须贴合人设与双方关系。`,
    `- ${callHint}须符合上方【角色人设】【用户人设】【双方关系】。`,
    `- ${forbidLine}`,
    pronounRule ? pronounRule.replace(/^\n+/, '') : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function loadUserGiftDeliveryPersonaContext(
  order: TasteOrderPayload,
  characterNameHint?: string,
): Promise<UserGiftDeliveryPersonaContext | null> {
  const characterId = resolveUserGiftCharacterId(order)
  if (!characterId) return null

  const character = await personaDb.getCharacter(characterId)
  const characterName =
    characterNameHint?.trim() ||
    character?.name?.trim() ||
    character?.remark?.trim() ||
    character?.wechatNickname?.trim() ||
    'TA'

  const playerIdentityId = getCharacterBoundPlayerIdentityId(character)
  const playerIdentity = playerIdentityId ? await personaDb.getPlayerIdentity(playerIdentityId) : null

  const recipientPersonaName =
    playerIdentity?.name?.trim() ||
    playerIdentity?.identity?.trim() ||
    '用户'

  let link: PlayerNetworkLink | null = null
  const rootId = await resolvePrivateChatNetworkRootId(character)
  if (rootId) {
    try {
      const links = await personaDb.getPlayerNetworkLinks(rootId)
      link = links.find((pl) => pl.characterId === characterId) ?? null
    } catch {
      link = null
    }
  }

  const recipientCallName = link?.theyCallYou?.trim() || undefined
  const orderRecipientNickname = resolveOrderRecipientNickname(order)

  return {
    characterId,
    characterName,
    recipientPersonaName,
    recipientCallName,
    orderRecipientNickname,
    characterPersonaBlock: buildCharacterPersonaBlock(character, characterName),
    playerPersonaBlock: buildPlayerPersonaBlock(playerIdentity),
    relationshipBlock: buildRelationshipBlock(characterName, link),
    personaGuardBlock: buildPersonaGuardBlock({
      characterName,
      recipientPersonaName,
      recipientCallName,
      playerIdentity,
    }),
  }
}

export function resolveUserGiftDeliveryUserLabel(ctx: UserGiftDeliveryPersonaContext): string {
  return ctx.recipientCallName?.trim() || ctx.recipientPersonaName
}

export function formatUserGiftOrderItemsSummary(order: TasteOrderPayload): string {
  const parts = order.items.map((item) =>
    item.quantity > 1 ? `${item.name}×${item.quantity}` : item.name,
  )
  if (parts.length <= 4) return parts.join('、')
  return `${parts.slice(0, 4).join('、')}等 ${order.itemCount} 件`
}

export function formatUserGiftOrderContextBlock(order: TasteOrderPayload): string {
  const items = formatUserGiftOrderItemsSummary(order)
  const remark = order.remark.trim()
  const lines = [
    `【店铺】${order.storeName}`,
    `【餐品】${items}`,
    `【外卖单收货名】${resolveOrderRecipientNickname(order)}（真实姓名：${resolveOrderRealRecipientName(order)}）`,
  ]
  if (remark) lines.push(`【下单备注/小票寄语】${remark}`)
  return lines.join('\n')
}
