import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'

/** 日记署名：角色档案中的真实姓名（非微信备注） */
export async function resolveCharacterRealName(
  characterId: string,
  fallback = '角色',
): Promise<string> {
  const cid = characterId.trim()
  if (!cid) return fallback
  try {
    const character = (await personaDb.getCharacter(cid)) as Character | null
    return character?.name?.trim() || fallback
  } catch {
    return fallback
  }
}
