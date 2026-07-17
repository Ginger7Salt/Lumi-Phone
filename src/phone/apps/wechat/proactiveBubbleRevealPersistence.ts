import { planProactiveRevealBubblesAsync } from './proactiveBubbleRevealPlan'
import type { ProactiveMessageRevealPayload } from './proactiveMessageRevealBridge'
import { collectRecentCharacterStickerRefsFromMessages } from './stickers/stickerAntiRepeat'

export async function persistProactiveRevealPayload(
  payload: ProactiveMessageRevealPayload,
  isRead: boolean,
): Promise<void> {
  const { personaDb } = await import('./newFriendsPersona/idb')
  const stored = await personaDb.listWeChatChatMessagesByConversationKey(payload.conversationKey)
  const recentStickerRefs = collectRecentCharacterStickerRefsFromMessages(stored)
  const convSettings = await personaDb.getChatConversationSettings(payload.conversationKey)
  const planned = await planProactiveRevealBubblesAsync(
    payload.bubbles,
    {
      characterId: payload.characterId,
      characterName: payload.notifyPeerTitle.trim() || 'TA',
      userLabel: payload.playerDisplayName.trim() || '我',
      defaultRecipientName: payload.playerDisplayName.trim() || '我',
      playerIdentityId: payload.playerIdentityId,
      playerDisplayName: payload.playerDisplayName.trim() || '用户',
      pulseDmScreenshotEnabled: convSettings?.pulseDmScreenshotEnabled === true,
    },
    recentStickerRefs,
  )
  for (const p of planned) {
    await personaDb.appendWeChatChatMessage({
      id: p.id,
      characterId: payload.characterId,
      playerIdentityId: payload.playerIdentityId,
      type: 'character',
      content: p.content,
      stickerRef: p.stickerRef,
      thinking: p.thinking,
      timestamp: p.timestamp,
      isRead,
      conversationKey: payload.conversationKey,
      notifyPeerTitle: payload.notifyPeerTitle,
      voice: p.voice,
      images: p.images,
      musicSync: p.musicSync,
      locationShare: p.locationShare,
      takeoutOrder: p.takeoutOrder,
    })
  }
}
