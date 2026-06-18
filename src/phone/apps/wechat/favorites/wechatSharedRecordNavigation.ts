import type { AppSlot } from '../../../types'
import { WECHAT_FOCUS_PERSONA_CHAT_SESSION_KEY } from '../wechatFocusChatNavigation'

/** 转发成功后打开私聊（不自动触发 AI 回复，与普通发消息一致由用户后续操作决定） */
export function requestOpenWeChatChatAfterSharedRecord(params: {
  characterId: string
}): void {
  const characterId = params.characterId.trim()
  if (!characterId) return
  try {
    sessionStorage.setItem(WECHAT_FOCUS_PERSONA_CHAT_SESSION_KEY, characterId)
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent<{ id: AppSlot['id'] }>('phone:open-app', { detail: { id: 'wechat' } }))
}
