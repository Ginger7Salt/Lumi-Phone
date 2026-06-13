import type { MomentsImageModelOption } from './momentsImageModelCatalog'

const NOVELAI_SUBSCRIPTION_URL = 'https://api.novelai.net/user/subscription'

type NovelaiModelDef = {
  modelName: string
  labelZh: string
  description: string
  priceLabel?: string
}

const NOVELAI_IMAGE_MODEL_DEFS: NovelaiModelDef[] = [
  {
    modelName: 'nai-diffusion-4-5-full',
    labelZh: 'NAI Diffusion 4.5 Full',
    description: '最新 4.5 完整模型，细节与可控性最佳',
    priceLabel: '按 Anlas 计费',
  },
  {
    modelName: 'nai-diffusion-4-5-curated',
    labelZh: 'NAI Diffusion 4.5 Curated',
    description: '4.5 精选版，更稳定、更省 Anlas',
    priceLabel: '按 Anlas 计费',
  },
  {
    modelName: 'nai-diffusion-4-full',
    labelZh: 'NAI Diffusion 4 Full',
    description: 'V4 完整模型',
    priceLabel: '按 Anlas 计费',
  },
  {
    modelName: 'nai-diffusion-4-curated-preview',
    labelZh: 'NAI Diffusion 4 Curated',
    description: 'V4 精选预览版',
    priceLabel: '按 Anlas 计费',
  },
  {
    modelName: 'nai-diffusion-3',
    labelZh: 'NAI Diffusion 3',
    description: '经典 V3 模型',
    priceLabel: '按 Anlas 计费',
  },
]

export const DEFAULT_NOVELAI_IMAGE_MODEL_ID = 'novelai:nai-diffusion-4-5-full'

export const NOVELAI_IMAGE_API_URL = 'https://image.novelai.net/ai/generate-image'

export const NOVELAI_ACCOUNT_URL = 'https://novelai.net/account'

function toCatalogOption(def: NovelaiModelDef): MomentsImageModelOption {
  return {
    id: `novelai:${def.modelName}`,
    modelName: def.modelName,
    labelZh: def.labelZh,
    title: def.labelZh,
    brand: 'NovelAI',
    description: def.description,
    free: false,
    priceLabel: def.priceLabel ?? '按 Anlas 计费',
  }
}

export function buildNovelaiImageModelCatalog(): MomentsImageModelOption[] {
  return NOVELAI_IMAGE_MODEL_DEFS.map(toCatalogOption)
}

export function isNovelaiV4Model(modelName: string): boolean {
  return /nai-diffusion-4|nai-diffusion-4-5/i.test(modelName)
}

export async function fetchNovelaiImageModelCatalog(apiKey: string): Promise<MomentsImageModelOption[]> {
  const key = apiKey.trim()
  if (!key) throw new Error('请先填写 NovelAI API Key')

  try {
    const res = await fetch(NOVELAI_SUBSCRIPTION_URL, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `NovelAI 鉴权失败 (${res.status})`)
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('鉴权')) throw e
    // 网络受限时仍允许使用静态模型列表
  }

  return buildNovelaiImageModelCatalog()
}

export function snapNovelaiDimension(n: number): number {
  const clamped = Math.max(64, Math.min(1536, Math.round(n)))
  return Math.round(clamped / 64) * 64
}
