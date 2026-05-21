/**
 * 部分模型不输出合法 JSON，而是 markdown 字段清单（keywords / extra_keywords / NPC 2 / 内容：…）。
 * 解析失败时整段会误写入记忆正文；此处检测并尽量抽出「内容：」后的叙事句。
 */

const SCHEMA_FIELD_RE =
  /[`"']?(?:keywords|extra_keywords|emotion_need|category|precise|character_id)[`"']?\s*[:：]/i
const CONTENT_LABEL_RE = /(?:^|\n)\s*(?:[*\-•]\s*)?(?:\*\*)?(?:内容|正文|content)\s*(?:\*\*)?\s*[：:]\s*/gi

function looksLikeBareSchemaToken(t: string): boolean {
  const s = t.trim()
  if (!s) return true
  if (/^[\[\]"'`,\s\\{}]+$/.test(s)) return true
  return SCHEMA_FIELD_RE.test(s) && s.length < 80
}

/** 正文是否像「把 JSON 字段说明当正文」的泄漏（非占位符 {{user}} 的正常记忆）。 */
export function looksLikeMemoryJsonSchemaLeak(text: string): boolean {
  const s = String(text ?? '').trim()
  if (!s) return false
  let score = 0
  if (SCHEMA_FIELD_RE.test(s)) score += 1
  if (/[`"']?keywords[`"']?\s*[:：]/i.test(s)) score += 1
  if (/[`"']?extra_keywords[`"']?\s*[:：]/i.test(s)) score += 1
  if (/\*\*?\s*NPC\s*\d+/i.test(s)) score += 1
  if (/(?:^|\n)\s*[*\-•]\s*`(?:keywords|extra_keywords)/im.test(s)) score += 1
  if (/"primary"\s*:|"linked"\s*:/i.test(s)) score += 1
  if (/\bprimary\s*[:：]\s*\{/i.test(s)) score += 1
  return score >= 2
}

/** 从误输出的字段清单中抽出可入库的叙事正文；抽不出则返回空串（调用方应拒写）。 */
export function extractNarrativeFromMalformedMemorySummary(raw: string): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (!looksLikeMemoryJsonSchemaLeak(s)) return s

  const narratives: string[] = []
  for (const m of s.matchAll(CONTENT_LABEL_RE)) {
    const start = (m.index ?? 0) + m[0].length
    const rest = s.slice(start)
    const lineEnd = rest.indexOf('\n')
    const firstLine = (lineEnd >= 0 ? rest.slice(0, lineEnd) : rest).trim()
    if (firstLine.length >= 8 && !looksLikeBareSchemaToken(firstLine)) {
      narratives.push(firstLine)
    }
  }
  if (narratives.length) {
    return narratives.sort((a, b) => b.length - a.length)[0]!.slice(0, 2000)
  }

  const prose: string[] = []
  for (const line of s.split('\n')) {
    const t = line.trim()
    if (!t) continue
    if (SCHEMA_FIELD_RE.test(t)) continue
    if (/^\*\*?\s*NPC\s*\d+/i.test(t)) continue
    if (/^[*\-•]\s*`/.test(t) && SCHEMA_FIELD_RE.test(t)) continue
    const cleaned = t
      .replace(/^[*\-•]+\s*/, '')
      .replace(/^\*\*|\*\*$/g, '')
      .trim()
    if (cleaned.length < 12 || looksLikeBareSchemaToken(cleaned)) continue
    if (/^(?:primary|linked)\s*[:：]/i.test(cleaned)) continue
    prose.push(cleaned)
  }
  const joined = prose.join(' ').replace(/\s+/g, ' ').trim()
  return joined.slice(0, 2000)
}

/** 清洗记忆正文：去泄漏 → 再交后续占位符规范化。 */
export function repairMemorySummaryBodyFromModel(raw: string): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return ''
  const extracted = extractNarrativeFromMalformedMemorySummary(trimmed)
  if (extracted) return extracted
  if (looksLikeMemoryJsonSchemaLeak(trimmed)) return ''
  return trimmed
}
