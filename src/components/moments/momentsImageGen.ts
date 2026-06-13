import {
  DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  parseMomentsImageModelId,
  type MomentsImageProvider,
} from './momentsImageModelCatalog'
import { isQianfanMuseSteamerModel } from './qianfanImageCatalog'
import {
  GEMINI_API_BASE_URL,
  isGeminiImagenModel,
  resolveImagenAspectRatio,
} from './geminiImageCatalog'
import { extractPngDataUrlFromBuffer } from './momentsImageGenBinary'
import {
  isNovelaiV4Model,
  NOVELAI_IMAGE_API_URL,
  snapNovelaiDimension,
} from './novelaiImageCatalog'
import {
  OPENAI_IMAGE_API_URL,
  resolveOpenaiImageSize,
} from './openaiImageCatalog'
import {
  KOLORS_IMAGE_SIZES,
  QIANFAN_IMAGE_SIZES,
  QWEN_IMAGE_SIZES,
} from './momentsImageSizePresets'
import { resolveVolcengineImageSize, VOLCENGINE_IMAGE_API_URL } from './volcengineImageCatalog'
import { localizeMomentsImageGenError } from './momentsImageGenErrorZh'
import { buildCharacterMediaImagePrompt, buildMomentsImagePrompt } from './momentsImagePromptEnhancer'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

export type MomentsImageGenParams = {
  prompt: string
  settings: MomentsImageGenSettings
  width?: number
  height?: number
  /** 显式尺寸（如 1024x1024、2K），优先于 width/height 推算 */
  imageSize?: string
  /** 角色私聊/群聊/朋友圈：非自拍时客户端强制第一视角风景/环境随手拍 */
  promptContext?: 'moments' | 'character_media'
}

const SILICONFLOW_IMAGE_URL = 'https://api.siliconflow.cn/v1/images/generations'
const QIANFAN_IMAGE_URL = 'https://qianfan.baidubce.com/v2/images/generations'
const QIANFAN_MUSESTEAMER_URL = 'https://qianfan.baidubce.com/v2/musesteamer/images/generations'

const KOLORS_IMAGE_SIZE_STRINGS = KOLORS_IMAGE_SIZES.map((s) => s.apiSize)
const QWEN_IMAGE_SIZE_STRINGS = QWEN_IMAGE_SIZES.map((s) => s.apiSize)
const QIANFAN_IMAGE_SIZE_STRINGS = QIANFAN_IMAGE_SIZES.map((s) => s.apiSize)

function buildFullPrompt(params: MomentsImageGenParams): string {
  if (params.promptContext === 'character_media') {
    return buildCharacterMediaImagePrompt(params.prompt, params.settings)
  }
  return buildMomentsImagePrompt(params.prompt, params.settings)
}

function pickClosestImageSize(width: number, height: number, presets: string[]): string {
  const targetRatio = width / height
  let best = presets[0]!
  let bestScore = Number.POSITIVE_INFINITY
  for (const preset of presets) {
    const [w, h] = preset.split('x').map(Number)
    if (!w || !h) continue
    const ratio = w / h
    const ratioDiff = Math.abs(Math.log(ratio / targetRatio))
    const sizeDiff = Math.abs(w * h - width * height) / (width * height)
    const score = ratioDiff * 2 + sizeDiff
    if (score < bestScore) {
      bestScore = score
      best = preset
    }
  }
  return best
}

function resolveSiliconFlowImageSize(
  modelName: string,
  width: number,
  height: number,
  imageSize?: string,
): string {
  if (imageSize) return imageSize
  if (/Kolors/i.test(modelName)) {
    return pickClosestImageSize(width, height, KOLORS_IMAGE_SIZE_STRINGS)
  }
  if (/Qwen\/Qwen-Image/i.test(modelName) && !/Edit/i.test(modelName)) {
    return pickClosestImageSize(width, height, QWEN_IMAGE_SIZE_STRINGS)
  }
  return `${Math.max(256, width)}x${Math.max(256, height)}`
}

function resolveQianfanImageSize(width: number, height: number, imageSize?: string): string {
  if (imageSize) return imageSize
  return pickClosestImageSize(Math.max(512, width), Math.max(512, height), QIANFAN_IMAGE_SIZE_STRINGS)
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(localizeMomentsImageGenError('siliconflow', res.status, 'IMAGE_DOWNLOAD_FAILED'))
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () =>
      reject(new Error(localizeMomentsImageGenError('siliconflow', 0, 'IMAGE_READ_FAILED')))
    reader.readAsDataURL(blob)
  })
}

async function generateSiliconFlowImage(params: MomentsImageGenParams): Promise<string> {
  const apiKey = params.settings.siliconflowApiKey?.trim()
  if (!apiKey) throw new Error('请先填写硅基流动 API Key')

  const prompt = buildFullPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const { modelName } = parseMomentsImageModelId(
    params.settings.modelId.trim() || DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )
  const width = params.width ?? 512
  const height = params.height ?? 512

  const body: Record<string, unknown> = {
    model: modelName,
    prompt,
    image_size: resolveSiliconFlowImageSize(modelName, width, height, params.imageSize),
    num_inference_steps: 20,
  }

  if (/Qwen\/Qwen-Image/i.test(modelName) && !/Edit/i.test(modelName)) {
    body.cfg = 4
  }
  if (/Kolors/i.test(modelName)) {
    body.guidance_scale = 7.5
    body.batch_size = 1
  }

  const res = await fetch(SILICONFLOW_IMAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError('siliconflow', res.status, text))
  }

  const data = (await res.json()) as { images?: Array<{ url?: string }> }
  const imageUrl = data.images?.[0]?.url?.trim()
  if (!imageUrl) throw new Error('硅基流动未返回图片 URL')

  try {
    return await fetchImageAsDataUrl(imageUrl)
  } catch {
    return imageUrl
  }
}

async function generateQianfanImage(params: MomentsImageGenParams): Promise<string> {
  const apiKey = params.settings.qianfanApiKey?.trim()
  if (!apiKey) throw new Error('请先填写百度千帆 API Key')

  const prompt = buildFullPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const { modelName } = parseMomentsImageModelId(
    params.settings.modelId.trim() || DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )
  const width = params.width ?? 512
  const height = params.height ?? 512
  const size = resolveQianfanImageSize(width, height, params.imageSize)

  const isMuseSteamer = isQianfanMuseSteamerModel(modelName)
  const url = isMuseSteamer ? QIANFAN_MUSESTEAMER_URL : QIANFAN_IMAGE_URL
  const body: Record<string, unknown> = isMuseSteamer
    ? { model: modelName, prompt, size }
    : { model: modelName, prompt, n: 1, size }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError('qianfan', res.status, text))
  }

  const data = (await res.json()) as { data?: Array<{ url?: string }> }
  const imageUrl = data.data?.[0]?.url?.trim()
  if (!imageUrl) throw new Error('百度千帆未返回图片 URL')

  try {
    return await fetchImageAsDataUrl(imageUrl)
  } catch {
    return imageUrl
  }
}

async function generateVolcengineImage(params: MomentsImageGenParams): Promise<string> {
  const apiKey = params.settings.volcengineApiKey?.trim()
  if (!apiKey) throw new Error('请先填写火山方舟 API Key')

  const prompt = buildFullPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const { modelName } = parseMomentsImageModelId(
    params.settings.modelId.trim() || DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )
  const width = params.width ?? 512
  const height = params.height ?? 512

  const body: Record<string, unknown> = {
    model: modelName,
    prompt,
    size: params.imageSize ?? resolveVolcengineImageSize(modelName, width, height),
    sequential_image_generation: 'disabled',
    response_format: 'url',
    stream: false,
    watermark: false,
  }

  const res = await fetch(VOLCENGINE_IMAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError('volcengine', res.status, text, modelName))
  }

  const data = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> }
  const item = data.data?.[0]
  const imageUrl = item?.url?.trim()
  if (imageUrl) {
    try {
      return await fetchImageAsDataUrl(imageUrl)
    } catch {
      return imageUrl
    }
  }

  const b64 = item?.b64_json?.trim()
  if (b64) return `data:image/png;base64,${b64}`

  throw new Error('火山方舟未返回图片')
}

async function generateNovelaiImage(params: MomentsImageGenParams): Promise<string> {
  const apiKey = params.settings.novelaiApiKey?.trim()
  if (!apiKey) throw new Error('请先填写 NovelAI API Key')

  const prompt = buildFullPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const { modelName } = parseMomentsImageModelId(
    params.settings.modelId.trim() || DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )
  const width = snapNovelaiDimension(params.width ?? 832)
  const height = snapNovelaiDimension(params.height ?? 1216)

  const negativeBase =
    'blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, logo, text, watermark, signature'

  const body: Record<string, unknown> = isNovelaiV4Model(modelName)
    ? {
        input: prompt,
        model: modelName,
        action: 'generate',
        parameters: {
          params_version: 3,
          width,
          height,
          scale: 5,
          sampler: 'k_euler_ancestral',
          steps: 28,
          n_samples: 1,
          ucPreset: 0,
          qualityToggle: true,
          v4_prompt: {
            caption: { base_caption: prompt, char_captions: [] },
            use_coords: false,
            use_order: true,
          },
          v4_negative_prompt: {
            caption: { base_caption: negativeBase },
          },
        },
      }
    : {
        input: prompt,
        model: modelName,
        action: 'generate',
        parameters: {
          width,
          height,
          scale: 6,
          sampler: 'k_euler_ancestral',
          steps: 28,
          n_samples: 1,
          uc: 'lowres, bad anatomy, bad hands, text, error, missing fingers, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, username, blurry',
        },
      }

  const res = await fetch(NOVELAI_IMAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError('novelai', res.status, text))
  }

  return extractPngDataUrlFromBuffer(await res.arrayBuffer())
}

async function generateGeminiImage(params: MomentsImageGenParams): Promise<string> {
  const apiKey = params.settings.geminiApiKey?.trim()
  if (!apiKey) throw new Error('请先填写 Gemini API Key')

  const prompt = buildFullPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const { modelName } = parseMomentsImageModelId(
    params.settings.modelId.trim() || DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )
  const width = params.width ?? 1024
  const height = params.height ?? 1024

  if (isGeminiImagenModel(modelName)) {
    const url = `${GEMINI_API_BASE_URL}/models/${modelName}:predict?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: resolveImagenAspectRatio(width, height),
        },
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(localizeMomentsImageGenError('gemini', res.status, text))
    }
    const data = (await res.json()) as {
      predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
      generatedImages?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
    }
    const item = data.predictions?.[0] ?? data.generatedImages?.[0]
    const b64 = item?.bytesBase64Encoded?.trim()
    if (!b64) throw new Error('Gemini Imagen 未返回图片')
    const mime = item?.mimeType?.trim() || 'image/png'
    return `data:${mime};base64,${b64}`
  }

  const url = `${GEMINI_API_BASE_URL}/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError('gemini', res.status, text))
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> }
    }>
  }
  for (const part of data.candidates?.[0]?.content?.parts ?? []) {
    const inline = part.inlineData
    if (inline?.data?.trim()) {
      const mime = inline.mimeType?.trim() || 'image/png'
      return `data:${mime};base64,${inline.data.trim()}`
    }
  }
  throw new Error('Gemini 未返回图片')
}

async function generateOpenaiImage(params: MomentsImageGenParams): Promise<string> {
  const apiKey = params.settings.openaiApiKey?.trim()
  if (!apiKey) throw new Error('请先填写 OpenAI API Key')

  const prompt = buildFullPrompt(params)
  if (!prompt) throw new Error('请先输入配图描述或朋友圈文字')

  const { modelName } = parseMomentsImageModelId(
    params.settings.modelId.trim() || DEFAULT_MOMENTS_IMAGE_MODEL_ID,
  )
  const width = params.width ?? 1024
  const height = params.height ?? 1024
  const size = resolveOpenaiImageSize(modelName, width, height, params.imageSize)

  const body: Record<string, unknown> = {
    model: modelName,
    prompt,
    n: 1,
    size,
    response_format: 'b64_json',
  }
  if (modelName === 'gpt-image-1') {
    body.quality = 'medium'
  } else if (modelName === 'dall-e-3') {
    body.quality = 'standard'
    body.response_format = 'b64_json'
  }

  const res = await fetch(OPENAI_IMAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(localizeMomentsImageGenError('openai', res.status, text))
  }

  const data = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> }
  const item = data.data?.[0]
  const b64 = item?.b64_json?.trim()
  if (b64) return `data:image/png;base64,${b64}`
  const imageUrl = item?.url?.trim()
  if (imageUrl) {
    try {
      return await fetchImageAsDataUrl(imageUrl)
    } catch {
      return imageUrl
    }
  }
  throw new Error('OpenAI 未返回图片')
}

function resolveProvider(settings: MomentsImageGenSettings): MomentsImageProvider {
  return settings.provider ?? parseMomentsImageModelId(settings.modelId).provider
}

export async function generateMomentsImage(params: MomentsImageGenParams): Promise<string> {
  const provider = resolveProvider(params.settings)
  if (provider === 'qianfan') return generateQianfanImage(params)
  if (provider === 'volcengine') return generateVolcengineImage(params)
  if (provider === 'novelai') return generateNovelaiImage(params)
  if (provider === 'gemini') return generateGeminiImage(params)
  if (provider === 'openai') return generateOpenaiImage(params)
  return generateSiliconFlowImage(params)
}
