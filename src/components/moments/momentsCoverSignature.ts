/** 朋友圈封面区个性签名：默认单行省略；含显式换行时最多 2 行 */
export function formatMomentsCoverSignature(raw: string | undefined | null): {
  text: string
  multiline: boolean
} {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return { text: '', multiline: false }

  if (/[\r\n]/.test(trimmed)) {
    const lines = trimmed
      .split(/\r\n|\n|\r/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (!lines.length) return { text: '', multiline: false }
    return { text: lines.slice(0, 2).join('\n'), multiline: true }
  }

  return { text: trimmed.replace(/\s+/g, ' '), multiline: false }
}
