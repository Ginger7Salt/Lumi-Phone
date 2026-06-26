import type { ApiModelPricing } from './types'

function parsePriceNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function pickFirstPrice(...values: unknown[]): number | null {
  for (const v of values) {
    const n = parsePriceNumber(v)
    if (n != null) return n
  }
  return null
}

function inferCurrency(apiUrl: string, row: Record<string, unknown>): ApiModelPricing['currency'] {
  const explicit = String(row.currency ?? row.price_currency ?? '').trim().toUpperCase()
  if (explicit === 'CNY' || explicit === 'RMB' || explicit === '¥') return 'CNY'
  if (explicit === 'USD' || explicit === 'USDT' || explicit === '$') return 'USD'
  const url = apiUrl.toLowerCase()
  if (url.includes('siliconflow.cn') || url.includes('siliconflow.com')) return 'CNY'
  if (url.includes('openrouter.ai')) return 'USD'
  return 'USD'
}

/** OpenRouter 等：pricing.prompt/completion 为「每 token」美元价，转为每百万 token */
function perTokenToPerMillion(value: number | null): number | null {
  if (value == null) return null
  return value * 1_000_000
}

function isLikelyPerTokenPricing(row: Record<string, unknown>): boolean {
  const pricing = row.pricing
  if (!pricing || typeof pricing !== 'object') return false
  const p = pricing as Record<string, unknown>
  return 'prompt' in p || 'completion' in p
}

export function extractModelPricingFromRow(row: unknown, apiUrl = ''): ApiModelPricing | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const pricing =
    r.pricing && typeof r.pricing === 'object' ? (r.pricing as Record<string, unknown>) : null
  const currency = inferCurrency(apiUrl, r)

  let inputPerMillion = pickFirstPrice(
    r.input_price_per_million,
    r.inputPricePerMillion,
    r.input_price,
    r.inputPrice,
    r.prompt_price,
    r.promptPrice,
    pricing?.input,
    pricing?.input_price,
    pricing?.prompt_per_million,
    pricing?.prompt,
  )
  let outputPerMillion = pickFirstPrice(
    r.output_price_per_million,
    r.outputPricePerMillion,
    r.output_price,
    r.outputPrice,
    r.completion_price,
    r.completionPrice,
    r.price,
    pricing?.output,
    pricing?.output_price,
    pricing?.completion_per_million,
    pricing?.completion,
  )
  const cachedInputPerMillion = pickFirstPrice(
    r.cached_input_price,
    r.cachedInputPrice,
    pricing?.cached_input,
    pricing?.input_cache_read,
    pricing?.cache_read,
  )

  if (isLikelyPerTokenPricing(r)) {
    const promptPerToken = pickFirstPrice(pricing?.prompt)
    const completionPerToken = pickFirstPrice(pricing?.completion)
    if (promptPerToken != null) inputPerMillion = perTokenToPerMillion(promptPerToken)
    if (completionPerToken != null) outputPerMillion = perTokenToPerMillion(completionPerToken)
    const cachePerToken = pickFirstPrice(pricing?.input_cache_read, pricing?.cache_read)
    if (cachePerToken != null) {
      return {
        inputPerMillion,
        outputPerMillion,
        cachedInputPerMillion: perTokenToPerMillion(cachePerToken),
        currency: 'USD',
        unit: 'per_million_tokens',
      }
    }
  }

  if (inputPerMillion == null && outputPerMillion == null && cachedInputPerMillion == null) return null

  return {
    inputPerMillion,
    outputPerMillion,
    cachedInputPerMillion,
    currency,
    unit: 'per_million_tokens',
  }
}

export function normalizeModelPricingMap(raw: unknown): Record<string, ApiModelPricing> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, ApiModelPricing> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = id.trim()
    if (!key || !value || typeof value !== 'object') continue
    const v = value as Partial<ApiModelPricing>
    const inputPerMillion =
      typeof v.inputPerMillion === 'number' && Number.isFinite(v.inputPerMillion) ? v.inputPerMillion : null
    const outputPerMillion =
      typeof v.outputPerMillion === 'number' && Number.isFinite(v.outputPerMillion) ? v.outputPerMillion : null
    const cachedInputPerMillion =
      typeof v.cachedInputPerMillion === 'number' && Number.isFinite(v.cachedInputPerMillion)
        ? v.cachedInputPerMillion
        : null
    if (inputPerMillion == null && outputPerMillion == null && cachedInputPerMillion == null) continue
    out[key] = {
      inputPerMillion,
      outputPerMillion,
      cachedInputPerMillion,
      currency: v.currency === 'CNY' ? 'CNY' : 'USD',
      unit: v.unit === 'per_image' ? 'per_image' : 'per_million_tokens',
      rawLabel: typeof v.rawLabel === 'string' ? v.rawLabel : undefined,
    }
  }
  return out
}

function formatTokenPrice(value: number, currency: ApiModelPricing['currency']): string {
  const symbol = currency === 'CNY' ? '¥' : '$'
  if (value === 0) return '免费'
  if (value < 0.01) return `${symbol}${value.toFixed(4)}/M`
  if (value < 1) return `${symbol}${value.toFixed(2)}/M`
  return `${symbol}${value.toFixed(2)}/M`
}

export function formatModelPricingLabel(pricing: ApiModelPricing | null | undefined): string {
  if (!pricing) return '价格未知'
  if (pricing.rawLabel?.trim()) return pricing.rawLabel.trim()
  const currency = pricing.currency ?? 'USD'
  const input = pricing.inputPerMillion
  const output = pricing.outputPerMillion
  const cached = pricing.cachedInputPerMillion
  if (input == null && output == null && cached == null) return '价格未知'
  if (input === 0 && output === 0) return '免费'
  const parts: string[] = []
  if (input != null) parts.push(`入 ${formatTokenPrice(input, currency)}`)
  if (cached != null) parts.push(`缓存 ${formatTokenPrice(cached, currency)}`)
  if (output != null) parts.push(`出 ${formatTokenPrice(output, currency)}`)
  return parts.join(' · ')
}

export function buildModelPricingMapFromList(
  list: unknown[],
  apiUrl: string,
): Record<string, ApiModelPricing> {
  const out: Record<string, ApiModelPricing> = {}
  for (const row of list) {
    if (typeof row === 'string') continue
    if (!row || typeof row !== 'object') continue
    const id = String((row as { id?: unknown }).id ?? '').trim()
    if (!id) continue
    const pricing = extractModelPricingFromRow(row, apiUrl)
    if (pricing) out[id] = pricing
  }
  return out
}
