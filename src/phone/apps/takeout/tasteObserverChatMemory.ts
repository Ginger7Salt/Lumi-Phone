import type { ApiConfig } from '../api/types'
import { loadOfflineDatingPlotsPromptBlock } from '../wechat/dating/loadOfflineDatingPlotsForWechatPrompt'
import { formatCharacterMemoriesForPromptInjectionPack } from '../wechat/memory/formatCharacterMemoriesForPromptInjection'
import { isMeetSyncedCharacter } from '../lumiMeet/meetUserProfileSnapshot'
import { loadMeetEncounterMemoriesPromptBlock } from '../lumiMeet/meetWechatSyncOnFriendLinked'
import { formatUnsummarizedMeetChatBlock } from '../lumiMeet/meetMemoryPromptBlocks'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { Character } from '../wechat/newFriendsPersona/types'
import {
  getCharacterBoundPlayerIdentityId,
  resolveActivePrivateChatSessionPlayerIdentityId,
} from '../wechat/wechatCharacterPlayerIdentity'
import {
  buildMemoryRelevanceHaystack,
  buildNpcGroupChatsUnsummarizedDigestForPrivatePrompt,
  formatRecentPrivateChatReferenceByCharacter,
  formatUnsummarizedPrivateChatBlock,
} from '../wechat/wechatMemoryPromptBlocks'
import {
  buildPrivateChatMemoryInjectionAnchor,
  normalizeMemoryPromptLineScope,
  wrapUnsummarizedPrivateBlockWithLineLabel,
} from '../wechat/wechatMemoryLineScope'
import {
  WECHAT_LUMI_PEER_CHARACTER_ID,
  wechatAccountPrivateConversationKey,
  wechatConversationKey,
} from '../wechat/wechatConversationKey'
import { parseCharacterTakeoutRemark } from './characterTakeoutRemark'
import type { TasteObserverChatPersonaContext } from './tasteObserverChatPersona'
import { resolveOrderRealRecipientName, resolveOrderRecipientNickname } from './tasteDeliveryRecipient'
import type { TasteOrderPayload } from './types'

type ObserverKind = 'character-merchant' | 'character-courier'

export type TasteObserverChatMemoryPack = {
  /** 可直接拼进 user/system 的记忆块（长期记忆 + 未总结摘录 + 线下剧情） */
  promptBlock: string
  longTermMemory: string
  unsPrivate: string
  unsGroup: string
  offlineDatingPlotsContext: string
}

function buildOrderMemoryHaystackBias(
  order: TasteOrderPayload,
  kind: ObserverKind,
  ctx: TasteObserverChatPersonaContext,
): string {
  const itemNames = order.items.map((i) => i.name).join('、')
  const { merchantInstruction } = parseCharacterTakeoutRemark(order.remark)
  return [
    `角色 ${ctx.characterName} 为玩家身份用户 ${ctx.recipientPersonaName} 点外卖`,
    ctx.recipientCallName ? `角色称呼用户 ${ctx.recipientCallName}` : '',
    `外卖单收货名 ${resolveOrderRecipientNickname(order)}`,
    `真实收货人 ${resolveOrderRealRecipientName(order)}`,
    `店铺 ${order.storeName}`,
    `菜品 ${itemNames}`,
    merchantInstruction ? `需口头转告商家 ${merchantInstruction}` : '',
    kind === 'character-merchant' ? '下单后与商家确认订单备餐' : '配送中与骑手沟通',
    ctx.relationshipBlock,
    ctx.personaGuardBlock,
  ]
    .filter(Boolean)
    .join('\n')
}

function formatMemoryPromptSections(pack: {
  longTermMemory: string
  unsPrivate: string
  unsGroup: string
  offlineDatingPlotsContext: string
  meetEncounterMemoriesContext?: string
  unsMeet?: string
}): string {
  const chunks: string[] = []
  const mem = pack.longTermMemory.trim()
  chunks.push(
    `---\n【长期记忆】\n${mem || '（暂无长期记忆模块入库数据，仅根据人设、关系与订单推断。）'}\n`,
  )
  if (pack.unsPrivate.trim()) {
    chunks.push(
      `---\n【尚未写入长期记忆的私聊片段（本地游标之后）】\n${pack.unsPrivate.trim()}\n`,
    )
  }
  if (pack.unsGroup.trim()) {
    chunks.push(
      `---\n【尚未写入长期记忆的群聊片段（本地游标之后）】\n${pack.unsGroup.trim()}\n`,
    )
  }
  if (pack.meetEncounterMemoriesContext?.trim()) {
    chunks.push(`---\n【遇见 · 已总结长期记忆】\n${pack.meetEncounterMemoriesContext.trim()}\n`)
  }
  if (pack.unsMeet?.trim()) {
    chunks.push(
      `---\n【尚未写入长期记忆的遇见临时会话片段（本地游标之后）】\n${pack.unsMeet.trim()}\n`,
    )
  }
  if (pack.offlineDatingPlotsContext.trim()) {
    chunks.push(`---\n【线下约会剧情参考】\n${pack.offlineDatingPlotsContext.trim()}\n`)
  }
  return chunks.join('\n')
}

/** 与线上私聊同源：关键词 + 向量语义召回长期记忆，并附带未总结私聊/群聊/线下剧情。 */
export async function loadTasteObserverChatMemoryPack(params: {
  order: TasteOrderPayload
  kind: ObserverKind
  apiConfig: ApiConfig | null
  personaCtx: TasteObserverChatPersonaContext
}): Promise<TasteObserverChatMemoryPack> {
  const empty: TasteObserverChatMemoryPack = {
    promptBlock: '',
    longTermMemory: '',
    unsPrivate: '',
    unsGroup: '',
    offlineDatingPlotsContext: '',
  }

  const cid = params.order.orderSourceCharacterId?.trim()
  if (!cid || cid === WECHAT_LUMI_PEER_CHARACTER_ID) return empty

  const character = (await personaDb.getCharacter(cid)) as Character | null
  if (!character) return empty

  const wechatAccountId = character.wechatAccountId?.trim() || ''
  const boundPid = getCharacterBoundPlayerIdentityId(character) || ''
  const sessionPid = await resolveActivePrivateChatSessionPlayerIdentityId({
    characterId: cid,
    wechatAccountId: wechatAccountId || null,
    appPlayerIdentityId: boundPid || null,
  })

  const conversationKey = wechatAccountId
    ? wechatAccountPrivateConversationKey(wechatAccountId, cid, sessionPid)
    : wechatConversationKey(cid, sessionPid)

  const lineScope = normalizeMemoryPromptLineScope(wechatAccountId || null, sessionPid)
  const apiOk =
    params.apiConfig?.apiUrl?.trim() && params.apiConfig?.apiKey?.trim()
      ? params.apiConfig
      : null

  const fromMeet = isMeetSyncedCharacter(cid, character.worldBooks)
  const charLabel = character.name?.trim() || character.wechatNickname?.trim() || null

  const [offlineDatingPlotsContext, meetEncounterMemoriesContext, unsMeetRaw, unsPrivateRaw, anchorGroupId] =
    await Promise.all([
      loadOfflineDatingPlotsPromptBlock(cid, charLabel).catch(() => ''),
      fromMeet ? loadMeetEncounterMemoriesPromptBlock(cid).catch(() => '') : Promise.resolve(''),
      fromMeet
        ? formatUnsummarizedMeetChatBlock({ characterId: cid, maxMessages: 80, maxChars: 2800 }).catch(() => '')
        : Promise.resolve(''),
      formatUnsummarizedPrivateChatBlock({
        conversationKey,
        maxMessages: 100,
        maxChars: 3200,
      }).catch(() => ''),
      personaDb.getPrivateChatAnchorGroupId(cid, sessionPid).catch(() => null),
    ])

  let unsGroup = ''
  try {
    unsGroup = await buildNpcGroupChatsUnsummarizedDigestForPrivatePrompt({
      npcCharacterId: cid,
      sessionPlayerIdentityId: sessionPid,
      boundPlayerIdentityId: boundPid || undefined,
      anchorGroupId: anchorGroupId ?? undefined,
      maxMessagesPerGroup: 50,
      charCap: 3200,
    })
  } catch {
    unsGroup = ''
  }

  const scopeForWrap = lineScope ?? normalizeMemoryPromptLineScope(wechatAccountId || null, sessionPid)
  const unsPrivateCurrent =
    unsPrivateRaw.trim() && scopeForWrap
      ? await wrapUnsummarizedPrivateBlockWithLineLabel(unsPrivateRaw, scopeForWrap, 'current')
      : unsPrivateRaw.trim()

  const injectionAnchor = scopeForWrap
    ? await buildPrivateChatMemoryInjectionAnchor({
        currentScope: scopeForWrap,
        strangerLine: false,
        characterId: cid,
      })
    : ''

  let unsPrivate = [injectionAnchor, unsPrivateCurrent].filter(Boolean).join('\n\n')
  if (!unsPrivate.trim()) {
    unsPrivate = await formatRecentPrivateChatReferenceByCharacter({
      characterId: cid,
      maxMessages: 48,
      maxChars: 2800,
    }).catch(() => '')
  }

  const hay = buildMemoryRelevanceHaystack([
    buildOrderMemoryHaystackBias(params.order, params.kind, params.personaCtx),
    unsPrivate.slice(0, 4800),
    unsGroup.slice(0, 2400),
    offlineDatingPlotsContext.slice(0, 3600),
    fromMeet ? String(meetEncounterMemoriesContext ?? '').trim().slice(0, 2800) : '',
    fromMeet ? String(unsMeetRaw ?? '').trim().slice(0, 2800) : '',
  ])

  let longTermMemory = ''
  try {
    const pack = await formatCharacterMemoriesForPromptInjectionPack(cid, hay, {
      apiConfig: apiOk,
      lineScope: scopeForWrap ?? undefined,
    })
    longTermMemory = pack.text.trim()
  } catch {
    longTermMemory = ''
  }

  const promptBlock = formatMemoryPromptSections({
    longTermMemory,
    unsPrivate,
    unsGroup,
    offlineDatingPlotsContext: offlineDatingPlotsContext.trim(),
    meetEncounterMemoriesContext: fromMeet ? String(meetEncounterMemoriesContext ?? '').trim() : '',
    unsMeet: fromMeet ? String(unsMeetRaw ?? '').trim() : '',
  })

  return {
    promptBlock,
    longTermMemory,
    unsPrivate,
    unsGroup,
    offlineDatingPlotsContext: offlineDatingPlotsContext.trim(),
  }
}
