import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'

import type { MomentComment, MomentItemModel } from './mockMoments'
import { getUnlockedInteractions } from './momentInteractionTypes'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import type { MomentContactRef } from './newMomentTypes'
import {
  canCharacterInteractOnPublisherMoment,
  hasCharacterToCharacterBinding,
  resolveRelationshipBoundPeers,
} from './momentRelationshipGraph'
import type { ThreadReplyDraft } from './momentCommentThreadReplyAi'

export type CommentCatalogEntry = {
  id: string
  author: string
  authorCharId?: string
  content: string
  replyTo?: string
}

export type ThreadParticipant = {
  charId: string
  displayName: string
  role: 'publisher' | 'target' | 'commenter' | 'mutual'
}

export function resolveMomentCharacterIdByDisplayName(
  displayName: string,
  moment: MomentItemModel,
  contactDirectory: MomentsContactDirectory,
  momentContacts: MomentContactRef[],
): string | undefined {
  const name = displayName.trim()
  if (!name) return undefined

  const publisherId = moment.authorCharacterId?.trim()
  if (publisherId && contactDirectory.getDisplayName(publisherId) === name) {
    return publisherId
  }
  if (publisherId && moment.authorName.trim() === name) {
    return publisherId
  }

  for (const c of momentContacts) {
    const cid = c.characterId?.trim()
    if (!cid) continue
    if (c.name.trim() === name || contactDirectory.getDisplayName(cid) === name) {
      return cid
    }
  }

  for (const ix of moment.interactions ?? []) {
    if (ix.type !== 'comment') continue
    if (contactDirectory.getDisplayName(ix.charId) === name) return ix.charId
  }

  for (const c of moment.comments ?? []) {
    if (c.authorCharacterId && c.author.trim() === name) return c.authorCharacterId
  }

  return undefined
}

export function isUserReplyToPublisher(
  comment: MomentComment,
  publisherDisplayName: string,
): boolean {
  const replyTo = comment.replyTo?.trim()
  if (!replyTo) return true
  return replyTo === publisherDisplayName.trim()
}

export function buildMomentCommentCatalog(
  moment: MomentItemModel,
  contactDirectory: MomentsContactDirectory,
  now: number,
): CommentCatalogEntry[] {
  const catalog: CommentCatalogEntry[] = []
  const seen = new Set<string>()

  for (const ix of getUnlockedInteractions(moment.interactions, now)) {
    if (ix.type !== 'comment' || !ix.content?.trim()) continue
    catalog.push({
      id: ix.id,
      author: contactDirectory.getDisplayName(ix.charId),
      authorCharId: ix.charId,
      content: ix.content.trim(),
      replyTo: ix.replyToCharId
        ? contactDirectory.getDisplayName(ix.replyToCharId)
        : undefined,
    })
    seen.add(ix.id)
  }

  for (const c of moment.comments ?? []) {
    if (seen.has(c.id) || c.isAuthorReply) continue
    catalog.push({
      id: c.id,
      author: c.author,
      authorCharId: c.authorCharacterId,
      content: c.content,
      replyTo: c.replyTo,
    })
    seen.add(c.id)
  }

  return catalog
}

export function buildThreadParticipants(params: {
  moment: MomentItemModel
  publisherCharId: string
  targetCharId: string
  playerIdentityId?: string | null
  contactDirectory: MomentsContactDirectory
  momentContacts: MomentContactRef[]
  blockedCharacterIds: Set<string>
  relationships: ReadonlyArray<Relationship>
  now: number
}): ThreadParticipant[] {
  const byId = new Map<string, ThreadParticipant>()
  const rels = params.relationships
  const publisher = params.publisherCharId.trim()
  const target = params.targetCharId.trim()

  const add = (charId: string, role: ThreadParticipant['role']) => {
    const id = charId.trim()
    if (!id) return
    if (id !== publisher && !canCharacterInteractOnPublisherMoment(publisher, id, rels)) {
      return
    }
    const existing = byId.get(id)
    if (existing) {
      if (role === 'target' || (role === 'publisher' && existing.role !== 'target')) {
        byId.set(id, { ...existing, role })
      }
      return
    }
    byId.set(id, {
      charId: id,
      displayName: params.contactDirectory.getDisplayName(id),
      role,
    })
  }

  add(publisher, 'publisher')
  add(target, 'target')

  for (const ix of getUnlockedInteractions(params.moment.interactions, params.now)) {
    if (ix.type !== 'comment') continue
    add(ix.charId, 'commenter')
  }

  for (const c of params.moment.comments ?? []) {
    if (c.isAuthorReply || !c.authorCharacterId) continue
    add(c.authorCharacterId, 'commenter')
  }

  for (const peer of resolveRelationshipBoundPeers(
    publisher,
    params.momentContacts,
    rels,
    params.blockedCharacterIds,
  )) {
    add(peer.charId, 'mutual')
  }

  return [...byId.values()]
}

export function filterThreadRepliesByRelationshipBinding(
  drafts: ThreadReplyDraft[],
  catalog: CommentCatalogEntry[],
  rels: ReadonlyArray<Relationship>,
): ThreadReplyDraft[] {
  const authorByCommentId = new Map(catalog.map((c) => [c.id, c.authorCharId]))

  return drafts.filter((draft) => {
    const repliedAuthorCharId = authorByCommentId.get(draft.replyToCommentId)
    if (!repliedAuthorCharId) return true
    return hasCharacterToCharacterBinding(draft.authorCharId, repliedAuthorCharId, rels)
  })
}

export function findCommentAuthorName(
  comments: MomentComment[],
  catalog: CommentCatalogEntry[],
  commentId: string,
  contactDirectory: MomentsContactDirectory,
): string {
  const fromStored = comments.find((c) => c.id === commentId)
  if (fromStored) return fromStored.author

  const fromCatalog = catalog.find((c) => c.id === commentId)
  if (fromCatalog) return fromCatalog.author

  return contactDirectory.getDisplayName(commentId) || '对方'
}
