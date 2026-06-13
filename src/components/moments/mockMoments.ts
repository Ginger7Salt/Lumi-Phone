import type { CharacterMomentPostType } from './momentCharacterPublishTypes'
import type { MomentPrivacyMeta } from './newMomentTypes'
import type { MomentInteraction } from './momentInteractionTypes'

export type MomentComment = {
  id: string
  author: string
  content: string
  replyTo?: string
  /** 角色评论时的 characterId（便于解析回复对象） */
  authorCharacterId?: string
  /** 角色对用户/他人评论的回复（存于 comments 数组） */
  isAuthorReply?: boolean
  replyToCommentId?: string
  /** 用户评论已被 AI 回应 */
  elicited?: boolean
  /** 发表时间戳（用于评论区底部时序排序） */
  createdAt?: number
}

export type MomentItemModel = {
  id: string
  authorName: string
  authorAvatar: string
  content: string
  images?: string[]
  location?: string
  timestamp: number
  likes?: string[]
  comments?: MomentComment[]
  /** 角色异步互动（按 visibleAt 解锁） */
  interactions?: MomentInteraction[]
  /** 是否为用户发表（持久化） */
  isUserAuthored?: boolean
  /** 角色发表时的 characterId */
  authorCharacterId?: string
  /** 角色发表时的动态类型 */
  postType?: CharacterMomentPostType
  /** 隐私与提醒配置（供查手机镜像 / 大模型受众联动） */
  privacy?: MomentPrivacyMeta
  /** 个人相册置顶 */
  isPinned?: boolean
}
