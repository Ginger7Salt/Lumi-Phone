import { personaDb } from '../newFriendsPersona/idb'
import type { FavoriteItem } from './favoriteItemTypes'
import { mapFavoriteToItem } from './mapFavoriteToItem'
import { resolveFavoriteVoiceAudioUrl } from './resolveFavoriteVoiceAudio'
import { SHARED_RECORD_PLAYER_ORIGIN_ID } from './sharedRecordOrigin'
import { resolveCanonicalCharacterId } from '../wechatGlobalCharacterRegistry'

async function ensureCharacterDisplayMaps(
  characterId: string,
  nameByCharId: Map<string, string>,
  avatarByCharId: Map<string, string>,
): Promise<void> {
  const raw = characterId.trim()
  if (!raw || raw === SHARED_RECORD_PLAYER_ORIGIN_ID) return
  const canon = (await resolveCanonicalCharacterId(raw)) || raw
  for (const id of new Set([raw, canon])) {
    if (!id || nameByCharId.has(id)) continue
    try {
      const ch = await personaDb.getCharacter(id)
      nameByCharId.set(id, ch?.name?.trim() || '未命名')
      const avatar = ch?.avatarUrl?.trim()
      if (avatar) avatarByCharId.set(id, avatar)
    } catch {
      nameByCharId.set(id, '未命名')
    }
  }
}

/** 从 IndexedDB 加载收藏列表（来源名优先用通讯录微信备注，否则回退人设姓名）。 */
export async function loadFavoriteItems(nameByCharIdOverride?: Map<string, string>): Promise<FavoriteItem[]> {
  const favs = await personaDb.listFavorites()
  const nameByCharId = new Map(nameByCharIdOverride ?? [])
  const avatarByCharId = new Map<string, string>()
  const mapped: FavoriteItem[] = []

  for (const fav of favs) {
    const msg = await personaDb.getWeChatChatMessageById(fav.messageId)
    const isPlayerMessage = msg?.type === 'player'
    const sourceId = isPlayerMessage
      ? SHARED_RECORD_PLAYER_ORIGIN_ID
      : (msg?.characterId?.trim() || fav.characterId.trim())
    if (!isPlayerMessage && sourceId) {
      await ensureCharacterDisplayMaps(sourceId, nameByCharId, avatarByCharId)
    }
    const item = mapFavoriteToItem(fav, msg, nameByCharId, avatarByCharId)
    if (item.type === 'voice' && !item.audioUrl?.trim()) {
      const resolved = await resolveFavoriteVoiceAudioUrl(fav, msg?.voice?.audioUrl)
      if (resolved) mapped.push({ ...item, audioUrl: resolved })
      else mapped.push(item)
    } else {
      mapped.push(item)
    }
  }

  return mapped
}
