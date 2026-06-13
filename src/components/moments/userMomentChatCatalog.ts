import { findAccountById, loadAccountsBundle } from '../../phone/apps/wechat/wechatAccountPersistence'
import { resolveCharacterAvatarUrl } from '../../phone/utils/characterAvatarUrl'

import { loadMomentRelationships } from './momentRelationshipGraph'
import { loadUserMoments } from './momentsFeedStorage'
import { loadMomentsContactTags } from './momentsContactTagsStore'
import { mockContactsToMomentRefs } from './publishMomentUtils'
import { sanitizeMomentBodyText } from './momentTextSanitize'
import { resolveUserMomentAudience } from './userMomentDistributionAudience'
import { formatMomentPublishedAtAbsolute } from './utils/timeFormat'

import type { MomentItemModel } from './mockMoments'

function summarizeCharacterInteractionOnMoment(moment: MomentItemModel, characterId: string): string {
  const cid = characterId.trim()
  if (!cid) return ''
  const parts: string[] = []
  for (const ix of moment.interactions ?? []) {
    if (ix.charId?.trim() !== cid) continue
    if (ix.type === 'like') parts.push('你已点赞')
    if (ix.type === 'comment' && ix.content?.trim()) {
      parts.push(`你已评论：${ix.content.trim().slice(0, 60)}`)
    }
    if (ix.type === 'viewed') parts.push('你已浏览未互动')
  }
  return parts.length ? `（${parts.join('；')}）` : ''
}

/** 私聊注入：该角色可见的用户近期朋友圈目录（不依赖关键词记忆召回） */
export async function buildUserMomentsVisibleToCharacterCatalogBlock(params: {
  accountId: string | null | undefined
  characterId: string
  playerIdentityId: string | null | undefined
  playerDisplayName: string
  limit?: number
}): Promise<string> {
  const accountId = params.accountId?.trim()
  const characterId = params.characterId.trim()
  if (!accountId || !characterId) return ''

  const bundle = await loadAccountsBundle()
  const account = bundle ? findAccountById(bundle, accountId) : null
  if (!account) return ''

  const playerName = params.playerDisplayName.trim() || account.nickname.trim() || '用户'
  const selfContact = {
    id: 'self',
    remarkName: playerName,
    avatarUrl: resolveCharacterAvatarUrl({ avatarUrl: account.avatarUrl }) || undefined,
  }
  const friends = account.personaContacts.map((c) => ({
    id: c.id,
    characterId: c.characterId,
    remarkName: c.remarkName,
    avatarUrl: resolveCharacterAvatarUrl({ avatarUrl: c.avatarUrl }) || undefined,
  }))
  const momentContacts = mockContactsToMomentRefs([selfContact, ...friends])
  const tags = loadMomentsContactTags()
  const relationships = await loadMomentRelationships()
  const allMoments = await loadUserMoments(accountId)
  const userMoments = allMoments
    .filter((m) => m.isUserAuthored)
    .sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id))

  const visibleRows: string[] = []
  for (const moment of userMoments) {
    if (visibleRows.length >= (params.limit ?? 8)) break
    const { visible } = resolveUserMomentAudience({
      moment,
      momentContacts,
      tags,
      playerIdentityId: params.playerIdentityId,
      relationships,
    })
    if (!visible.some((v) => v.charId === characterId)) continue
    const preview =
      sanitizeMomentBodyText(moment.content).slice(0, 72) ||
      (moment.images?.length ? `[图片动态 ${moment.images.length} 张]` : '[无文字]')
    const time = formatMomentPublishedAtAbsolute(moment.timestamp) || '—'
    const pinnedTag = moment.isPinned ? ' · 置顶' : ''
    const interactionTag = summarizeCharacterInteractionOnMoment(moment, characterId)
    visibleRows.push(`${visibleRows.length + 1}. ${time} | ${preview}${pinnedTag}${interactionTag}`)
  }

  if (!visibleRows.length) {
    return `【${playerName}的朋友圈 · 你能看到的】当前没有可见的用户动态。用户若问「你看到哪条朋友圈」，如实说还没刷到或没有可见内容，勿编造。`
  }

  return [
    `【${playerName}的朋友圈 · 你能看到的】`,
    '以下是该用户近期发、且在你的可见范围内的朋友圈。私聊里用户问「你看到哪条/什么内容」时，须据下列条目回答；禁止编造列表外内容，禁止把私聊里刚出现的词（如用户刚发的「野狼」）当成朋友圈正文，除非下方确实有对应条目。',
    visibleRows.join('\n'),
  ].join('\n')
}
