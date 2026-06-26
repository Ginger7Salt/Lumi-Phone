import { loadResolvedApiConfig } from '../api/loadResolvedApiConfig'
import type { ApiConfig } from '../api/types'
import { openAiCompatibleChat } from '../wechat/newFriendsPersona/ai'
import { formatCharacterMemoriesForPromptInjectionPack } from '../wechat/memory/formatCharacterMemoriesForPromptInjection'
import { loadOfflineDatingPlotsPromptBlock } from '../wechat/dating/loadOfflineDatingPlotsForWechatPrompt'
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
  wechatAccountPrivateConversationKey,
  wechatConversationKey,
} from '../wechat/wechatConversationKey'
import {
  formatUserGiftOrderContextBlock,
  loadUserGiftDeliveryPersonaContext,
  resolveUserGiftDeliveryUserLabel,
  type UserGiftDeliveryPersonaContext,
} from './tasteUserGiftDeliveryPersona'
import type { TasteOrderPayload } from './types'

function stripJsonFence(raw: string): string {
  const t = raw.trim()
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return m ? m[1].trim() : t
}

function normalizeMessageLines(raw: unknown): string[] {
  const root = typeof raw === 'object' && raw !== null ? raw : null
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((root as { messages?: unknown })?.messages)
      ? (root as { messages: unknown[] }).messages
      : null
  if (!arr?.length) return []

  const lines: string[] = []
  for (const row of arr) {
    if (typeof row === 'string') {
      const text = row.trim()
      if (text) lines.push(text.slice(0, 280))
      continue
    }
    if (!row || typeof row !== 'object') continue
    const text = String((row as { text?: unknown }).text ?? '').trim()
    if (text) lines.push(text.slice(0, 280))
  }
  return lines.slice(0, 3)
}

async function loadUserGiftDeliveryMemoryBlock(params: {
  order: TasteOrderPayload
  ctx: UserGiftDeliveryPersonaContext
  apiConfig: ApiConfig | null
  wechatAccountId: string
  sessionPlayerIdentityId: string
}): Promise<string> {
  const cid = params.ctx.characterId
  const character = (await personaDb.getCharacter(cid)) as Character | null
  if (!character) return ''

  const wechatAccountId = params.wechatAccountId.trim()
  const sessionPid = params.sessionPlayerIdentityId.trim() || '__none__'
  const conversationKey = wechatAccountId
    ? wechatAccountPrivateConversationKey(wechatAccountId, cid, sessionPid)
    : wechatConversationKey(cid, sessionPid)

  const lineScope = normalizeMemoryPromptLineScope(wechatAccountId || null, sessionPid)
  const apiOk =
    params.apiConfig?.apiUrl?.trim() && params.apiConfig?.apiKey?.trim() ? params.apiConfig : null

  const fromMeet = isMeetSyncedCharacter(cid, character.worldBooks)
  const charLabel = character.name?.trim() || character.wechatNickname?.trim() || null
  const boundPid = getCharacterBoundPlayerIdentityId(character) || ''

  const [offlineDatingPlotsContext, , , unsPrivateRaw, anchorGroupId] =
    await Promise.all([
      loadOfflineDatingPlotsPromptBlock(cid, charLabel).catch(() => ''),
      fromMeet ? loadMeetEncounterMemoriesPromptBlock(cid).catch(() => '') : Promise.resolve(''),
      fromMeet
        ? formatUnsummarizedMeetChatBlock({ characterId: cid, maxMessages: 80, maxChars: 2800 }).catch(() => '')
        : Promise.resolve(''),
      formatUnsummarizedPrivateChatBlock({
        conversationKey,
        maxMessages: 80,
        maxChars: 2800,
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
      maxMessagesPerGroup: 40,
      charCap: 2400,
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
      maxMessages: 40,
      maxChars: 2400,
    }).catch(() => '')
  }

  const hay = buildMemoryRelevanceHaystack([
    `用户为角色 ${params.ctx.characterName} 点外卖送达`,
    formatUserGiftOrderContextBlock(params.order),
    params.ctx.relationshipBlock,
    params.ctx.personaGuardBlock,
    unsPrivate.slice(0, 3600),
    unsGroup.slice(0, 1800),
    offlineDatingPlotsContext.slice(0, 2400),
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

  const chunks: string[] = []
  if (longTermMemory) chunks.push(`---\n【长期记忆】\n${longTermMemory}\n`)
  if (unsPrivate.trim()) {
    chunks.push(`---\n【尚未写入长期记忆的私聊片段】\n${unsPrivate.trim()}\n`)
  }
  if (offlineDatingPlotsContext.trim()) {
    chunks.push(`---\n【线下约会剧情参考】\n${offlineDatingPlotsContext.trim()}\n`)
  }
  return chunks.join('\n')
}

function buildDeliveryNotifyPrompt(
  order: TasteOrderPayload,
  ctx: UserGiftDeliveryPersonaContext,
  memoryBlock: string,
): string {
  const userLabel = resolveUserGiftDeliveryUserLabel(ctx)
  const orderBlock = formatUserGiftOrderContextBlock(order)

  return `【场景】微信私聊 · 用户（玩家身份）刚为角色「${ctx.characterName}」远程点了外卖，餐品**刚刚送达**，${ctx.characterName}已亲手收到。

${orderBlock}

${ctx.characterPersonaBlock}

${ctx.playerPersonaBlock}

${ctx.relationshipBlock}

${ctx.personaGuardBlock}

${memoryBlock}

请生成 **1–3 条** ${ctx.characterName} 发给用户「${userLabel}」的微信短消息。
要求：
1) **必须**基于人设、双方关系与【长期记忆】；角色**已经知道**具体店铺与餐品（见上方订单信息），可自然提到菜名；
2) 语气可以是：惊喜确认（「你刚刚给我点外卖了？」「是你点的吗？」）、收到告知（「我收到啦！」）、尝后反馈（「好吃！」「谢谢宝宝」）等，选贴合关系的 1–3 种即可；
3) 若小票/备注里有给用户的话，角色可轻提或回应，但不要逐字复读长备注；
4) 每条 1–2 句，口语化，禁止 markdown；可适当颜文字；
5) **禁止**用微信昵称、通讯录备注代替用户人设称呼；
6) 只输出 JSON：{"messages":["第一条","第二条"]}`
}

export async function generateUserGiftDeliveryWechatMessages(params: {
  order: TasteOrderPayload
  wechatAccountId: string
  sessionPlayerIdentityId: string
  characterNameHint?: string
  apiConfig?: ApiConfig | null
}): Promise<{ messages: string[]; ctx: UserGiftDeliveryPersonaContext }> {
  const ctx = await loadUserGiftDeliveryPersonaContext(params.order, params.characterNameHint)
  if (!ctx) throw new Error('非用户赠角色外卖单')

  const cfg = params.apiConfig ?? (await loadResolvedApiConfig('chatCard'))
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new Error('未配置聊天 API，请在 API 设置中配置「聊天记录卡片」')
  }

  const memoryBlock = await loadUserGiftDeliveryMemoryBlock({
    order: params.order,
    ctx,
    apiConfig: cfg,
    wechatAccountId: params.wechatAccountId,
    sessionPlayerIdentityId: params.sessionPlayerIdentityId,
  })

  const system = `你是微信私聊文案编剧。根据【角色人设】【用户人设】【双方关系】【长期记忆】与订单信息，生成角色收到用户所点外卖后、主动发给用户的 1–3 条短消息。
须贴合人设与关系，禁止用微信昵称代替用户身份，勿与长期记忆矛盾。输出必须是合法 JSON，不要任何解释文字。`

  const raw = await openAiCompatibleChat(
    cfg,
    [
      { role: 'system', content: system },
      { role: 'user', content: buildDeliveryNotifyPrompt(params.order, ctx, memoryBlock) },
    ],
    { temperature: 0.82, max_tokens: 600 },
  )

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(String(raw ?? '')))
  } catch {
    throw new Error('AI 返回格式无效，请重试')
  }

  const lines = normalizeMessageLines(parsed)
  if (lines.length < 1) {
    throw new Error('AI 未生成有效消息，请重试')
  }

  return { messages: lines, ctx }
}

export async function resolveUserGiftDeliveryConversation(params: {
  order: TasteOrderPayload
  wechatAccountId: string
  appSessionPlayerIdentityId: string
}): Promise<{
  characterId: string
  sessionPlayerIdentityId: string
  conversationKey: string
  notifyPeerTitle: string
  playerDisplayName: string
} | null> {
  const ctx = await loadUserGiftDeliveryPersonaContext(params.order)
  if (!ctx) return null

  const character = await personaDb.getCharacter(ctx.characterId)
  const sessionPlayerIdentityId = await resolveActivePrivateChatSessionPlayerIdentityId({
    characterId: ctx.characterId,
    wechatAccountId: params.wechatAccountId,
    appPlayerIdentityId: params.appSessionPlayerIdentityId,
  })

  const conversationKey = params.wechatAccountId.trim()
    ? wechatAccountPrivateConversationKey(
        params.wechatAccountId.trim(),
        ctx.characterId,
        sessionPlayerIdentityId,
      )
    : wechatConversationKey(ctx.characterId, sessionPlayerIdentityId)

  const notifyPeerTitle =
    character?.remark?.trim() ||
    character?.wechatNickname?.trim() ||
    character?.name?.trim() ||
    ctx.characterName

  return {
    characterId: ctx.characterId,
    sessionPlayerIdentityId,
    conversationKey,
    notifyPeerTitle,
    playerDisplayName: resolveUserGiftDeliveryUserLabel(ctx),
  }
}
