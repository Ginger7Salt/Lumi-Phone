import { resolveWeiboFaceUrl } from './pulseWeiboFace'

export type PublishSyntaxPart =
  | { type: 'text'; value: string }
  | { type: 'hashtag'; value: string; raw: string }
  | { type: 'mention'; value: string; raw: string }
  | { type: 'supertopic'; value: string; raw: string }
  | { type: 'face'; name: string; url: string; raw: string }

type SyntaxHit = { start: number; end: number; part: PublishSyntaxPart }

const FACE_RE = /\[([\u4e00-\u9fa5a-z0-9_]+?)\]/g
/** 成对 #话题内容#（内容可含空格） */
const HASHTAG_PAIRED_RE = /[#＃]([^#＃\n\[\]]{1,40})[#＃]/g
/** #话题 后接空格（输入中 / 开放式话题） */
const HASHTAG_RE = /[#＃]\s*([^#＃\[\]\s\n]{1,32})(?=\s)/g
/** 行尾未打完的话题（如刚输入完尚未加空格） */
const HASHTAG_TAIL_RE = /[#＃]\s*([^#＃\[\]\s\n]{1,32})$/g
/** 表达式艾特优先，其次纯文本昵称 */
const MENTION_RE = /@\{\{(char|player):([^}]+)\}\}|@([^\s@【】\[\]\n#＃\{\}]{1,40})(?=\s|$)/g
const SUPERTOPIC_RE = /【([^】]{1,32})】/g

function collectHits(text: string, re: RegExp, build: (match: RegExpExecArray) => SyntaxHit | null): SyntaxHit[] {
  const hits: SyntaxHit[] = []
  re.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const hit = build(match)
    if (hit) hits.push(hit)
  }
  return hits
}

function mergeHits(hits: SyntaxHit[]): SyntaxHit[] {
  const sorted = [...hits].sort((a, b) => a.start - b.start || b.end - a.end)
  const merged: SyntaxHit[] = []
  for (const hit of sorted) {
    if (merged.some((m) => hit.start < m.end && hit.end > m.start)) continue
    merged.push(hit)
  }
  return merged
}

/** 解析发布编辑器正文：#话题#、@艾特、超话、微博表情 */
export function parsePublishSyntax(text: string): PublishSyntaxPart[] {
  if (!text) return []

  const hits = mergeHits([
    ...collectHits(text, FACE_RE, (m) => {
      const name = m[1]!
      const raw = m[0]
      const face = resolveWeiboFaceUrl(name)
      return {
        start: m.index,
        end: m.index + raw.length,
        part: face
          ? { type: 'face', name: face.name, url: face.url, raw }
          : { type: 'text', value: raw },
      }
    }),
    ...collectHits(text, HASHTAG_PAIRED_RE, (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      part: { type: 'hashtag', value: m[1]!.trim(), raw: m[0] },
    })),
    ...collectHits(text, HASHTAG_RE, (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      part: { type: 'hashtag', value: m[1]!.trim(), raw: m[0] },
    })),
    ...collectHits(text, HASHTAG_TAIL_RE, (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      part: { type: 'hashtag', value: m[1]!.trim(), raw: m[0] },
    })),
    ...collectHits(text, MENTION_RE, (m) => {
      const exprKind = m[1]
      const exprId = m[2]
      const plain = m[3]
      const value =
        exprKind && exprId ? `${exprKind}:${exprId.trim()}` : (plain ?? '').trim()
      return {
        start: m.index,
        end: m.index + m[0].length,
        part: { type: 'mention', value, raw: m[0] },
      }
    }),
    ...collectHits(text, SUPERTOPIC_RE, (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      part: { type: 'supertopic', value: m[1]!.trim(), raw: m[0] },
    })),
  ])

  const parts: PublishSyntaxPart[] = []
  let cursor = 0
  for (const hit of hits) {
    if (hit.start < cursor) continue
    if (hit.start > cursor) {
      parts.push({ type: 'text', value: text.slice(cursor, hit.start) })
    }
    parts.push(hit.part)
    cursor = hit.end
  }
  if (cursor < text.length) {
    parts.push({ type: 'text', value: text.slice(cursor) })
  }

  return parts.length ? parts : [{ type: 'text', value: text }]
}

export const PUBLISH_SYNTAX_COLORS = {
  /** 与 PULSE_COLORS.topicBlue 一致，保证 #话题# 明显发蓝 */
  hashtag: '#507DAF',
  mention: '#D4AF37',
  supertopicBg: 'rgba(28,28,30,0.04)',
  face: '#8E99A4',
  ink: '#1C1C1E',
} as const
