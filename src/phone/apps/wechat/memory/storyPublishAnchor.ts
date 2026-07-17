import { personaDb } from '../newFriendsPersona/idb'
import {
  formatGregorianStoryDayFromMs,
  parseStoryCalendarDayStartMs,
} from './storyTimelineTypes'

/**
 * 用户发帖（微博 / 朋友圈）→ 角色记忆的「剧情时序」锚定。
 *
 * 规则：
 * - 角色剧情时间轴已有 currentStoryDay
 * - 且「最近一次剧情推进的系统时间」早于发帖系统时间
 * → 本帖视为发生在该剧情日推进之后（而非系统公历年的剧情内时间）
 */

export type StoryPublishAfterAnchor = {
  /** 写入记忆正文的「发布时间」行 */
  publishLines: string[]
  /** 短标签（如「发表于剧情日 … 之后」） */
  storyPublishLabel?: string
  storyAnchored: boolean
  /** 系统墙钟展示文案（后台对照） */
  systemPublishedLabel: string
}

function latestPlotAdvanceSystemMs(params: {
  stateUpdatedAt?: number
  latestRowRecordedAt?: number
}): number {
  const a =
    typeof params.stateUpdatedAt === 'number' && Number.isFinite(params.stateUpdatedAt)
      ? params.stateUpdatedAt
      : 0
  const b =
    typeof params.latestRowRecordedAt === 'number' && Number.isFinite(params.latestRowRecordedAt)
      ? params.latestRowRecordedAt
      : 0
  return Math.max(a, b)
}

export async function resolveStoryPublishAfterAnchor(params: {
  characterId: string
  /** 发帖系统墙钟 */
  systemPublishedAt: number
  /** 系统墙钟展示（调用方按业务格式化） */
  systemPublishedLabel: string
}): Promise<StoryPublishAfterAnchor> {
  const systemPublishedAt = params.systemPublishedAt
  const systemPublishedLabel = params.systemPublishedLabel.trim() || '未知时间'
  const characterId = params.characterId.trim()
  if (!characterId || !Number.isFinite(systemPublishedAt) || systemPublishedAt <= 0) {
    return {
      publishLines: systemPublishedLabel ? [`发布时间：${systemPublishedLabel}`] : [],
      storyAnchored: false,
      systemPublishedLabel,
    }
  }

  try {
    const [state, rows] = await Promise.all([
      personaDb.getStoryTimelineState(characterId),
      personaDb.listStoryTimelinePlotRowsByCharacterId(characterId),
    ])
    const storyDay = state?.currentStoryDay?.trim() || ''
    if (!storyDay) {
      return {
        publishLines: [`发布时间：${systemPublishedLabel}`],
        storyAnchored: false,
        systemPublishedLabel,
      }
    }

    const storyDayMs = parseStoryCalendarDayStartMs(storyDay)
    const latestRowRecordedAt = rows.reduce((max, r) => {
      const t = typeof r.recordedAt === 'number' && Number.isFinite(r.recordedAt) ? r.recordedAt : 0
      return t > max ? t : max
    }, 0)
    const plotAdvanceSystemMs = latestPlotAdvanceSystemMs({
      stateUpdatedAt: state?.updatedAt,
      latestRowRecordedAt,
    })

    if (plotAdvanceSystemMs > 0 && plotAdvanceSystemMs < systemPublishedAt) {
      const storyDayLabel =
        storyDayMs != null ? formatGregorianStoryDayFromMs(storyDayMs) : storyDay
      const timeBit = state?.currentStoryTime?.trim()
      const storyAnchor = timeBit ? `${storyDayLabel} ${timeBit}` : storyDayLabel
      const storyPublishLabel = `发表于剧情日 ${storyAnchor} 之后`
      return {
        storyAnchored: true,
        storyPublishLabel,
        systemPublishedLabel,
        publishLines: [`发布时间：${storyPublishLabel}`],
      }
    }

    return {
      publishLines: [`发布时间：${systemPublishedLabel}`],
      storyAnchored: false,
      systemPublishedLabel,
    }
  } catch {
    return {
      publishLines: [`发布时间：${systemPublishedLabel}`],
      storyAnchored: false,
      systemPublishedLabel,
    }
  }
}
