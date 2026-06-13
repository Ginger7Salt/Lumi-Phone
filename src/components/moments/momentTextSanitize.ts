/**
 * 朋友圈文案清洗：去掉聊天协议占位符，将 [微信表情名] 转为 Unicode emoji。
 * 正文保留换行；评论压成单行。
 */

import { clampMomentBodyText } from './momentContentLimits'

/** 聊天/协议类占位符，朋友圈中不应出现 */
const META_BRACKET =
  /\[(?:图片|点赞|表情包|表情|动画表情|语音|视频|位置|链接|文件|红包|转账|名片|小程序|引用|REDPACKET|TRANSFER|VOICECALL|BUSY|系统|动画表情)\]/gi

const QUOTE_BRACKET = /\[引用:[^\]]*\]/gi
const STICKER_LINE = /^\[表情包\].*$/gm
const IMAGE_SENT_HINT = /[（(]?(?:发送|发来)了(?:一张)?图片[）)]?/g
const SPEAKER_TAG = /<<SPEAKER:[^>]+>>/gi

/** 常见微信方括号表情名 → Unicode */
const WECHAT_EMOJI_MAP: Record<string, string> = {
  微笑: '🙂',
  撇嘴: '😒',
  色: '😍',
  发呆: '😳',
  得意: '😏',
  流泪: '😢',
  害羞: '☺️',
  闭嘴: '🤐',
  睡: '😴',
  大哭: '😭',
  尴尬: '😅',
  发怒: '😠',
  调皮: '😜',
  龇牙: '😁',
  惊讶: '😮',
  难过: '😞',
  酷: '😎',
  冷汗: '😰',
  抓狂: '😫',
  吐: '🤮',
  偷笑: '🤭',
  可爱: '🥺',
  白眼: '🙄',
  傲慢: '😤',
  困: '😪',
  惊恐: '😱',
  流汗: '😅',
  憨笑: '😄',
  咒骂: '🤬',
  疑问: '❓',
  嘘: '🤫',
  晕: '😵',
  衰: '😖',
  敲打: '😤',
  再见: '👋',
  擦汗: '😓',
  抠鼻: '🤏',
  鼓掌: '👏',
  坏笑: '😏',
  哈欠: '🥱',
  鄙视: '😒',
  委屈: '🥺',
  快哭了: '🥹',
  阴险: '😈',
  亲亲: '😘',
  吓: '😨',
  可怜: '🥺',
  玫瑰: '🌹',
  爱心: '❤️',
  心碎: '💔',
  蛋糕: '🎂',
  礼物: '🎁',
  太阳: '☀️',
  月亮: '🌙',
  强: '👍',
  弱: '👎',
  握手: '🤝',
  胜利: '✌️',
  抱拳: '🙏',
  拳头: '👊',
  OK: '👌',
  跳跳: '🦘',
  发抖: '🥶',
  怄火: '😤',
  转圈: '🌀',
  挥手: '👋',
  激动: '🤩',
  裂开: '🫠',
  苦涩: '😣',
  让我看看: '👀',
  叹气: '😮‍💨',
  无语: '😑',
  捂脸: '🤦',
  吃瓜: '🍉',
  旺柴: '🐶',
  好的: '👌',
  打脸: '🤦',
  哇: '😲',
  翻白眼: '🙄',
  666: '👍',
  让我缓缓: '😮‍💨',
  合十: '🙏',
}

export const MOMENT_TEXT_OUTPUT_HINT = `
朋友圈正文与评论须为自然中文口语，像真人发圈/评圈：
- 正文可换行，但禁止微信聊天协议占位符：[图片]、[点赞]、[表情包]、[动画表情]、[语音]、[红包] 等
- 禁止 [流汗]、[微笑] 等方括号表情名；需要表情时直接用 Unicode emoji（如 😅、🙂），或不写
- 禁止 Markdown（# 标题、**加粗**、列表符号）、JSON、<<SPEAKER>>、[引用:…] 等机器格式
- 配图由 images/imagePrompts 字段表达，正文里不要写 [图片]
`.trim()

function replaceBracketTokens(s: string): string {
  return s.replace(/\[([^\[\]\n]{1,12})\]/g, (_match, inner: string) => {
    const key = inner.trim()
    if (!key) return ''
    if (WECHAT_EMOJI_MAP[key]) return WECHAT_EMOJI_MAP[key]!
    if (/^[\u4e00-\u9fffA-Za-z0-9]{1,12}$/.test(key)) return ''
    return _match
  })
}

function stripMarkdownNoise(s: string): string {
  return s
    .replace(/\*{1,2}([^*\n]+)\*{1,2}/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>{1,2}\s+/gm, '')
    .replace(/^-{3,}$/gm, '')
    .replace(/(?:^|\s)回复[₀₁₂₃₄₅₆₇₈₉0-9一二三四五六七八九十]+[：:]\s*/g, ' ')
}

function normalizeBodyWhitespace(s: string): string {
  return s
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 朋友圈正文：保留换行，清洗协议与 Markdown 泄漏 */
export function sanitizeMomentBodyText(
  raw: string | undefined | null,
  maxChars?: number,
): string {
  if (raw == null) return ''
  let s = String(raw)
    .replace(/\uFEFF/g, '')
    .replace(SPEAKER_TAG, '')
    .replace(QUOTE_BRACKET, '')
    .replace(META_BRACKET, '')
    .replace(STICKER_LINE, '')
    .replace(IMAGE_SENT_HINT, '')
    .replace(/\[(?:表情包|表情)\][^\s]*/gi, '')

  s = replaceBracketTokens(s)
  s = stripMarkdownNoise(s)
  return clampMomentBodyText(normalizeBodyWhitespace(s), maxChars)
}

/** 评论等单行文案 */
export function sanitizeMomentText(raw: string | undefined | null): string {
  return sanitizeMomentBodyText(raw).replace(/\s*\n+\s*/g, ' ').trim()
}
