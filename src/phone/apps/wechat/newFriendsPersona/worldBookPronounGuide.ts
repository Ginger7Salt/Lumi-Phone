import type { WorldBookPronounGuide } from './types'

/** 注入世界书全文时：角色卡 vs 玩家身份卡（历史字段名保留） */
export type WorldBookPromptVoice = 'character_card' | 'player_identity'

export function normalizeWorldBookPronounGuide(v: unknown): WorldBookPronounGuide {
  if (v === 'user_as_i' || v === 'third_person') return v
  if (v === 'mixed_explicit') return 'default'
  return 'default'
}

/** 角色人设世界书：占位符在注入前按「当前绑定人设 + 该人设绑定的玩家身份」展开 */
const CHARACTER_WB_PLACEHOLDER_NOTE =
  '（占位符「{{char}}」=当前会话绑定人设的真实姓名，「{{user}}」=该人设绑定的玩家身份姓名；注入前替换，避免与角色设定混淆。）'

/** 玩家身份世界书：条目即本人设定，不作占位符与人称约定 */
const PLAYER_IDENTITY_WB_NOTE = '（玩家身份条目：正文均指玩家本人，与聊天中的虚构人设设定无关。）'

/**
 * 附在条目后；`voice` 区分身份卡条目与角色人设条目。
 */
export function worldBookPronounGuideAnnotation(
  _guide?: WorldBookPronounGuide,
  _subjectName?: string,
  voice?: WorldBookPromptVoice,
): string {
  return voice === 'player_identity' ? PLAYER_IDENTITY_WB_NOTE : CHARACTER_WB_PLACEHOLDER_NOTE
}

export function formatWorldBookItemLineForPrompt(params: {
  priority: 'before' | 'after'
  name: string
  content: string
  /** @deprecated 读库兼容；注入逻辑不再区分 */
  pronounGuide?: WorldBookPronounGuide
  /** @deprecated 注入逻辑不再区分 */
  subjectName?: string
  voice?: WorldBookPromptVoice
}): string {
  const pr = params.priority === 'before' ? '聊天之前' : '聊天之后'
  const body = String(params.content ?? '').trim()
  const voice = params.voice ?? 'character_card'
  return `- [${pr}] ${params.name}：${body} ${worldBookPronounGuideAnnotation(undefined, undefined, voice)}`
}
