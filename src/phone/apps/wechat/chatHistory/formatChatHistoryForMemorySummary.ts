import type { WeChatChatHistoryPayload } from '../newFriendsPersona/types'

function formatChatHistoryDialogueLines(payload: WeChatChatHistoryPayload): string {
  return payload.messages
    .map((m) => {
      const who = m.senderName.trim() || '未知'
      const body = m.content.trim() || '...'
      return `[${who}: ${body}]`
    })
    .join('\n')
}

/** 自动总结 / 记忆摘录：展开聊天记录卡片正文（禁止只写 [聊天记录]） */
export function formatChatHistoryForMemorySummary(params: {
  payload: WeChatChatHistoryPayload
  /** 消息落库方：玩家转发 or 角色伪造展示 */
  messageType: 'player' | 'character'
}): string {
  const title = params.payload.title.trim() || '聊天记录'
  const lines = formatChatHistoryDialogueLines(params.payload)
  const dialogue = lines.trim() || '（无有效对话行）'
  if (params.messageType === 'player') {
    return (
      `（我向当前会话对象转发一份聊天记录；标题《${title}》；` +
      `对话摘录如下，非当前私聊原句）\n${dialogue}`
    )
  }
  return (
    `（对方向我展示一份其与他人的聊天记录摘录；标题《${title}》；` +
    `内容为剧情内编撰的第三方私聊摘录，非真实库导出）\n${dialogue}`
  )
}

/** 注入 AI 私聊上下文（含用户转发与角色伪造） */
export function formatChatHistoryForAiTranscript(params: {
  payload: WeChatChatHistoryPayload
  from: 'self' | 'other'
}): string {
  const title = params.payload.title.trim() || '聊天记录'
  const lines = formatChatHistoryDialogueLines(params.payload)
  const head =
    params.from === 'self'
      ? `（我向你转发一份聊天记录：《${title}》；内容如下）`
      : `（我向你展示一份我与他人的聊天记录：《${title}》；内容如下）`
  return `${head}\n${lines}`
}
