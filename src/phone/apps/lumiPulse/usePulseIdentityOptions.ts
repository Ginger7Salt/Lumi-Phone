import { useCallback, useEffect, useMemo, useState } from 'react'

import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { PlayerIdentity } from '../wechat/newFriendsPersona/types'
import {
  formatPlayerIdentityDisplayName,
  isWechatAccountSessionSlotIdentityId,
} from '../wechat/wechatCharacterPlayerIdentity'
import { loadAccountsBundle } from '../wechat/wechatAccountPersistence'
import { toPlayerPovId, type PulsePovId } from './pulseTypes'

export type PulseIdentityOption = {
  povId: PulsePovId
  rawId: string
  label: string
  avatarUrl?: string
  subtitle?: string
}

/** 微博进场用：当前微信马甲下可选的玩家身份视角（排除账号槽位） */
export function usePulseIdentityOptions() {
  const [options, setOptions] = useState<PulseIdentityOption[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const bundle = await loadAccountsBundle()
    if (!bundle) {
      setCurrentAccountId(null)
      setOptions([])
      setHydrated(true)
      return
    }
    const accId = bundle.currentAccountId
    setCurrentAccountId(accId)
    const rows = await personaDb.listPlayerIdentities(accId)
    const next: PulseIdentityOption[] = []
    for (const row of rows as PlayerIdentity[]) {
      const id = row.id?.trim()
      if (!id || isWechatAccountSessionSlotIdentityId(id)) continue
      next.push({
        povId: toPlayerPovId(id),
        rawId: id,
        label: formatPlayerIdentityDisplayName(row, id),
        avatarUrl: row.avatarUrl?.trim() || undefined,
        subtitle: row.identity?.trim() || row.mbti?.trim() || undefined,
      })
    }
    setOptions(next)
    setHydrated(true)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return useMemo(
    () => ({
      hydrated,
      currentAccountId,
      options,
      refresh,
    }),
    [currentAccountId, hydrated, options, refresh],
  )
}
