import { useEffect, useMemo, useState } from 'react'

import type { WeChatPersonaContact } from '../../../types'
import type { WeChatChatHistoryPayload } from '../newFriendsPersona/types'
import { assignChatHistoryMessageTimestamps } from './assignChatHistoryMessageTimestamps'
import { resolveForwardedMessageTimestamps } from './parseChatHistoryTimeHint'
import { maskChatHistoryForPlayerView } from './maskChatHistoryForPlayerView'
import { maskChatHistoryForRecipient } from './maskChatHistoryForRecipient'

const EMPTY_PERSONA_CONTACTS: readonly WeChatPersonaContact[] = []

function finalizeChatHistoryViewPayload(payload: WeChatChatHistoryPayload): WeChatChatHistoryPayload {
  const anchorMs =
    payload.historyAnchorMs ??
    payload.messages.find((m) => typeof m.timestamp === 'number')?.timestamp ??
    Date.now()
  const resolved = resolveForwardedMessageTimestamps(
    payload.messages,
    anchorMs,
    payload.occurredAtHint,
  )
  return {
    ...payload,
    historyAnchorMs: anchorMs,
    messages: assignChatHistoryMessageTimestamps(resolved, anchorMs, {
      historyWhenHint: payload.occurredAtHint,
      titleHint: payload.title,
    }),
  }
}

function personaContactsKey(contacts?: readonly WeChatPersonaContact[]): string {
  if (!contacts?.length) return ''
  return contacts.map((c) => `${c.characterId}:${c.remarkName}`).join('|')
}

function chatHistoryDataKey(payload: WeChatChatHistoryPayload): string {
  return [
    payload.title,
    payload.occurredAtHint ?? '',
    payload.historyAnchorMs ?? '',
    payload.messages.length,
    ...payload.messages.map((m) => `${m.senderName}|${m.content}|${m.timestamp ?? ''}`),
  ].join('\x1e')
}

export function useChatHistoryMaskedView(
  data: WeChatChatHistoryPayload,
  options?: {
    recipientCharacterId?: string
    userDisplayName?: string
    personaContacts?: readonly WeChatPersonaContact[]
    cardSenderCharacterId?: string
  },
): WeChatChatHistoryPayload {
  const cardSenderId = options?.cardSenderCharacterId?.trim() || ''
  const rid = options?.recipientCharacterId?.trim() || ''
  const userDisplayName = options?.userDisplayName?.trim() || '我'
  const personaContacts = options?.personaContacts ?? EMPTY_PERSONA_CONTACTS
  const contactsKey = personaContactsKey(personaContacts)
  const dataKey = chatHistoryDataKey(data)
  const needsAsyncMask = Boolean((cardSenderId && !rid) || rid)

  const syncMasked = useMemo(
    () => finalizeChatHistoryViewPayload(data),
    [dataKey],
  )

  const [asyncMasked, setAsyncMasked] = useState<WeChatChatHistoryPayload | null>(null)

  useEffect(() => {
    if (!needsAsyncMask) {
      setAsyncMasked((prev) => (prev === null ? prev : null))
      return
    }

    let cancelled = false

    void (async () => {
      const next = cardSenderId && !rid
        ? await maskChatHistoryForPlayerView({
            payload: data,
            cardSenderCharacterId: cardSenderId,
            personaContacts,
          })
        : await maskChatHistoryForRecipient({
            payload: data,
            recipientCharacterId: rid,
            userDisplayName,
            personaContacts,
            cardSenderCharacterId: options?.cardSenderCharacterId,
          })
      if (cancelled) return
      setAsyncMasked(finalizeChatHistoryViewPayload(next))
    })()

    return () => {
      cancelled = true
    }
  }, [
    cardSenderId,
    contactsKey,
    dataKey,
    needsAsyncMask,
    options?.cardSenderCharacterId,
    rid,
    userDisplayName,
  ])

  return needsAsyncMask ? (asyncMasked ?? syncMasked) : syncMasked
}
