import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'

import type { InteractionNotice, InteractionNoticeState } from './interactionNoticeTypes'

const KV_PREFIX = 'wechat-moments-notices-v1'
const MAX_NOTICES = 300

function kvKey(accountId: string): string {
  return `${KV_PREFIX}:${accountId.trim()}`
}

function normalizeNotice(raw: unknown): InteractionNotice | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const momentId = typeof o.momentId === 'string' ? o.momentId.trim() : ''
  const actorId = typeof o.actorId === 'string' ? o.actorId.trim() : ''
  const type =
    o.type === 'like' || o.type === 'comment' || o.type === 'reply' || o.type === 'mention'
      ? o.type
      : null
  const timestamp =
    typeof o.timestamp === 'number' && Number.isFinite(o.timestamp) ? o.timestamp : Date.now()
  const postThumbnail = typeof o.postThumbnail === 'string' ? o.postThumbnail : ''
  if (!id || !momentId || !actorId || !type) return null

  return {
    id,
    momentId,
    actorId,
    type,
    content: typeof o.content === 'string' ? o.content : undefined,
    timestamp,
    isRead: o.isRead === true,
    postThumbnail,
    replyToName: typeof o.replyToName === 'string' ? o.replyToName : undefined,
    sourceInteractionId:
      typeof o.sourceInteractionId === 'string' ? o.sourceInteractionId : undefined,
  }
}

function normalizeState(raw: unknown): InteractionNoticeState {
  if (!raw || typeof raw !== 'object') {
    return { notices: [], processedInteractionIds: [] }
  }
  const o = raw as Record<string, unknown>
  const notices = Array.isArray(o.notices)
    ? o.notices.map(normalizeNotice).filter((n): n is InteractionNotice => !!n)
    : []
  const processedInteractionIds = Array.isArray(o.processedInteractionIds)
    ? o.processedInteractionIds
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter(Boolean)
    : []
  return { notices, processedInteractionIds }
}

export async function loadInteractionNoticeState(
  accountId: string | null | undefined,
): Promise<InteractionNoticeState> {
  const acc = accountId?.trim()
  if (!acc) return { notices: [], processedInteractionIds: [] }
  try {
    const raw = await personaDb.getPhoneKv(kvKey(acc))
    return normalizeState(raw)
  } catch {
    return { notices: [], processedInteractionIds: [] }
  }
}

export async function saveInteractionNoticeState(
  accountId: string | null | undefined,
  state: InteractionNoticeState,
): Promise<void> {
  const acc = accountId?.trim()
  if (!acc) return
  const trimmedNotices = state.notices
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_NOTICES)
  const trimmedProcessed = state.processedInteractionIds.slice(-2000)
  try {
    await personaDb.setPhoneKv(kvKey(acc), {
      notices: trimmedNotices,
      processedInteractionIds: trimmedProcessed,
    })
  } catch {
    // ignore quota
  }
}
