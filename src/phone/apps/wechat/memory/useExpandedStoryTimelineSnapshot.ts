import { useEffect, useState } from 'react'
import { personaDb } from '../newFriendsPersona/idb'

/** 剧情摘要展示：将入库占位符 `{{id:…}}` / `{{char}}` 等展开为绑定姓名（编辑弹窗仍用原文）。 */
export function useExpandedStoryTimelineSnapshot(
  characterId: string | null | undefined,
  rawText: string,
): string {
  const [display, setDisplay] = useState(() => String(rawText ?? '').trim())

  useEffect(() => {
    const raw = String(rawText ?? '').trim()
    const cid = characterId?.trim()
    if (!raw) {
      setDisplay('')
      return
    }
    if (!cid || !raw.includes('{{')) {
      setDisplay(raw)
      return
    }
    let cancelled = false
    void personaDb.expandStoryTimelineTextForDisplay(cid, raw).then((expanded) => {
      if (!cancelled) setDisplay(expanded.trim() || raw)
    })
    return () => {
      cancelled = true
    }
  }, [characterId, rawText])

  return display
}
