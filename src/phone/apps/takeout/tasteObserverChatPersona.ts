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
import type { TasteOrderPayload } from './types'

const CHARACTER_WB_MAX = 1600
const PLAYER_WB_MAX = 1200

export type TasteObserverChatPersonaContext = {
  characterName: string
  /** 玩家身份档案姓名（非微信昵称） */
  recipientPersonaName: string
  /** 角色对人设的口语称呼（theyCallYou），可能为空 */
  recipientCallName?: string
  /** 订单收货昵称（外卖单用，与人设姓名可不同） */
  orderRecipientNickname?: string
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

function buildRelationshipBlock(
  characterName: string,
  link: PlayerNetworkLink | null,
): string {
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
  orderRecipientNickname?: string
  playerIdentity: PlayerIdentity | null
}): string {
  const callHint = params.recipientCallName?.trim()
    ? `跟商家/骑手提到用户时，优先用关系称呼「${params.recipientCallName.trim()}」或「${params.recipientPersonaName}」，`
    : `跟商家/骑手提到用户时，用「${params.recipientPersonaName}」等人设向称呼，`
  const wxNick = params.playerIdentity?.wechatNickname?.trim()
  const forbidParts = [
    wxNick && wxNick !== params.recipientPersonaName ? `微信昵称「${wxNick}」` : '',
  ].filter(Boolean)

  const forbidLine = forbidParts.length
    ? `**禁止**在生成对话里把用户叫做：${forbidParts.join('、')}。`
    : '**禁止**用微信昵称、通讯录备注代替用户人设姓名。'

  const nickNote = params.orderRecipientNickname?.trim()
    ? `外卖单收货昵称为「${params.orderRecipientNickname.trim()}」，与玩家身份名可不同，跟商家/骑手沟通时可用此昵称。`
    : ''

  const pronounRule = buildWeChatPlayerThirdPersonPronounIronRule(params.playerIdentity).trim()

  return [
    '【人设铁律】',
    `- 这是${params.characterName}为**用户本人**（玩家身份「${params.recipientPersonaName}」）点的惊喜外卖。`,
    `- 角色**已在寻味平台完成下单**（菜品与小票寄语等均已写入订单，寻味会**自动出票**）；与商家微信沟通是**下单后的确认与跟进**，**禁止**在聊天里重新点菜、报菜名选餐或从零开始下单；**禁止**讨论小票打印、确认 remark 会不会印、或复读小票寄语正文。`,
    `- ${callHint}须符合上方【角色人设】【用户人设】【双方关系】。`,
    nickNote,
    `- ${forbidLine}`,
    pronounRule ? pronounRule.replace(/^\n+/, '') : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function loadTasteObserverChatPersonaContext(
  order: TasteOrderPayload,
  characterNameHint?: string,
): Promise<TasteObserverChatPersonaContext> {
  const characterId = order.orderSourceCharacterId?.trim()
  const character = characterId ? await personaDb.getCharacter(characterId) : null
  const characterName =
    characterNameHint?.trim() ||
    character?.name?.trim() ||
    order.orderSourceCharacterName?.trim() ||
    'TA'

  const playerIdentityId = getCharacterBoundPlayerIdentityId(character)
  const playerIdentity = playerIdentityId ? await personaDb.getPlayerIdentity(playerIdentityId) : null

  const recipientPersonaName =
    playerIdentity?.name?.trim() ||
    playerIdentity?.identity?.trim() ||
    '用户'

  let link: PlayerNetworkLink | null = null
  if (characterId) {
    const rootId = await resolvePrivateChatNetworkRootId(character)
    if (rootId) {
      try {
        const links = await personaDb.getPlayerNetworkLinks(rootId)
        link = links.find((pl) => pl.characterId === characterId) ?? null
      } catch {
        link = null
      }
    }
  }

  const recipientCallName = link?.theyCallYou?.trim() || undefined
  const orderRecipientNickname = order.deliveryAddress.label.trim() || undefined

  return {
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
      orderRecipientNickname,
      playerIdentity,
    }),
  }
}

/** 生成对话时指代收件人的主称呼（人设向，非微信昵称） */
export function resolveObserverChatRecipientLabel(ctx: TasteObserverChatPersonaContext): string {
  return ctx.recipientCallName?.trim() || ctx.recipientPersonaName
}
