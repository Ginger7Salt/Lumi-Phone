import { planProactiveRevealBubblesAsync } from './proactiveBubbleRevealPlan'
import type { ProactiveMessageRevealPayload } from './proactiveMessageRevealBridge'

export async function persistProactiveRevealPayload(
  payload: ProactiveMessageRevealPayload,
  isRead: boolean,
): Promise<void> {
  const planned = await planProactiveRevealBubblesAsync(payload.bubbles)
  const { personaDb } = await import('./newFriendsPersona/idb')
  for (const p of planned) {
    await personaDb.appendWeChatChatMessage({
      id: p.id,
      characterId: payload.characterId,
      playerIdentityId: payload.playerIdentityId,
      type: 'character',
      content: p.content,
      thinking: p.thinking,
      timestamp: p.timestamp,
      isRead,
      conversationKey: payload.conversationKey,
      notifyPeerTitle: payload.notifyPeerTitle,
      voice: p.voice,
      images: p.images,
    })
  }
}
