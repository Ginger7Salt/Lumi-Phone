import type { MomentItemModel } from './mockMoments'
import { sanitizeMomentBodyText } from './momentTextSanitize'

/** 信息流上是否应有可见正文或配图 */
export function isMomentFeedVisible(item: MomentItemModel): boolean {
  const body = sanitizeMomentBodyText(item.content)
  return body.length > 0 || (item.images?.length ?? 0) > 0 || !!item.attachedMusic?.title?.trim()
}

export function describeEmptyMomentPublishFailure(): string {
  return '生成结果为空（无正文、配图或歌曲）。请检查聊天 API 是否正常、模型是否支持 JSON 输出，或更换模型后重试'
}
