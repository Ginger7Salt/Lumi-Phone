/**
 * 从约会 AI 正文中剔除 VN 语音参数块及散落 JSON 行，供 prompt 拼接与展示共用。
 * 从 VN 切到普通模式时，若不剔除，「最近剧情」会把整段 JSON 喂回模型，拖慢且易干扰输出格式。
 */

function isLikelyVnVoiceParamsArtifactLine(rawLine: string): boolean {
  const line = String(rawLine || '').trim()
  if (!line) return false
  if (/【\s*VN语音参数(?:结束)?\s*】/u.test(line)) return true
  if (/(?:^|[{"\s,])idx(?:\s*["'}\],]|:)|emotion\s*:|tone\s*:/i.test(line)) {
    const reduced = line.replace(/[\u4e00-\u9fa5]/g, '').trim()
    if (/^[\[\]\{\}",:a-z0-9_\-\s.]+$/i.test(reduced)) return true
  }
  return false
}

export function extractVnVoiceParamsBlock(raw: string): {
  cleanedText: string
  items: Array<{ idx: number; emotion: string; tone: string }>
} {
  const source = String(raw || '')
  const startMatch = /【\s*VN语音参数\s*】/u.exec(source)
  if (!startMatch || startMatch.index < 0) {
    const cleanedText = source
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter((x) => x && !isLikelyVnVoiceParamsArtifactLine(x))
      .join('\n')
      .trim()
    return { cleanedText, items: [] }
  }
  const start = startMatch.index
  const endRegex = /【\s*VN语音参数结束\s*】/gu
  endRegex.lastIndex = start + startMatch[0].length
  const endMatch = endRegex.exec(source)
  const end = endMatch ? endMatch.index : -1
  const block = end >= 0 ? source.slice(start, end + endMatch![0].length) : source.slice(start)
  const cleanedTextRaw = source.slice(0, start) + (end >= 0 ? source.slice(end + endMatch![0].length) : '')
  const cleanedText = cleanedTextRaw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x && !isLikelyVnVoiceParamsArtifactLine(x))
    .join('\n')
    .trim()
  const jsonText = block.match(/\[[\s\S]*?\]/)?.[0] || '[]'
  try {
    const arr = JSON.parse(jsonText) as unknown
    const items = (Array.isArray(arr) ? arr : [])
      .map((x) => {
        const o = x as Record<string, unknown>
        return {
          idx: Number(o?.idx),
          emotion: String(o?.emotion ?? '').trim(),
          tone: String(o?.tone ?? '').trim(),
        }
      })
      .filter((x) => Number.isFinite(x.idx) && x.idx >= 0 && !!x.emotion && !!x.tone)
    return { cleanedText, items }
  } catch {
    return { cleanedText, items: [] }
  }
}

/** 仅剔除语音参数（无 items），供不需要解析 JSON 的调用方 */
export function stripVnVoiceParamsPayload(raw: string): string {
  return extractVnVoiceParamsBlock(raw).cleanedText
}
