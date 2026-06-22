import { parseMemorySourcePrefix } from './memorySourceBadges'

const MOMENT_SONG_SHARE_RE = /（分享(?:单曲|歌单)）《([^》]+)》(?:\s*[·•]\s*([^\n；]+))?/

/** 从朋友圈记忆正文中解析分享歌曲（与 buildMomentContentForAi 格式一致） */
export function parseMomentSongShareFromMemoryText(raw: string): {
  title: string
  artist: string
} | null {
  const text = String(raw ?? '')
  const match = text.match(MOMENT_SONG_SHARE_RE)
  if (!match) return null
  const title = match[1]?.trim()
  if (!title) return null
  return {
    title,
    artist: match[2]?.trim() || '',
  }
}

/** 记忆管理 UI：歌曲朋友圈仅展示简短摘要，完整歌词仍保留在 memory.content 供模型注入 */
export function formatMomentSongMemoryDisplaySummary(raw: string): string | null {
  const parsed = parseMomentSongShareFromMemoryText(raw)
  if (!parsed) return null
  return parsed.artist
    ? `分享了${parsed.artist}的《${parsed.title}》`
    : `分享了《${parsed.title}》`
}

function stripMomentMemoryUiNoise(raw: string): string {
  const { body } = parseMemorySourcePrefix(raw)
  return body
    .replace(/^朋友圈正文：\s*/m, '')
    .replace(/；歌词（带时间轴[\s\S]*$/m, '')
    .trim()
}

/** 朋友圈记忆在 UI 中的展示正文（歌曲类走摘要，其余保持可读原文） */
export function formatMomentMemoryBodyForDisplay(raw: string): string {
  const text = String(raw ?? '').trim()
  if (!text) return '（无正文）'

  const songSummary = formatMomentSongMemoryDisplaySummary(text)
  if (songSummary) return songSummary

  const cleaned = stripMomentMemoryUiNoise(text)
  return cleaned || text || '（无正文）'
}
