import { MAX_MOMENT_IMAGES } from '../../../../components/moments/momentContentLimits'
import { resolveMomentVisionImageUrls } from '../../../../components/moments/momentVisionChat'
import { loadUserMoments } from '../../../../components/moments/momentsFeedStorage'
import { resolveMomentIdFromMemory } from './momentMemoryArchiveSuppression'
import type { CharacterMemory } from '../newFriendsPersona/types'

/** 单轮聊天召回的朋友圈配图数上限（与动态 1～9 张一致） */
export const MAX_MEMORY_INJECT_MOMENT_IMAGES = MAX_MOMENT_IMAGES

export function isMomentScopeMemoryForImageInjection(m: CharacterMemory): boolean {
  return m.memoryScope === 'moment' || !!m.momentSourceMomentId?.trim()
}

export function collectMomentIdsFromRecalledMemories(memories: CharacterMemory[]): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const m of memories) {
    if (!isMomentScopeMemoryForImageInjection(m)) continue
    const id = resolveMomentIdFromMemory(m)
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export async function resolveMomentImagesForMemoryInjection(params: {
  accountId: string | null | undefined
  pickedMemories: CharacterMemory[]
}): Promise<string[]> {
  const momentIds = collectMomentIdsFromRecalledMemories(params.pickedMemories)
  if (!momentIds.length) return []
  const acc = params.accountId?.trim()
  if (!acc) return []

  const allMoments = await loadUserMoments(acc)
  const byId = new Map(allMoments.map((m) => [m.id, m]))
  const rawUrls: string[] = []

  for (const momentId of momentIds) {
    const moment = byId.get(momentId)
    const images = moment?.images ?? []
    if (!images.length) continue
    for (const url of images) {
      const u = url.trim()
      if (!u) continue
      rawUrls.push(u)
      if (rawUrls.length >= MAX_MEMORY_INJECT_MOMENT_IMAGES) break
    }
    if (rawUrls.length >= MAX_MEMORY_INJECT_MOMENT_IMAGES) break
  }

  if (!rawUrls.length) return []
  return resolveMomentVisionImageUrls(rawUrls.slice(0, MAX_MEMORY_INJECT_MOMENT_IMAGES))
}

/** 群聊：合并各 NPC 召回的朋友圈配图，去重并封顶 */
export function mergeMomentImageUrlsForGroup(...lists: Array<string[] | undefined | null>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const list of lists) {
    for (const url of list ?? []) {
      const u = url.trim()
      if (!u || seen.has(u)) continue
      seen.add(u)
      out.push(u)
      if (out.length >= MAX_MEMORY_INJECT_MOMENT_IMAGES) return out
    }
  }
  return out
}
