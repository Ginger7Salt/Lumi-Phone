import { loadOfflineDatingPlotsPromptBlock } from '../../phone/apps/wechat/dating/loadOfflineDatingPlotsForWechatPrompt'
import {
  formatRecentPrivateChatReferenceByCharacter,
  formatUnsummarizedPrivateChatBlock,
} from '../../phone/apps/wechat/wechatMemoryPromptBlocks'
import {
  buildAnonymousQaPersonaPromptPack,
  type AnonymousQaWechatContext,
} from '../anonymousQa/buildAnonymousQaPersonaContext'
import { filterPublishableCharacterContacts } from './momentFeedVisibility'
import type { MomentContactRef } from './newMomentTypes'
import type { MomentRelationshipBoundPeer } from './momentRelationshipGraph'

export type MutualFriendRef = MomentRelationshipBoundPeer

/** @deprecated 使用 resolveRelationshipBoundPeers（须传入关系边） */
export function resolveMutualFriends(
  targetCharacterId: string,
  momentContacts: MomentContactRef[],
  blockedCharacterIds: Set<string> = new Set(),
): MutualFriendRef[] {
  return filterPublishableCharacterContacts(momentContacts, blockedCharacterIds)
    .filter((c) => c.characterId?.trim() && c.characterId.trim() !== targetCharacterId.trim())
    .map((c) => ({
      charId: c.characterId!.trim(),
      contactId: c.id,
      displayName: c.name.trim() || '未命名',
    }))
}

export async function buildInstantGenRecentContext(params: {
  wechatCtx: AnonymousQaWechatContext
  characterId: string
  includeRecentChat: boolean
  includeOfflinePlots: boolean
}): Promise<string> {
  const blocks: string[] = []

  if (params.includeRecentChat) {
    const pack = await buildAnonymousQaPersonaPromptPack({
      characterId: params.characterId,
      wechatCtx: params.wechatCtx,
      relevanceHaystack: '朋友圈 即时生成 近期对话',
      disableMemoryVectorRecall: true,
    })
    let chatBlock = ''
    if (pack.conversationKey) {
      chatBlock = await formatUnsummarizedPrivateChatBlock({
        conversationKey: pack.conversationKey,
        maxMessages: 20,
        maxChars: 2400,
      })
    }
    if (!chatBlock.trim()) {
      chatBlock = await formatRecentPrivateChatReferenceByCharacter({
        characterId: params.characterId,
        maxMessages: 20,
        maxChars: 2400,
      })
    }
    if (chatBlock.trim()) blocks.push(`【最近 20 条对话记忆】\n${chatBlock.trim()}`)
  }

  if (params.includeOfflinePlots) {
    const character = await buildAnonymousQaPersonaPromptPack({
      characterId: params.characterId,
      wechatCtx: params.wechatCtx,
      relevanceHaystack: '线下剧情',
      disableMemoryVectorRecall: true,
    }).then((p) => p.character)
    const plots = await loadOfflineDatingPlotsPromptBlock(
      params.characterId,
      character?.name ?? character?.wechatNickname ?? null,
    )
    if (plots.trim()) blocks.push(`【未总结的线下剧情】\n${plots.trim()}`)
  }

  return blocks.length ? blocks.join('\n\n') : '（暂无可用上下文，请根据人设自由发挥。）'
}
