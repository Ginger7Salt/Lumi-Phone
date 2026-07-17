import type { PulsePostMediaKind, PulseTrendingTag } from './pulseTypes'

export type ParsedTrendingComment = {
  authorName: string
  content: string
  /** 二级评论：被回复的一级评论昵称 */
  parentHint?: string
  likeCount: number
}

export type ParsedTrendingImage = {
  /** 展示用画面描述（生图另走剧情配图链路，不在此存提示词） */
  description: string
}

export type ParsedTrendingPost = {
  authorName: string
  content: string
  likeCount: number
  comments: ParsedTrendingComment[]
  mediaKind: PulsePostMediaKind
  images: ParsedTrendingImage[]
}

export type ParsedTrendingTopic = {
  title: string
  tag?: PulseTrendingTag
  excerpt?: string
  heatLabel?: string
  posts: ParsedTrendingPost[]
}

function normalizeTitle(raw: string): string {
  let t = raw.replace(/^[#＃\s]+|[#＃\s]+$/g, '').trim()
  if (!t) return ''
  if (!t.startsWith('#')) t = `#${t}`
  if (!t.endsWith('#')) t = `${t}#`
  return t.slice(0, 80)
}

function pickTag(raw: string): PulseTrendingTag | undefined {
  const t = raw.trim()
  if (t.includes('爆')) return '爆'
  if (t.includes('热')) return '热'
  if (t.includes('新')) return '新'
  return undefined
}

function parseIntLoose(raw: string | undefined, fallback = 0): number {
  if (!raw) return fallback
  const cleaned = raw.replace(/[,，\s]/g, '')
  const m = cleaned.match(/([\d.]+)\s*(亿|万|w|k)?/i)
  if (!m) {
    const n = Number.parseInt(cleaned.replace(/\D/g, ''), 10)
    return Number.isFinite(n) ? Math.max(0, n) : fallback
  }
  const base = Number.parseFloat(m[1]!)
  if (!Number.isFinite(base)) return fallback
  const unit = (m[2] ?? '').toLowerCase()
  if (unit === '亿') return Math.round(base * 100_000_000)
  if (unit === '万' || unit === 'w') return Math.round(base * 10_000)
  if (unit === 'k') return Math.round(base * 1_000)
  return Math.round(base)
}

function fieldLine(block: string, keys: string[]): string {
  const lines = block.split(/\r?\n/)
  for (const key of keys) {
    const re = new RegExp(`^\\s*${key}\\s*[:：]\\s*(.*)$`, 'i')
    for (const line of lines) {
      const m = re.exec(line)
      if (m) return (m[1] ?? '').trim()
    }
  }
  return ''
}

const POST_OTHER_FIELD_RE =
  /^\s*(?:作者|正文|赞|点赞|昵称|内容|评论|回复|层级|热度标签|标签|摘要|导语|热度|类型|帖型|配图\d*|图片\d*|图文描述|配图|图片|生图\d*|生图提示\d*|生图提示词\d*|生图提示词|生图提示|生图)\s*[:：]/i

function multilineField(block: string, keys: string[]): string {
  const lines = block.split(/\r?\n/)
  const keyRe = new RegExp(`^\\s*(?:${keys.join('|')})\\s*[:：]\\s*(.*)$`, 'i')

  for (let i = 0; i < lines.length; i++) {
    const m = keyRe.exec(lines[i]!)
    if (!m) continue
    const parts: string[] = []
    const first = (m[1] ?? '').trim()
    if (first) parts.push(first)
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]!
      if (/^\s*\[(?:TOPIC|POST|COMMENT)\]/i.test(line)) break
      if (POST_OTHER_FIELD_RE.test(line) && !keyRe.test(line)) break
      parts.push(line)
    }
    return parts.join('\n').trim()
  }
  return ''
}

function parseMediaKind(raw: string): PulsePostMediaKind | undefined {
  const t = raw.trim().toLowerCase()
  if (!t) return undefined
  if (/纯图|仅图|image[_-]?only|pic[_-]?only|^image$/.test(t)) return 'image'
  if (/图文|文字\s*\+\s*图|text[_+&]?image|mixed/.test(t)) return 'text_image'
  if (/纯文|文字|text[_-]?only|^text$/.test(t)) return 'text'
  return undefined
}

function parseImageDescriptions(head: string): string[] {
  const numbered: string[] = []
  for (let i = 1; i <= 9; i++) {
    const line = fieldLine(head, [`配图${i}`, `图片${i}`, `图${i}`, `image${i}`, `img${i}`])
    if (line) {
      // 兼容误写「描述｜提示」：只取展示描述段
      const desc = line.split(/\s*(?:\||｜)\s*/)[0]?.trim() || line
      numbered.push(desc.slice(0, 280))
    }
  }
  if (numbered.length) return numbered.slice(0, 9)

  const block = multilineField(head, ['配图', '图片', '图文描述', 'images', 'imageDescs'])
  if (!block) return []
  const out: string[] = []
  for (const line of block.split(/\r?\n/)) {
    const t = line
      .replace(/^\s*(?:[-*•]|\d+[\.．、:：)]\s*)/, '')
      .trim()
    if (!t) continue
    if (/^(类型|帖型|作者|正文|赞|生图)\s*[:：]/i.test(t)) continue
    const desc = t.split(/\s*(?:\||｜)\s*/)[0]?.trim() || t
    out.push(desc.slice(0, 280))
  }
  return out.slice(0, 9)
}

function resolveMediaKind(
  declared: PulsePostMediaKind | undefined,
  content: string,
  images: ParsedTrendingImage[],
): PulsePostMediaKind {
  if (declared === 'image' || (!content && images.length > 0)) return 'image'
  if (declared === 'text_image' || (content && images.length > 0)) return 'text_image'
  if (declared === 'text') return 'text'
  return images.length > 0 ? 'text_image' : 'text'
}

function parseCommentBlock(raw: string): ParsedTrendingComment | null {
  const authorName =
    fieldLine(raw, ['昵称', '作者', '网友', '用户']) ||
    fieldLine(raw, ['name']) ||
    '网友'
  const parentHint =
    fieldLine(raw, ['回复', '回复给', 'parentHint', '父评']) || undefined
  const content = multilineField(raw, ['内容', '评论', '正文']) || ''
  if (!content.trim()) return null
  const likeCount = Math.min(
    9_999_999,
    Math.max(0, parseIntLoose(fieldLine(raw, ['赞', '点赞', 'like']), 0)),
  )
  return {
    authorName: authorName.slice(0, 24),
    content: content.slice(0, 500),
    parentHint: parentHint?.slice(0, 24) || undefined,
    likeCount,
  }
}

function parsePostBlock(raw: string): ParsedTrendingPost | null {
  const commentParts = raw.split(/\[COMMENT\]/i)
  const head = commentParts[0] ?? ''
  const authorName = fieldLine(head, ['作者', '昵称', '博主']) || '匿名网友'
  const declaredKind = parseMediaKind(fieldLine(head, ['类型', '帖型', '形态', 'kind']))
  const imageDescs = parseImageDescriptions(head)
  const images = imageDescs.map((description) => ({ description }))

  let content = multilineField(head, ['正文', '内容', '文案'])
  if (!content) {
    content = head
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !/^(作者|昵称|博主|赞|点赞|正文|类型|帖型|形态|配图\d*|图片\d*|配图|图片|生图)\s*[:：]/i.test(
            l,
          ),
      )
      .join('\n')
      .trim()
  }

  const mediaKind = resolveMediaKind(declaredKind, content, images)
  if (mediaKind === 'image') {
    content = content.slice(0, 80)
  }
  if (!content && images.length === 0) return null

  const likeRaw = fieldLine(head, ['赞', '点赞', 'like'])
  const likeCount = Math.min(9_999_999, Math.max(0, parseIntLoose(likeRaw, 120 + Math.floor(Math.random() * 800))))

  const comments: ParsedTrendingComment[] = []
  for (let i = 1; i < commentParts.length; i++) {
    const c = parseCommentBlock(commentParts[i] ?? '')
    if (c) comments.push(c)
  }

  const finalKind =
    mediaKind === 'text'
      ? 'text'
      : images.length
        ? mediaKind
        : 'text'

  return {
    authorName: authorName.slice(0, 24),
    content: content.slice(0, 500),
    likeCount,
    comments: comments.slice(0, 24),
    mediaKind: finalKind,
    images: finalKind === 'text' ? [] : images.slice(0, 9),
  }
}

function parseTopicBlock(raw: string): ParsedTrendingTopic | null {
  const postParts = raw.split(/\[POST\]/i)
  const head = postParts[0] ?? ''
  const titleLine =
    fieldLine(head, ['标题', '热搜', 'title']) ||
    head
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.startsWith('#') || l.startsWith('＃')) ||
    ''
  const title = normalizeTitle(titleLine)
  if (!title) return null

  const tag = pickTag(fieldLine(head, ['热度标签', '标签', 'tag']))
  const heatLabel = fieldLine(head, ['热度', 'heat']) || undefined
  const excerpt =
    fieldLine(head, ['摘要', '导语', 'excerpt']) ||
    multilineField(head, ['摘要', '导语']) ||
    undefined

  const posts: ParsedTrendingPost[] = []
  for (let i = 1; i < postParts.length; i++) {
    const p = parsePostBlock(postParts[i] ?? '')
    if (p) posts.push(p)
  }

  return {
    title,
    tag,
    excerpt: excerpt?.slice(0, 120),
    heatLabel: heatLabel?.slice(0, 24),
    posts,
  }
}

/** 解析 AI markup 热搜包 */
export function parseTrendingData(raw: string): ParsedTrendingTopic[] {
  const text = String(raw ?? '')
    .replace(/^```[\w]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  if (!text) return []

  const parts = text.split(/\[TOPIC\]/i)
  const out: ParsedTrendingTopic[] = []
  for (let i = 1; i < parts.length; i++) {
    const t = parseTopicBlock(parts[i] ?? '')
    if (t) out.push(t)
  }
  return out
}

export function inventHeatLabel(rank: number, tag?: PulseTrendingTag): string {
  if (tag === '爆') {
    const n = (2.4 - rank * 0.18).toFixed(1)
    return `${n}亿`
  }
  if (tag === '热') {
    const n = Math.max(120, 980 - rank * 70)
    return `${n}万`
  }
  const n = Math.max(8, 86 - rank * 6)
  return `${n}万`
}
