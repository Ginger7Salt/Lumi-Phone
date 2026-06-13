import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'
import { resolveCharacterAvatarUrl } from '../../phone/utils/characterAvatarUrl'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { buildMomentsUserContactRef, resolveEffectiveCharacterMentionUser } from './momentMentionUtils'
import type { MomentItemModel } from './mockMoments'
import { assertMomentsChatApiConfigured } from './momentsChatApiReady'
import { generateCharacterMomentPost } from './momentCharacterPublishAi'
import type { CharacterMomentPostType } from './momentCharacterPublishTypes'
import { isMomentsImageGenConfigured } from './momentsImageGenAvailability'
import { generateMomentsImage } from './momentsImageGen'
import type { MomentContactRef } from './newMomentTypes'
import { characterPostToMomentItem } from './publishMomentUtils'
import { MAX_MOMENT_IMAGES } from './momentContentLimits'
import { sanitizeMomentBodyText } from './momentTextSanitize'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

export type PublishCharacterMomentParams = {
  wechatCtx: AnonymousQaWechatContext
  characterId: string
  characterContact: MomentContactRef
  momentContacts?: MomentContactRef[]
  blockedCharacterIds?: Set<string>
  imageGenSettings: MomentsImageGenSettings
  chatRequestHint?: string
  triggeredByUserRequest?: boolean
  onProgress?: (stage: 'writing' | 'imaging' | 'done') => void
}

export type PublishCharacterMomentResult = {
  item: MomentItemModel
  usedFallback: boolean
}

function resolvePostImages(
  postType: CharacterMomentPostType,
  imageUrls: string[],
): string[] | undefined {
  if (postType === 'text') return undefined
  return imageUrls.length ? imageUrls : undefined
}

async function generateCharacterMomentImages(
  prompts: string[],
  settings: MomentsImageGenSettings,
): Promise<string[]> {
  if (!settings.enabled) return []
  const capped = prompts.slice(0, MAX_MOMENT_IMAGES)
  const urls: string[] = []
  for (const prompt of capped) {
    try {
      const url = await generateMomentsImage({
        prompt,
        settings,
        width: 512,
        height: 512,
        promptContext: 'character_media',
      })
      if (url) urls.push(url)
    } catch {
      // 单张失败不阻断整条动态
    }
  }
  return urls
}

export async function publishCharacterMoment(
  params: PublishCharacterMomentParams,
): Promise<PublishCharacterMomentResult> {
  assertMomentsChatApiConfigured(params.wechatCtx.apiConfig)
  params.onProgress?.('writing')

  const character = await personaDb.getCharacter(params.characterId)
  const displayName =
    params.characterContact.name.trim() ||
    character?.remark?.trim() ||
    character?.wechatNickname?.trim() ||
    character?.name?.trim() ||
    '未命名'
  const avatarUrl =
    resolveCharacterAvatarUrl({
      avatarUrl: params.characterContact.avatarUrl ?? character?.avatarUrl,
    }) || resolveCharacterAvatarUrl({ avatarUrl: '' })

  const aiDraft = await generateCharacterMomentPost({
    wechatCtx: params.wechatCtx,
    characterId: params.characterId,
    characterDisplayName: displayName,
    momentContacts: params.momentContacts,
    blockedCharacterIds: params.blockedCharacterIds,
    chatRequestHint: params.chatRequestHint,
    triggeredByUserRequest: params.triggeredByUserRequest,
  })

  let imageUrls: string[] = []
  let postType = aiDraft.postType
  let content = sanitizeMomentBodyText(aiDraft.content)
  const needsImages = postType === 'image' || postType === 'mixed'
  if (needsImages && isMomentsImageGenConfigured(params.imageGenSettings) && aiDraft.images.length) {
    params.onProgress?.('imaging')
    imageUrls = await generateCharacterMomentImages(aiDraft.images, params.imageGenSettings)
  }

  if (needsImages && !imageUrls.length) {
    if (postType === 'image') {
      postType = 'text'
      content = content || '。'
    } else if (postType === 'mixed' && !content.trim()) {
      postType = 'text'
      content = '。'
    }
  }

  const userContact = buildMomentsUserContactRef(params.wechatCtx.playerDisplayName)

  const item = characterPostToMomentItem({
    characterId: params.characterId,
    authorName: displayName,
    authorAvatar: avatarUrl,
    postType,
    content,
    imageUrls: resolvePostImages(postType, imageUrls) ?? [],
    location: aiDraft.location,
    privacy: aiDraft.privacy,
    userContact,
    momentContacts: params.momentContacts,
    isPinned: aiDraft.isPinned,
    mentionUser: resolveEffectiveCharacterMentionUser({
      mentionUser: aiDraft.mentionUser,
      privacy: aiDraft.privacy,
      chatRequestHint: params.chatRequestHint,
      triggeredByUserRequest: params.triggeredByUserRequest,
    }),
    mentionCharacterIds: aiDraft.mentionCharacterIds,
    publisherSelfComments: aiDraft.publisherSelfComments,
  })

  params.onProgress?.('done')
  return { item, usedFallback: false }
}
