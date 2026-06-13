import type { ApiConfig } from '../../phone/apps/api/types'
import { loadPrivateChatNetworkRelationshipsBlock } from '../../phone/apps/wechat/networkRelationshipsPrompt'
import type { WeChatChatMessage } from '../../phone/apps/wechat/newFriendsPersona/types'
import { materializeSystemContent } from '../../phone/apps/wechat/wechatChatAi'
import { parseModelJsonPayload } from '../anonymousQa/qnaDirectedJsonParse'
import {
  buildAnonymousQaPersonaPromptPack,
  type AnonymousQaWechatContext,
} from '../anonymousQa/buildAnonymousQaPersonaContext'

import type { AiMomentInteractionDraft } from './momentInteractionTypes'
import { detectUserGhostedChatButPostedMoment } from './momentUserInteractionContext'
import { assertMomentsChatApiConfigured } from './momentsChatApiReady'
import type { AllowedMomentCharacter } from './momentPrivacyAudience'
import { MOMENT_TEXT_OUTPUT_HINT, sanitizeMomentText } from './momentTextSanitize'
import { runMomentsVisionChat } from './momentVisionChat'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'

const USER_MOMENT_INTERACTION_TASK = `
---
【朋友圈评论任务 · 最高优先级】
你正在以**本角色本人**对用户朋友圈做出反应（点赞 / 评论 / 浏览），不是在当第三方「互动编排器」。
- 评论即你在微信朋友圈下的真实留言：语气、句式、长短、口癖、emoji 习惯须与 system 中【近期私聊】里**你（角色）说过的话**一致。
- 私聊里克制、短句、少感叹 → 评论里也须如此；**禁止**突然变萌宠网红体、客服体、翻译腔。
- **禁止**因角色名/昵称含「狗/猫」等就写「帮你咬他」「哇太乖了」式模板，除非私聊里你本就这种说话方式。
- 可 0 条互动；comment 最多 1～2 句，像真人随手评，不要戏精表演。
- comment **必须**承接上方朋友圈正文的具体内容/情绪（如用户说困→关心睡觉、调侃熬夜等），**禁止**「看到了」「收到」「不错哦」等空话。
- 只输出 JSON，不要 Markdown。
${MOMENT_TEXT_OUTPUT_HINT}
`.trim()

function formatRecentPrivateChatToneAnchor(messages: WeChatChatMessage[], limit = 10): string {
  const sorted = [...messages].filter((m) => !m.isRecalled).sort((a, b) => a.timestamp - b.timestamp)
  const tail = sorted.slice(-limit)
  if (!tail.length) return ''
  const lines = tail.map((m) => {
    const who = m.type === 'character' ? '你（角色）' : '用户'
    const text = m.content?.trim().slice(0, 160) || '（非文字消息）'
    return `${who}：${text}`
  })
  return [
    '【近期私聊原文（评论语气须与此一致，尤其模仿「你（角色）」的说话方式）】',
    ...lines,
  ].join('\n')
}

function buildSingleCharacterInteractionTask(params: {
  playerDisplayName: string
  momentContent: string
  imageCount: number
  mentioned: boolean
  enableVisitorFootprints: boolean
  ghostTease: ReturnType<typeof detectUserGhostedChatButPostedMoment>
  privateChatToneAnchor: string
}): string {
  const typeUnion = params.enableVisitorFootprints ? '"like"|"comment"|"viewed"' : '"like"|"comment"'
  const viewedRule = params.enableVisitorFootprints
    ? '\n- type=viewed：只浏览不点赞不评论；需 dwellSeconds（3～120）'
    : ''
  const mentionLine = params.mentioned
    ? '\n- 用户在这条朋友圈里 @ 提醒了你；你知晓被提及，但互动深浅仍须符合关系与人设。'
    : ''
  const ghostLine = params.ghostTease
    ? `\n- 【情境】用户约 ${params.ghostTease.gapHours} 小时未回你私聊却发了这条圈；若符合人设，可在 comment 里轻调侃「有空发朋友圈没空回消息」，勿机械模板。`
    : ''

  return [
    `【任务】你（本角色）看到 ${params.playerDisplayName.trim() || '用户'} 刚发的朋友圈，决定是否点赞/评论`,
    `【朋友圈正文 · 评论必须回应这里】${params.momentContent.trim() || '（无文字）'}`,
    `配图数：${params.imageCount}${mentionLine}${ghostLine}`,
    params.privateChatToneAnchor,
    '',
    `输出 JSON：{"interactions":[{"type":${typeUnion},"content":"仅comment需要","delaySeconds":数字,"dwellSeconds":"仅viewed"}]}`,
    '规则：可 0～2 条；有 comment 时须回应正文具体内容；delaySeconds 30～300；若 like+comment，comment 比 like 大 8～15 秒。',
    viewedRule,
  ]
    .filter(Boolean)
    .join('\n')
}

function parseSingleCharacterInteractions(
  payload: unknown,
  charId: string,
  allowViewed: boolean,
): AiMomentInteractionDraft[] {
  const rows = (() => {
    if (Array.isArray(payload)) return payload
    if (!payload || typeof payload !== 'object') return null
    const o = payload as Record<string, unknown>
    if (Array.isArray(o.interactions)) return o.interactions as unknown[]
    return null
  })()
  if (!rows?.length) return []

  const out: AiMomentInteractionDraft[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const typeRaw = o.type
    const type =
      typeRaw === 'like' || typeRaw === 'comment' || (allowViewed && typeRaw === 'viewed')
        ? typeRaw
        : null
    if (!type) continue

    const delayRaw = Number(o.delaySeconds)
    const delaySeconds = Number.isFinite(delayRaw) ? Math.max(5, Math.min(7200, delayRaw)) : 60

    if (type === 'comment') {
      const content = sanitizeMomentText(typeof o.content === 'string' ? o.content : '')
      if (!content) continue
      out.push({ charId, type, content: content.slice(0, 280), delaySeconds })
      continue
    }
    if (type === 'viewed') {
      const dwellRaw = Number(o.dwellSeconds)
      const dwellSeconds = Number.isFinite(dwellRaw)
        ? Math.max(3, Math.min(300, Math.round(dwellRaw)))
        : 12
      out.push({ charId, type, delaySeconds, dwellSeconds })
      continue
    }
    out.push({ charId, type, delaySeconds })
    if (out.length >= 2) break
  }
  return out
}

function parseInteractionRaw(
  raw: string,
  charId: string,
  allowViewed: boolean,
): AiMomentInteractionDraft[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const payload = parseModelJsonPayload(trimmed)
  if (!payload) return []
  return parseSingleCharacterInteractions(payload, charId, allowViewed)
}

async function loadPrivateChatMessages(conversationKey: string): Promise<WeChatChatMessage[]> {
  const key = conversationKey.trim()
  if (!key) return []
  try {
    return await personaDb.listWeChatChatMessagesByConversationKey(key)
  } catch {
    return []
  }
}

async function generatePersonaBoundInteractionForCharacter(params: {
  cfg: ApiConfig
  wechatCtx: AnonymousQaWechatContext
  character: AllowedMomentCharacter
  momentContent: string
  momentImages?: string[]
  imageCount: number
  momentPublishedAt: number
  mentioned: boolean
  enableVisitorFootprints: boolean
}): Promise<AiMomentInteractionDraft[]> {
  const haystack = [params.momentContent.trim(), '朋友圈 动态 互动 评论'].filter(Boolean).join('\n')
  const pack = await buildAnonymousQaPersonaPromptPack({
    characterId: params.character.charId,
    wechatCtx: params.wechatCtx,
    relevanceHaystack: haystack,
  })
  if (!pack.character) return []

  const messages = await loadPrivateChatMessages(pack.conversationKey)
  const ghostTease = detectUserGhostedChatButPostedMoment(messages, params.momentPublishedAt)
  const privateChatToneAnchor = formatRecentPrivateChatToneAnchor(messages)

  const networkRelationshipsBlock = await loadPrivateChatNetworkRelationshipsBlock({
    character: pack.character,
    sessionPlayerIdentityId: params.wechatCtx.playerIdentityId,
  })

  const systemBase = await materializeSystemContent({
    character: pack.character,
    playerIdentity: pack.playerIdentity,
    playerDisplayName: params.wechatCtx.playerDisplayName.trim() || '朋友',
    promptMode: 'persona',
    longTermMemoryNotes: pack.longTermMemoryNotes || undefined,
    worldBackgroundPrompt: pack.worldBackgroundPrompt,
    offlineDatingPlotsContext: pack.offlineDatingPlotsContext || undefined,
    unsummarizedPrivateNotes: pack.unsummarizedPrivateNotes || undefined,
    unsummarizedGroupNotes: pack.unsummarizedGroupNotes || undefined,
    meetEncounterMemoriesContext: pack.meetEncounterMemoriesContext || undefined,
    unsummarizedMeetNotes: pack.unsMeet?.trim() || undefined,
    networkRelationshipsBlock: networkRelationshipsBlock || undefined,
    chatMemberIds: [params.character.charId],
    globalWechatPlate: 'private_chat',
  })

  const system = `${systemBase}\n\n${USER_MOMENT_INTERACTION_TASK}`

  const userTask = buildSingleCharacterInteractionTask({
    playerDisplayName: params.wechatCtx.playerDisplayName,
    momentContent: params.momentContent,
    imageCount: params.imageCount,
    mentioned: params.mentioned,
    enableVisitorFootprints: params.enableVisitorFootprints,
    ghostTease,
    privateChatToneAnchor,
  })

  const runOnce = async (retryNote?: string) => {
    const raw = await runMomentsVisionChat(params.cfg, {
      system,
      userText: retryNote ? `${userTask}\n\n${retryNote}` : userTask,
      momentImages: params.momentImages,
      temperature: retryNote ? 0.75 : 0.88,
      max_tokens: 680,
    })
    return parseInteractionRaw(raw, params.character.charId, params.enableVisitorFootprints)
  }

  let drafts = await runOnce()
  if (!drafts.length) {
    drafts = await runOnce(
      '上次输出无效。请仅输出 JSON；若有 comment，必须直接回应朋友圈正文（禁止「看到了」「收到」等空话）。',
    )
  }

  return drafts
}

/** 按角色人设分别生成对用户朋友圈的点赞/评论（与私聊同一套 system 注入） */
export async function generatePersonaBoundUserMomentInteractions(params: {
  wechatCtx: AnonymousQaWechatContext
  momentContent: string
  imageCount: number
  momentImages?: string[]
  allowedCharacters: AllowedMomentCharacter[]
  mentionedCharacterIds?: Set<string>
  enableVisitorFootprints?: boolean
  momentPublishedAt: number
}): Promise<AiMomentInteractionDraft[]> {
  const cfg = params.wechatCtx.apiConfig
  assertMomentsChatApiConfigured(cfg)

  const mentionedIds = params.mentionedCharacterIds ?? new Set<string>()
  const rows = await Promise.all(
    params.allowedCharacters.map((character) =>
      generatePersonaBoundInteractionForCharacter({
        cfg: cfg as ApiConfig,
        wechatCtx: params.wechatCtx,
        character,
        momentContent: params.momentContent,
        momentImages: params.momentImages,
        imageCount: params.imageCount,
        momentPublishedAt: params.momentPublishedAt,
        mentioned: mentionedIds.has(character.charId),
        enableVisitorFootprints: params.enableVisitorFootprints ?? false,
      }),
    ),
  )
  return rows.flat()
}
