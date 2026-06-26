import { buildOpenAiModelsEndpoint } from '../../phone/apps/api/openAiCompatibleEndpoints'
import { isSiliconFlowModelsApiUrl, extractOpenAiModelListRowId } from '../../phone/apps/api/embeddingModelList'
import { localizeMomentsImageGenError } from './momentsImageGenErrorZh'
import type { MomentsImageModelOption } from './momentsImageModelCatalog'

export const DEFAULT_CUSTOM_IMAGE_MODEL_ID = 'custom:'

const IMAGE_MODEL_ID_RE =
  /image|dall-?e|kolors|flux|stable|diffusion|seedream|seed|txt2img|text-to-image|picture|imagen|wanx|ernie-image|z-image|midjourney|sdxl|sd3|playground|cogview|hunyuan|pixart|aura|realvis|dreamshaper|ideogram|black-forest|bfl-/i

const NON_IMAGE_MODEL_ID_RE =
  /embed|embedding|whisper|tts|audio|transcrib|speech|rerank|moderation/i

const CHAT_ONLY_MODEL_ID_RE =
  /^(gpt-[34]|gpt-4|o1|o3|o4|claude|gemini-[0-9]|deepseek|qwen(?!.*image)|llama|mistral|grok|glm-|doubao-(?!.*seed)|moonshot|kimi)/i

function readLower(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim().toLowerCase()
  }
  return ''
}

function isImageModelCandidate(row: unknown): boolean {
  const id = extractOpenAiModelListRowId(row)
  if (!id) return false
  if (NON_IMAGE_MODEL_ID_RE.test(id)) return false
  if (CHAT_ONLY_MODEL_ID_RE.test(id) && !IMAGE_MODEL_ID_RE.test(id)) return false

  if (typeof row === 'object' && row) {
    const r = row as Record<string, unknown>
    const subType = readLower(r, 'sub_type', 'subType', 'subtype')
    if (subType === 'text-to-image' || subType === 'image' || subType === 'images') return true

    const type = readLower(r, 'type', 'model_type', 'modelType', 'kind', 'object')
    if (type.includes('image') || type === 'text-to-image') return true

    const modality = readLower(r, 'modality')
    if (modality.includes('image')) return true

    const capabilities = r.capabilities
    if (Array.isArray(capabilities) && capabilities.some((c) => String(c).toLowerCase().includes('image'))) {
      return true
    }
  }

  return IMAGE_MODEL_ID_RE.test(id)
}

function shortModelLabel(modelId: string): string {
  const slash = modelId.lastIndexOf('/')
  return slash >= 0 ? modelId.slice(slash + 1) : modelId
}

function toCatalogOption(modelId: string): MomentsImageModelOption {
  const label = shortModelLabel(modelId)
  return {
    id: `custom:${modelId}`,
    modelName: modelId,
    labelZh: label,
    title: label,
    brand: '自定义接口',
    description: modelId,
    free: false,
  }
}

async function requestModelsList(
  endpoint: string,
  apiKey: string,
): Promise<{ ok: true; list: unknown[] } | { ok: false; error: string; status?: number }> {
  const resp = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await resp.text()
  let data: unknown = null
  try {
    data = text ? (JSON.parse(text) as unknown) : null
  } catch {
    return { ok: false, error: '返回不是合法 JSON（请检查 API URL 是否指向正确的 /models 接口）' }
  }
  if (!resp.ok) {
    const msg =
      data && typeof data === 'object'
        ? String(
            (data as { error?: { message?: string }; message?: string }).error?.message ??
              (data as { message?: string }).message ??
              `拉取失败（HTTP ${resp.status}）`,
          )
        : `拉取失败（HTTP ${resp.status}）`
    return { ok: false, error: msg, status: resp.status }
  }
  const anyD = data as { data?: unknown; models?: unknown }
  const list = Array.isArray(anyD?.data) ? anyD.data : Array.isArray(anyD?.models) ? anyD.models : null
  if (!list) return { ok: false, error: '返回格式不符合预期（未找到模型列表）' }
  return { ok: true, list }
}

function pickAllModelsFromList(list: unknown[]): MomentsImageModelOption[] {
  const seen = new Set<string>()
  const options: MomentsImageModelOption[] = []
  for (const row of list) {
    const modelId = extractOpenAiModelListRowId(row)
    if (!modelId || seen.has(modelId)) continue
    seen.add(modelId)
    options.push(toCatalogOption(modelId))
  }
  options.sort((a, b) => a.labelZh.localeCompare(b.labelZh, 'zh-CN'))
  return options
}

function pickImageModelsFromList(list: unknown[]): MomentsImageModelOption[] {
  const seen = new Set<string>()
  const options: MomentsImageModelOption[] = []
  for (const row of list) {
    if (!isImageModelCandidate(row)) continue
    const modelId = extractOpenAiModelListRowId(row)
    if (!modelId || seen.has(modelId)) continue
    seen.add(modelId)
    options.push(toCatalogOption(modelId))
  }
  options.sort((a, b) => a.labelZh.localeCompare(b.labelZh, 'zh-CN'))
  return options
}

export async function fetchCustomImageModelCatalog(
  apiUrl: string,
  apiKey: string,
): Promise<MomentsImageModelOption[]> {
  const url = apiUrl.trim()
  const key = apiKey.trim()
  if (!url) throw new Error('请先填写 API URL')
  if (!key) throw new Error('请先填写 API Key')
  if (!/^https?:\/\//i.test(url)) throw new Error('API URL 格式不正确（需以 http/https 开头）')

  const endpoint = buildOpenAiModelsEndpoint(url)
  if (!endpoint) throw new Error('API URL 无效')

  const imageSubTypeEndpoint = endpoint.includes('?')
    ? `${endpoint}&sub_type=text-to-image`
    : `${endpoint}?sub_type=text-to-image`

  const siliconflow = isSiliconFlowModelsApiUrl(url)
  const tryPlans: { endpoint: string; trustAll: boolean }[] = siliconflow
    ? [
        { endpoint: imageSubTypeEndpoint, trustAll: true },
        { endpoint, trustAll: false },
      ]
    : [
        { endpoint, trustAll: false },
        { endpoint: imageSubTypeEndpoint, trustAll: true },
      ]

  let lastError = '未找到可用的生图模型'
  let lastTotalCount = 0

  for (const plan of tryPlans) {
    try {
      const res = await requestModelsList(plan.endpoint, key)
      if (!res.ok) {
        lastError = res.error
        continue
      }
      lastTotalCount = res.list.length
      if (!lastTotalCount) {
        lastError = '拉取成功但模型列表为空'
        continue
      }

      const options = plan.trustAll ? pickAllModelsFromList(res.list) : pickImageModelsFromList(res.list)
      if (options.length) return options

      lastError = `已从 ${plan.endpoint} 拉取 ${lastTotalCount} 个模型，但未识别出文生图模型`
    } catch {
      lastError = '请求失败（可能被浏览器 CORS 限制，或网络不可达）'
    }
  }

  if (lastTotalCount > 0) {
    const hint = siliconflow
      ? '若使用硅基流动，也可直接选用内置「硅基流动」引擎。'
      : '请确认中转站已在 /models 中暴露生图模型（如 dall-e、flux、kolors 等），且 URL 与聊天 API 使用同一根地址。'
    throw new Error(`${lastError}。${hint}`)
  }

  throw new Error(localizeMomentsImageGenError('custom', 0, lastError))
}
