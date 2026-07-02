import { personaDb } from '../newFriendsPersona/idb'

const STORY_YEAR_RE = /(\d{4})年/

/** 从剧情时间轴近端行推断故事年份，供日记日期补全年份 */
export async function loadDiaryStoryYearHint(characterId: string): Promise<string | null> {
  const cid = characterId.trim()
  if (!cid) return null

  const rows = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
  for (let i = rows.length - 1; i >= 0; i--) {
    const text = String(rows[i]?.rowText ?? '')
    const anchor = text.match(/【本轮锚点】([^\n]+)/)?.[1] ?? ''
    const fromAnchor = anchor.match(STORY_YEAR_RE)?.[1]
    if (fromAnchor) return fromAnchor

    const allYears = [...text.matchAll(/(\d{4})年/g)]
    if (allYears.length) return allYears[allYears.length - 1]![1]!
  }
  return null
}

/** 无年份时补上剧情年份（如 7月2日 傍晚 → 2026年7月2日 傍晚） */
export function ensureDiaryInUniverseTimeHasYear(
  inUniverseTime: string,
  yearHint?: string | null,
): string {
  const t = String(inUniverseTime ?? '').trim()
  if (!t || STORY_YEAR_RE.test(t)) return t

  const year = String(yearHint ?? '').trim()
  if (!/^\d{4}$/.test(year)) return t

  if (/^\d{1,2}月\d{1,2}日/.test(t)) return `${year}年${t}`
  return t
}

/** 预览列表：只保留日期时段，去掉逗号后的地点/场景补述 */
export function formatDiaryPreviewDate(
  inUniverseTime: string,
  yearHint?: string | null,
): string {
  const full = ensureDiaryInUniverseTimeHasYear(inUniverseTime, yearHint).trim()
  if (!full) return ''
  const comma = full.search(/[,，]/)
  if (comma >= 0) return full.slice(0, comma).trim()
  return full
}
