/**
 * 双时间约定：
 * - 系统落库时间（systemRecordedAt / recordedAt / Date.now）：仅后台时序，不对用户展示
 * - 剧情时间（storyDay / storyTime / storyTimeLabel）：前端与记忆摘要展示用
 */

import type { StoryTimelineSummaryDelta } from './storyTimelineTypes'
import { composeStoryTimelineCalendarAnchorLabel } from './storyTimelineTypes'

export type DualNarrativeStoryFields = {
  storyDay?: string
  storyTime?: string
  /** 用户可见的剧情时间文案 */
  storyTimeLabel?: string
}

/** 从 timeline delta 提取剧情时间字段（优先 end 锚点） */
export function dualNarrativeStoryFieldsFromDelta(
  delta: Pick<
    StoryTimelineSummaryDelta,
    'story_day' | 'story_time' | 'story_day_end' | 'story_time_end'
  > | null | undefined,
): DualNarrativeStoryFields {
  if (!delta) return {}
  const storyDay = (delta.story_day_end || delta.story_day || '').trim() || undefined
  const storyTime = (delta.story_time_end || delta.story_time || '').trim() || undefined
  const storyTimeLabel =
    composeStoryTimelineCalendarAnchorLabel(delta).trim() ||
    (storyDay
      ? storyTime
        ? `${storyDay} ${storyTime}`
        : storyDay
      : storyTime || undefined)
  if (!storyDay && !storyTime && !storyTimeLabel) return {}
  return {
    ...(storyDay ? { storyDay } : {}),
    ...(storyTime ? { storyTime } : {}),
    ...(storyTimeLabel ? { storyTimeLabel } : {}),
  }
}

/** 从记忆/摘要正文中解析用户可见剧情时间（不含系统落库） */
export function extractStoryTimeLabelFromText(text: string): string | undefined {
  const raw = String(text ?? '')
  const patterns = [
    /【剧情时间】([^\n]+)/,
    /【本轮锚点】([^\n]+)/,
    /【当前锚点】([^\n]+)/,
    /发布时间：\s*(发表于剧情日[^\n]+)/,
    /发布时间：([^\n]+)/,
  ]
  for (const re of patterns) {
    const m = raw.match(re)
    const label = m?.[1]?.trim()
    if (!label) continue
    // 过滤误把系统落库行当成展示时间
    if (/系统落库|勿按系统公历/.test(label)) continue
    return label.slice(0, 120)
  }
  return undefined
}

/** 记忆卡片角标：优先剧情时间；无则不展示墙钟（避免泄漏系统时间） */
export function resolveMemoryDisplayTimeLabel(params: {
  storyTimeLabel?: string | null
  content?: string | null
  pulseStoryPublishLabel?: string | null
}): string {
  const direct = params.storyTimeLabel?.trim()
  if (direct) return direct
  const pulse = params.pulseStoryPublishLabel?.trim()
  if (pulse) return pulse
  const fromBody = extractStoryTimeLabelFromText(params.content || '')
  if (fromBody) return fromBody
  return ''
}
