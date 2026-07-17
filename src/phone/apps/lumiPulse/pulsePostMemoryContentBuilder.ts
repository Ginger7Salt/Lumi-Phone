import type { PulseMemoryPayload } from '../wechat/newFriendsPersona/types'
import type { PulseComment, PulsePost } from './pulseTypes'
import { formatPulseCount, pulsePostImageSlots } from './pulseTypes'

export type { PulseMemoryPayload }

export function pulsePostMemoryId(postId: string): string {
  return `pulse-mem-${postId.trim()}`
}

/** 用户微博 → 观众角色记忆稳定 id */
export function userPulseViewerMemoryId(postId: string, viewerCharacterId: string): string {
  return `user-pulse-mem-${postId.trim()}::${viewerCharacterId.trim()}`
}

export function formatPulsePublishedAtAbsolute(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return ''
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}年${m}月${day}日 ${hh}:${mm}`
}

/** 从正文抽取 #话题# */
export function extractPulseHashtagKeywords(content: string): string[] {
  const out: string[] = []
  const re = /#([^#\s]{1,24})#/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) {
    const t = m[1]?.trim()
    if (t && !out.includes(t)) out.push(t)
    if (out.length >= 6) break
  }
  return out
}

function buildCommentsSnapshot(comments: PulseComment[]): string {
  if (!comments.length) return ''
  const byId = new Map(comments.map((c) => [c.id, c]))
  const lines: string[] = []
  const sorted = [...comments].sort((a, b) => a.createdAt - b.createdAt)
  for (const c of sorted) {
    const text = c.content.trim()
    if (!text) continue
    const author = c.authorName.trim() || '网友'
    const parent = c.parentId ? byId.get(c.parentId) : undefined
    if (parent?.authorName?.trim()) {
      lines.push(`${author}回复${parent.authorName.trim()}：${text}`)
    } else {
      lines.push(`${author}评论：${text}`)
    }
    if (lines.length >= 40) break
  }
  return lines.length ? `评论区：\n${lines.join('\n')}` : ''
}

export function buildPulsePostMemoryBodyText(post: PulsePost): string {
  const text = post.content.trim()
  if (text) return text
  const slots = pulsePostImageSlots(post)
  if (slots.length) {
    const desc = slots
      .map((s) => resolvePulseSlotMemoryDescription(s))
      .filter(Boolean)
      .slice(0, 3)
      .join('；')
    return desc ? `（图片微博：${desc}）` : `（图片微博，${slots.length} 张）`
  }
  return '（无文字）'
}

/** 单槽记忆用画面描述：优先中文 description，其次短截生图提示词 */
function resolvePulseSlotMemoryDescription(slot: {
  description?: string
  imagePrompt?: string
}): string {
  const desc = slot.description?.trim() ?? ''
  if (desc) return desc.slice(0, 200)
  const prompt = slot.imagePrompt?.trim() ?? ''
  if (!prompt) return ''
  // 英文 prompt 只取前一小段，避免记忆被 SD tag 刷屏
  return prompt.replace(/\s+/g, ' ').slice(0, 120)
}

/** 写入记忆的配图说明（多行），便于角色知晓自己发了什么图 */
export function buildPulsePostImageDescriptionsForMemory(post: PulsePost): string[] {
  return pulsePostImageSlots(post)
    .map((s) => resolvePulseSlotMemoryDescription(s))
    .filter(Boolean)
    .slice(0, 9)
}

function buildImageDescriptionsSnapshot(descriptions: string[]): string {
  if (!descriptions.length) return ''
  if (descriptions.length === 1) return `配图画面：${descriptions[0]}`
  return `配图画面：\n${descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`
}

/** 写入长期记忆的微博正文块：原文 + 时间 + 热度 + 配图描述 + 评论区 */
export function buildPulsePostMemoryNaturalContent(params: {
  post: PulsePost
  comments: PulseComment[]
  trendingTitle?: string
}): string {
  const { post, comments, trendingTitle } = params
  const body = buildPulsePostMemoryBodyText(post)
  const parts: string[] = [`微博正文：${body}`]

  const publishedLabel = formatPulsePublishedAtAbsolute(post.createdAt)
  if (publishedLabel) parts.push(`发布时间：${publishedLabel}`)

  if (trendingTitle?.trim()) {
    parts.push(`关联话题：#${trendingTitle.trim()}#`)
  }

  if (post.locationLabel?.trim()) {
    parts.push(`位置：${post.locationLabel.trim()}`)
  }

  const imageDescriptions = buildPulsePostImageDescriptionsForMemory(post)
  const imageCount = pulsePostImageSlots(post).length
  if (imageDescriptions.length) {
    parts.push(buildImageDescriptionsSnapshot(imageDescriptions))
  } else if (imageCount > 0) {
    parts.push(`配图：${imageCount} 张（暂无画面描述）`)
  }

  parts.push(
    `热度：点赞 ${formatPulseCount(post.likeCount)} · 转发 ${formatPulseCount(post.repostCount)} · 评论 ${formatPulseCount(
      Math.max(post.commentCount, comments.length),
    )}`,
  )

  const commentBlock = buildCommentsSnapshot(comments)
  if (commentBlock) parts.push(commentBlock)

  return parts.join('\n').slice(0, 3800)
}

export function buildPulsePostMemoryPayload(params: {
  post: PulsePost
  comments: PulseComment[]
  trendingTitle?: string
}): { payload: PulseMemoryPayload; memoryContent: string } {
  const memoryContent = buildPulsePostMemoryNaturalContent(params)
  const snapshot = buildCommentsSnapshot(params.comments)
  const imageDescriptions = buildPulsePostImageDescriptionsForMemory(params.post)
  return {
    memoryContent,
    payload: {
      originalText: buildPulsePostMemoryBodyText(params.post),
      publishedAt: params.post.createdAt,
      imagesCount: pulsePostImageSlots(params.post).length,
      ...(imageDescriptions.length ? { imageDescriptions } : {}),
      likeCount: Math.max(0, params.post.likeCount || 0),
      repostCount: Math.max(0, params.post.repostCount || 0),
      commentCount: Math.max(params.post.commentCount || 0, params.comments.length),
      interactionsSnapshot: snapshot.slice(0, 4000),
      ...(params.post.locationLabel?.trim()
        ? { location: params.post.locationLabel.trim().slice(0, 120) }
        : {}),
      ...(params.trendingTitle?.trim()
        ? { trendingTopic: params.trendingTitle.trim().slice(0, 64) }
        : {}),
    },
  }
}

/** 用户微博观众记忆正文（含剧情时序锚定后的发布时间行） */
export function buildUserPulseViewerMemoryContent(params: {
  post: PulsePost
  comments: PulseComment[]
  playerDisplayName: string
  visibilityLabel: string
  mentionedViewer: boolean
  trendingTitle?: string
  /** 已解析的发布时间行（含剧情锚定说明） */
  publishLines: string[]
}): string {
  const userName = params.playerDisplayName.trim() || '用户'
  const body = buildPulsePostMemoryBodyText(params.post)
  const parts: string[] = [`${userName}的微博：`]

  if (params.visibilityLabel.trim()) {
    parts.push(`可见范围：${params.visibilityLabel.trim()}`)
  }
  if (params.mentionedViewer) {
    parts.push('你在正文中被提醒查看（提到了你）')
  }

  parts.push(`微博正文：${body}`)

  for (const line of params.publishLines) {
    if (line.trim()) parts.push(line.trim())
  }

  if (params.trendingTitle?.trim()) {
    parts.push(`关联话题：#${params.trendingTitle.trim()}#`)
  }
  if (params.post.locationLabel?.trim()) {
    parts.push(`位置：${params.post.locationLabel.trim()}`)
  }

  const imageDescriptions = buildPulsePostImageDescriptionsForMemory(params.post)
  const imageCount = pulsePostImageSlots(params.post).length
  if (imageDescriptions.length) {
    parts.push(buildImageDescriptionsSnapshot(imageDescriptions))
  } else if (imageCount > 0) {
    parts.push(`配图：${imageCount} 张（暂无画面描述）`)
  }

  parts.push(
    `热度：点赞 ${formatPulseCount(params.post.likeCount)} · 转发 ${formatPulseCount(
      params.post.repostCount,
    )} · 评论 ${formatPulseCount(Math.max(params.post.commentCount, params.comments.length))}`,
  )

  const commentBlock = buildCommentsSnapshot(params.comments)
  if (commentBlock) parts.push(commentBlock)

  return parts.join('\n').slice(0, 3800)
}
