export interface InteractionNotice {
  id: string
  momentId: string
  actorId: string
  type: 'like' | 'comment' | 'reply' | 'mention'
  content?: string
  timestamp: number
  isRead: boolean
  postThumbnail: string
  /** 回复对象展示名（角色互评或回复用户时为「你」） */
  replyToName?: string
  /** 关联的互动 id，用于去重 */
  sourceInteractionId?: string
}

export interface InteractionNoticeState {
  notices: InteractionNotice[]
  processedInteractionIds: string[]
}
