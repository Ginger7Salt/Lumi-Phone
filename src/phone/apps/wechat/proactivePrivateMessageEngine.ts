import { loadResolvedApiConfig } from '../api/loadResolvedApiConfig'
import { isCharacterImageGenEnabled } from '../api/imageGenPresetUtils'
import { loadResolvedImageGenSettings } from '../api/loadResolvedImageGenSettings'
import { resolveImageStyleHint } from '../../../components/moments/momentsImagePromptEnhancer'
import { buildCharacterMomentsPinCatalogBlock } from '../../../components/moments/momentPinService'
import { buildUserMomentsVisibleToCharacterCatalogBlock } from '../../../components/moments/userMomentChatCatalog'
import { setBackgroundNotifyPendingWork } from '../backgroundNotify/backgroundNotifyPendingWork'
import { resolveWorldBookUserBinding } from './charUserPlaceholders'
import {
  buildMeetWechatPrivateChatContinuityBlock,
  isMeetSyncedCharacter,
  loadMeetUserProfileSnapshotFromKv,
} from '../lumiMeet/meetUserProfileSnapshot'
import { personaDb } from './newFriendsPersona/idb'
import type { ChatConversationSettingsRow, WeChatChatMessage } from './newFriendsPersona/types'
import { formatWorldBackgroundForPrompt } from './newFriendsPersona/worldBackgroundFormat'
import { loadAccountsBundle } from './wechatAccountPersistence'
import { buildFriendRequestPrivatePromptPack } from './wechatFriendRequestPrivatePromptPack'
import {
  requestWeChatPeerReplyBubbles,
  type ChatTranscriptTurn,
} from './wechatChatAi'
import { stripAndApplyCharacterMomentPinDirectives } from './wechatCharacterMomentPinApply'
import { stripAndApplyCharacterMomentPublishDirectives } from './wechatCharacterMomentPublishApply'
import {
  buildCharacterProfileImageCatalogBlock,
  stripAndApplyCharacterProfileImageActions,
} from './wechatCharacterProfileImageApply'
import { stripCharacterImageGenLinesFromBubbles, limitCharacterImageGenLinesFromBubbles } from './wechatCharacterImageGen'
import {
  drawRoundImageCount,
  parseStoredImageRoundCountRange,
  rollImageRoundTriggerAllowed,
} from './wechatMediaSendFrequency'
import {
  buildCharacterWechatProfileStateBlock,
  stripAndApplyCharacterWechatProfileUpdates,
} from './wechatCharacterProfileUpdateApply'
import {
  isWechatGroupConversationKey,
  parsePrivateWeChatConversationCharacterAndSession,
  parseWechatAccountPrivateConversationKey,
  WECHAT_LUMI_PEER_CHARACTER_ID,
  WECHAT_SELF_PEER_CHARACTER_ID,
} from './wechatConversationKey'
import {
  isCharacterTimePerceptionEnabled,
  normalizeWeChatTimeConfig,
  resolveWeChatCurrentTimeMs,
} from './time/wechatTimeUtils'
import { loadCharacterPsycheState } from './characterPsyche/characterPsycheStore'
import {
  buildProactivePrivateMessageReplyBias,
  computeMsSinceLastUserMessage,
  hasProactiveMessageScheduleSaved,
  resolveProactiveMessageAiRound,
} from './proactivePrivateMessageTypes'
import {
  drawProactiveVariableIntervalSeconds,
  isProactiveVariableIntervalEnabled,
  resolveCharacterExplicitBusyForProactive,
  resolveProactiveMessageEffectiveIntervalSeconds,
} from './proactiveVariableInterval'
import {
  tryHandoffProactiveMessageReveal,
  stashProactiveMessageReveal,
  type ProactiveMessageRevealBubble,
} from './proactiveMessageRevealBridge'

const TICK_MS = 5_000

let installed = false
let runningTick = false
const inFlightKeys = new Set<string>()
const aiBusyKeys = new Set<string>()
const inFlightListeners = new Set<() => void>()

function notifyProactiveMessageInFlightChange(): void {
  for (const fn of inFlightListeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function subscribeProactiveMessageInFlight(listener: () => void): () => void {
  inFlightListeners.add(listener)
  return () => {
    inFlightListeners.delete(listener)
  }
}

function newMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `wx-proactive-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function markProactiveMessageConversationAiBusy(conversationKey: string, busy: boolean): void {
  const k = conversationKey.trim()
  if (!k) return
  if (busy) aiBusyKeys.add(k)
  else aiBusyKeys.delete(k)
}

/** 用户手动触发角色回复时，将主动消息倒计时锚点重置为当前时刻，避免与即将到来的角色回复重复。 */
export async function resetProactiveMessageCountdown(conversationKey: string): Promise<void> {
  const key = conversationKey.trim()
  if (!key || isWechatGroupConversationKey(key)) return
  if (!parsePrivateWeChatConversationCharacterAndSession(key)) return
  const row = await personaDb.getChatConversationSettings(key)
  if (!row?.proactiveMessageEnabled) return
  if (!hasProactiveMessageScheduleSaved(row)) return
  const now = Date.now()
  const patch: Parameters<typeof personaDb.upsertChatConversationSettings>[0] = {
    conversationKey: key,
    peerCharacterId: row.peerCharacterId,
    playerIdentityId: row.playerIdentityId,
    proactiveMessageLastFiredAtMs: now,
  }
  if (isProactiveVariableIntervalEnabled(row)) {
    const explicitBusy = await resolveCharacterExplicitBusyForProactive({ row, now })
    patch.proactiveMessageNextIntervalSeconds = drawProactiveVariableIntervalSeconds(explicitBusy)
  }
  await personaDb.upsertChatConversationSettings(patch)
}

export function isProactiveMessageInFlight(conversationKey: string): boolean {
  return inFlightKeys.has(conversationKey.trim())
}

function isPersonaPrivateConversation(row: ChatConversationSettingsRow): boolean {
  const k = row.conversationKey.trim()
  if (!k || isWechatGroupConversationKey(k)) return false
  const peer = row.peerCharacterId.trim()
  if (!peer || peer === WECHAT_LUMI_PEER_CHARACTER_ID || peer === WECHAT_SELF_PEER_CHARACTER_ID) return false
  return !!parsePrivateWeChatConversationCharacterAndSession(k)
}

function storedMessagesToTranscript(messages: WeChatChatMessage[]): ChatTranscriptTurn[] {
  return messages
    .filter((m) => !m.isRecalled && !m.ext?.centerSystemStrip)
    .map((m) => {
      const from = m.type === 'player' ? ('self' as const) : ('other' as const)
      if (m.voice) {
        const txt = m.voice.transcriptText?.trim() || m.content?.trim() || '（语音）'
        const emo = m.voice.emotionLabel?.trim()
        const who = m.type === 'player' ? '用户语音' : '对方语音'
        const voiceText = emo ? `（${who}，情绪：${emo}）${txt}` : `（${who}）${txt}`
        return { id: m.id, from, text: voiceText, replyTo: m.replyTo }
      }
      const text = m.content?.trim()
      if (text) return { id: m.id, from, text, replyTo: m.replyTo }
      if (m.images?.length) return { id: m.id, from, text: '（发送了一张图片）', replyTo: m.replyTo }
      return { id: m.id, from, text: '', replyTo: m.replyTo }
    })
    .filter((t) => t.text.trim())
}

async function resolveWeChatNowMs(characterId: string): Promise<number> {
  const realNow = Date.now()
  const [global, charTime] = await Promise.all([
    personaDb.getGlobalSettings(),
    personaDb.getCharacterTimeSettings(characterId),
  ])
  const cfg = normalizeWeChatTimeConfig(charTime?.config ?? global.globalTimeConfig)
  return resolveWeChatCurrentTimeMs(cfg, realNow)
}

async function shouldFire(row: ChatConversationSettingsRow, now: number): Promise<boolean> {
  if (!row.proactiveMessageEnabled) return false
  const key = row.conversationKey.trim()
  if (!key || inFlightKeys.has(key) || aiBusyKeys.has(key)) return false

  if (!hasProactiveMessageScheduleSaved(row)) return false

  const explicitBusy = await resolveCharacterExplicitBusyForProactive({ row, now })
  const intervalMs =
    resolveProactiveMessageEffectiveIntervalSeconds(row, {
      characterExplicitlyBusy: explicitBusy,
    }) * 1000
  const lastFired = row.proactiveMessageLastFiredAtMs ?? 0
  if (now - lastFired < intervalMs) return false

  const gs = await personaDb.getGlobalSettings()
  let busyEnabled = true
  let isBusy = false
  let busyEnd = 0
  if (gs.busyMode === 'character') {
    const busyRow = await personaDb.getCharacterBusySettings(row.peerCharacterId)
    busyEnabled = busyRow?.enabled ?? true
    isBusy = !!busyRow?.isBusy
    busyEnd = busyRow?.busyEndTime ?? 0
  } else {
    const kv = await personaDb.getPhoneKv(`busy-conv:${key}`)
    busyEnabled = typeof kv === 'boolean' ? kv : true
    const busyRow = await personaDb.getCharacterBusySettings(row.peerCharacterId)
    isBusy = !!busyRow?.isBusy
    busyEnd = busyRow?.busyEndTime ?? 0
  }
  if (busyEnabled && isBusy && busyEnd > now) return false

  return true
}

async function fireProactiveMessage(row: ChatConversationSettingsRow): Promise<void> {
  const key = row.conversationKey.trim()
  const parsed = parsePrivateWeChatConversationCharacterAndSession(key)
  if (!parsed) return
  const characterId = parsed.characterId.trim()
  const sessionPid = parsed.sessionPlayerId.trim() || '__none__'
  const peerCharacterId = row.peerCharacterId.trim() || characterId
  const playerIdentityId =
    sessionPid !== '__none__' ? sessionPid : row.playerIdentityId.trim() || sessionPid
  const scoped = parseWechatAccountPrivateConversationKey(key)
  const wechatAccountId = scoped?.wechatAccountId ?? null

  inFlightKeys.add(key)
  notifyProactiveMessageInFlightChange()
  setBackgroundNotifyPendingWork({ wechatTyping: true })
  try {
    const apiConfig = await loadResolvedApiConfig('chatCard')
    if (!apiConfig?.apiUrl?.trim() || !apiConfig.apiKey?.trim() || !apiConfig.modelId?.trim()) {
      return
    }

    const character = await personaDb.getCharacter(characterId)
    if (!character) return

    const [messages, bundle] = await Promise.all([
      personaDb.listWeChatChatMessagesByConversationKey(key),
      loadAccountsBundle(),
    ])
    const transcript = storedMessagesToTranscript(messages).slice(-48)
    const now = await resolveWeChatNowMs(characterId)

    const account =
      wechatAccountId && bundle?.accounts
        ? bundle.accounts.find((a) => a.accountId === wechatAccountId)
        : undefined
    const playerDisplayName = account?.nickname?.trim() || '我'
    const wechatHome = {
      displayName: playerDisplayName,
      signature: account?.signature?.trim() || '',
    }

    let worldBackgroundPrompt: string | undefined
    if (character.worldBackgroundEnabled !== false && character.worldBackgroundId?.trim()) {
      const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
      const block = formatWorldBackgroundForPrompt(wbg)
      if (block.trim()) worldBackgroundPrompt = block
    }

    const msSinceLastUserMessage = computeMsSinceLastUserMessage(messages, now)
    let affection: number | null = null
    let relationshipDef: string | null = null
    try {
      const psyche = await loadCharacterPsycheState({
        conversationCharacterId: characterId,
        playerIdentityId,
        personaCharacterId: characterId,
        characterFullName: character.name?.trim() || 'TA',
      })
      affection = psyche.state?.affection ?? null
      relationshipDef = psyche.state?.relationshipDef ?? null
    } catch {
      // 体征未生成时仍可走通用主动消息偏向
    }

    const replyBias = buildProactivePrivateMessageReplyBias(messages, {
      msSinceLastUserMessage,
      affection,
      relationshipDef,
    })
    const aiRound = resolveProactiveMessageAiRound(messages)

    const pack = await buildFriendRequestPrivatePromptPack({
      characterId: peerCharacterId,
      conversationKey: key,
      sessionPlayerIdentityId: sessionPid,
      apiConfig,
      transcript,
      biasTextForMemoryHaystack: replyBias,
      strangerMemoryGuard: false,
      crossAccountContext:
        wechatAccountId && bundle?.accounts
          ? { currentAccountId: wechatAccountId, allAccounts: bundle.accounts }
          : undefined,
    })

    const playerIdentity =
      sessionPid && sessionPid !== '__none__' && wechatAccountId
        ? await personaDb.getPlayerIdentityForWechatAccount(sessionPid, wechatAccountId)
        : null

    const fromMeet = isMeetSyncedCharacter(characterId, character.worldBooks ?? [])
    let meetWechatContinuityBlock: string | undefined
    if (fromMeet) {
      const meetSnap = await loadMeetUserProfileSnapshotFromKv(characterId)
      meetWechatContinuityBlock = buildMeetWechatPrivateChatContinuityBlock({
        meetSnapshot: meetSnap,
        wechatProfile: wechatHome,
        forFriendRequest: false,
      })
    }

    const worldBookBinding = await resolveWorldBookUserBinding(character)
    const charTimeRow = await personaDb.getCharacterTimeSettings(characterId)
    const timePerceptionEnabled = isCharacterTimePerceptionEnabled(charTimeRow)

    const resolvedImageGenSettings = await loadResolvedImageGenSettings()
    const characterImageGenEnabled = isCharacterImageGenEnabled(resolvedImageGenSettings)
    const characterImageGenStyleHint = resolveImageStyleHint(resolvedImageGenSettings)

    const characterMomentsPinCatalog =
      wechatAccountId && characterId
        ? await buildCharacterMomentsPinCatalogBlock(wechatAccountId, characterId)
        : ''
    const userMomentsViewerCatalog =
      wechatAccountId && characterId
        ? await buildUserMomentsVisibleToCharacterCatalogBlock({
            accountId: wechatAccountId,
            characterId,
            playerIdentityId: sessionPid,
            playerDisplayName,
          })
        : ''
    const characterWechatProfileBlock = [
      buildCharacterWechatProfileStateBlock(character),
      buildCharacterProfileImageCatalogBlock(character),
    ]
      .filter((x) => x.trim())
      .join('\n\n')

    const imageCountRange = parseStoredImageRoundCountRange(
      row.imageRoundCountMin,
      row.imageRoundCountMax,
    )
    const imageRoundAllowed = rollImageRoundTriggerAllowed(row.imageRoundTriggerPercent)
    const imageRoundCountTarget = imageRoundAllowed ? drawRoundImageCount(imageCountRange) : 0

    const ai = await requestWeChatPeerReplyBubbles({
      apiConfig,
      character,
      playerIdentity,
      playerDisplayName,
      wechatHomeProfile: wechatHome,
      meetWechatContinuityBlock,
      transcript,
      promptMode: 'persona',
      longTermMemoryNotes: pack.memory || undefined,
      longTermMemoryMomentImages: pack.momentImageUrls?.length ? pack.momentImageUrls : undefined,
      worldBackgroundPrompt,
      offlineDatingPlotsContext: pack.offlineDatingPlotsContext || undefined,
      meetEncounterMemoriesContext: pack.meetEncounterMemoriesContext || undefined,
      unsummarizedPrivateNotes: pack.unsPrivate || undefined,
      unsummarizedGroupNotes: pack.unsGroup || undefined,
      unsummarizedMeetNotes: pack.unsMeet || undefined,
      recentGroupChatsReference: pack.recentGroupChatsReference || undefined,
      replyBias,
      includeThinkingChain: true,
      currentTimeMs: now,
      timePerceptionEnabled,
      chatMemberIds: [peerCharacterId],
      globalWechatPlate: 'private_chat',
      worldBookPlayerIdentity: worldBookBinding?.row ?? null,
      worldBookUserLineLabel: worldBookBinding?.lineLabel,
      stickerRoundTriggerPercent: row.stickerRoundTriggerPercent,
      voiceRoundTriggerPercent: row.voiceRoundTriggerPercent,
      ...(characterImageGenEnabled
        ? {
            characterImageGenEnabled: true,
            characterImageGenStyleHint,
            imageRoundTriggerPercent: row.imageRoundTriggerPercent,
            imageRoundCountMin: imageCountRange.min,
            imageRoundCountMax: imageCountRange.max,
            ...(imageRoundCountTarget > 0 ? { imageRoundCountTarget: imageRoundCountTarget } : {}),
          }
        : {}),
      ...(characterMomentsPinCatalog.trim()
        ? { characterMomentsPinCatalog }
        : {}),
      ...(userMomentsViewerCatalog.trim()
        ? { userMomentsViewerCatalog }
        : {}),
      ...(characterWechatProfileBlock.trim()
        ? { characterWechatProfileBlock }
        : {}),
      proactiveInitiation: aiRound.proactiveInitiation,
      proactiveInitiationNudge: aiRound.proactiveInitiationNudge,
    })

    let bubbles = (ai.bubbles ?? []).map((s) => String(s ?? '').trim()).filter(Boolean)
    if (characterImageGenEnabled && !imageRoundAllowed) {
      bubbles = stripCharacterImageGenLinesFromBubbles(bubbles)
    } else if (characterImageGenEnabled && imageRoundAllowed) {
      bubbles = limitCharacterImageGenLinesFromBubbles(bubbles, imageCountRange.max)
    }
    if (wechatAccountId && characterId && bubbles.length) {
      const profileImageApplied = await stripAndApplyCharacterProfileImageActions({
        characterId,
        bubbles,
      })
      bubbles = profileImageApplied.bubbles
      const profileApplied = await stripAndApplyCharacterWechatProfileUpdates({
        characterId,
        bubbles,
      })
      bubbles = profileApplied.bubbles
      bubbles = await stripAndApplyCharacterMomentPublishDirectives({
        accountId: wechatAccountId,
        characterId,
        playerIdentityId,
        playerDisplayName,
        apiConfig,
        bubbles,
      })
      bubbles = await stripAndApplyCharacterMomentPinDirectives({
        accountId: wechatAccountId,
        characterId,
        bubbles,
      })
    }
    if (!bubbles.length) return

    const notifyTitle =
      character.wechatNickname?.trim() || character.name?.trim() || '聊天'

    let ts = now
    const revealBubbles: ProactiveMessageRevealBubble[] = []
    for (let i = 0; i < bubbles.length; i += 1) {
      const content = bubbles[i]!
      ts += i === 0 ? 0 : 800 + Math.floor(Math.random() * 1200)
      revealBubbles.push({
        id: newMessageId(),
        content,
        thinking: i === 0 ? ai.thinking : undefined,
        timestamp: ts,
      })
    }

    const handedOff = tryHandoffProactiveMessageReveal({
      conversationKey: key,
      characterId: peerCharacterId,
      playerIdentityId,
      notifyPeerTitle: notifyTitle,
      bubbles: revealBubbles,
    })

    if (!handedOff) {
      stashProactiveMessageReveal({
        conversationKey: key,
        characterId: peerCharacterId,
        playerIdentityId,
        notifyPeerTitle: notifyTitle,
        bubbles: revealBubbles,
      })
    }

    const firedAt = Date.now()
    const explicitBusy = await resolveCharacterExplicitBusyForProactive({ row, now: firedAt })
    const nextPatch: Parameters<typeof personaDb.upsertChatConversationSettings>[0] = {
      conversationKey: key,
      peerCharacterId: row.peerCharacterId,
      playerIdentityId: row.playerIdentityId,
      proactiveMessageLastFiredAtMs: firedAt,
    }
    if (isProactiveVariableIntervalEnabled(row)) {
      nextPatch.proactiveMessageNextIntervalSeconds = drawProactiveVariableIntervalSeconds(explicitBusy)
    }
    await personaDb.upsertChatConversationSettings(nextPatch)
  } catch (err) {
    console.warn('[proactivePrivateMessage]', err)
  } finally {
    inFlightKeys.delete(key)
    notifyProactiveMessageInFlightChange()
    setBackgroundNotifyPendingWork({ wechatTyping: false })
  }
}

async function runTick(): Promise<void> {
  if (runningTick) return
  runningTick = true
  try {
    const all = await personaDb.listAllChatConversationSettings()
    const now = Date.now()
    const candidates = all.filter((row) => row && isPersonaPrivateConversation(row) && row.proactiveMessageEnabled)
    for (const row of candidates) {
      if (!(await shouldFire(row, now))) continue
      void fireProactiveMessage(row)
    }
  } finally {
    runningTick = false
  }
}

export function installProactivePrivateMessageEngine(): void {
  if (installed) return
  installed = true

  const onStorage = () => void runTick()
  window.addEventListener('wechat-storage-changed', onStorage)
  document.addEventListener('visibilitychange', onStorage)

  void runTick()
  setInterval(() => void runTick(), TICK_MS)
}
