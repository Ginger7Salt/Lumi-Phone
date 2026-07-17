import type { ApiConfig } from '../../phone/apps/api/types'
import { loadPrivateChatNetworkRelationshipsBlock } from '../../phone/apps/wechat/networkRelationshipsPrompt'
import { buildSystemContent } from '../../phone/apps/wechat/wechatChatAi'
import {
  buildAnonymousQaPersonaPromptPack,
  type AnonymousQaWechatContext,
} from '../anonymousQa/buildAnonymousQaPersonaContext'
import { assertMomentsChatApiConfigured } from './momentsChatApiReady'
import {
  parseMomentsModelJsonPayload,
  requestMomentsModelJsonText,
  throwIfMomentModelJsonInvalid,
} from './momentsChatJsonAi'
import {
  buildCharacterMomentPrivacyPromptSection,
  CHARACTER_MOMENT_PRIVACY_JSON_HINT,
  CHARACTER_MOMENT_PRIVACY_RULES,
} from './momentCharacterPrivacyAi'
import type { MomentContactRef } from './newMomentTypes'
import {
  normalizeInstantGenAiDraft,
  type InstantGenAiDraft,
  type InstantGenConfig,
  instantGenChoiceToPostType,
  instantGenPostTypeIncludesText,
  instantGenPostTypeRequiresText,
} from './momentInstantGenTypes'
import { PUBLISHER_SELF_COMMENT_PROMPT_RULES } from './momentCharacterPublishTypes'
import { buildInstantGenContentTypePromptBlock } from './momentInstantGenContentTypes'
import {
  CHARACTER_MOMENT_MUSIC_POST_JSON_HINT,
  CHARACTER_MOMENT_MUSIC_POST_PROMPT,
  CHARACTER_MOMENT_MUSIC_LOCALE_HINT,
} from './momentAttachedMusic'
import { type MutualFriendRef } from './momentInstantGenContext'
import { MOMENT_LOCATION_PROMPT_HINT } from './momentLocationUtils'
import {
  buildCharacterLocationPromptBlock,
  detectRelocationSignalsInContext,
  enforceCharacterLocationConsistency,
  mergeLocationAnchorWithPersona,
  resolveCharacterLocationAnchor,
} from './momentCharacterLocationAnchor'
import { buildCharacterMomentImagePromptRules } from './momentCharacterImageRules'
import { characterHasAppearanceReference } from '../../phone/apps/wechat/characterAppearanceImageGen'
import {
  buildInstantGenTextLengthHint,
  MOMENT_BODY_LENGTH_HINT,
  MOMENT_IMAGE_COUNT_PROMPT,
} from './momentContentLimits'
import { MOMENT_TEXT_OUTPUT_HINT } from './momentTextSanitize'
import { resolveImageStyleHint } from './momentsImagePromptEnhancer'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

const INSTANT_GEN_TASK = `
【系统任务：实时朋友圈推演与社交生态模拟】
用户刚刚触发了即时朋友圈生成。你必须完全代入角色人设，一次性返回朋友圈正文、与发布者有**人脉关系绑定**的其他角色的互动、以及你对评论的回复。
禁止在正文/评论中写出 MBTI 四字母（ENFP/INFJ 等）或「快乐修勾」「INFJ 清冷感」等类型学套话。
只有与发布者在「管理关系 / 人脉」中**双向互相认识**（A→B 且 B→A 均有关系边）的其他角色才能点赞/评论；单向认识或未绑定的角色不得出现在 interactions 中。
互动 delaySeconds 须在 30~600 秒（10 分钟内）错落分布，不同角色须明显错开；发布者回复的 delaySeconds 为「该评论出现后」再等待的秒数。
共同好友继续跟发布者/他人互怼时，后续 comment 必须填 replyTo 指向被回复那条互动的 id（如 c_001 或发布者 reply 对应评论），禁止写成无 replyTo 的顶层评论。
发布者可在评论区对自己追评补充（非回复他人）：在 interactions 里用 authorId=发布者 characterId、无 replyTo、无 reply 的 comment；或使用 publisherSelfComments 数组。**自评必须与本条正文/配图/地点直接相关**，严禁把私聊另起话题搬进评论区。

${PUBLISHER_SELF_COMMENT_PROMPT_RULES}

仅输出一个 JSON 对象，严禁 Markdown：
{
  "postType": "text"|"mixed"|"image"|"music",
  "content": "极具活人感的朋友圈正文（text/mixed 时必填且不得为空；music 时可选配文；禁止仅写 [图片] 等占位符；纯 image 可留空）",
  "location": null,
  "imagePrompts": ["英文 SD 提示词1","英文 SD 提示词2"],
  ${CHARACTER_MOMENT_MUSIC_POST_JSON_HINT},
  "publisherSelfComments": [{ "content": "追评补充", "delaySeconds": 60 }],
  "interactions": [
    { "type": "like", "authorId": "与发布者有绑定关系的角色characterId", "delaySeconds": 45 },
    {
      "type": "comment",
      "id": "c_001",
      "authorId": "与发布者有绑定关系的角色characterId",
      "content": "评论内容",
      "delaySeconds": 80,
      "reply": { "content": "发布者对这条评论的回复", "delaySeconds": 60 }
    },
    {
      "type": "comment",
      "id": "c_002",
      "authorId": "共同好友characterId",
      "content": "继续回怼发布者的评论",
      "delaySeconds": 140,
      "replyTo": "c_001 或发布者回复那条互动的 id"
    }
  ],
  ${CHARACTER_MOMENT_PRIVACY_JSON_HINT}
}
${MOMENT_LOCATION_PROMPT_HINT}

${MOMENT_TEXT_OUTPUT_HINT}

${MOMENT_BODY_LENGTH_HINT}

${MOMENT_IMAGE_COUNT_PROMPT}

${CHARACTER_MOMENT_MUSIC_POST_PROMPT}

生成时须兼顾用户指定的「内容气质」与「载体形式」：严肃通知/爆瓜/小作文等可写长文；日常吐槽宜短促；暗恋吃醋宜留白暗示。
`.trim()

export async function generateInstantMomentWithInteractions(params: {
  wechatCtx: AnonymousQaWechatContext
  config: InstantGenConfig
  targetDisplayName: string
  recentContext: string
  mutualFriends: MutualFriendRef[]
  momentContacts: MomentContactRef[]
  blockedCharacterIds?: Set<string>
  imageGenSettings?: MomentsImageGenSettings
}): Promise<InstantGenAiDraft> {
  const cfg = params.wechatCtx.apiConfig
  assertMomentsChatApiConfigured(cfg)

  const includeRecentChat = params.config.includeRecentChat === true
  const includeOfflinePlots = params.config.includeOfflinePlots === true
  const includeLongTermMemory = params.config.includeLongTermMemory === true
  /** 三个参考都不勾：只按人设 / 世界书，角色自己的生活 */
  const characterSoloTheme = !includeRecentChat && !includeOfflinePlots && !includeLongTermMemory

  const pack = await buildAnonymousQaPersonaPromptPack({
    characterId: params.config.targetCharacterId,
    wechatCtx: params.wechatCtx,
    relevanceHaystack: params.recentContext,
    disableMemoryVectorRecall: true,
    includeUnsummarizedChat: includeRecentChat,
    includeLongTermMemory,
    includeOfflineDatingPlots: includeOfflinePlots,
  })
  if (!pack.character) {
    throw new Error('未找到该角色人设，请确认通讯录已绑定角色')
  }

  const locationAnchor = mergeLocationAnchorWithPersona({
    locationAnchor: await resolveCharacterLocationAnchor({
      accountId: params.wechatCtx.wechatAccountId,
      characterId: params.config.targetCharacterId,
    }),
    personaTexts: [
      pack.character.bio,
      pack.character.identity,
      pack.character.wechatRegion,
      pack.character.worldBooks
        ?.flatMap((w) => w.items ?? [])
        .map((it) => `${it.keywords ?? ''}\n${it.content ?? ''}`)
        .join('\n'),
      pack.worldBackgroundPrompt,
      includeLongTermMemory ? pack.longTermMemoryNotes : '',
      includeOfflinePlots ? pack.offlineDatingPlotsContext : '',
      includeRecentChat ? params.recentContext : '',
      includeRecentChat ? pack.unsummarizedPrivateNotes : '',
    ],
  })
  const relocationAllowed = detectRelocationSignalsInContext(
    includeLongTermMemory ? pack.longTermMemoryNotes : '',
    includeRecentChat ? pack.unsummarizedPrivateNotes : '',
    includeOfflinePlots ? pack.offlineDatingPlotsContext : '',
    includeRecentChat || includeOfflinePlots ? params.recentContext : '',
  )
  const locationPromptBlock = buildCharacterLocationPromptBlock({
    ...locationAnchor,
    relocationAllowed,
  })

  const networkRelationshipsBlock = await loadPrivateChatNetworkRelationshipsBlock({
    character: pack.character,
    sessionPlayerIdentityId: params.wechatCtx.playerIdentityId,
  })

  const system = buildSystemContent({
    character: pack.character,
    // 纯角色主题时不塞用户身份卡，避免正文被用户日程/关系牵引
    playerIdentity: characterSoloTheme ? null : pack.playerIdentity,
    playerDisplayName: params.wechatCtx.playerDisplayName.trim() || '朋友',
    promptMode: 'persona',
    longTermMemoryNotes: includeLongTermMemory ? pack.longTermMemoryNotes || undefined : undefined,
    worldBackgroundPrompt: pack.worldBackgroundPrompt,
    offlineDatingPlotsContext: includeOfflinePlots
      ? pack.offlineDatingPlotsContext || undefined
      : undefined,
    unsummarizedPrivateNotes: includeRecentChat
      ? pack.unsummarizedPrivateNotes || undefined
      : undefined,
    unsummarizedGroupNotes: includeRecentChat
      ? pack.unsummarizedGroupNotes || undefined
      : undefined,
    meetEncounterMemoriesContext: includeRecentChat
      ? pack.meetEncounterMemoriesContext || undefined
      : undefined,
    unsummarizedMeetNotes: includeRecentChat ? pack.unsMeet || undefined : undefined,
    networkRelationshipsBlock: networkRelationshipsBlock || undefined,
    chatMemberIds: [params.config.targetCharacterId],
  })

  const mutualList =
    params.mutualFriends.length > 0
      ? params.mutualFriends.map((f) => `${f.displayName}（id: ${f.charId}）`).join('、')
      : '（无与发布者绑定关系的角色，interactions 应为空数组）'

  const styleHint = params.imageGenSettings
    ? resolveImageStyleHint(params.imageGenSettings)
    : '写实摄影'
  const isAnimeStyle = styleHint.includes('二次元') || styleHint.toLowerCase().includes('anime')
  const includesText = instantGenPostTypeIncludesText(params.config.postType)
  const requiresText = instantGenPostTypeRequiresText(params.config.postType)
  const textLengthHint = includesText
    ? buildInstantGenTextLengthHint(params.config.textLengthTarget)
    : ''

  const privacyPrompt = buildCharacterMomentPrivacyPromptSection({
    publisherCharacterId: params.config.targetCharacterId,
    momentContacts: params.momentContacts,
    playerDisplayName: params.wechatCtx.playerDisplayName,
    blockedCharacterIds: params.blockedCharacterIds,
  })

  const TOPIC_DIVERSITY_RULE = [
    '【话题多样性】朋友圈是角色的公开生活墙，不要默认以用户为唯一话题。',
    '可以发：自己的日常琐事、兴趣爱好、工作学习吐槽、独自外出见闻、和共同好友/其他人的日常互动梗、审美种草等。',
    '只有勾选了对应参考、且本条气质确实相关时，才可轻量涉及与用户有关的公开可说内容；禁止条条都写成想念用户、汇报给用户、围着用户转。',
  ].join('\n')

  const themeOrContextBlock = characterSoloTheme
    ? [
        '【本条立意 · 仅人设】本次未勾选「最近对话 / 线下剧情 / 长期记忆」。',
        '只依据人设、世界书、世界背景发挥；以角色本人的生活与社交圈为主题。',
        '严禁把与用户的私聊、暧昧拉扯、思念用户、约会回忆、关系进展写成正文或自评核心。',
        '用户称呼仅供隐私/@ 判断，不是发帖主题。',
        TOPIC_DIVERSITY_RULE,
      ].join('\n')
    : [
        includeRecentChat || includeOfflinePlots
          ? `【可选参考上下文】（仅在与本条气质相关时轻量借用，勿整段复述）：\n${params.recentContext}`
          : '',
        includeRecentChat
          ? '已勾选最近对话：可参考近 20 条私聊的语气与事件，但仍须写成角色会公开发的朋友圈，勿把私密私聊原话搬上墙。'
          : '未勾选最近对话：勿引用近期私聊情节。',
        includeOfflinePlots
          ? '已勾选线下剧情：可呼应未总结线下情节的公开可说部分。'
          : '未勾选线下剧情：勿写约会/线下同行回忆。',
        includeLongTermMemory
          ? '已勾选长期记忆：可轻量借用相关记忆作背景，勿把记忆条目复述成日记。'
          : '未勾选长期记忆：勿引用长期记忆库中的情节。',
        TOPIC_DIVERSITY_RULE,
      ]
        .filter(Boolean)
        .join('\n')

  const userTask = [
    `你的身份是：【${params.targetDisplayName}】`,
    `用户选定的载体形式：${instantGenChoiceToPostType(params.config.postType)}（text=纯文字，mixed=图文，image=纯图片，music=分享歌曲）`,
    buildInstantGenContentTypePromptBlock(
      params.config.contentType,
      params.config.customContentDirection,
    ),
    params.config.postType === 'music'
      ? `【分享歌曲】postType 必须为 music；必填 attachedMusic（网易云真实歌名+歌手）；content 可选 1～2 句配文；禁止 imagePrompts。\n${CHARACTER_MOMENT_MUSIC_LOCALE_HINT}`
      : requiresText
        ? `【正文字数】${textLengthHint}\n载体含文字时 content 必填、不得为空，禁止只输出 [图片] 等协议占位符；须直接写可读正文（标点/emoji 均可）。`
        : includesText
          ? `【配文字数】${textLengthHint}\ncontent 可选，用于补充分享心情。`
          : '纯图片动态：content 留空，只填 imagePrompts。',
    params.config.postType === 'music' ? '' : `配图引擎风格：${styleHint}`,
    (params.config.postType === 'mixed' || params.config.postType === 'image')
      ? '载体含图时 imagePrompts 须按场景给出 1~9 个不同画面的英文 prompt，勿习惯性只输出 1 个。'
      : '',
    (params.config.postType === 'mixed' || params.config.postType === 'image')
      ? buildCharacterMomentImagePromptRules(isAnimeStyle, characterHasAppearanceReference(pack.character))
      : '',
    themeOrContextBlock,
    `可与该条朋友圈互动的角色（authorId 须填 characterId；均须与发布者双向互相认识）：${mutualList}`,
    '被 hide_from 屏蔽的角色看不到该动态，不得出现在 interactions 中。',
    privacyPrompt,
    locationPromptBlock,
    '是否附带 location 由发布者自行决定，非必要填 null；若填写须遵守上方市级锚点规则，无跨城依据时市级不得变更。',
    '请生成极具活人感的朋友圈与后续社交互动，只返回 JSON。',
  ].join('\n\n')

  const raw = await requestMomentsModelJsonText(
    cfg as ApiConfig,
    [
      { role: 'system', content: `${system}\n\n${INSTANT_GEN_TASK}\n\n${CHARACTER_MOMENT_PRIVACY_RULES}` },
      { role: 'user', content: userTask },
    ],
    { temperature: 0.9 },
  )
  const trimmedRaw = raw.trim()
  const payload = parseMomentsModelJsonPayload(trimmedRaw)
  const contentLimit = includesText ? params.config.textLengthTarget : undefined
  const draft = normalizeInstantGenAiDraft(
    payload,
    params.config.postType,
    params.config.targetCharacterId,
    contentLimit,
  )
  throwIfMomentModelJsonInvalid(trimmedRaw, draft)
  return {
    ...draft,
    location: enforceCharacterLocationConsistency({
      location: draft.location,
      anchorCity: locationAnchor.anchorCity,
      contextTexts: [
        includeLongTermMemory ? pack.longTermMemoryNotes : '',
        includeRecentChat ? pack.unsummarizedPrivateNotes : '',
        includeOfflinePlots ? pack.offlineDatingPlotsContext : '',
        includeRecentChat || includeOfflinePlots ? params.recentContext : '',
      ],
      postContent: draft.content,
    }),
  }
}
