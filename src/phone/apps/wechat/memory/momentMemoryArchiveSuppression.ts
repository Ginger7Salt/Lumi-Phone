import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemory } from '../newFriendsPersona/types'

const KV_KEY = 'wechat-suppressed-moment-memory-archives-v1'
const STABLE_ID_PREFIX = 'moment-mem-'
const USER_MOMENT_STABLE_ID_PREFIX = 'user-moment-mem-'

export const MOMENT_MEMORY_ARCHIVE_SUPPRESSED_EVENT = 'moment-memory-archive-suppressed'

export function resolveMomentIdFromMemory(memory: CharacterMemory): string | null {
  const fromField = memory.momentSourceMomentId?.trim()
  if (fromField) return fromField
  const id = memory.id.trim()
  for (const prefix of [STABLE_ID_PREFIX, USER_MOMENT_STABLE_ID_PREFIX]) {
    if (!id.startsWith(prefix)) continue
    const rest = id.slice(prefix.length)
    const sep = rest.indexOf('::')
    return (sep >= 0 ? rest.slice(0, sep) : rest).trim() || null
  }
  return null
}

export async function getSuppressedMomentArchiveIds(): Promise<Set<string>> {
  try {
    const raw = await personaDb.getPhoneKv(KV_KEY)
    if (!Array.isArray(raw)) return new Set()
    return new Set(
      raw
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter(Boolean),
    )
  } catch {
    return new Set()
  }
}

export async function suppressMomentMemoryArchive(momentId: string): Promise<void> {
  const id = momentId.trim()
  if (!id) return
  const set = await getSuppressedMomentArchiveIds()
  if (set.has(id)) return
  set.add(id)
  await personaDb.setPhoneKv(KV_KEY, [...set])
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(MOMENT_MEMORY_ARCHIVE_SUPPRESSED_EVENT, { detail: { momentId: id } }),
    )
  }
}

export async function isMomentMemoryArchiveSuppressed(momentId: string): Promise<boolean> {
  const id = momentId.trim()
  if (!id) return false
  const set = await getSuppressedMomentArchiveIds()
  return set.has(id)
}

export function isMomentArchiveMemory(memory: CharacterMemory): boolean {
  return (
    memory.memoryScope === 'moment' ||
    !!memory.momentSourceMomentId?.trim() ||
    !!memory.momentPayload ||
    memory.id.trim().startsWith(STABLE_ID_PREFIX) ||
    memory.id.trim().startsWith(USER_MOMENT_STABLE_ID_PREFIX) ||
    memory.content.trimStart().startsWith('[朋友圈]')
  )
}

export async function suppressMomentMemoryArchiveFromMemory(
  memory: CharacterMemory,
): Promise<void> {
  if (!isMomentArchiveMemory(memory)) return
  const momentId = resolveMomentIdFromMemory(memory)
  if (momentId) await suppressMomentMemoryArchive(momentId)
}

/** 删除全部朋友圈相关角色记忆，并清空已隐藏归档 id 列表 */
export async function clearAllMomentMemoryArchives(): Promise<number> {
  const all = await personaDb.listAllCharacterMemories()
  let deleted = 0
  for (const m of all) {
    if (!isMomentArchiveMemory(m)) continue
    await personaDb.deleteCharacterMemory(m.id)
    deleted += 1
  }
  await personaDb.setPhoneKv(KV_KEY, [])
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MOMENT_MEMORY_ARCHIVE_SUPPRESSED_EVENT))
  }
  return deleted
}
