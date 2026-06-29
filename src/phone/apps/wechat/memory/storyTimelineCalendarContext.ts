import { getAiPlotActiveTimelineDelta } from '../dating/plotTimelineDelta'
import type { PlotItem } from '../dating/types'
import { personaDb } from '../newFriendsPersona/idb'
import {
  composeStoryTimelineCalendarAnchorLabel,
  hasTimelineDeltaContent,
  STORY_TIMELINE_GREGORIAN_ANCHOR_RE,
  type StoryTimelineSummaryDelta,
} from './storyTimelineTypes'

export type StoryCalendarPlotRef = {
  type?: string
  timelineDelta?: StoryTimelineSummaryDelta
  timelineSnapshot?: string
}

/** 从已有剧情列表取**上一回合故事内**公历锚点（禁止 plot.timestamp / 落库时刻） */
export function resolveStoryCalendarAnchorFromPlots(
  plots: StoryCalendarPlotRef[] | null | undefined,
): string {
  const list = plots ?? []
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]
    if (p?.type !== 'ai') continue
    if (p.timelineDelta && hasTimelineDeltaContent(p.timelineDelta)) {
      const label = composeStoryTimelineCalendarAnchorLabel(p.timelineDelta)
      if (label) return label
    }
    const snap = String(p.timelineSnapshot ?? '').trim()
    const anchorMatch = snap.match(/【本轮锚点】([^\n]+)/)
    const anchorText = anchorMatch?.[1]?.trim() ?? ''
    if (anchorText) {
      const cal = anchorText.match(STORY_TIMELINE_GREGORIAN_ANCHOR_RE)
      if (cal?.[0]) return cal[0].trim()
      const first = anchorText.split(' · ')[0]?.trim()
      if (first && /^\d{4}年/.test(first)) return first
    }
  }
  return ''
}

export function resolveStoryCalendarAnchorFromPlotItems(plots: PlotItem[] | null | undefined): string {
  const list = plots ?? []
  return resolveStoryCalendarAnchorFromPlots(
    list.map((p) => ({
      type: p.type,
      timelineDelta: p.type === 'ai' ? getAiPlotActiveTimelineDelta(p) : undefined,
      timelineSnapshot: p.timelineSnapshot,
    })),
  )
}

/**
 * @deprecated 仅保留排序/游标用途；**禁止**作为剧情公历锚点展示或写入 prompt。
 * plot.timestamp 为落库时刻，不是故事内时间。
 */
export function resolveStoryTimeHintMsFromPlots(
  plots: Array<{ timestamp?: number }> | null | undefined,
): number {
  const list = plots ?? []
  for (let i = list.length - 1; i >= 0; i--) {
    const ts = list[i]?.timestamp
    if (typeof ts === 'number' && Number.isFinite(ts)) return ts
  }
  return Date.now()
}

/** 写入 timeline 摘要 prompt：剧情内公历锚点 + 生日/节日感知 */
export const STORY_TIMELINE_CALENDAR_AWARENESS_RULES = `
【剧情日历·公历锚点（timeline 必填语义）】
- **锚点是故事内时间，不是生成/落库时刻**：story_day / story_time 必须来自正文与已有剧情时间轴；**禁止**使用手机当前日期、消息发送时刻、plot.timestamp。
- story_day **须写含年份的公历日期**（本轮开始或单点之日），如 "2025年10月1日"；**禁止**仅写「第3天」「Day 12」（相对进度写 relative_time）。
- story_time **须写 24 小时制 HH:mm**（本轮开始或单点时刻）；仅有「傍晚/深夜」时须结合上下文推断。
- **跨时段剧情**：正文明确跨越时间（如闪回、多日旅行、从清晨写到深夜且跨日）时，须填写 story_day_end、story_time_end；展示形如「2025年5月1日 星期一 08:00 - 2025年6月29日 星期日 18:00」。同日跨度可只写 story_time + story_time_end（story_day_end 可省略或与 story_day 相同）。
- 写 event_summary / row_title 时须感知**季节与节日氛围**，并与 story_day（及 end）一致。
- **生日节点**：若下方提供了 {{user}} / {{char}} 的生日 MM-DD，须对照 story_day 判断是否临近或当日。
- **重要节日**：元旦、春节、清明、劳动节、端午、中秋、国庆、情人节、520、七夕、跨年夜等；命中或临近（±1～2 天）时在摘要中点明节日语境。
`.trim()

export async function buildStoryTimelineCalendarContextBlock(params: {
  peerCharacterId?: string | null
  sessionPlayerIdentityId?: string | null
  /** 上一回合故事内公历锚点（优先） */
  storyCalendarAnchor?: string | null
  /** @deprecated 勿用于展示剧情时刻；仅兼容旧调用 */
  storyTimeHintMs?: number | null
}): Promise<string> {
  const lines: string[] = []
  const anchor = String(params.storyCalendarAnchor ?? '').trim()
  if (anchor) {
    lines.push(
      `【剧情时间锚点（上一回合故事内末尾·本轮须承接；禁止写成手机当前日期）】${anchor}`,
    )
  } else {
    lines.push(
      '【剧情时间锚点】尚无上一回合公历锚点：须**仅根据正文与大纲**推断 story_day/story_time；**禁止**使用生成当日、消息落库时刻或【当前时间】。',
    )
  }

  const cid = params.peerCharacterId?.trim()
  if (cid) {
    try {
      const ch = await personaDb.getCharacter(cid)
      if (ch?.birthdayMD?.trim()) {
        lines.push(`{{char}} 生日（MM-DD，对照 story_day 判断是否节点）：${ch.birthdayMD.trim()}`)
      }
    } catch {
      /* ignore */
    }
  }

  const playerId = params.sessionPlayerIdentityId?.trim()
  if (playerId) {
    try {
      const player = await personaDb.getPlayerIdentity(playerId)
      if (player?.birthdayMD?.trim()) {
        lines.push(`{{user}} 生日（MM-DD，对照 story_day 判断是否节点）：${player.birthdayMD.trim()}`)
      }
    } catch {
      /* ignore */
    }
  }

  if (!lines.length) return ''
  return `\n\n${lines.join('\n')}\n${STORY_TIMELINE_CALENDAR_AWARENESS_RULES}`
}
