import { useCallback, useEffect, useState } from 'react'

import { personaDb } from './newFriendsPersona/idb'
import type { ChatConversationSettingsRow } from './newFriendsPersona/types'
import {
  buildProactiveMessageCountdownState,
  type ProactiveMessageCountdownState,
} from './proactiveMessageCountdown'
import {
  isProactiveMessageInFlight,
  subscribeProactiveMessageInFlight,
} from './proactivePrivateMessageEngine'

export function useProactiveMessageCountdown(params: {
  conversationKey: string
  enabled: boolean
  isBusyActive: boolean
}): ProactiveMessageCountdownState | null {
  const [settings, setSettings] = useState<ChatConversationSettingsRow | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const conversationKey = params.conversationKey.trim()
  const active = params.enabled && !!conversationKey

  const reload = useCallback(async () => {
    if (!active) {
      setSettings(null)
      return
    }
    const st = await personaDb.getChatConversationSettings(conversationKey)
    setSettings(st)
  }, [active, conversationKey])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!active) return
    const onStorage = () => void reload()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [active, reload])

  useEffect(() => {
    if (!active || !settings?.proactiveMessageEnabled) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active, settings?.proactiveMessageEnabled])

  useEffect(() => {
    if (!active || !settings?.proactiveMessageEnabled) return
    const bump = () => setNow(Date.now())
    return subscribeProactiveMessageInFlight(bump)
  }, [active, settings?.proactiveMessageEnabled])

  if (!active || !settings?.proactiveMessageEnabled) return null

  return buildProactiveMessageCountdownState({
    settings,
    now,
    isBusyActive: params.isBusyActive,
    inFlight: isProactiveMessageInFlight(conversationKey),
    characterExplicitlyBusy: params.isBusyActive,
  })
}
