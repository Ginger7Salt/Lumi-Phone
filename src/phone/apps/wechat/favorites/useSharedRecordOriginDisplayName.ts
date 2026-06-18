import { useEffect, useState } from 'react'

import type { WeChatPersonaContact } from '../../../types'
import type { WeChatSharedRecordPayload } from '../newFriendsPersona/types'
import { resolveSharedRecordOriginUserDisplayName } from './sharedRecordOriginNames'

export function useSharedRecordOriginDisplayName(
  data: WeChatSharedRecordPayload,
  options?: {
    personaContacts?: readonly WeChatPersonaContact[]
    playerDisplayName?: string
  },
): string {
  const fallback = data.originalSenderName.trim() || '未知来源'
  const [name, setName] = useState(fallback)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const resolved = await resolveSharedRecordOriginUserDisplayName({
        payload: data,
        personaContacts: options?.personaContacts ?? [],
        playerDisplayName: options?.playerDisplayName,
      })
      if (!cancelled) setName(resolved.trim() || fallback)
    })()
    return () => {
      cancelled = true
    }
  }, [data, fallback, options?.personaContacts, options?.playerDisplayName])

  return name
}
