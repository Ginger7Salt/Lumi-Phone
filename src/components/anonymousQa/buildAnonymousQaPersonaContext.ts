import type { ApiConfig } from '../../phone/apps/api/types'
import { loadOfflineDatingPlotsPromptBlock } from '../../phone/apps/wechat/dating/loadOfflineDatingPlotsForWechatPrompt'
import { formatCharacterMemoriesForPromptInjection } from '../../phone/apps/wechat/memory/formatCharacterMemoriesForPromptInjection'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { Character, PlayerIdentity } from '../../phone/apps/wechat/newFriendsPersona/types'
import { formatWorldBackgroundForPrompt } from '../../phone/apps/wechat/newFriendsPersona/worldBackgroundFormat'
import { resolveActivePrivateChatSessionPlayerIdentityId } from '../../phone/apps/wechat/wechatCharacterPlayerIdentity'
import {
  WECHAT_LUMI_PEER_CHARACTER_ID,
  wechatAccountPrivateConversationKey,
} from '../../phone/apps/wechat/wechatConversationKey'
import { buildMemoryRelevanceHaystack } from '../../phone/apps/wechat/wechatMemoryPromptBlocks'
import {
  buildNpcGroupChatsUnsummarizedDigestForPrivatePrompt,
  formatUnsummarizedPrivateChatBlock,
} from '../../phone/apps/wechat/wechatMemoryPromptBlocks'
import {
  normalizeMemoryPromptLineScope,
  wrapUnsummarizedPrivateBlockWithLineLabel,
} from '../../phone/apps/wechat/wechatMemoryLineScope'
import { isMeetSyncedCharacter } from '../../phone/apps/lumiMeet/meetUserProfileSnapshot'
import { formatUnsummarizedMeetChatBlock } from '../../phone/apps/lumiMeet/meetMemoryPromptBlocks'
import { loadMeetEncounterMemoriesPromptBlock } from '../../phone/apps/lumiMeet/meetWechatSyncOnFriendLinked'

export type AnonymousQaWechatContext = {
  wechatAccountId: string | null
  playerIdentityId: string
  playerDisplayName: string
  apiConfig: ApiConfig | null
}

/** 定向提问 AI 语境：身份档案「姓名」（评论区 UI/@ 用微信昵称，见 qnaDirectedPlayerDisplay） */
export async function resolveDirectedQnaPlayerName(params: {
  wechatCtx: AnonymousQaWechatContext | null
  fallback?: string
}): Promise<string> {
  const fallback = params.fallback?.trim() || params.wechatCtx?.playerDisplayName?.trim() || '玩家'
  const pid = params.wechatCtx?.playerIdentityId?.trim()
  if (!pid || pid === '__none__') return fallback
  try {
    const identity = (await personaDb.getPlayerIdentity(pid)) as PlayerIdentity | null
    return identity?.name?.trim() || fallback
  } catch {
    return fallback
  }
}

export function resolveDirectedQnaPlayerNameFromPack(
  pack: { playerIdentity: PlayerIdentity | null },
  wechatCtx: AnonymousQaWechatContext | null,
  fallback?: string,
): string {
  return (
    pack.playerIdentity?.name?.trim() ||
    fallback?.trim() ||
    wechatCtx?.playerDisplayName?.trim() ||
    '玩家'
  )
}

export type AnonymousQaPersonaPromptPack = {
  character: Character | null
  playerIdentity: PlayerIdentity | null
  worldBackgroundPrompt?: string
  longTermMemoryNotes: string
  offlineDatingPlotsContext: string
  unsummarizedPrivateNotes: string
  unsummarizedGroupNotes: string
  meetEncounterMemoriesContext: string
  unsMeet: string
  sessionPlayerIdentityId: string
  conversationKey: string
}

/** 与微信私聊同一套：长期记忆、未总结私聊/群聊、线下剧情、遇见承接。 */
export async function buildAnonymousQaPersonaPromptPack(params: {
  characterId: string
  wechatCtx: AnonymousQaWechatContext
  relevanceHaystack: string
  /** 朋友圈等场景：跳过向量 embedding，避免无关 503 与延迟 */
  disableMemoryVectorRecall?: boolean
  /**
   * 默认 true。为 false 时不注入未总结私聊·群聊 / 遇见记忆。
   * 若同时传入 includeChatMemoryContext（旧参数），未单独指定时与之对齐。
   */
  includeUnsummarizedChat?: boolean
  /** 默认 true。为 false 时不注入长期记忆块 */
  includeLongTermMemory?: boolean
  /**
   * @deprecated 请用 includeUnsummarizedChat + includeLongTermMemory。
   * 若未传上述两项，则两者都跟随本开关（默认 true）。
   */
  includeChatMemoryContext?: boolean
  /** 默认 true。为 false 时不注入线下约会剧情块 */
  includeOfflineDatingPlots?: boolean
}): Promise<AnonymousQaPersonaPromptPack> {
  const cid = params.characterId.trim()
  const legacyChat = params.includeChatMemoryContext
  const includeUnsummarized =
    params.includeUnsummarizedChat !== undefined
      ? params.includeUnsummarizedChat
      : legacyChat !== false
  const includeLongTerm =
    params.includeLongTermMemory !== undefined
      ? params.includeLongTermMemory
      : legacyChat !== false
  const includeOfflinePlots = params.includeOfflineDatingPlots !== false
  const empty: AnonymousQaPersonaPromptPack = {
    character: null,
    playerIdentity: null,
    longTermMemoryNotes: '',
    offlineDatingPlotsContext: '',
    unsummarizedPrivateNotes: '',
    unsummarizedGroupNotes: '',
    meetEncounterMemoriesContext: '',
    unsMeet: '',
    sessionPlayerIdentityId: '__none__',
    conversationKey: '',
  }
  if (!cid || cid === WECHAT_LUMI_PEER_CHARACTER_ID) return empty

  const acc = params.wechatCtx.wechatAccountId?.trim() || ''
  const appPid = params.wechatCtx.playerIdentityId.trim() || '__none__'
  const sessionPid = await resolveActivePrivateChatSessionPlayerIdentityId({
    characterId: cid,
    wechatAccountId: acc || null,
    appPlayerIdentityId: appPid,
  })
  const conversationKey = acc
    ? wechatAccountPrivateConversationKey(acc, cid, sessionPid)
    : `${cid}::${sessionPid}`

  const character = (await personaDb.getCharacter(cid)) as Character | null
  const playerIdentity =
    sessionPid && sessionPid !== '__none__'
      ? ((await personaDb.getPlayerIdentity(sessionPid)) as PlayerIdentity | null)
      : null

  let worldBackgroundPrompt: string | undefined
  if (character?.worldBackgroundId?.trim()) {
    const bg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
    const block = formatWorldBackgroundForPrompt(bg)
    if (block.trim()) worldBackgroundPrompt = block
  }

  const fromMeet = isMeetSyncedCharacter(cid, character?.worldBooks)
  const chRow = character
  const digestBoundPid = chRow?.playerIdentityId

  const lineScope = normalizeMemoryPromptLineScope(acc || null, sessionPid)
  const apiOk =
    params.wechatCtx.apiConfig?.apiUrl?.trim() && params.wechatCtx.apiConfig?.apiKey?.trim()
      ? params.wechatCtx.apiConfig
      : null

  const [offlineDatingPlotsContext, meetEncounterMemoriesContext, unsMeet, unsPrivateRaw, unsGroup] =
    await Promise.all([
      includeOfflinePlots
        ? loadOfflineDatingPlotsPromptBlock(cid, character?.name ?? null)
        : Promise.resolve(''),
      includeUnsummarized && fromMeet ? loadMeetEncounterMemoriesPromptBlock(cid) : Promise.resolve(''),
      includeUnsummarized && fromMeet
        ? formatUnsummarizedMeetChatBlock({ characterId: cid, maxMessages: 120, maxChars: 3200 }).then((s) =>
            s.trim(),
          )
        : Promise.resolve(''),
      includeUnsummarized
        ? formatUnsummarizedPrivateChatBlock({
            conversationKey,
            maxMessages: 100,
            maxChars: 3200,
          }).then((s) => s.trim())
        : Promise.resolve(''),
      includeUnsummarized
        ? buildNpcGroupChatsUnsummarizedDigestForPrivatePrompt({
            npcCharacterId: cid,
            sessionPlayerIdentityId: sessionPid,
            boundPlayerIdentityId: digestBoundPid,
            maxMessagesPerGroup: 50,
            charCap: 4200,
          }).then((s) => s.trim())
        : Promise.resolve(''),
    ])

  const scopeForWrap = lineScope ?? normalizeMemoryPromptLineScope(acc || null, sessionPid)
  const unsPrivateCurrent =
    unsPrivateRaw && scopeForWrap
      ? await wrapUnsummarizedPrivateBlockWithLineLabel(unsPrivateRaw, scopeForWrap, 'current')
      : unsPrivateRaw

  const hay = buildMemoryRelevanceHaystack([
    params.relevanceHaystack,
    offlineDatingPlotsContext.slice(0, 3600),
    meetEncounterMemoriesContext.slice(0, 2800),
    unsMeet.slice(0, 2800),
    unsPrivateCurrent.slice(0, 4800),
    unsGroup.slice(0, 2400),
  ])

  let longTermMemoryNotes = ''
  if (includeLongTerm) {
    try {
      longTermMemoryNotes = (
        await formatCharacterMemoriesForPromptInjection(cid, hay, {
          apiConfig: apiOk,
          lineScope: (lineScope ?? scopeForWrap) ?? undefined,
          disableVector: params.disableMemoryVectorRecall === true,
        })
      ).trim()
    } catch {
      longTermMemoryNotes = ''
    }
  }

  return {
    character,
    playerIdentity,
    worldBackgroundPrompt,
    longTermMemoryNotes,
    offlineDatingPlotsContext: offlineDatingPlotsContext.trim(),
    unsummarizedPrivateNotes: unsPrivateCurrent,
    unsummarizedGroupNotes: unsGroup,
    meetEncounterMemoriesContext: meetEncounterMemoriesContext.trim(),
    unsMeet,
    sessionPlayerIdentityId: sessionPid,
    conversationKey,
  }
}
