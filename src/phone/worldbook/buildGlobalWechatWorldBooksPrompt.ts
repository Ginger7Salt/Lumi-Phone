/** 全局档案条目正文注入时的单行格式（第三人称客观设定说明） */

const GLOBAL_WB_LINE_NOTE =
  '（本条为全局客观设定，正文宜为第三人称客观叙述；若出现「我」「你」等须结合语境理解，勿默认等同某一固定角色或用户。）'

/** 单条条目注入格式（用于 buildWorldbookContext） */
export function formatGlobalWorldBookItemLineForPrompt(name: string, content: string): string {
  const title = String(name ?? '').trim() || '未命名条目'
  const body = String(content ?? '').trim()
  return `- [聊天之前] ${title}：${body} ${GLOBAL_WB_LINE_NOTE}`
}
