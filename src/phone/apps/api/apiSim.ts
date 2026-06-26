import { buildOpenAiModelsEndpoint } from './openAiCompatibleEndpoints'
import {
  isSiliconFlowModelsApiUrl,
  pickEmbeddingModelsFromApiList,
} from './embeddingModelList'
import { buildModelPricingMapFromList } from './modelPricingUtils'
import type { ApiConfig } from './types'
import type { ApiModelPricing } from './types'

export type ModelFetchResult =
  | { ok: true; models: string[]; modelPricingById: Record<string, ApiModelPricing> }
  | { ok: false; error: string }
export type TestResult = { ok: true } | { ok: false; error: string }

function pickErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback
  const anyP = payload as any
  const msg =
    anyP?.error?.message ??
    anyP?.message ??
    anyP?.error ??
    anyP?.detail ??
    anyP?.msg
  return typeof msg === 'string' ? msg : fallback
}

function parseModelsListPayload(data: unknown): unknown[] | null {
  const anyD = data as { data?: unknown; models?: unknown }
  const list = Array.isArray(anyD?.data) ? anyD.data : Array.isArray(anyD?.models) ? anyD.models : null
  return Array.isArray(list) ? list : null
}

async function requestOpenAiModelsList(
  endpoint: string,
  key: string,
): Promise<{ ok: true; list: unknown[] } | { ok: false; error: string; status?: number }> {
  const resp = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await resp.text()
  const data = text ? (JSON.parse(text) as unknown) : null
  if (!resp.ok) {
    return { ok: false, error: pickErrorMessage(data, `拉取失败（HTTP ${resp.status}）`), status: resp.status }
  }
  const list = parseModelsListPayload(data)
  if (!list) return { ok: false, error: '返回格式不符合预期（未找到模型列表）' }
  return { ok: true, list }
}

function mergeModelListRows(...lists: unknown[][]): unknown[] {
  const byId = new Map<string, unknown>()
  for (const list of lists) {
    for (const row of list) {
      const id =
        typeof row === 'string'
          ? row.trim()
          : row && typeof row === 'object'
            ? String((row as { id?: unknown; name?: unknown }).id ?? (row as { name?: unknown }).name ?? '').trim()
            : ''
      if (!id) continue
      if (!byId.has(id)) byId.set(id, row)
    }
  }
  return [...byId.values()]
}

/** 拉取模型（真实请求，失败会给出原因；注意：浏览器可能被 CORS 限制） */
export async function fetchModels(cfg: ApiConfig): Promise<ModelFetchResult> {
  const url = cfg.apiUrl.trim()
  const key = cfg.apiKey.trim()
  if (!url) return { ok: false, error: '请先填写 API URL' }
  if (!key) return { ok: false, error: '请先填写 API Key' }
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'API URL 格式不正确（需以 http/https 开头）' }
  const endpoint = buildOpenAiModelsEndpoint(url)
  if (!endpoint) return { ok: false, error: 'API URL 无效' }

  try {
    const res = await requestOpenAiModelsList(endpoint, key)
    if (!res.ok) return { ok: false, error: res.error }
    const list = res.list
    const models = list
      .map((x) =>
        typeof x === 'string' ? x : typeof (x as { id?: unknown })?.id === 'string' ? (x as { id: string }).id : '',
      )
      .filter((x): x is string => !!x)

    if (!models.length) return { ok: false, error: '拉取成功但模型列表为空' }
    const uniq = Array.from(new Set(models)).sort((a, b) => a.localeCompare(b))
    const modelPricingById = buildModelPricingMapFromList(list, url)
    return { ok: true, models: uniq, modelPricingById }
  } catch (e) {
    const msg =
      e instanceof SyntaxError
        ? '返回不是合法 JSON（请检查 API URL 是否指向正确的 /models 接口）'
        : '请求失败（可能被浏览器 CORS 限制，或网络不可达）'
    return { ok: false, error: msg }
  }
}

/**
 * 语义向量召回专用：只保留 embedding 模型。
 * 硅基流动会额外请求 sub_type=embedding；筛空时不会回退展示聊天模型。
 */
export async function fetchEmbeddingModels(cfg: ApiConfig): Promise<ModelFetchResult> {
  const url = cfg.apiUrl.trim()
  const key = cfg.apiKey.trim()
  if (!url) return { ok: false, error: '请先填写 API URL' }
  if (!key) return { ok: false, error: '请先填写 API Key' }
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'API URL 格式不正确（需以 http/https 开头）' }
  const endpoint = buildOpenAiModelsEndpoint(url)
  if (!endpoint) return { ok: false, error: 'API URL 无效' }

  try {
    const lists: unknown[][] = []
    const main = await requestOpenAiModelsList(endpoint, key)
    if (!main.ok) return { ok: false, error: main.error }
    lists.push(main.list)

    if (isSiliconFlowModelsApiUrl(url)) {
      const embedEndpoint = endpoint.includes('?')
        ? `${endpoint}&sub_type=embedding`
        : `${endpoint}?sub_type=embedding`
      const embedOnly = await requestOpenAiModelsList(embedEndpoint, key)
      if (embedOnly.ok && embedOnly.list.length) lists.push(embedOnly.list)
    }

    const merged = mergeModelListRows(...lists)
    const models = pickEmbeddingModelsFromApiList(merged)
    const modelPricingById = buildModelPricingMapFromList(merged, url)
    return { ok: true, models, modelPricingById }
  } catch (e) {
    const msg =
      e instanceof SyntaxError
        ? '返回不是合法 JSON（请检查 API URL 是否指向正确的 /models 接口）'
        : '请求失败（可能被浏览器 CORS 限制，或网络不可达）'
    return { ok: false, error: msg }
  }
}

/** 预留：对接真实连通性测试接口 */
export async function testConnectionSim(cfg: ApiConfig): Promise<TestResult> {
  const url = cfg.apiUrl.trim()
  const key = cfg.apiKey.trim()
  if (!url) return { ok: false, error: '缺少 API URL' }
  if (!key) return { ok: false, error: '缺少 API Key' }
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'API URL 需以 http/https 开头' }
  if (url.toLowerCase().includes('timeout')) return { ok: false, error: '请求超时，请检查网络或域名' }
  if (key.toLowerCase().includes('fail')) return { ok: false, error: '鉴权失败：Key 被拒绝' }
  return { ok: true }
}

