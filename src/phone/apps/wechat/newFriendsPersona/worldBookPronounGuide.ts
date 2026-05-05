import type { WorldBookPronounGuide } from './types'

/** 注入世界书全文时：角色卡 vs 玩家身份卡（同 struct，人称默认不同） */
export type WorldBookPromptVoice = 'character_card' | 'player_identity'

export function normalizeWorldBookPronounGuide(v: unknown): WorldBookPronounGuide {
  if (v === 'user_as_i' || v === 'third_person') return v
  // 旧版「混杂」已移除，读库时归入常规视角
  if (v === 'mixed_explicit') return 'default'
  return 'default'
}

function safeSubjectName(name: string, fallback: string): string {
  const t = String(name ?? '').trim()
  return t || fallback
}

/**
 * 附在单条世界书条目后，明确「我/你/他」在**本条正文**中的解读，减少模型把用户口吻误读成角色。
 */
export function worldBookPronounGuideAnnotation(
  guide: WorldBookPronounGuide | undefined,
  subjectName: string,
  voice: WorldBookPromptVoice,
): string {
  const g = normalizeWorldBookPronounGuide(guide)

  if (voice === 'player_identity') {
    const name = safeSubjectName(subjectName, '用户')
    if (g === 'third_person') {
      return `（本条代词：以第三人称描写用户「${name}」为主；勿把文内「我」默认解成其他虚构角色。）`
    }
    return `（本条代词：「我」=身份卡用户「${name}」本人；「你」多指对话中的对方角色。）`
  }

  const charName = safeSubjectName(subjectName, '该角色')
  switch (g) {
    case 'user_as_i':
      return `（本条代词：「我」=用户/操作者本人，≠角色「${charName}」；「你」多指该角色或语境对象。理解职务、情感线、谁暗恋谁时必须先应用此条，勿将「我」误当作该角色。）`
    case 'third_person':
      return `（本条代词：以第三人称描写「${charName}」为主；文中「我」若出现勿一律视为该角色，须依句意判断。）`
    case 'default':
    default:
      return `（本条代词：「我」=角色「${charName}」；「你」=进行对话的真人用户/操作者。）`
  }
}

export function formatWorldBookItemLineForPrompt(params: {
  priority: 'before' | 'after'
  name: string
  content: string
  pronounGuide?: WorldBookPronounGuide
  subjectName: string
  voice: WorldBookPromptVoice
}): string {
  const pr = params.priority === 'before' ? '聊天之前' : '聊天之后'
  const body = String(params.content ?? '').trim()
  const ann = worldBookPronounGuideAnnotation(params.pronounGuide, params.subjectName, params.voice)
  return `- [${pr}] ${params.name}：${body}${ann ? ` ${ann}` : ''}`
}
