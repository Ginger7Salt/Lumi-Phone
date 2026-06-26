/** 模型 id 看起来像 embedding（兜底；优先用接口元数据判定） */
export const EMBEDDING_MODEL_NAME_RE =
  /embed|embedding|text-embedding|bge-|m3e|e5-|ada|voyage|nomic|mxbai|snowflake|qwen.*embed|doubao-embedding|baai\/bge/i

export function extractOpenAiModelListRowId(row: unknown): string {
  if (typeof row === 'string') return row.trim()
  if (!row || typeof row !== 'object') return ''
  const r = row as Record<string, unknown>
  return String(r.id ?? r.name ?? '').trim()
}

function readLower(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim().toLowerCase()
  }
  return ''
}

/** 从 /models 单条记录判断是否支持 embedding（尽量读元数据，不单靠名字） */
export function isEmbeddingModelCandidate(row: unknown): boolean {
  if (typeof row === 'string') {
    const id = row.trim()
    return id ? EMBEDDING_MODEL_NAME_RE.test(id) : false
  }
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  const id = extractOpenAiModelListRowId(row)
  if (!id) return false

  const type = readLower(r, 'type', 'model_type', 'modelType', 'kind')
  if (type === 'embedding' || type === 'embeddings' || type === 'text-embedding') return true

  const subType = readLower(r, 'sub_type', 'subType', 'subtype')
  if (subType === 'embedding' || subType === 'embeddings') return true

  const architecture = r.architecture
  if (architecture && typeof architecture === 'object') {
    const modality = readLower(architecture as Record<string, unknown>, 'modality')
    if (modality.includes('embed')) return true
    const outputModalities = (architecture as Record<string, unknown>).output_modalities
    if (Array.isArray(outputModalities)) {
      if (outputModalities.some((m) => String(m).toLowerCase().includes('embed'))) return true
    }
  }

  const modality = readLower(r, 'modality')
  if (modality.includes('embed')) return true

  for (const capKey of ['capabilities', 'supported_capabilities', 'supportedCapabilities', 'tasks']) {
    const caps = r[capKey]
    if (Array.isArray(caps) && caps.some((c) => String(c).toLowerCase().includes('embed'))) return true
  }

  return EMBEDDING_MODEL_NAME_RE.test(id)
}

/** 只保留 embedding 候选，筛空时**不会**回退为全量聊天模型 */
export function pickEmbeddingModelsFromApiList(list: unknown[]): string[] {
  const ids: string[] = []
  for (const row of list) {
    if (!isEmbeddingModelCandidate(row)) continue
    const id = extractOpenAiModelListRowId(row)
    if (id) ids.push(id)
  }
  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b))
}

export function isSiliconFlowModelsApiUrl(apiUrl: string): boolean {
  return /siliconflow\.(cn|com)/i.test(apiUrl.trim())
}
