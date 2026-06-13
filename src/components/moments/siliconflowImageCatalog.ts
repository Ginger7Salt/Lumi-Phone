import { localizeMomentsImageGenError } from './momentsImageGenErrorZh'
import type { MomentsImageModelOption } from './momentsImageModelCatalog'

const SILICONFLOW_MODELS_URL = 'https://api.siliconflow.cn/v1/models'
const SILICONFLOW_PRICING_URL = 'https://siliconflow.cn/pricing'

/** 官网定价页兜底（https://siliconflow.cn/pricing 生图模型区） */
const FALLBACK_IMAGE_PRICE_YUAN: Record<string, number> = {
  'Tongyi-MAI/Z-Image-Turbo': 0.1,
  'Tongyi-MAI/Z-Image': 0.3,
  'baidu/ERNIE-Image-Turbo': 0.11,
  'Qwen/Qwen-Image-Edit-2509': 0.3,
  'Qwen/Qwen-Image-Edit': 0.3,
  'Qwen/Qwen-Image': 0.3,
  'Kwai-Kolors/Kolors': 0,
}

export const DEFAULT_SILICONFLOW_IMAGE_MODEL_ID = 'siliconflow:Kwai-Kolors/Kolors'

type SiliconFlowModelRow = {
  id?: string
  object?: string
  price?: number
  output_price?: number
  outputPrice?: number
  pricing?: { output?: number; output_price?: number }
}

function shortModelLabel(modelId: string): string {
  const slash = modelId.lastIndexOf('/')
  return slash >= 0 ? modelId.slice(slash + 1) : modelId
}

function formatPriceLabel(yuan: number | null | undefined): string {
  if (yuan === 0) return '免费'
  if (yuan == null || !Number.isFinite(yuan)) return '价格未知'
  const text = yuan < 0.01 ? yuan.toFixed(4) : yuan < 1 ? yuan.toFixed(2) : yuan.toFixed(2)
  return `¥${text}/张`
}

function resolveModelPriceYuan(modelId: string, priceMap: Record<string, number>): number | null {
  if (modelId in priceMap) return priceMap[modelId]!
  const withoutPro = modelId.startsWith('Pro/') ? modelId.slice(4) : null
  if (withoutPro && withoutPro in priceMap) return priceMap[withoutPro]!
  return null
}

function extractPriceFromModelRow(row: SiliconFlowModelRow): number | null {
  const candidates = [
    row.price,
    row.output_price,
    row.outputPrice,
    row.pricing?.output,
    row.pricing?.output_price,
  ]
  for (const v of candidates) {
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}

/** 从定价页 HTML 解析「输出价格（/张）」区块 */
export function parseSiliconFlowImagePricingHtml(html: string): Record<string, number> {
  const map: Record<string, number> = { ...FALLBACK_IMAGE_PRICE_YUAN }
  const imageSection = html.includes('生图模型')
    ? html.slice(html.indexOf('生图模型'))
    : html

  const modelIdPattern = /(?:title|href)="([^"]+\/[^"]+)"/g
  const seen = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = modelIdPattern.exec(imageSection)) !== null) {
    const raw = match[1]!
    if (!raw.includes('/')) continue
    if (seen.has(raw)) continue
    if (!/(Image|Kolors|Z-Image|ERNIE)/i.test(raw)) continue
    seen.add(raw)

    const chunk = imageSection.slice(match.index, match.index + 700)
    if (/免费/.test(chunk)) {
      map[raw] = 0
      continue
    }
    const priceMatch = chunk.match(/¥\s*([0-9]+(?:\.[0-9]+)?)/)
    if (priceMatch) map[raw] = Number(priceMatch[1])
  }

  return map
}

export async function fetchSiliconFlowImagePricingMap(): Promise<Record<string, number>> {
  try {
    const res = await fetch(SILICONFLOW_PRICING_URL, { method: 'GET' })
    if (!res.ok) return { ...FALLBACK_IMAGE_PRICE_YUAN }
    const html = await res.text()
    return parseSiliconFlowImagePricingHtml(html)
  } catch {
    return { ...FALLBACK_IMAGE_PRICE_YUAN }
  }
}

function toCatalogOption(modelId: string, priceYuan: number | null): MomentsImageModelOption {
  const free = priceYuan === 0
  const priceLabel = formatPriceLabel(priceYuan)
  return {
    id: `siliconflow:${modelId}`,
    modelName: modelId,
    labelZh: shortModelLabel(modelId),
    title: shortModelLabel(modelId),
    brand: '硅基流动',
    description: priceLabel === '价格未知' ? '文生图 · 价格见硅基流动官网' : `文生图 · ${priceLabel}`,
    free,
    priceYuanPerImage: priceYuan,
    priceLabel,
  }
}

export async function fetchSiliconFlowImageModelCatalog(apiKey: string): Promise<MomentsImageModelOption[]> {
  const key = apiKey.trim()
  if (!key) throw new Error('请先填写硅基流动 API Key')

  const modelsRes = await fetch(`${SILICONFLOW_MODELS_URL}?sub_type=text-to-image`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  const priceMap = { ...FALLBACK_IMAGE_PRICE_YUAN }

  if (!modelsRes.ok) {
    const text = await modelsRes.text()
    throw new Error(localizeMomentsImageGenError('siliconflow', modelsRes.status, text))
  }

  const payload = (await modelsRes.json()) as { data?: SiliconFlowModelRow[] }
  const rows = Array.isArray(payload.data) ? payload.data : []
  if (!rows.length) throw new Error('未返回文生图模型，请确认账户权限')

  const options = rows
    .map((row) => {
      const modelId = row.id?.trim()
      if (!modelId) return null
      const fromApi = extractPriceFromModelRow(row)
      const priceYuan = fromApi ?? resolveModelPriceYuan(modelId, priceMap)
      return toCatalogOption(modelId, priceYuan)
    })
    .filter((m): m is MomentsImageModelOption => !!m)

  options.sort((a, b) => {
    const af = a.free ? 0 : 1
    const bf = b.free ? 0 : 1
    if (af !== bf) return af - bf
    const ap = a.priceYuanPerImage ?? 999
    const bp = b.priceYuanPerImage ?? 999
    if (ap !== bp) return ap - bp
    return a.labelZh.localeCompare(b.labelZh, 'zh-CN')
  })

  return options
}
