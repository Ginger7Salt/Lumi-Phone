/** 听一听操作成功提示（可选跳转微信私聊） */
export type ListenTogetherActionToastPayload = {
  message: string
  /** 有值时显示「去聊天」 */
  chatCharacterId?: string
  chatActionLabel?: string
}

export type ListenTogetherToastInput = string | ListenTogetherActionToastPayload

export function normalizeListenTogetherToast(
  input: ListenTogetherToastInput,
): ListenTogetherActionToastPayload {
  if (typeof input === 'string') return { message: input }
  return input
}

export function buildWeChatShareSuccessToast(params: {
  sent: number
  characterIds: string[]
  contactName?: string
}): ListenTogetherActionToastPayload {
  const sent = Math.max(0, params.sent)
  const ids = params.characterIds.map((id) => id.trim()).filter(Boolean)
  const name = params.contactName?.trim()
  const message =
    sent === 1
      ? `已分享给 ${name || '好友'}，可在微信查看`
      : `已分享给 ${sent} 位好友，可在微信查看`
  return {
    message,
    chatCharacterId: sent === 1 ? ids[0] : undefined,
    chatActionLabel: '去聊天',
  }
}

export function buildMusicSyncInviteSuccessToast(params: {
  contactName: string
  characterId: string
}): ListenTogetherActionToastPayload {
  const name = params.contactName.trim() || '好友'
  const characterId = params.characterId.trim()
  return {
    message: `已向 ${name} 发送共听邀约`,
    chatCharacterId: characterId || undefined,
    chatActionLabel: '去聊天',
  }
}
