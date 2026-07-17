import { resolveStoryPublishAfterAnchor } from '../wechat/memory/storyPublishAnchor'
import { formatPulsePublishedAtAbsolute } from './pulsePostMemoryContentBuilder'

/**
 * 用户微博 → 角色记忆的「剧情时序」锚定（薄封装，逻辑见 storyPublishAnchor）。
 */

export type PulsePostStoryPublishAnchor = {
  publishLines: string[]
  storyPublishLabel?: string
  storyAnchored: boolean
  systemPublishedLabel: string
}

export async function resolvePulsePostStoryPublishAnchor(params: {
  characterId: string
  systemPublishedAt: number
}): Promise<PulsePostStoryPublishAnchor> {
  const systemPublishedLabel =
    formatPulsePublishedAtAbsolute(params.systemPublishedAt) || '未知时间'
  return resolveStoryPublishAfterAnchor({
    characterId: params.characterId,
    systemPublishedAt: params.systemPublishedAt,
    systemPublishedLabel,
  })
}
