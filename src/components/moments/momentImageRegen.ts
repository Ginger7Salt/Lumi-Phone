import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { buildCharacterMediaImageGenParams } from '../../phone/apps/wechat/characterAppearanceImageGen'
import type { Character } from '../../phone/apps/wechat/newFriendsPersona/types'
import { generateMomentsImage } from './momentsImageGen'
import { isMomentsImageGenConfigured } from './momentsImageGenAvailability'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'
import { loadMomentsSettings } from './useMomentsSettingsStore'

/** 按提示词重新生成一张朋友圈配图（character_media 模版） */
export async function regenerateMomentFeedImage(params: {
  prompt: string
  characterId?: string | null
  settings?: MomentsImageGenSettings | null
}): Promise<string> {
  const prompt = params.prompt.trim()
  if (!prompt) throw new Error('请先填写生图提示词')

  const settings = params.settings ?? loadMomentsSettings().imageGen
  if (!isMomentsImageGenConfigured(settings)) {
    throw new Error('请先在朋友圈设置中配置生图引擎')
  }

  const characterId = params.characterId?.trim()
  let character: Character | null = null
  if (characterId) {
    try {
      character = (await personaDb.getCharacter(characterId)) ?? null
    } catch {
      character = null
    }
  }

  const dataUrl = await generateMomentsImage(
    buildCharacterMediaImageGenParams({
      prompt,
      settings,
      character,
      width: 512,
      height: 512,
    }),
  )
  if (!dataUrl?.trim()) throw new Error('生图 API 未返回有效图片')
  return dataUrl
}

/** 保证 imagePrompts 与 images 同长；缺位补空串 */
export function alignMomentImagePrompts(
  images: string[] | undefined,
  prompts: string[] | undefined,
): string[] | undefined {
  if (!images?.length) return undefined
  const next = images.map((_, i) => String(prompts?.[i] ?? '').trim())
  return next.some(Boolean) ? next : undefined
}
