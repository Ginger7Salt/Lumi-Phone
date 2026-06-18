import { isUserMomentViewerMemory } from '../../../../components/moments/userMomentDistributionArchiveService'
import type { CharacterMemory } from '../newFriendsPersona/types'
import { groupMemoryBucketCharacterId } from '../wechatConversationKey'
import type { MemoryEntry } from './memoryArchiveTypes'

const GROUP_ROSTER_PREFIX = '__group__'

/** 记忆档案馆 roster 群聊项 → IndexedDB 群聊记忆桶 id */
export function resolveArchiveCharacterStorageCharacterIds(selectedCharId: string): string[] {
  const cid = selectedCharId.trim()
  if (!cid) return []
  if (cid.startsWith(GROUP_ROSTER_PREFIX)) {
    const gid = cid.slice(GROUP_ROSTER_PREFIX.length).trim()
    return gid ? [groupMemoryBucketCharacterId(gid)] : []
  }
  return [cid]
}

/**
 * 收集「清空该角色记忆」应删除的全部 id：
 * - 不限当前查看账号（跨马甲一并删除）
 * - 含 IndexedDB 存储桶内全部行（私聊 / 关联 / 群聊桶）
 * - 含界面上 charId 归在该角色名下的条目（如群聊摘要挂在首位成员下）
 */
export function collectMemoryIdsForArchiveCharacterClear(params: {
  selectedCharId: string
  allEntries: MemoryEntry[]
  rawMemories: CharacterMemory[]
}): string[] {
  const { selectedCharId, allEntries, rawMemories } = params
  const cid = selectedCharId.trim()
  if (!cid) return []

  const ids = new Set<string>()
  const storageIds = new Set(resolveArchiveCharacterStorageCharacterIds(cid))

  for (const e of allEntries) {
    if (e.charId === cid) ids.add(e.id)
  }

  for (const m of rawMemories) {
    if (isUserMomentViewerMemory(m)) continue
    const storageId = m.characterId.trim()
    if (storageIds.has(storageId)) ids.add(m.id)
  }

  return [...ids]
}
