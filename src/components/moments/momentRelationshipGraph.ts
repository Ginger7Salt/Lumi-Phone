import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'

import { filterPublishableCharacterContacts } from './momentFeedVisibility'
import type { MomentContactRef } from './newMomentTypes'

export type MomentRelationshipBoundPeer = {
  charId: string
  contactId: string
  displayName: string
}

/** 加载人脉关系边（角色↔角色、玩家身份↔角色） */
export async function loadMomentRelationships(): Promise<Relationship[]> {
  try {
    return await personaDb.listAllRelationships()
  } catch {
    return []
  }
}

/** 两角色之间是否存在双向角色↔角色关系（A 认识 B 且 B 也认识 A） */
export function hasCharacterToCharacterBinding(
  charA: string,
  charB: string,
  rels: ReadonlyArray<Relationship>,
): boolean {
  const a = charA.trim()
  const b = charB.trim()
  if (!a || !b || a === b) return false

  const hasEdge = (from: string, to: string) =>
    rels.some(
      (r) =>
        !r.isPlayerIdentity &&
        r.fromCharacterId.trim() === from &&
        r.toCharacterId.trim() === to,
    )

  return hasEdge(a, b) && hasEdge(b, a)
}

/** 玩家身份与角色是否双向绑定（双方互相认识） */
export function hasPlayerIdentityBinding(
  playerIdentityId: string | undefined | null,
  charId: string,
  rels: ReadonlyArray<Relationship>,
): boolean {
  const pid = playerIdentityId?.trim()
  const cid = charId.trim()
  if (!pid || pid === '__none__' || !cid) return false

  const hasEdge = (from: string, to: string) =>
    rels.some(
      (r) =>
        r.isPlayerIdentity &&
        r.fromCharacterId.trim() === from &&
        r.toCharacterId.trim() === to,
    )

  return hasEdge(pid, cid) && hasEdge(cid, pid)
}

/** 角色是否可与发布者在其朋友圈下互动（须与发布者双向认识） */
export function canCharacterInteractOnPublisherMoment(
  publisherCharId: string,
  interactorCharId: string,
  rels: ReadonlyArray<Relationship>,
): boolean {
  return hasCharacterToCharacterBinding(publisherCharId, interactorCharId, rels)
}

/**
 * 用户视角：是否能看到某角色在该条动态下的互动。
 * - 发布者本人的互动始终可见
 * - 其余角色须与用户（玩家身份）有绑定关系
 */
export function canPlayerSeeCharacterMomentActivity(
  playerIdentityId: string | undefined | null,
  interactorCharId: string,
  publisherCharId: string | undefined,
  rels: ReadonlyArray<Relationship>,
): boolean {
  const iid = interactorCharId.trim()
  if (!iid) return false
  if (publisherCharId?.trim() && iid === publisherCharId.trim()) return true
  if (!playerIdentityId?.trim() || playerIdentityId.trim() === '__none__') return true
  return hasPlayerIdentityBinding(playerIdentityId, iid, rels)
}

/** 评区连锁：回复者能否「看见并回复」被回复评论的作者（无绑定则互不可见） */
export function canCharacterReplyToCommentAuthor(
  replierCharId: string,
  repliedAuthorCharId: string | undefined,
  rels: ReadonlyArray<Relationship>,
): boolean {
  const replier = replierCharId.trim()
  if (!repliedAuthorCharId?.trim()) return true
  const author = repliedAuthorCharId.trim()
  if (replier === author) return false
  return hasCharacterToCharacterBinding(replier, author, rels)
}

/** 与发布者双向绑定的通讯录角色（可参与点赞/评论/评区，不含发布者本人） */
export function resolveRelationshipBoundPeers(
  publisherCharId: string,
  momentContacts: MomentContactRef[],
  rels: ReadonlyArray<Relationship>,
  blockedCharacterIds: Set<string> = new Set(),
): MomentRelationshipBoundPeer[] {
  const publisher = publisherCharId.trim()
  if (!publisher) return []

  return filterPublishableCharacterContacts(momentContacts, blockedCharacterIds)
    .filter((c) => {
      const cid = c.characterId?.trim()
      if (!cid || cid === publisher) return false
      return hasCharacterToCharacterBinding(publisher, cid, rels)
    })
    .map((c) => ({
      charId: c.characterId!.trim(),
      contactId: c.id,
      displayName: c.name.trim() || '未命名',
    }))
}

/** 用户发圈：在隐私名单基础上，仅保留与玩家身份有绑定的角色 */
export function filterPlayerBoundMomentCharacters<
  T extends { charId: string; displayName: string },
>(
  characters: T[],
  playerIdentityId: string | undefined | null,
  rels: ReadonlyArray<Relationship>,
): T[] {
  const pid = playerIdentityId?.trim()
  if (!pid || pid === '__none__') return characters
  return characters.filter((c) => hasPlayerIdentityBinding(pid, c.charId, rels))
}

export function resolveCharIdByDisplayName(
  displayName: string,
  momentContacts: MomentContactRef[],
  getDisplayName: (charId: string) => string,
): string | undefined {
  const name = displayName.trim()
  if (!name) return undefined
  for (const c of momentContacts) {
    const cid = c.characterId?.trim()
    if (!cid) continue
    if (c.name.trim() === name || getDisplayName(cid) === name) return cid
  }
  return undefined
}
