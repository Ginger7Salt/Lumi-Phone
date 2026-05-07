/** SillyTavern 风格占位符：注入提示词或世界书正文后展开为当前会话的约会对象名 / 用户身份名 */

import type { Character, PlayerIdentity } from './newFriendsPersona/types'

/** 档案室条目、人设世界书正文推荐写法：`{{char}}`=该人设角色本人，`{{user}}`=玩家绑定身份本人 */
export const WORLD_BOOK_CHAR_PLACEHOLDER = '{{char}}'
export const WORLD_BOOK_USER_PLACEHOLDER = '{{user}}'

export type CharUserNames = {
  /** 当前人设（约会对象）展示名，一般用 realName */
  charName: string
  /** 该人设绑定会话绑定的玩家身份姓名 */
  userName: string
}

/**
 * 与微信私聊 / 约会一致：`{{char}}` 用当前绑定人设；`{{user}}` 用**该人设绑定的**玩家身份（须由调用方传入已按 `character.playerIdentityId` 解析好的 identity）。
 */
export function resolveCharUserNamesForPrompt(params: {
  character: Character | null
  playerIdentity: PlayerIdentity | null
  playerDisplayName: string
  /** 身份昵称、姓名、备注及 playerDisplayName 皆空时的兜底；默认「用户」 */
  userNameIfAnonymous?: string
}): CharUserNames {
  const charName =
    String(params.character?.name ?? '').trim() ||
    String(params.character?.wechatNickname ?? '').trim() ||
    '对方'
  const iden = params.playerIdentity
  const userName =
    String(iden?.wechatNickname ?? '').trim() ||
    String(iden?.name ?? '').trim() ||
    String(iden?.remark ?? '').trim() ||
    String(params.playerDisplayName ?? '').trim() ||
    (params.userNameIfAnonymous ?? '用户')
  return { charName, userName }
}

export function expandCharUserPlaceholders(text: string, names: CharUserNames): string {
  const charName = String(names.charName ?? '').trim() || '对方'
  const userName = String(names.userName ?? '').trim() || '用户'
  return String(text ?? '')
    .replace(/\{\{char\}\}/g, charName)
    .replace(/\{\{user\}\}/g, userName)
}

/** 关联长期记忆等：`{{archive_char}}` = 线下存档主角；`{{id:xxx}}` = 指定人设 id 的显示名（须与档案 id 完全一致） */
export const LINKED_MEMORY_ARCHIVE_CHAR_PLACEHOLDER = '{{archive_char}}'

export type LinkedMemoryPlaceholderExpandInput = {
  /** 当前档案所属人设（私聊对方 / 本条记忆的 characterId） */
  charName: string
  userName: string
  /** 关联记忆 `linkedFromCharacterId` 对应主角的显示名 */
  archiveCharName?: string
  /** `{{id:<characterId>}}` → 显示名（含存档主角与 listNpcsFor 人脉） */
  idToDisplayName?: Readonly<Record<string, string>>
}

/**
 * 在 `expandCharUserPlaceholders` 基础上扩展关联记忆占位符。
 * 顺序：`{{id:…}}` → `{{archive_char}}` → `{{char}}` / `{{user}}`
 */
export function expandLinkedMemoryPlaceholders(text: string, input: LinkedMemoryPlaceholderExpandInput): string {
  const idMap = input.idToDisplayName ?? {}
  let s = String(text ?? '')
  s = s.replace(/\{\{id:([^}]+)\}\}/g, (_m, rawId: string) => {
    const id = String(rawId ?? '').trim()
    if (!id) return ''
    const nm = idMap[id]
    return nm != null && String(nm).trim() ? String(nm).trim() : `{{id:${id}}}`
  })
  const arch = String(input.archiveCharName ?? '').trim()
  s = s.replace(/\{\{archive_char\}\}/g, arch || '主角')
  return expandCharUserPlaceholders(s, {
    charName: input.charName,
    userName: input.userName,
  })
}

/**
 * 约会专用：澄清「我＝用户」类世界书与约会对象人称，须在展开占位符之前附加到 system（本身不含未展开花括号）。
 */
export function buildDatingCharUserPerspectiveDirective(charName: string, userName: string): string {
  const c = String(charName || '').trim() || '对方'
  const u = String(userName || '').trim() || '用户'
  return (
    `【指称约定（最高优先级）】\n` +
    `- 「约会对象 / 当前人设」=「${c}」；「玩家」= 该人设绑定的玩家身份「${u}」。\n` +
    `- 人设侧世界书、档案室条目中出现的「{{char}}」「{{user}}」已替换为「${c}」「${u}」；其中**写在与「${u}」绑定的一侧**的校内职务、社团职级、远近关系等，**一律视为对玩家的有效设定**，与「用户身份卡」摘要**互补**——身份卡未逐字写的条目项**不得**当成「不存在」，也**禁止**因叙事常以「${c}」为描写重心，就把条目中赋予「${u}」的职务或上级身份改写到「${c}」头上。\n` +
    `- 「用户身份卡」及**玩家身份专属**世界书：专述玩家本体档案；勿把其中条目与「${c}」的人设条目混写、对调。\n` +
    `- 正文输出请直接写真实姓名或语境下合理称呼。\n\n`
  )
}
