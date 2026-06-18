import type { WeChatChatHistoryPayload } from '../newFriendsPersona/types'

export function formatChatHistoryForAiPrompt(payload: WeChatChatHistoryPayload): string {
  const title = payload.title.trim() || '聊天记录'
  const lines = payload.messages
    .map((m) => {
      const who = m.senderName.trim() || '未知'
      const body = m.content.trim() || '...'
      return `[${who}: ${body}]`
    })
    .join('\n')
  return `【系统事件】用户向你转发了一份名为《${title}》的聊天记录。内容如下：\n${lines}\n请你仔细阅读这份记录，并结合你的人设，给出你的反应。是吃醋、愤怒、还是嘲笑？`
}
