import type { AppSlot } from '../../types'

export const WECHAT_FOCUS_PERSONA_CHAT_SESSION_KEY = 'lumi-wechat-focus-persona-chat-id'
export const WECHAT_FOCUS_GROUP_CHAT_SESSION_KEY = 'lumi-wechat-focus-group-chat-id'

export const WECHAT_FOCUS_PERSONA_CHAT_EVENT = 'wechat:focus-persona-chat'
export const WECHAT_FOCUS_GROUP_CHAT_EVENT = 'wechat:focus-group-chat'

export type WeChatFocusPersonaChatDetail = {
  characterId: string
}

export type WeChatFocusGroupChatDetail = {
  groupId: string
}

export type WeChatFocusChatTarget =
  | { kind: 'persona'; characterId: string }
  | { kind: 'group'; groupId: string }

function openWeChatApp() {
  window.dispatchEvent(new CustomEvent<{ id: AppSlot['id'] }>('phone:open-app', { detail: { id: 'wechat' } }))
}

/** 写入待打开私聊角色并拉起微信（由 WeChatApp 消费） */
export function requestOpenWeChatPersonaChat(characterId: string): void {
  const id = characterId.trim()
  if (!id) return
  try {
    sessionStorage.setItem(WECHAT_FOCUS_PERSONA_CHAT_SESSION_KEY, id)
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent<WeChatFocusPersonaChatDetail>(WECHAT_FOCUS_PERSONA_CHAT_EVENT, {
      detail: { characterId: id },
    }),
  )
  openWeChatApp()
}

/** 写入待打开群聊并拉起微信（由 WeChatApp 消费） */
export function requestOpenWeChatGroupChat(groupId: string): void {
  const id = groupId.trim()
  if (!id) return
  try {
    sessionStorage.setItem(WECHAT_FOCUS_GROUP_CHAT_SESSION_KEY, id)
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent<WeChatFocusGroupChatDetail>(WECHAT_FOCUS_GROUP_CHAT_EVENT, {
      detail: { groupId: id },
    }),
  )
  openWeChatApp()
}

export function requestOpenWeChatChat(target: WeChatFocusChatTarget): void {
  if (target.kind === 'persona') {
    requestOpenWeChatPersonaChat(target.characterId)
    return
  }
  requestOpenWeChatGroupChat(target.groupId)
}

export function consumeWeChatFocusPersonaChatId(): string | null {
  try {
    const id = sessionStorage.getItem(WECHAT_FOCUS_PERSONA_CHAT_SESSION_KEY)?.trim() || ''
    if (id) sessionStorage.removeItem(WECHAT_FOCUS_PERSONA_CHAT_SESSION_KEY)
    return id || null
  } catch {
    return null
  }
}

export function consumeWeChatFocusGroupChatId(): string | null {
  try {
    const id = sessionStorage.getItem(WECHAT_FOCUS_GROUP_CHAT_SESSION_KEY)?.trim() || ''
    if (id) sessionStorage.removeItem(WECHAT_FOCUS_GROUP_CHAT_SESSION_KEY)
    return id || null
  } catch {
    return null
  }
}
