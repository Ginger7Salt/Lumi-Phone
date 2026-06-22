import type { WeChatListenTrackSharePayload } from '../newFriendsPersona/types'

type BurstMsg = {
  from: 'self' | 'other'
  listenTrackShare?: WeChatListenTrackSharePayload
  musicSync?: { kind: string }
}

/**
 * 自最近一条对方消息以来，用户连发多条时，取最近一条听一听单曲/歌单分享卡。
 */
export function findLatestSelfListenTrackShareInBurst(
  reversedNewestFirst: readonly BurstMsg[],
): WeChatListenTrackSharePayload | undefined {
  for (const m of reversedNewestFirst) {
    if (m.from === 'other') break
    if (m.from === 'self' && m.listenTrackShare) return m.listenTrackShare
  }
  return undefined
}

function findLatestSelfMusicInviteInBurst(reversedNewestFirst: readonly BurstMsg[]): boolean {
  for (const m of reversedNewestFirst) {
    if (m.from === 'other') break
    if (m.from === 'self' && m.musicSync?.kind === 'music_invite') return true
  }
  return false
}

/**
 * 本轮是否应走「音乐共听邀约」裁决（含 replyBias / MUSIC_SYNC 指令 / 接受卡）。
 * 用户仅分享单曲/歌单、未发正式共听邀约卡时，禁止触发共听接受流程。
 */
export function shouldEngageMusicSyncInviteFlow(reversedNewestFirst: readonly BurstMsg[]): boolean {
  const trackShare = findLatestSelfListenTrackShareInBurst(reversedNewestFirst)
  if (!trackShare) return true
  return findLatestSelfMusicInviteInBurst(reversedNewestFirst)
}
