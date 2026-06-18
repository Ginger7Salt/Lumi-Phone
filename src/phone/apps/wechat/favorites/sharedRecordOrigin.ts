/** 收藏/转发记忆切片：原发送者为玩家本人时的占位 id（非会话角色 id） */
export const SHARED_RECORD_PLAYER_ORIGIN_ID = '__player__'

export type SharedRecordSenderKind = 'character' | 'player'

export function isSharedRecordPlayerOrigin(originCharacterId: string): boolean {
  return originCharacterId.trim() === SHARED_RECORD_PLAYER_ORIGIN_ID
}
