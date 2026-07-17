import type { MomentItemModel } from './mockMoments'
import { alignMomentImagePrompts } from './momentImageRegen'

/** 就地更新某张配图 URL + 提示词（供 patchUserMoment 使用） */
export function buildMomentImageReplacePatch(
  moment: MomentItemModel,
  index: number,
  next: { url: string; prompt: string },
): Pick<MomentItemModel, 'images' | 'imagePrompts'> {
  const images = [...(moment.images ?? [])]
  if (index < 0 || index >= images.length) {
    throw new Error('图片索引无效')
  }
  images[index] = next.url
  const prompts = [...(moment.imagePrompts ?? [])]
  while (prompts.length < images.length) prompts.push('')
  prompts[index] = next.prompt.trim()
  return {
    images,
    imagePrompts: alignMomentImagePrompts(images, prompts),
  }
}

export function buildMomentImagePromptPatch(
  moment: MomentItemModel,
  index: number,
  prompt: string,
): Pick<MomentItemModel, 'imagePrompts'> {
  const images = moment.images ?? []
  if (index < 0 || index >= images.length) {
    throw new Error('图片索引无效')
  }
  const prompts = [...(moment.imagePrompts ?? [])]
  while (prompts.length < images.length) prompts.push('')
  prompts[index] = prompt.trim()
  return {
    imagePrompts: alignMomentImagePrompts(images, prompts) ?? prompts,
  }
}
