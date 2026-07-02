import { WeiboFaceByValues } from './pulseWeiboFaceData'

/** 微博方括号表情 token，与 weibo-face 一致 */
const WEIBO_FACE_TOKEN = /\[([\u4e00-\u9fa5a-z0-9_]+?)\]/gi

export type PulseWeiboFacePart =
  | { type: 'text'; value: string }
  | { type: 'face'; name: string; url: string }

/** 解析正文中的 [doge] 等为结构化片段，供 React 渲染 */
export function parsePulseWeiboFaceText(text: string): PulseWeiboFacePart[] {
  if (!text) return []

  const parts: PulseWeiboFacePart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  WEIBO_FACE_TOKEN.lastIndex = 0
  while ((match = WEIBO_FACE_TOKEN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    const name = match[1]!
    const url = WeiboFaceByValues[name as keyof typeof WeiboFaceByValues]
    if (url) {
      parts.push({ type: 'face', name, url })
    } else {
      parts.push({ type: 'text', value: match[0] })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts.length ? parts : [{ type: 'text', value: text }]
}

/** 发布/评论面板常用微博表情（名称 → CDN 由 weibo-face 提供） */
export const PULSE_WEIBO_FACE_PICKER: string[] = [
  'doge',
  '二哈',
  '允悲',
  '吃瓜',
  '打call',
  'awsl',
  '彩虹屁',
  '太开心',
  '嘻嘻',
  '哈哈',
  '笑cry',
  '爱你',
  '亲亲',
  '抱一抱',
  '思考',
  '疑问',
  '费解',
  '晕',
  '裂开',
  '苦涩',
  '酸',
  '泪',
  '可怜',
  '怒',
  '白眼',
  '鄙视',
  '打脸',
  '顶',
  '求饶',
  '喵喵',
  '单身狗',
  '揣手',
  '666',
  '哇',
  '并不简单',
  '笑而不语',
  '偷笑',
  '坏笑',
  '污',
  '憧憬',
  '舔屏',
  '感冒',
  '生病',
  '拜拜',
  '困',
  '睡',
  '钱',
  '互粉',
]

export function getWeiboFaceUrl(name: string): string | undefined {
  return WeiboFaceByValues[name as keyof typeof WeiboFaceByValues]
}
