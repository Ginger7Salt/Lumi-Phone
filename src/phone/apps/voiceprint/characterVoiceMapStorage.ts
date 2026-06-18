import { resolveCanonicalCharacterId } from '../wechat/wechatGlobalCharacterRegistry'

const CHARACTER_VOICE_MAP_LS_KEY = 'minimax:characterVoiceMap'

export type CharacterVoiceMap = Record<string, string>

function safeParseMap(raw: string): CharacterVoiceMap {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: CharacterVoiceMap = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const id = String(k || '').trim()
      const voice = typeof v === 'string' ? v.trim() : ''
      if (id && voice) out[id] = voice
    }
    return out
  } catch {
    return {}
  }
}

export function readCharacterVoiceMapFromStorage(): CharacterVoiceMap {
  if (typeof localStorage === 'undefined') return {}
  return safeParseMap(localStorage.getItem(CHARACTER_VOICE_MAP_LS_KEY) ?? '')
}

export function writeCharacterVoiceMapToStorage(map: CharacterVoiceMap): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CHARACTER_VOICE_MAP_LS_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

/** 删除指定角色的声纹映射（角色从微信移除或彻底删除时调用） */
export function pruneCharacterVoiceMappings(characterIds: readonly string[]): CharacterVoiceMap {
  const remove = new Set(characterIds.map((id) => id.trim()).filter(Boolean))
  if (!remove.size) return readCharacterVoiceMapFromStorage()
  const current = readCharacterVoiceMapFromStorage()
  let changed = false
  const next: CharacterVoiceMap = {}
  for (const [k, v] of Object.entries(current)) {
    if (remove.has(k)) {
      changed = true
      continue
    }
    next[k] = v
  }
  if (changed) writeCharacterVoiceMapToStorage(next)
  return changed ? next : current
}

/** 仅保留仍存在于通讯录的角色映射，剔除孤儿条目 */
export function pruneCharacterVoiceMappingsToAllowed(allowedCharacterIds: ReadonlySet<string>): CharacterVoiceMap {
  const current = readCharacterVoiceMapFromStorage()
  let changed = false
  const next: CharacterVoiceMap = {}
  for (const [k, v] of Object.entries(current)) {
    if (!allowedCharacterIds.has(k)) {
      changed = true
      continue
    }
    next[k] = v
  }
  if (changed) writeCharacterVoiceMapToStorage(next)
  return changed ? next : current
}

/** 按 canonical id 归一化映射键，修复「绑定在别名、聊天用 canonical」导致查不到声纹 */
export async function normalizeCharacterVoiceMapKeys(): Promise<CharacterVoiceMap> {
  const current = readCharacterVoiceMapFromStorage()
  const next: CharacterVoiceMap = {}
  let changed = false
  for (const [key, voiceId] of Object.entries(current)) {
    const v = voiceId.trim()
    if (!v) {
      changed = true
      continue
    }
    const canon = (await resolveCanonicalCharacterId(key)) || key.trim()
    if (!canon) {
      changed = true
      continue
    }
    if (canon !== key.trim()) changed = true
    if (!next[canon]) next[canon] = v
  }
  if (changed) writeCharacterVoiceMapToStorage(next)
  return changed ? next : current
}

/** 解析角色绑定的 MiniMax voice_id（兼容别名 / canonical 双向查找） */
export async function lookupBoundVoiceIdForCharacter(characterId: string): Promise<string> {
  const id = characterId.trim()
  if (!id) return ''
  const map = readCharacterVoiceMapFromStorage()
  const direct = map[id]?.trim()
  if (direct) return direct

  const canon = (await resolveCanonicalCharacterId(id)) || id
  if (canon !== id) {
    const viaCanon = map[canon]?.trim()
    if (viaCanon) return viaCanon
  }

  for (const [key, voiceId] of Object.entries(map)) {
    const v = voiceId.trim()
    if (!v) continue
    const keyCanon = (await resolveCanonicalCharacterId(key)) || key.trim()
    if (keyCanon === canon) return v
  }
  return ''
}

export { CHARACTER_VOICE_MAP_LS_KEY }
