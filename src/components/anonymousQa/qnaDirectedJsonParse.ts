function repairJsonLikeText(text: string): string {
  return text
    .replace(/[\u201c\u201d\u2018\u2019]/g, '"')
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

const REASONING_BLOCK_PATTERNS: RegExp[] = [
  /<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi,
  /<think\b[^>]*>[\s\S]*?<\/think>/gi,
  /<redacted_thinking\b[^>]*>[\s\S]*?<\/redacted_thinking>/gi,
  /<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi,
  /```(?:thinking|think|analysis)\s*[\s\S]*?```/gi,
]

/** 去掉 DeepSeek / Claude 等模型的思维链，避免 JSON.parse 误读 */
export function stripModelReasoningWrapper(text: string): string {
  let s = String(text ?? '').trim()
  for (let pass = 0; pass < 6; pass += 1) {
    let changed = false
    for (const re of REASONING_BLOCK_PATTERNS) {
      const next = s.replace(re, '').trim()
      if (next !== s) {
        s = next
        changed = true
      }
    }
    if (!changed) break
  }
  return s
}

/** 将思维链与可见正文拆开（JSON 有时只出现在其中一段） */
export function splitModelReasoningAndVisibleText(text: string): { reasoning: string; visible: string } {
  let visible = String(text ?? '').trim()
  const reasoningParts: string[] = []
  const extractPatterns: RegExp[] = [
    /<thinking\b[^>]*>([\s\S]*?)<\/thinking>/gi,
    /<think\b[^>]*>([\s\S]*?)<\/think>/gi,
    /<redacted_thinking\b[^>]*>([\s\S]*?)<\/redacted_thinking>/gi,
    /<reasoning\b[^>]*>([\s\S]*?)<\/reasoning>/gi,
    /```(?:thinking|think|analysis)\s*([\s\S]*?)```/gi,
  ]
  for (const re of extractPatterns) {
    visible = visible.replace(re, (_match, inner: string) => {
      if (typeof inner === 'string' && inner.trim()) reasoningParts.push(inner.trim())
      return ''
    })
  }
  return { reasoning: reasoningParts.join('\n').trim(), visible: visible.trim() }
}

function parseJsonCandidatesFromTextSegment(segment: string): unknown | null {
  const candidates: string[] = []
  const t = segment.trim()
  if (t) candidates.push(t)

  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/gi)
  if (fenced) {
    for (const block of fenced) {
      const inner = block.replace(/```(?:json)?/i, '').replace(/```$/, '').trim()
      if (inner) candidates.push(inner)
    }
  }

  const objStart = t.indexOf('{')
  const objEnd = t.lastIndexOf('}')
  if (objStart >= 0 && objEnd > objStart) {
    candidates.push(t.slice(objStart, objEnd + 1))
  }

  const arrStart = t.indexOf('[')
  const arrEnd = t.lastIndexOf(']')
  if (arrStart >= 0 && arrEnd > arrStart) {
    candidates.push(t.slice(arrStart, arrEnd + 1))
  }

  for (const raw of candidates) {
    for (const attempt of [raw, repairJsonLikeText(raw)]) {
      try {
        return JSON.parse(attempt) as unknown
      } catch {
        /* next */
      }
    }
  }

  return null
}

const MOMENT_JSON_NEST_KEYS = ['data', 'result', 'moment', 'post', 'output', 'response'] as const

/** 兼容模型把朋友圈包在 data/moment 等字段里 */
export function unwrapMomentJsonPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  for (const key of MOMENT_JSON_NEST_KEYS) {
    const nested = o[key]
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue
    const n = nested as Record<string, unknown>
    if (
      'content' in n ||
      'postType' in n ||
      'interactions' in n ||
      'imagePrompts' in n ||
      'images' in n
    ) {
      return n
    }
  }
  return o
}

/** 从模型原文中解析 JSON（兼容 ```json 包裹、前后废话、轻微语法瑕疵） */
export function parseModelJsonPayload(text: string): unknown | null {
  const { reasoning, visible } = splitModelReasoningAndVisibleText(text)
  const stripped = stripModelReasoningWrapper(text)
  const segments = [visible, reasoning, stripped, text.trim()]
  for (const segment of segments) {
    const parsed = parseJsonCandidatesFromTextSegment(segment)
    if (parsed) return parsed
  }
  return null
}

function formatModelResponsePreview(raw: string, max = 120): string {
  const { visible, reasoning } = splitModelReasoningAndVisibleText(raw)
  const probe = visible || reasoning || raw
  const t = stripModelReasoningWrapper(probe).trim().replace(/\s+/g, ' ')
  if (!t) return '（空）'
  return t.length > max ? `${t.slice(0, max)}…` : t
}

export function describeMomentModelJsonFailure(raw: string): string {
  const trimmedRaw = raw.trim()
  const t = stripModelReasoningWrapper(trimmedRaw).trim()
  const preview = formatModelResponsePreview(trimmedRaw)
  if (!trimmedRaw || !t) {
    return `模型返回为空。请检查 API 地址/Key/模型 ID，或聊天卡片「最大回复 token」是否过小（建议 ≥4096）。响应片段：${preview}`
  }
  if (!t.includes('{') && !t.includes('[')) {
    if (trimmedRaw.includes('{') || trimmedRaw.includes('[')) {
      return `JSON 可能落在思维链里或被网关拆到 reasoning 字段。响应片段：${preview}。若使用 DeepSeek R1 等思考模型，建议换非思考快照模型生成朋友圈`
    }
    return `模型返回了纯文本而非 JSON（多为 JSON 模式未生效或人设指令盖过了格式要求）。响应开头：${preview}。请换指令遵循更好的模型，或检查 API 设置里的聊天模型与 max_tokens（建议 ≥4096）`
  }
  const payload = parseModelJsonPayload(raw)
  if (!payload) {
    return `JSON 语法无法解析（常见于正文未转义换行、或被截断）。响应开头：${preview}。可尝试增大 max_tokens 或换模型`
  }
  return 'JSON 已解析但缺少必填字段（如 postType/content/images）。请重试或换模型'
}

export function extractRepliesArray(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return null
  const o = payload as Record<string, unknown>
  for (const key of ['replies', 'reply', 'comments', 'data', 'messages']) {
    if (Array.isArray(o[key])) return o[key] as unknown[]
  }
  return null
}

/** 解析互动连击 JSON；失败返回 null */
export function parseInteractionRepliesFromRaw(raw: string): unknown[] | null {
  const payload = parseModelJsonPayload(raw)
  const replies = extractRepliesArray(payload)
  if (replies?.length) return replies

  // 兜底：从文本中抠出 "replies": [...] 段（仍来自模型输出，非本地台词）
  const block = raw.match(/"replies"\s*:\s*(\[[\s\S]*\])/i)?.[1]
  if (block) {
    for (const attempt of [block, repairJsonLikeText(block)]) {
      try {
        const arr = JSON.parse(attempt) as unknown
        if (Array.isArray(arr) && arr.length) return arr
      } catch {
        /* continue */
      }
    }
  }

  return null
}

export function describeInteractionParseFailure(raw: string): string {
  const t = raw.trim()
  if (!t) return '模型返回为空，请检查 API 或稍后重试'
  if (!t.includes('{') && !t.includes('[')) {
    return '模型返回了纯文本而非 JSON。已切换为 JSON 专用请求，请再试一次'
  }
  if (parseModelJsonPayload(t) && !extractRepliesArray(parseModelJsonPayload(t)!)) {
    return 'JSON 已解析但缺少 replies 数组，请重试'
  }
  return '模型返回的 JSON 无法解析，请重试或更换指令遵循更好的模型'
}
