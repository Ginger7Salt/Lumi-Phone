import type { MomentComment, MomentItemModel } from './mockMoments'
import type { MomentInteraction } from './momentInteractionTypes'
import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'
import { getUnlockedInteractions } from './momentInteractionTypes'
import { formatMomentLocationDisplay } from './momentLocationUtils'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import { hasCharacterToCharacterBinding } from './momentRelationshipGraph'
import { sanitizeMomentBodyText, sanitizeMomentText } from './momentTextSanitize'
import { buildMomentContentForAi } from './momentAttachedMusic'
import { formatMomentPublishedAtAbsolute } from './utils/timeFormat'
import type { MomentMemoryPayload } from '../../phone/apps/wechat/newFriendsPersona/types'

export type MomentInteractionArchiveRow = {
  kind: 'like' | 'comment' | 'viewed' | 'user_comment' | 'stored_comment'
  authorName: string
  content?: string
  replyToName?: string
  isAuthorReply?: boolean
}

export function collectMomentInteractionRows(params: {
  moment: MomentItemModel
  now: number
  contactDirectory: MomentsContactDirectory
  playerDisplayName: string
  publisherCharacterId: string
  publisherDisplayName: string
}): MomentInteractionArchiveRow[] {
  const rows: MomentInteractionArchiveRow[] = []
  const unlocked = getUnlockedInteractions(params.moment.interactions, params.now)
  const publisherId = params.publisherCharacterId.trim()

  for (const ix of unlocked) {
    if (ix.type === 'like') {
      rows.push({
        kind: 'like',
        authorName: params.contactDirectory.getDisplayName(ix.charId),
      })
      continue
    }
    if (ix.type === 'viewed') continue
    if (ix.type === 'comment') {
      const content = sanitizeMomentText(ix.content)
      if (!content) continue
      const isPublisherSelfComment = ix.isPublisherSelfComment === true
      const isAuthorReply =
        !isPublisherSelfComment &&
        (ix.isAuthorReply === true ||
          (ix.charId.trim() === publisherId &&
            !!(ix.replyToCharId?.trim() || ix.replyToInteractionId?.trim() || ix.replyToCommentId?.trim())))
      const authorName = isAuthorReply || isPublisherSelfComment
        ? params.publisherDisplayName
        : params.contactDirectory.getDisplayName(ix.charId)
      let replyToName: string | undefined
      if (ix.replyToCharId?.trim()) {
        replyToName = params.contactDirectory.getDisplayName(ix.replyToCharId)
      } else if (ix.replyToInteractionId) {
        const parent = unlocked.find((u) => u.id === ix.replyToInteractionId)
        if (parent) replyToName = params.contactDirectory.getDisplayName(parent.charId)
      }
      rows.push({
        kind: 'comment',
        authorName,
        content,
        replyToName,
        isAuthorReply,
      })
    }
  }

  for (const c of params.moment.comments ?? []) {
    appendStoredCommentRow(rows, c, params.playerDisplayName, params.publisherDisplayName)
  }

  const legacyLikes = params.moment.likes ?? []
  const playerName = params.playerDisplayName.trim()
  for (const name of legacyLikes) {
    const trimmed = name.trim()
    if (!trimmed) continue
    const likeName =
      playerName && (trimmed === playerName || trimmed === '我') ? playerName : trimmed
    if (rows.some((r) => r.kind === 'like' && r.authorName === likeName)) continue
    rows.push({ kind: 'like', authorName: likeName })
  }

  return rows
}

function appendStoredCommentRow(
  rows: MomentInteractionArchiveRow[],
  comment: MomentComment,
  playerDisplayName: string,
  publisherDisplayName: string,
): void {
  const content = sanitizeMomentText(comment.content)
  if (!content) return
  const rawAuthor = comment.author.trim() || '未知'
  const authorName =
    !comment.isAuthorReply &&
    playerDisplayName.trim() &&
    (rawAuthor === playerDisplayName.trim() || rawAuthor === '我')
      ? playerDisplayName.trim()
      : rawAuthor
  rows.push({
    kind: comment.isAuthorReply ? 'stored_comment' : 'user_comment',
    authorName: comment.isAuthorReply ? publisherDisplayName : authorName,
    content,
    replyToName: comment.replyTo?.trim() || undefined,
    isAuthorReply: comment.isAuthorReply,
  })
}

/** 评论区原始植入格式（不经模型改写） */
export function buildMomentInteractionsSnapshot(rows: MomentInteractionArchiveRow[]): string {
  const lines: string[] = []
  const likes = rows.filter((r) => r.kind === 'like')
  const comments = rows.filter(
    (r) => r.kind === 'comment' || r.kind === 'user_comment' || r.kind === 'stored_comment',
  )

  if (likes.length) {
    lines.push(`点赞栏：${likes.map((r) => r.authorName).join('/')}`)
  }

  for (const row of comments) {
    if (!row.content?.trim()) continue
    if (row.replyToName?.trim()) {
      lines.push(`${row.authorName}回复${row.replyToName}：${row.content}`)
    } else {
      lines.push(`${row.authorName}评论：${row.content}`)
    }
  }

  return lines.length ? lines.join('\n') : ''
}

/** 写入长期记忆的朋友圈正文：分享歌曲时附带与一起听同格式的歌名/歌手/歌词节选 */
export function buildMomentMemoryBodyText(moment: MomentItemModel): string {
  const withMusic = buildMomentContentForAi({
    content: moment.content,
    attachedMusic: moment.attachedMusic,
  }).trim()
  if (withMusic) return withMusic
  const text = sanitizeMomentBodyText(moment.content).trim()
  if (text) return text
  const imageCount = moment.images?.length ?? 0
  if (imageCount > 0) return `（图片动态，${imageCount} 张）`
  return '（无文字）'
}

export function buildMomentMemoryNaturalContent(params: {
  moment: MomentItemModel
  publisherDisplayName: string
  rows: MomentInteractionArchiveRow[]
  locationLabel: string
  /** 覆盖默认墙钟「发布时间」行（剧情锚定用） */
  publishLines?: string[]
}): string {
  const body = buildMomentMemoryBodyText(params.moment)
  const parts: string[] = [`朋友圈正文：${body}`]

  if (params.publishLines?.length) {
    for (const line of params.publishLines) {
      const t = line.trim()
      if (t) parts.push(t)
    }
  } else {
    const publishedLabel = formatMomentPublishedAtAbsolute(params.moment.timestamp)
    if (publishedLabel) {
      parts.push(`发布时间：${publishedLabel}`)
    }
  }

  if (params.locationLabel) {
    parts.push(`位置：${params.locationLabel}`)
  }

  const interactionBlock = buildMomentInteractionsSnapshot(params.rows)
  if (interactionBlock) {
    parts.push(interactionBlock)
  }

  return parts.join('\n').slice(0, 3800)
}

export function buildMomentMemoryPayload(params: {
  moment: MomentItemModel
  now: number
  contactDirectory: MomentsContactDirectory
  playerDisplayName: string
  publisherCharacterId: string
  publisherDisplayName: string
  publishLines?: string[]
  storyPublishLabel?: string
}): {
  payload: MomentMemoryPayload
  memoryContent: string
  interactionRows: MomentInteractionArchiveRow[]
} {
  const locationLabel = formatMomentLocationDisplay(params.moment.location)
  const rows = collectMomentInteractionRows(params)
  const interactionsSnapshot = buildMomentInteractionsSnapshot(rows)
  const memoryContent = buildMomentMemoryNaturalContent({
    moment: params.moment,
    publisherDisplayName: params.publisherDisplayName,
    rows,
    locationLabel,
    publishLines: params.publishLines,
  })

  return {
    interactionRows: rows,
    memoryContent,
    payload: {
      originalText: buildMomentMemoryBodyText(params.moment) || '（图片动态）',
      publishedAt: params.moment.timestamp,
      ...(params.storyPublishLabel?.trim()
        ? { storyPublishLabel: params.storyPublishLabel.trim() }
        : {}),
      systemPublishedAt: params.moment.timestamp,
      imagesCount: params.moment.images?.length ?? 0,
      interactionsSnapshot,
      ...(locationLabel ? { location: locationLabel } : {}),
    },
  }
}

export function momentMemoryIdForMoment(momentId: string): string {
  return `moment-mem-${momentId.trim()}`
}

/** 互动者侧朋友圈记忆稳定 id（与发布者 `moment-mem-{id}` 区分） */
export function momentMemoryIdForMomentInteractor(momentId: string, interactorCharId: string): string {
  return `${momentMemoryIdForMoment(momentId)}::${interactorCharId.trim()}`
}

/** 从已解锁互动与用户评论中收集 NPC 互动者 characterId（不含发布者） */
export function collectMomentInteractorCharIds(
  moment: MomentItemModel,
  now: number,
  publisherCharacterId: string,
): string[] {
  const publisherId = publisherCharacterId.trim()
  if (!publisherId) return []
  const ids = new Set<string>()
  const unlocked = getUnlockedInteractions(moment.interactions ?? [], now)
  for (const ix of unlocked) {
    if (ix.type !== 'like' && ix.type !== 'comment') continue
    const cid = ix.charId.trim()
    if (!cid || cid === publisherId) continue
    ids.add(cid)
  }
  for (const c of moment.comments ?? []) {
    if (c.isAuthorReply) continue
    const cid = c.authorCharacterId?.trim()
    if (cid && cid !== publisherId) ids.add(cid)
  }
  return [...ids]
}

/** 互动者在该条朋友圈下的自身行为摘要 */
export function summarizeInteractorOwnMomentActions(
  moment: MomentItemModel,
  interactorCharId: string,
  now: number,
): string {
  const iid = interactorCharId.trim()
  if (!iid) return '曾在该条朋友圈下互动'
  const parts: string[] = []
  const unlocked = getUnlockedInteractions(moment.interactions ?? [], now)
  if (unlocked.some((ix) => ix.type === 'like' && ix.charId.trim() === iid)) {
    parts.push('点赞')
  }
  for (const ix of unlocked) {
    if (ix.type !== 'comment' || ix.charId.trim() !== iid) continue
    const text = sanitizeMomentText(ix.content)
    if (text) parts.push(`评论「${text}」`)
  }
  for (const c of moment.comments ?? []) {
    if (c.isAuthorReply) continue
    if (c.authorCharacterId?.trim() !== iid) continue
    const text = sanitizeMomentText(c.content)
    if (text) parts.push(`评论「${text}」`)
  }
  return parts.length ? `我的互动：${parts.join('；')}` : '曾在该条朋友圈下互动'
}

export function buildInteractorMomentMemoryNaturalContent(params: {
  moment: MomentItemModel
  publisherDisplayName: string
  interactorCharId: string
  rows: MomentInteractionArchiveRow[]
  locationLabel: string
  now: number
  publishLines?: string[]
}): string {
  const ownSummary = summarizeInteractorOwnMomentActions(
    params.moment,
    params.interactorCharId,
    params.now,
  )
  const base = buildMomentMemoryNaturalContent({
    moment: params.moment,
    publisherDisplayName: params.publisherDisplayName,
    rows: params.rows,
    locationLabel: params.locationLabel,
    publishLines: params.publishLines,
  })
  const publisherLine = `参与互动的朋友圈（发布者：${params.publisherDisplayName.trim() || '未命名'}）`
  return [publisherLine, base, ownSummary].filter(Boolean).join('\n').slice(0, 3800)
}

export function mergeInteractorMomentMemoryKeywords(
  baseKeywords: string[],
  publisherDisplayName: string,
  ownActionSummary: string,
): string[] {
  const out: string[] = []
  const push = (raw: string) => {
    const t = raw.replace(/\s+/g, ' ').trim()
    if (!t || t.length > 16) return
    if (!out.includes(t)) out.push(t)
  }
  for (const kw of baseKeywords) push(kw)
  push(publisherDisplayName)
  const nameParts = publisherDisplayName.replace(/[^\u4e00-\u9fffA-Za-z0-9·]/g, ' ').split(/\s+/).filter(Boolean)
  for (const p of nameParts) {
    if (p.length >= 2) push(p)
  }
  const commentMatch = ownActionSummary.match(/评论「([^」]+)」/g)
  if (commentMatch) {
    for (const m of commentMatch) {
      const inner = m.slice(3, -1).trim()
      if (inner.length >= 2) push(inner.slice(0, 12))
    }
  }
  return out.slice(0, 8)
}

/** 被用户 @ 的角色：根据实际解锁互动生成记忆侧写 */
export function summarizeMentionedCharacterMomentResponse(
  moment: MomentItemModel,
  charId: string,
  now: number,
): string {
  const iid = charId.trim()
  if (!iid) return '用户在朋友圈提到了你。'
  const unlocked = getUnlockedInteractions(moment.interactions ?? [], now)
  const parts: string[] = []
  if (unlocked.some((ix) => ix.type === 'like' && ix.charId.trim() === iid)) {
    parts.push('点赞')
  }
  for (const ix of unlocked) {
    if (ix.type !== 'comment' || ix.charId.trim() !== iid) continue
    const text = sanitizeMomentText(ix.content)
    if (text) parts.push(`评论「${text}」`)
  }
  if (parts.length) return `我的反应：${parts.join('；')}`
  if (unlocked.some((ix) => ix.type === 'viewed' && ix.charId.trim() === iid)) {
    return '你已看到这条动态；根据当时的关系与心情，未留下点赞或评论。'
  }
  return '用户提醒你看这条朋友圈；你尚未刷到或尚未在动态下留下互动。'
}

export function buildUserMomentMentionMemoryContent(params: {
  moment: MomentItemModel
  playerDisplayName: string
  interactorCharId: string
  now: number
}): string {
  const userName = params.playerDisplayName.trim() || '用户'
  const body = buildMomentMemoryBodyText(params.moment)
  const locationLabel = formatMomentLocationDisplay(params.moment.location)
  const response = summarizeMentionedCharacterMomentResponse(
    params.moment,
    params.interactorCharId,
    params.now,
  )
  const lines = [
    `${userName}在朋友圈「提醒你看」提到了你。`,
    `动态：${body.slice(0, 280)}`,
  ]
  if (locationLabel) lines.push(`位置：${locationLabel}`)
  lines.push(response)
  return lines.join('\n').slice(0, 3800)
}

export function userMomentViewerMemoryId(momentId: string, viewerCharId: string): string {
  return `user-moment-mem-${momentId.trim()}::${viewerCharId.trim()}`
}

export function isUserMomentViewerMemoryId(id: string): boolean {
  return id.trim().startsWith('user-moment-mem-')
}

/** 个人朋友圈数据面板：展示该条动态下全部点赞/评论（不做共同好友过滤；使用人设原始姓名） */
export function collectUserMomentInteractionRowsForPanel(params: {
  moment: MomentItemModel
  now: number
  contactDirectory: MomentsContactDirectory
  playerDisplayName: string
}): MomentInteractionArchiveRow[] {
  const rows: MomentInteractionArchiveRow[] = []
  const playerName = params.playerDisplayName.trim() || '用户'
  const unlocked = getUnlockedInteractions(params.moment.interactions, params.now)

  for (const ix of unlocked) {
    if (ix.type === 'viewed') continue
    if (ix.type === 'like') {
      rows.push({
        kind: 'like',
        authorName: resolveInteractionCharName(params.contactDirectory, ix.charId, 'persona'),
      })
      continue
    }
    if (ix.type === 'comment') {
      const content = sanitizeMomentText(ix.content)
      if (!content) continue
      const authorName = resolveInteractionCharName(params.contactDirectory, ix.charId, 'persona')
      let replyToName: string | undefined
      if (ix.replyToCharId?.trim()) {
        replyToName = resolveInteractionCharName(params.contactDirectory, ix.replyToCharId, 'persona')
      } else if (ix.replyToInteractionId) {
        const parent = unlocked.find((u) => u.id === ix.replyToInteractionId)
        if (parent) {
          replyToName = resolveInteractionCharName(params.contactDirectory, parent.charId, 'persona')
        }
      }
      rows.push({
        kind: 'comment',
        authorName,
        content,
        replyToName,
        isAuthorReply: false,
      })
    }
  }

  for (const c of params.moment.comments ?? []) {
    const beforeLen = rows.length
    appendStoredCommentRow(rows, c, playerName, playerName)
    if (!c.authorCharacterId?.trim() || rows.length <= beforeLen) continue
    const row = rows[rows.length - 1]
    if (row) {
      row.authorName = resolveInteractionCharName(params.contactDirectory, c.authorCharacterId, 'persona')
    }
  }

  const legacyLikes = params.moment.likes ?? []
  for (const name of legacyLikes) {
    const trimmed = name.trim()
    if (!trimmed) continue
    const likeName = playerName && (trimmed === playerName || trimmed === '我') ? playerName : trimmed
    if (rows.some((r) => r.kind === 'like' && r.authorName === likeName)) continue
    rows.push({ kind: 'like', authorName: likeName })
  }

  return rows
}

function viewerCanSeeInteractionActor(
  viewerCharacterId: string,
  actorCharId: string | undefined,
  actorName: string,
  playerDisplayName: string,
  relationships: ReadonlyArray<Relationship>,
): boolean {
  const viewerId = viewerCharacterId.trim()
  const cid = actorCharId?.trim()
  const playerName = playerDisplayName.trim()
  if (cid) {
    if (cid === viewerId) return true
    return hasCharacterToCharacterBinding(viewerId, cid, relationships)
  }
  if (playerName && (actorName.trim() === playerName || actorName.trim() === '我')) return true
  return false
}

function resolveInteractionCharName(
  contactDirectory: MomentsContactDirectory,
  charId: string,
  naming: 'display' | 'persona',
): string {
  const cid = charId.trim()
  if (!cid) return '未命名'
  return naming === 'persona'
    ? contactDirectory.getPersonaName(cid)
    : contactDirectory.getDisplayName(cid)
}

function viewerCanSeeInteractionReplyTarget(params: {
  viewerCharacterId: string
  replyToCharId?: string
  replyToInteractionId?: string
  unlocked: MomentInteraction[]
  playerDisplayName: string
  relationships: ReadonlyArray<Relationship>
  contactDirectory: MomentsContactDirectory
}): boolean {
  const replyCharId = params.replyToCharId?.trim()
  if (replyCharId) {
    return viewerCanSeeInteractionActor(
      params.viewerCharacterId,
      replyCharId,
      params.contactDirectory.getDisplayName(replyCharId),
      params.playerDisplayName,
      params.relationships,
    )
  }
  const parentId = params.replyToInteractionId?.trim()
  if (!parentId) return true
  const parent = params.unlocked.find((u) => u.id === parentId)
  if (!parent) return true
  return viewerCanSeeInteractionActor(
    params.viewerCharacterId,
    parent.charId,
    params.contactDirectory.getDisplayName(parent.charId),
    params.playerDisplayName,
    params.relationships,
  )
}

function appendStoredCommentRowForViewer(
  rows: MomentInteractionArchiveRow[],
  comment: MomentComment,
  moment: MomentItemModel,
  playerDisplayName: string,
  publisherDisplayName: string,
  viewerCharacterId: string,
  relationships: ReadonlyArray<Relationship>,
  contactDirectory: MomentsContactDirectory,
): void {
  const playerName = playerDisplayName.trim()
  const authorCharId = comment.authorCharacterId?.trim()
  const rawAuthor = comment.author.trim() || '未知'
  const authorNameForCheck =
    authorCharId ? contactDirectory.getDisplayName(authorCharId) : rawAuthor

  if (comment.isAuthorReply) {
    appendStoredCommentRow(rows, comment, playerDisplayName, publisherDisplayName)
    return
  }

  if (
    !viewerCanSeeInteractionActor(
      viewerCharacterId,
      authorCharId,
      authorNameForCheck,
      playerName,
      relationships,
    )
  ) {
    return
  }

  if (comment.replyToCommentId?.trim()) {
    const parent = (moment.comments ?? []).find((c) => c.id === comment.replyToCommentId?.trim())
    if (parent) {
      const parentCharId = parent.authorCharacterId?.trim()
      const parentAuthor = parent.author.trim() || '未知'
      if (
        !viewerCanSeeInteractionActor(
          viewerCharacterId,
          parentCharId,
          parentCharId ? contactDirectory.getDisplayName(parentCharId) : parentAuthor,
          playerName,
          relationships,
        )
      ) {
        return
      }
    }
  } else if (comment.replyTo?.trim()) {
    const replyTo = comment.replyTo.trim()
    if (
      playerName &&
      replyTo !== playerName &&
      replyTo !== '我' &&
      replyTo !== publisherDisplayName.trim()
    ) {
      const replyCharId = (moment.comments ?? []).find(
        (c) =>
          c.author.trim() === replyTo ||
          (c.authorCharacterId?.trim() &&
            contactDirectory.getDisplayName(c.authorCharacterId.trim()) === replyTo),
      )?.authorCharacterId?.trim()
      if (
        replyCharId &&
        !viewerCanSeeInteractionActor(
          viewerCharacterId,
          replyCharId,
          contactDirectory.getDisplayName(replyCharId),
          playerName,
          relationships,
        )
      ) {
        return
      }
    }
  }

  appendStoredCommentRow(rows, comment, playerDisplayName, publisherDisplayName)
}

/** 观众角色可见的点赞/评论：角色之间须为共同好友；用户本人互动始终可见 */
export function collectUserMomentInteractionRowsForViewer(params: {
  moment: MomentItemModel
  now: number
  contactDirectory: MomentsContactDirectory
  playerDisplayName: string
  viewerCharacterId: string
  relationships: ReadonlyArray<Relationship>
}): MomentInteractionArchiveRow[] {
  const rows: MomentInteractionArchiveRow[] = []
  const playerName = params.playerDisplayName.trim() || '用户'
  const unlocked = getUnlockedInteractions(params.moment.interactions, params.now)

  for (const ix of unlocked) {
    if (ix.type === 'viewed') continue
    if (ix.type === 'like') {
      const authorName = params.contactDirectory.getDisplayName(ix.charId)
      if (!viewerCanSeeInteractionActor(params.viewerCharacterId, ix.charId, authorName, playerName, params.relationships)) {
        continue
      }
      rows.push({ kind: 'like', authorName })
      continue
    }
    if (ix.type === 'comment') {
      if (
        !viewerCanSeeInteractionActor(
          params.viewerCharacterId,
          ix.charId,
          params.contactDirectory.getDisplayName(ix.charId),
          playerName,
          params.relationships,
        )
      ) {
        continue
      }
      if (
        !viewerCanSeeInteractionReplyTarget({
          viewerCharacterId: params.viewerCharacterId,
          replyToCharId: ix.replyToCharId,
          replyToInteractionId: ix.replyToInteractionId,
          unlocked,
          playerDisplayName: playerName,
          relationships: params.relationships,
          contactDirectory: params.contactDirectory,
        })
      ) {
        continue
      }
      const content = sanitizeMomentText(ix.content)
      if (!content) continue
      const authorName = params.contactDirectory.getDisplayName(ix.charId)
      let replyToName: string | undefined
      if (ix.replyToCharId?.trim()) {
        replyToName = params.contactDirectory.getDisplayName(ix.replyToCharId)
      } else if (ix.replyToInteractionId) {
        const parent = unlocked.find((u) => u.id === ix.replyToInteractionId)
        if (parent) replyToName = params.contactDirectory.getDisplayName(parent.charId)
      }
      rows.push({
        kind: 'comment',
        authorName,
        content,
        replyToName,
        isAuthorReply: false,
      })
    }
  }

  for (const c of params.moment.comments ?? []) {
    appendStoredCommentRowForViewer(
      rows,
      c,
      params.moment,
      playerName,
      playerName,
      params.viewerCharacterId,
      params.relationships,
      params.contactDirectory,
    )
  }

  const legacyLikes = params.moment.likes ?? []
  for (const name of legacyLikes) {
    const trimmed = name.trim()
    if (!trimmed) continue
    const likeName = playerName && (trimmed === playerName || trimmed === '我') ? playerName : trimmed
    if (rows.some((r) => r.kind === 'like' && r.authorName === likeName)) continue
    if (!viewerCanSeeInteractionActor(params.viewerCharacterId, undefined, likeName, playerName, params.relationships)) {
      continue
    }
    rows.push({ kind: 'like', authorName: likeName })
  }

  return rows
}

export function buildUserMomentViewerMemoryContent(params: {
  moment: MomentItemModel
  playerDisplayName: string
  rows: MomentInteractionArchiveRow[]
  locationLabel: string
  visibilityLabel: string
  mentionedViewer: boolean
  /** 覆盖默认墙钟「发布时间」行（剧情锚定用） */
  publishLines?: string[]
}): string {
  const userName = params.playerDisplayName.trim() || '用户'
  const body = buildMomentMemoryBodyText(params.moment)
  const parts: string[] = [`${userName}的朋友圈：`]

  if (params.moment.isPinned) {
    parts.push('状态：已置顶')
  }
  if (params.visibilityLabel.trim()) {
    parts.push(`可见范围：${params.visibilityLabel.trim()}`)
  }
  if (params.mentionedViewer) {
    parts.push('你在正文中被提醒查看（提到了你）')
  }

  if (body && body !== '（无文字）') {
    parts.push(`朋友圈正文：${body}`)
  } else if ((params.moment.images?.length ?? 0) > 0) {
    parts.push(`朋友圈正文：（图片动态，${params.moment.images!.length} 张）`)
  } else {
    parts.push('朋友圈正文：（无文字）')
  }

  if (params.publishLines?.length) {
    for (const line of params.publishLines) {
      const t = line.trim()
      if (t) parts.push(t)
    }
  } else {
    const publishedLabel = formatMomentPublishedAtAbsolute(params.moment.timestamp)
    if (publishedLabel) parts.push(`发布时间：${publishedLabel}`)
  }
  if (params.locationLabel) parts.push(`位置：${params.locationLabel}`)

  const interactionBlock = buildMomentInteractionsSnapshot(params.rows)
  if (interactionBlock) parts.push(interactionBlock)

  return parts.join('\n').slice(0, 3800)
}

export function buildUserMomentViewerMemoryPayload(params: {
  moment: MomentItemModel
  now: number
  contactDirectory: MomentsContactDirectory
  playerDisplayName: string
  viewerCharacterId: string
  relationships: ReadonlyArray<Relationship>
  visibilityLabel: string
  mentionedViewer: boolean
  publishLines?: string[]
  storyPublishLabel?: string
}): {
  payload: MomentMemoryPayload
  memoryContent: string
  interactionRows: MomentInteractionArchiveRow[]
} {
  const locationLabel = formatMomentLocationDisplay(params.moment.location) ?? ''
  const rows = collectUserMomentInteractionRowsForViewer(params)
  const interactionsSnapshot = buildMomentInteractionsSnapshot(rows)
  const memoryContent = buildUserMomentViewerMemoryContent({
    moment: params.moment,
    playerDisplayName: params.playerDisplayName,
    rows,
    locationLabel,
    visibilityLabel: params.visibilityLabel,
    mentionedViewer: params.mentionedViewer,
    publishLines: params.publishLines,
  })

  return {
    interactionRows: rows,
    memoryContent,
    payload: {
      originalText: buildMomentMemoryBodyText(params.moment) || '（图片动态）',
      publishedAt: params.moment.timestamp,
      imagesCount: params.moment.images?.length ?? 0,
      interactionsSnapshot,
      publisherDisplayName: params.playerDisplayName.trim() || '用户',
      isPinned: !!params.moment.isPinned,
      visibilityLabel: params.visibilityLabel,
      privacyMode: params.moment.privacy?.mode,
      mentionedViewer: params.mentionedViewer,
      ...(params.storyPublishLabel?.trim()
        ? { storyPublishLabel: params.storyPublishLabel.trim() }
        : {}),
      systemPublishedAt: params.moment.timestamp,
      ...(locationLabel ? { location: locationLabel } : {}),
    },
  }
}
