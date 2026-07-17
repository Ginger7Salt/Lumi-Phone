import { generateMomentsImage } from '../../../components/moments/momentsImageGen'
import { isMomentsImageGenConfigured } from '../../../components/moments/momentsImageGenAvailability'
import { loadResolvedApiConfig } from '../api/loadResolvedApiConfig'
import { loadResolvedImageGenSettings } from '../api/loadResolvedImageGenSettings'
import {
  appearanceBundleToCharacterPatch,
  resolveScopedAppearanceRefs,
} from '../wechat/resolveScopedAppearanceRefs'
import {
  buildCharacterMediaImageGenParams,
  buildDatingPlotImageGenParams,
} from '../wechat/characterAppearanceImageGen'
import { enforceDatingPlotImagePromptCastGenders } from '../wechat/dating/datingPlotImagePromptGenderEnforcer'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import {
  generatePulseCinematicFeedImagePrompts,
  generatePulsePhoneFeedImagePrompts,
  isPulsePhoneStyleImageBrief,
} from './pulsePostImagePromptAi'
import { parsePulsePovId } from './pulseTypes'

/**
 * 微博帖配图双层：
 * - 占位：通俗中文画面描述（给用户看，绝不直接当生图 prompt）
 * - 后台：推演英文 tags 后，按内容走「线上角色发图 character_media」或「线下剧情电影 dating_plot」模版生图
 */
export async function generatePulsePostSlotImage(params: {
  description: string
  /** 帖文正文，仅作语境（非提示词） */
  postContent?: string | null
  worldOrCharacterPovId?: string | null
  playerPovId?: string | null
  /** 已有英文提示词时跳过推演，直接生图（重新生成） */
  imagePromptOverride?: string | null
}): Promise<{ dataUrl: string; imagePrompt: string; pipeline: 'character_media' | 'dating_plot' }> {
  const description = params.description.trim()
  const override = params.imagePromptOverride?.trim() || ''
  if (!description && !override) throw new Error('缺少画面描述')

  const settings = await loadResolvedImageGenSettings()
  if (!isMomentsImageGenConfigured(settings)) {
    throw new Error('请先在 API 预设或朋友圈设置中配置生图引擎')
  }

  const apiConfig = await loadResolvedApiConfig('chatCard')
  if (
    !override &&
    (!apiConfig?.apiUrl?.trim() || !apiConfig?.apiKey?.trim() || !apiConfig?.modelId?.trim())
  ) {
    throw new Error('请先配置对话 API（用于配图提示词推演）')
  }

  const worldParsed = params.worldOrCharacterPovId
    ? parsePulsePovId(
        params.worldOrCharacterPovId.startsWith('char:')
          ? params.worldOrCharacterPovId
          : `char:${params.worldOrCharacterPovId}`,
      )
    : null
  const characterId =
    worldParsed?.kind === 'char' ? worldParsed.rawId : params.worldOrCharacterPovId?.trim() || ''

  const playerParsed = params.playerPovId
    ? parsePulsePovId(
        params.playerPovId.startsWith('player:')
          ? params.playerPovId
          : `player:${params.playerPovId}`,
      )
    : null
  const identityId =
    playerParsed?.kind === 'player' ? playerParsed.rawId : params.playerPovId?.trim() || ''

  const character = characterId ? await personaDb.getCharacter(characterId) : null
  const playerIdentity = identityId ? await personaDb.getPlayerIdentity(identityId) : null

  const phoneStyle = isPulsePhoneStyleImageBrief(description || override)
  const scopedRefs = character
    ? await resolveScopedAppearanceRefs({
        context: phoneStyle ? 'chat' : 'dating',
        characterId: character.id,
        character,
        playerIdentityId: identityId || null,
        playerIdentity,
      })
    : null

  const characterForGen = character
    ? {
        ...character,
        ...(scopedRefs ? appearanceBundleToCharacterPatch(scopedRefs.character) : {}),
      }
    : null

  const playerDisplayName =
    playerIdentity?.wechatNickname?.trim() || playerIdentity?.name?.trim() || '玩家'
  const narrative = params.postContent?.trim() || undefined

  let prompt: string
  if (override) {
    prompt = phoneStyle
      ? override
      : enforceDatingPlotImagePromptCastGenders(override, characterForGen, playerIdentity)
  } else {
    if (!apiConfig) throw new Error('请先配置对话 API（用于配图提示词推演）')
    const promptPack = phoneStyle
      ? await generatePulsePhoneFeedImagePrompts({
          apiConfig,
          description,
          character: characterForGen,
          playerIdentity,
          playerDisplayName,
          narrativeContext: narrative,
        })
      : await generatePulseCinematicFeedImagePrompts({
          apiConfig,
          description,
          character: characterForGen,
          playerIdentity,
          playerDisplayName,
          narrativeContext: narrative,
        })

    const promptRaw = promptPack.prompts[0]?.trim()
    if (!promptRaw) {
      throw new Error('配图提示词推演失败，请稍后重试')
    }

    prompt = phoneStyle
      ? promptRaw
      : enforceDatingPlotImagePromptCastGenders(promptRaw, characterForGen, playerIdentity)
  }

  const genParams = phoneStyle
    ? buildCharacterMediaImageGenParams({
        prompt,
        settings,
        character: characterForGen,
        additionalReferenceImages: scopedRefs?.user.images,
      })
    : buildDatingPlotImageGenParams({
        prompt,
        settings,
        character: characterForGen,
        playerIdentity,
        playerDisplayName,
        additionalReferenceImages: scopedRefs?.user.images,
      })

  const dataUrl = await generateMomentsImage(genParams)
  if (!dataUrl?.trim()) throw new Error('生图 API 未返回有效图片')
  return {
    dataUrl,
    imagePrompt: prompt,
    pipeline: phoneStyle ? 'character_media' : 'dating_plot',
  }
}
