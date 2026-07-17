import { useCallback, useEffect, useMemo, useState } from 'react'

import { personaDb } from '../wechat/newFriendsPersona/idb'
import { getCharacterLinkedPlayerIdentityIds } from '../wechat/wechatCharacterPlayerIdentity'
import { toCharPovId } from './pulseTypes'
import { parsePulsePovId } from './pulseTypes'

/**
 * 当前玩家身份视角下：绑定/关联了该身份的角色 char: povId 集合
 * （主要角色 + 通讯录中出现的角色一并纳入，便于流过滤与社交种子）
 */
export function usePulseIdentityBoundCharPovIds(
  playerPovId: string | null | undefined,
  contactCharacterIds: readonly string[],
) {
  const [boundCharPovIds, setBoundCharPovIds] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  const identityRawId = useMemo(() => {
    const parsed = playerPovId ? parsePulsePovId(playerPovId) : null
    return parsed?.kind === 'player' ? parsed.rawId : ''
  }, [playerPovId])

  const contactKey = contactCharacterIds.join('\0')

  const refresh = useCallback(async () => {
    if (!identityRawId) {
      setBoundCharPovIds([])
      setHydrated(true)
      return
    }
    const ids = contactCharacterIds.map((id) => id.trim()).filter(Boolean)
    const unique = [...new Set(ids)]
    const found: string[] = []
    await Promise.all(
      unique.map(async (cid) => {
        try {
          const ch = await personaDb.getCharacter(cid)
          if (!ch) return
          if (getCharacterLinkedPlayerIdentityIds(ch).includes(identityRawId)) {
            found.push(toCharPovId(cid))
          }
        } catch {
          /* ignore missing */
        }
      }),
    )
    setBoundCharPovIds(found)
    setHydrated(true)
  }, [contactKey, contactCharacterIds, identityRawId])

  useEffect(() => {
    setHydrated(false)
    void refresh()
  }, [refresh])

  const set = useMemo(() => new Set(boundCharPovIds), [boundCharPovIds])

  return { hydrated, boundCharPovIds, boundCharPovIdSet: set, refresh }
}
