import { listWechatDefaultAvatarUrls } from '../wechatDefaultAvatars'

/** 同一卡片内同一临时 NPC 名稳定对应一张头像（从 image/随机网友头像 池抽取） */
export function pickStableNetizenAvatarForChatHistoryNpc(seed: string): string | undefined {
  const pool = listWechatDefaultAvatarUrls()
  if (!pool.length) return undefined
  const s = String(seed ?? '').trim()
  if (!s) return pool[0]
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return pool[Math.abs(h) % pool.length]
}
