import { WeiboFaceByValues } from './pulseWeiboFaceData'

/** 微博方括号表情 token，与 weibo-face 一致 */
const WEIBO_FACE_TOKEN = /\[([\u4e00-\u9fa5a-z0-9_]+?)\]/gi

/**
 * 常见口语/模型别名 → 词库正式名。
 * 例：AI 常写 [流泪]，微博官方是 [泪]；常写 [叹气]，词库无此正式名。
 */
export const WEIBO_FACE_ALIASES: Record<string, string> = {
  流泪: '泪',
  哭: '泪',
  大哭: '泪',
  哭哭: '泪',
  伤心: '悲伤',
  难过: '悲伤',
  叹气: '失望',
  唉声叹气: '失望',
  无奈: '允悲',
  唉: '失望',
  失落: '失望',
  郁闷: '失望',
  大笑: '哈哈',
  开心: '太开心',
  狗头: 'doge',
  狗: 'doge',
  捂脸: '笑cry',
  捂脸哭: '笑cry',
  无语: '黑线',
  尴尬: '汗',
  尬笑: '汗',
  怒了: '怒',
  生气: '怒',
  嘿嘿: '嘻嘻',
  呵呵: '微笑',
  爱心: '爱你',
}

export type PulseWeiboFacePart =
  | { type: 'text'; value: string }
  | { type: 'face'; name: string; url: string }

/** 解析表情名（含别名）→ CDN；找不到则 undefined */
export function resolveWeiboFaceUrl(rawName: string): { name: string; url: string } | undefined {
  const key = rawName.trim()
  if (!key) return undefined
  const canonical = WEIBO_FACE_ALIASES[key] ?? key
  const url =
    WeiboFaceByValues[canonical as keyof typeof WeiboFaceByValues] ??
    WeiboFaceByValues[key as keyof typeof WeiboFaceByValues]
  if (!url) return undefined
  return { name: canonical, url }
}

/** 解析正文中的 [doge] 等为结构化片段，供 React 渲染 */
export function parsePulseWeiboFaceText(text: string): PulseWeiboFacePart[] {
  if (!text) return []

  const normalized = String(text)
    .replace(/\uFF3B/g, '[')
    .replace(/\uFF3D/g, ']')

  const parts: PulseWeiboFacePart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  const token = new RegExp(WEIBO_FACE_TOKEN.source, WEIBO_FACE_TOKEN.flags)
  while ((match = token.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: normalized.slice(lastIndex, match.index) })
    }
    const face = resolveWeiboFaceUrl(match[1]!)
    if (face) {
      parts.push({ type: 'face', name: face.name, url: face.url })
    } else {
      parts.push({ type: 'text', value: match[0] })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < normalized.length) {
    parts.push({ type: 'text', value: normalized.slice(lastIndex) })
  }

  return parts.length ? parts : [{ type: 'text', value: normalized }]
}

/** 去掉微博方括号表情码（如 [二哈][doge]） */
export function stripPulseWeiboFaceCodes(text: string): string {
  if (!text) return ''
  WEIBO_FACE_TOKEN.lastIndex = 0
  return text.replace(WEIBO_FACE_TOKEN, '')
}

/**
 * 个性签名 / 简介：纯文字，不含表情码与 Unicode emoji。
 */
export function sanitizePulseProfileSignature(text: string): string {
  return stripPulseWeiboFaceCodes(String(text ?? ''))
    .replace(/\uFE0F/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
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
  return resolveWeiboFaceUrl(name)?.url
}
