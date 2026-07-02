import { personaDb } from '../newFriendsPersona/idb'
import { ensureDatingPlotSummaryCursorSyncedFromPlotRows } from '../memory/storyTimelineDatingCursorSync'
import { filterSummarizedStoryTimelineRows } from '../memory/summarizedStoryTimelineRowFilter'
import {
  STORY_TIMELINE_INJECT_LABEL_RECENT,
  STORY_TIMELINE_INJECT_RECENT_ROWS,
  formatStoryTimelineRowForPromptInject,
  resolveStoryTimelineRowTitle,
  type StoryTimelinePlotRow,
} from '../memory/storyTimelineTypes'

function selectOfflineSummaryRows(rows: StoryTimelinePlotRow[], count: number): StoryTimelinePlotRow[] {
  const offline = rows.filter((row) => {
    const scope = row.sourceScope ?? 'offline'
    return scope === 'offline' || scope === 'linked'
  })
  return offline.slice(-Math.max(0, count))
}

/** 日记生成：注入近端固定 5 条「线下摘要」行（非 plot 全文） */
export async function loadDiaryOfflineSummaryPromptBlock(characterId: string): Promise<string> {
  const cid = characterId.trim()
  if (!cid) return ''

  const rows = await personaDb.listStoryTimelinePlotRowsByCharacterId(cid)
  if (!rows.length) return ''

  await ensureDatingPlotSummaryCursorSyncedFromPlotRows(cid, rows)
  const summarized = await filterSummarizedStoryTimelineRows(cid, rows)
  const recent = selectOfflineSummaryRows(summarized, STORY_TIMELINE_INJECT_RECENT_ROWS)
  if (!recent.length) return ''

  const rowOpts = {
    redactSidePerspectiveForMainChar: true,
    mainCharPresence: { mainCharacterId: cid },
  }

  const blocks = recent
    .map((row, i) => {
      const title = resolveStoryTimelineRowTitle(row)
      const body = formatStoryTimelineRowForPromptInject(row, rowOpts)
      if (!body.trim()) return null
      return `--- 摘要 ${i + 1} · ${title} · ${STORY_TIMELINE_INJECT_LABEL_RECENT} ---\n${body}`
    })
    .filter(Boolean)
    .join('\n\n')

  if (!blocks) return ''

  const expanded = await personaDb.expandStoryTimelineTextForDisplay(cid, blocks)
  return (
    `【近端剧情摘要（最近 ${recent.length} 条，由旧到新；线下约会每轮一行小摘要，非全文）】\n` +
    `${expanded}\n\n` +
    `（以上为记忆档案馆「线下摘要」近端固定条目；写日记时据此承接线下发生过什么，勿与私聊记忆矛盾；勿复述全文对白。）`
  )
}
