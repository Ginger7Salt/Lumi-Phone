/** 全局档案条目正文注入时的单行格式（第三人称客观设定说明） */

/** 附于每条档案室条目注入行尾；与人设世界书推荐的占位符约定一致 */
export const GLOBAL_WB_LINE_NOTE =
  '（本条人称占位：`{{char}}`=当前会话中的该人设角色本人，`{{user}}`=玩家绑定身份本人；注入模型前会替换为真实姓名。请优先用二者区分角色与用户，勿用含糊的「我」兼指双方。）'

/** 单条条目注入格式（用于 buildWorldbookContext） */
export function formatGlobalWorldBookItemLineForPrompt(name: string, content: string): string {
  const title = String(name ?? '').trim() || '未命名条目'
  const body = String(content ?? '').trim()
  return `- [序言介入] ${title}：${body} ${GLOBAL_WB_LINE_NOTE}`
}
