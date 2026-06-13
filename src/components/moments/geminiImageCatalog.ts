import type { MomentsImageModelOption } from './momentsImageModelCatalog'

type GeminiModelDef = {
  modelName: string
  labelZh: string
  description: string
  kind: 'gemini' | 'imagen'
  priceLabel?: string
}

const GEMINI_IMAGE_MODEL_DEFS: GeminiModelDef[] = [
  {
    modelName: 'gemini-2.0-flash-preview-image-generation',
    labelZh: 'Gemini 2.0 Flash 生图',
    description: 'Gemini 原生多模态生图（generateContent）',
    kind: 'gemini',
    priceLabel: '按 Google AI 计费',
  },
  {
    modelName: 'gemini-2.5-flash-image',
    labelZh: 'Gemini 2.5 Flash 生图',
    description: 'Gemini 2.5 快速生图模型',
    kind: 'gemini',
    priceLabel: '按 Google AI 计费',
  },
  {
    modelName: 'imagen-3.0-generate-002',
    labelZh: 'Imagen 3',
    description: 'Google Imagen 3 文生图（predict API）',
    kind: 'imagen',
    priceLabel: '按 Google AI 计费',
  },
  {
    modelName: 'imagen-4.0-generate-preview-06-06',
    labelZh: 'Imagen 4 Preview',
    description: 'Imagen 4 预览版',
    kind: 'imagen',
    priceLabel: '按 Google AI 计费',
  },
]

export const DEFAULT_GEMINI_IMAGE_MODEL_ID = 'gemini:gemini-2.0-flash-preview-image-generation'

export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export const GEMINI_AI_STUDIO_URL = 'https://aistudio.google.com/apikey'

function toCatalogOption(def: GeminiModelDef): MomentsImageModelOption {
  return {
    id: `gemini:${def.modelName}`,
    modelName: def.modelName,
    labelZh: def.labelZh,
    title: def.labelZh,
    brand: 'Google Gemini',
    description: def.description,
    free: false,
    priceLabel: def.priceLabel ?? '按 Google AI 计费',
  }
}

export function buildGeminiImageModelCatalog(): MomentsImageModelOption[] {
  return GEMINI_IMAGE_MODEL_DEFS.map(toCatalogOption)
}

export function isGeminiImagenModel(modelName: string): boolean {
  return modelName.startsWith('imagen-')
}

export async function fetchGeminiImageModelCatalog(apiKey: string): Promise<MomentsImageModelOption[]> {
  const key = apiKey.trim()
  if (!key) throw new Error('请先填写 Gemini API Key')
  return buildGeminiImageModelCatalog()
}

export function resolveImagenAspectRatio(width: number, height: number): string {
  const ratio = width / height
  if (ratio > 1.25) return '16:9'
  if (ratio < 0.75) return '9:16'
  if (ratio > 1.05) return '4:3'
  if (ratio < 0.95) return '3:4'
  return '1:1'
}
