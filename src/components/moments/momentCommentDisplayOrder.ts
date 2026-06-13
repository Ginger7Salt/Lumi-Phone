import type { MomentComment } from './mockMoments'
import type { MomentInteraction } from './momentInteractionTypes'

/** 紧跟在某条评论后的连续角色回复（唤起回应插入的一批） */
export function gatherContiguousRepliesAfter(
  comments: MomentComment[],
  anchorId: string,
): MomentComment[] {
  const anchorIndex = comments.findIndex((c) => c.id === anchorId)
  if (anchorIndex < 0) return []

  const out: MomentComment[] = []
  for (let i = anchorIndex + 1; i < comments.length; i++) {
    const c = comments[i]!
    if (!c.isAuthorReply) break
    out.push(c)
  }
  return out
}

export type MomentCommentDisplayRow = {
  id: string
  sortAt: number
  kind: 'user' | 'ai' | 'stored-author'
  author: string
  content: string
  replyTo?: string
  replyToName?: string
  charId?: string
}

function resolveCommentCreatedAt(
  comment: MomentComment,
  index: number,
  commentById: Map<string, MomentComment>,
): number {
  if (typeof comment.createdAt === 'number' && Number.isFinite(comment.createdAt)) {
    return comment.createdAt
  }
  if (comment.isAuthorReply) {
    const parentId = comment.replyToCommentId?.trim()
    const parent = parentId ? commentById.get(parentId) : undefined
    if (parent) {
      return resolveCommentCreatedAt(parent, index, commentById) + 400
    }
  }
  return index * 1000 + 100
}

type CommentAuthorRef = {
  author: string
  charId?: string
}

function buildCommentAuthorIndex(
  comments: MomentComment[],
  unlockedCommentInteractions: MomentInteraction[],
  resolveAuthorName: (charId: string) => string,
): Map<string, CommentAuthorRef> {
  const byId = new Map<string, CommentAuthorRef>()
  for (const c of comments) {
    byId.set(c.id, {
      author: c.author.trim(),
      charId: c.authorCharacterId,
    })
  }
  for (const ix of unlockedCommentInteractions) {
    if (ix.type !== 'comment') continue
    byId.set(ix.id, {
      author: resolveAuthorName(ix.charId),
      charId: ix.charId,
    })
  }
  return byId
}

function resolveReplyTargetAuthorName(
  replyToCommentId: string | undefined,
  authorById: Map<string, CommentAuthorRef>,
): string | undefined {
  const id = replyToCommentId?.trim()
  if (!id) return undefined
  return authorById.get(id)?.author
}

function inferReplyToPublisherFromPriorRows(
  row: MomentCommentDisplayRow,
  priorRows: MomentCommentDisplayRow[],
  publisherCharId: string,
  resolveAuthorName: (charId: string) => string,
): string | undefined {
  if (!row.charId || row.charId === publisherCharId) return undefined
  const authorName = row.author.trim()
  for (let i = priorRows.length - 1; i >= 0; i--) {
    const prev = priorRows[i]!
    if (prev.charId !== publisherCharId) continue
    if (prev.replyTo?.trim() === authorName) {
      return resolveAuthorName(publisherCharId)
    }
  }
  return undefined
}

/** 评论区统一按时间序在底部平铺展示（含延时解锁的互动） */
export function buildFlatCommentTimeline(params: {
  comments: MomentComment[]
  unlockedCommentInteractions: MomentInteraction[]
  resolveAuthorName: (charId: string) => string
  publisherCharacterId?: string
}): MomentCommentDisplayRow[] {
  const { comments, unlockedCommentInteractions, resolveAuthorName, publisherCharacterId } = params
  const commentById = new Map(comments.map((c) => [c.id, c]))
  const authorById = buildCommentAuthorIndex(comments, unlockedCommentInteractions, resolveAuthorName)
  const rows: MomentCommentDisplayRow[] = []

  comments.forEach((c, index) => {
    const sortAt = resolveCommentCreatedAt(c, index, commentById)
    if (c.isAuthorReply) {
      const replyToName =
        resolveReplyTargetAuthorName(c.replyToCommentId, authorById) ??
        c.replyTo?.trim() ??
        '你'
      rows.push({
        id: c.id,
        sortAt,
        kind: 'stored-author',
        author: c.author,
        content: c.content,
        replyToName,
      })
      return
    }
    rows.push({
      id: c.id,
      sortAt,
      kind: 'user',
      author: c.author,
      content: c.content,
      replyTo: c.replyTo,
    })
  })

  for (const ix of unlockedCommentInteractions) {
    if (ix.type !== 'comment' || !ix.content?.trim()) continue
    let replyToName: string | undefined
    if (ix.replyToCommentId?.trim()) {
      replyToName = resolveReplyTargetAuthorName(ix.replyToCommentId, authorById)
    }
    if (!replyToName && ix.replyToInteractionId?.trim()) {
      const parent = unlockedCommentInteractions.find((row) => row.id === ix.replyToInteractionId)
      if (parent) replyToName = resolveAuthorName(parent.charId)
    }
    if (!replyToName && ix.replyToCharId?.trim()) {
      replyToName = resolveAuthorName(ix.replyToCharId.trim())
    }
    rows.push({
      id: ix.id,
      sortAt: ix.visibleAt,
      kind: 'ai',
      author: resolveAuthorName(ix.charId),
      content: ix.content,
      replyTo: replyToName,
      charId: ix.charId,
    })
  }

  const sorted = rows.sort((a, b) => a.sortAt - b.sortAt || a.id.localeCompare(b.id))
  const publisherId = publisherCharacterId?.trim()
  if (!publisherId) return sorted

  return sorted.map((row, index) => {
    if (row.kind !== 'ai' || row.replyTo?.trim()) return row
    const inferred = inferReplyToPublisherFromPriorRows(
      row,
      sorted.slice(0, index),
      publisherId,
      resolveAuthorName,
    )
    if (!inferred) return row
    return { ...row, replyTo: inferred }
  })
}

export function splitCommentsForDisplay(
  comments: MomentComment[],
  playerName: string,
): {
  nonPlayerComments: MomentComment[]
  playerComments: MomentComment[]
  authorRepliesByCommentId: Map<string, MomentComment[]>
  contiguousRepliesByPlayerId: Map<string, MomentComment[]>
} {
  const player = playerName.trim()
  const nonPlayerComments: MomentComment[] = []
  const playerComments: MomentComment[] = []
  const authorRepliesByCommentId = new Map<string, MomentComment[]>()
  const contiguousRepliesByPlayerId = new Map<string, MomentComment[]>()
  const consumedReplyIds = new Set<string>()

  for (const c of comments) {
    if (player && !c.isAuthorReply && c.author.trim() === player) {
      playerComments.push(c)
      const replies = gatherContiguousRepliesAfter(comments, c.id)
      if (replies.length) {
        contiguousRepliesByPlayerId.set(c.id, replies)
        for (const r of replies) consumedReplyIds.add(r.id)
      }
    }
  }

  for (const c of comments) {
    if (consumedReplyIds.has(c.id)) continue

    if (c.isAuthorReply) {
      const parentId = c.replyToCommentId?.trim()
      if (parentId) {
        const list = authorRepliesByCommentId.get(parentId) ?? []
        list.push(c)
        authorRepliesByCommentId.set(parentId, list)
      } else {
        nonPlayerComments.push(c)
      }
      continue
    }

    if (player && c.author.trim() === player) {
      continue
    }

    nonPlayerComments.push(c)
  }

  return { nonPlayerComments, playerComments, authorRepliesByCommentId, contiguousRepliesByPlayerId }
}

export function getLastPlayerCommentId(
  comments: MomentComment[],
  playerName: string,
): string | null {
  const player = playerName.trim()
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i]!
    if (!c.isAuthorReply && c.author.trim() === player) return c.id
  }
  return null
}
