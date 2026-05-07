/**
 * 须与 `groupChatEventNotice.ts` 内 `WECHAT_GROUP_EVENT_NOTICE_PREFIX` 保持一致（本文件不 import 该模块，避免与 idb 循环依赖）。
 */
const WECHAT_GROUP_EVENT_NOTICE_PREFIX = '__WX_GRP_EVT__:'

function stripGroupEventNoticePrefixLocal(raw: string): string {
  const s = String(raw ?? '')
  const t = s.trimStart()
  if (t.startsWith(WECHAT_GROUP_EVENT_NOTICE_PREFIX)) return t.slice(WECHAT_GROUP_EVENT_NOTICE_PREFIX.length)
  return s
}

/**
 * 微信「信息」会话列表、新消息通知摘要等：去掉群系统灰条前缀后，若以 `[表情包]` / `[表情]` 协议开头则统一显示 `[动画表情]`，不暴露引用名。
 */
export function formatWeChatMessagesTabPreviewFromStoredMessageContent(content: string): string {
  const pc = stripGroupEventNoticePrefixLocal(String(content ?? '').trim()).trim()
  if (!pc) return pc
  const firstLine = (pc.split(/\r?\n/)[0] ?? '').trim()
  if (firstLine.startsWith('[表情包]') || firstLine.startsWith('[表情]')) return '[动画表情]'
  return pc
}
