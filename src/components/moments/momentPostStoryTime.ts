import { resolveStoryPublishAfterAnchor } from '../../phone/apps/wechat/memory/storyPublishAnchor'
import { formatMomentPublishedAtAbsolute } from './utils/timeFormat'

/** 用户朋友圈 → 角色记忆的剧情时序锚定（与微博同源规则） */
export async function resolveMomentPostStoryPublishAnchor(params: {
  characterId: string
  systemPublishedAt: number
}) {
  const systemPublishedLabel =
    formatMomentPublishedAtAbsolute(params.systemPublishedAt) || '未知时间'
  return resolveStoryPublishAfterAnchor({
    characterId: params.characterId,
    systemPublishedAt: params.systemPublishedAt,
    systemPublishedLabel,
  })
}
