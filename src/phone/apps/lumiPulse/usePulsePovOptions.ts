import { useCallback, useEffect, useMemo, useState } from 'react'

import { useCustomization } from '../../CustomizationContext'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { Character } from '../wechat/newFriendsPersona/types'
import { isPersonaRosterMainCharacter } from '../wechat/newFriendsPersona/personaRoster/personaRosterTypes'
import { DEFAULT_WORLD_BACKGROUND_ID } from '../wechat/newFriendsPersona/worldBackgroundConstants'
import { loadAccountsBundle } from '../wechat/wechatAccountPersistence'
import type { PulsePovOption } from './pulseTypes'
import { toCharPovId } from './pulseTypes'

/** 世界选择：仅列出主要角色，每位角色代表一个可进入的世界观 */
export function usePulsePovOptions() {
  const { state } = useCustomization()
  const [mainCharacters, setMainCharacters] = useState<Character[]>([])
  const [worldNameByBgId, setWorldNameByBgId] = useState<Record<string, string>>({})
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const refresh = useCallback(async () => {
    const bundle = await loadAccountsBundle()
    if (!bundle) {
      setCurrentAccountId(null)
      setMainCharacters([])
      setWorldNameByBgId({})
      setHydrated(true)
      return
    }
    const accId = bundle.currentAccountId
    setCurrentAccountId(accId)
    const linkedIds = state.wechatPersonaContacts.map((c) => c.characterId).filter(Boolean)
    const roots = await personaDb.listRootCharactersAccessibleToWechatAccount(accId, linkedIds)
    const mains = roots.filter(isPersonaRosterMainCharacter)
    setMainCharacters(mains)

    const bgIds = [
      ...new Set(
        mains.map((c) => c.worldBackgroundId?.trim() || DEFAULT_WORLD_BACKGROUND_ID),
      ),
    ]
    const nameMap: Record<string, string> = {}
    await Promise.all(
      bgIds.map(async (id) => {
        const wb = await personaDb.getWorldBackground(id)
        nameMap[id] = wb?.name?.trim() || '现代都市'
      }),
    )
    setWorldNameByBgId(nameMap)
    setHydrated(true)
  }, [state.wechatPersonaContacts])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const options = useMemo((): PulsePovOption[] => {
    const rows: PulsePovOption[] = []
    for (const ch of mainCharacters) {
      const id = ch.id.trim()
      if (!id) continue
      const bgId = ch.worldBackgroundId?.trim() || DEFAULT_WORLD_BACKGROUND_ID
      rows.push({
        povId: toCharPovId(id),
        kind: 'char',
        rawId: id,
        label: ch.name?.trim() || '未命名',
        worldName: worldNameByBgId[bgId] ?? '现代都市',
        avatarUrl: ch.avatarUrl?.trim(),
      })
    }
    return rows
  }, [mainCharacters, worldNameByBgId])

  return {
    hydrated,
    currentAccountId,
    options,
    refresh,
  }
}
