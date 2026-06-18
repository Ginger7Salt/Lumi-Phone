/** 会话级 AI 回复管线（等 API + 逐条露出）是否进行中；跨 ChatRoom 重挂载保持，避免「正在输入」丢失与重复触发。 */
const activeKeys = new Set<string>()
const listeners = new Set<() => void>()

function notify() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function setWechatAiReplyPipelineActive(conversationKey: string, active: boolean) {
  const k = conversationKey.trim()
  if (!k) return
  const had = activeKeys.has(k)
  if (active) activeKeys.add(k)
  else activeKeys.delete(k)
  if (had !== activeKeys.has(k)) notify()
}

export function isWechatAiReplyPipelineActive(conversationKey: string): boolean {
  return activeKeys.has(conversationKey.trim())
}

export function subscribeWechatAiReplyPipelineActive(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
