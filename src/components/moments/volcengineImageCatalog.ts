import type { MomentsImageModelOption } from './momentsImageModelCatalog'

/**
 * 官方计费：https://www.volcengine.com/docs/6492/1544808
 * API 文档：https://www.volcengine.com/docs/82379/1541523
 */
const VOLCENGINE_IMAGE_PRICE_YUAN: Record<string, number> = {
  'doubao-seedream-5-0-lite': 0.22,
  'doubao-seedream-5-0-260128': 0.22,
  'doubao-seedream-4-5-251128': 0.25,
  'doubao-seedream-4-0-250828': 0.2,
  'doubao-seedream-3-0-t2i': 0.259,
}

type VolcengineImageModelDef = {
  modelName: string
  labelZh: string
  description: string
}

/** 火山方舟 Seedream 文生图模型（官方计费名 + 常用接入点 ID） */
const VOLCENGINE_IMAGE_MODEL_DEFS: VolcengineImageModelDef[] = [
  {
    modelName: 'doubao-seedream-5-0-lite',
    labelZh: 'Seedream 5.0 Lite',
    description: '视觉推理 + 联网搜索，2K/3K，性价比线',
  },
  {
    modelName: 'doubao-seedream-5-0-260128',
    labelZh: 'Seedream 5.0',
    description: '最新综合体验，多图参考与组图',
  },
  {
    modelName: 'doubao-seedream-4-5-251128',
    labelZh: 'Seedream 4.5',
    description: '专业生产级，原生 4K，强文字渲染',
  },
  {
    modelName: 'doubao-seedream-4-0-250828',
    labelZh: 'Seedream 4.0',
    description: '成熟稳定，1K/2K/4K，高性价比',
  },
  {
    modelName: 'doubao-seedream-3-0-t2i',
    labelZh: 'Seedream 3.0 文生图',
    description: '经典文生图模型',
  },
]

export const DEFAULT_VOLCENGINE_IMAGE_MODEL_ID = 'volcengine:doubao-seedream-5-0-lite'

export const VOLCENGINE_IMAGE_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'

/**
 * 火山方舟 · 开通管理（图片生成 / ComputerVision 分类）
 * @see https://developer.volcengine.com/articles/7617050418636668991
 */
export const VOLCENGINE_ARK_OPEN_MANAGEMENT_URL =
  'https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?advancedActiveKey=model&tab=ComputerVision'

/** @deprecated 请使用 VOLCENGINE_ARK_OPEN_MANAGEMENT_URL */
export const VOLCENGINE_ARK_MODEL_CONSOLE_URL = VOLCENGINE_ARK_OPEN_MANAGEMENT_URL

const MODEL_NOT_ACTIVATED_PATTERN =
  /has not activated the model|ModelNotOpen|model service in the Ark Console/i

export function isVolcengineModelNotActivatedError(message: string): boolean {
  return (
    MODEL_NOT_ACTIVATED_PATTERN.test(message) ||
    /尚未开通模型|尚未开通当前生图模型|开通管理/.test(message)
  )
}

export function extractVolcengineModelFromError(message: string): string | undefined {
  const explicit = message.match(/model\s+([a-z0-9._-]+)/i)
  if (explicit?.[1]) return explicit[1]
  const seedream = message.match(/doubao-seedream[\w-]*/i)
  return seedream?.[0]
}

export function formatVolcengineModelNotActivatedMessage(
  rawMessage: string,
  modelNameHint?: string,
): string {
  const model = extractVolcengineModelFromError(rawMessage) ?? modelNameHint
  if (model) {
    return `火山方舟账号尚未开通模型「${model}」。请先在控制台「开通管理」中开通该 Seedream 模型，并确保账户有余额。`
  }
  return '火山方舟账号尚未开通当前生图模型。请先在控制台「开通管理」中开通对应 Seedream 模型，并确保账户有余额。'
}

function formatPriceLabel(yuan: number): string {
  const text = yuan < 0.01 ? yuan.toFixed(4) : yuan < 1 ? yuan.toFixed(2) : yuan.toFixed(2)
  return `¥${text}/张`
}

function toCatalogOption(def: VolcengineImageModelDef): MomentsImageModelOption {
  const priceYuan = VOLCENGINE_IMAGE_PRICE_YUAN[def.modelName] ?? null
  const priceLabel = priceYuan != null ? formatPriceLabel(priceYuan) : '价格未知'
  return {
    id: `volcengine:${def.modelName}`,
    modelName: def.modelName,
    labelZh: def.labelZh,
    title: def.labelZh,
    brand: '火山方舟',
    description: `文生图 · ${priceLabel} · ${def.description}`,
    free: false,
    priceYuanPerImage: priceYuan,
    priceLabel,
  }
}

type VolcengineProbeError = {
  error?: { code?: string; message?: string; type?: string }
  message?: string
}

function parseVolcengineProbeError(body: string): VolcengineProbeError {
  try {
    return JSON.parse(body) as VolcengineProbeError
  } catch {
    return { message: body }
  }
}

function isDefinitelyVolcengineModelNotActivated(code: string, message: string): boolean {
  return (
    code === 'ModelNotOpen' ||
    code === 'ServiceNotOpen' ||
    code === 'InvalidEndpointOrModel.NotFound' ||
    /has not activated the model|not activated the model|model service in the Ark Console|模型服务未开通/i.test(
      message,
    )
  )
}

/** 模型已受理请求、但因 prompt 等业务参数失败（说明已开通，且不会成功出图计费） */
function isDefinitelyVolcengineModelActivated(code: string, message: string): boolean {
  if (code === 'InputTextSensitiveContentDetected') return true
  if (code !== 'InvalidParameter' && code !== 'MissingParameter') return false
  return /prompt|提示词|text is required|empty|missing.*required/i.test(message)
}

/**
 * 用合法 size + 空 prompt 探测开通状态。
 * 未开通 → ModelNotOpen；已开通 → prompt 参数类错误（不会成功出图）。
 */
async function probeVolcengineModelActivation(
  apiKey: string,
  modelName: string,
): Promise<boolean | null> {
  const size = resolveVolcengineImageSize(modelName, 1024, 1024)
  const res = await fetch(VOLCENGINE_IMAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      prompt: '',
      size,
      sequential_image_generation: 'disabled',
      response_format: 'url',
      stream: false,
      watermark: false,
    }),
  })

  if (res.ok) return true

  const body = await res.text()
  const parsed = parseVolcengineProbeError(body)
  const code = parsed.error?.code ?? ''
  const message = parsed.error?.message ?? parsed.message ?? body

  if (res.status === 401 || code === 'AuthenticationError') {
    throw new Error('火山方舟 API Key 无效')
  }

  if (isDefinitelyVolcengineModelNotActivated(code, message)) return false
  if (res.status === 404 && /activated|ModelNotOpen|NotFound/i.test(message)) return false
  if (isDefinitelyVolcengineModelActivated(code, message)) return true

  // 无法确定时标为待检测，避免误报「已开通」
  return null
}

/** 返回官方静态目录，并用 API Key 探测各模型开通状态 */
export async function fetchVolcengineImageModelCatalog(
  apiKey?: string,
): Promise<MomentsImageModelOption[]> {
  const catalog = VOLCENGINE_IMAGE_MODEL_DEFS.map(toCatalogOption)
  const key = apiKey?.trim()
  if (!key) return catalog

  const results = await Promise.all(
    catalog.map(async (model) => {
      try {
        const serviceActivated = await probeVolcengineModelActivation(key, model.modelName)
        return { ...model, serviceActivated }
      } catch (e) {
        if (e instanceof Error && e.message.includes('API Key 无效')) throw e
        return { ...model, serviceActivated: null }
      }
    }),
  )

  return results
}

/** 按模型能力将预览尺寸映射到官方 size 参数 */
export function resolveVolcengineImageSize(
  modelName: string,
  width: number,
  height: number,
): string {
  const maxDim = Math.max(width, height)
  if (/seedream-5-0-lite/i.test(modelName)) {
    return maxDim <= 1536 ? '2K' : '3K'
  }
  if (/seedream-4-5/i.test(modelName) || /seedream-5-0/i.test(modelName)) {
    return maxDim <= 1536 ? '2K' : '4K'
  }
  if (maxDim <= 768) return '1K'
  if (maxDim <= 1536) return '2K'
  return '4K'
}
