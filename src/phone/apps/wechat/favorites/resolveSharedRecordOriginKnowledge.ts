import { personaDb } from '../newFriendsPersona/idb'
import type { Relationship, WeChatSharedRecordPayload } from '../newFriendsPersona/types'
import { hasReverseCharacterRelationship } from '../newFriendsPersona/personaRoster/crossBindings/crossBindingEngine'
import { loadGlobalWechatCharacterRegistry, resolveCanonicalCharacterId } from '../wechatGlobalCharacterRegistry'
import {
  resolveCharacterRealNameForSharedRecord,
  resolveCharacterWechatNickname,
  resolveOriginNameKnownToRecipient,
} from './sharedRecordOriginNames'
import { resolvePrivateChatNetworkRootId } from '../privateChatNetworkNpcPronoun'
import { isSharedRecordPlayerOrigin } from './sharedRecordOrigin'

/**
 * 人脉关系图中，接收方对原发送者的认识程度。
 * - mutual：双向连线，互相认识
 * - one_way：仅「接收方→原发送方」单向，接收方认识原发送方
 * - one_way_reverse：仅「原发送方→接收方」单向，接收方对原发送方身份存疑
 * - none：无角色↔角色连线
 */
export type SharedRecordOriginLinkKind = 'none' | 'one_way' | 'one_way_reverse' | 'mutual'

export type SharedRecordOriginKnowledge = {
  /** 接收方是否确信原发送者身份（双向，或接收方→原发送方单向时为 true） */
  originKnownToRecipient: boolean
  linkKind: SharedRecordOriginLinkKind
  /** 人脉图中「接收方→原发送方」连线的关系名（若有） */
  relationLabel?: string
  /** 接收方认知里对原发送者的称呼（真实姓名或 fromCallsTo） */
  originNameAsKnownByRecipient: string
  /** A 的人设真实姓名（注入系统提示用，与微信备注无关） */
  originRealName: string
}

function findCharCharEdge(
  rels: readonly Relationship[],
  fromId: string,
  toId: string,
): Relationship | undefined {
  const from = fromId.trim()
  const to = toId.trim()
  if (!from || !to) return undefined
  return rels.find(
    (r) => !r.isPlayerIdentity && r.fromCharacterId === from && r.toCharacterId === to,
  )
}

function findCharCharEdgeLoose(
  rels: readonly Relationship[],
  fromCandidates: readonly string[],
  toCandidates: readonly string[],
): Relationship | undefined {
  for (const from of fromCandidates) {
    for (const to of toCandidates) {
      const hit = findCharCharEdge(rels, from, to)
      if (hit) return hit
    }
  }
  return undefined
}

async function resolveCharacterIdCandidates(characterId: string): Promise<string[]> {
  const raw = characterId.trim()
  if (!raw) return []
  const canon = (await resolveCanonicalCharacterId(raw)) || raw
  const out = new Set<string>([raw, canon])
  try {
    const reg = await loadGlobalWechatCharacterRegistry()
    for (const [alias, target] of Object.entries(reg.aliasToCanonical)) {
      const a = alias.trim()
      const t = target.trim()
      if (!a || !t) continue
      if (a === raw || a === canon || t === raw || t === canon) {
        out.add(a)
        out.add(t)
      }
    }
  } catch {
    // ignore
  }
  return [...out]
}

/** 人脉边可能挂在 NPC 自身、档案根 id 或 canonical 别名上，全部纳入候选。 */
async function resolveRelationshipLookupCandidates(characterId: string): Promise<string[]> {
  const ids = await resolveCharacterIdCandidates(characterId)
  const out = new Set(ids)
  const canon = (await resolveCanonicalCharacterId(characterId)) || characterId.trim()
  if (canon) out.add(canon)
  try {
    const ch = await personaDb.getCharacter(canon)
    if (!ch) return [...out]
    const generatedRoot = ch.generatedForCharacterId?.trim()
    if (generatedRoot) out.add(generatedRoot)
    const networkRoot = await resolvePrivateChatNetworkRootId(ch)
    if (networkRoot) out.add(networkRoot)
  } catch {
    // ignore
  }
  return [...out]
}

/**
 * 依据人脉关系图连线判断：接收方是否认识原发送者。
 * - 双向连线 → 互相认识，确知来源
 * - 仅「接收方→原发送方」单向 → 接收方认识原发送方，确知来源
 * - 仅「原发送方→接收方」单向 / 无连线 → 对身份存疑
 */
export async function resolveSharedRecordOriginKnowledge(
  recipientCharacterId: string,
  payload: WeChatSharedRecordPayload,
): Promise<SharedRecordOriginKnowledge> {
  const recipientId = recipientCharacterId.trim()
  const originId = payload.originalSenderCharacterId.trim()
  const senderKind = payload.originalSenderKind ?? (isSharedRecordPlayerOrigin(originId) ? 'player' : 'character')

  const originRealName =
    senderKind === 'player' || isSharedRecordPlayerOrigin(originId)
      ? '用户'
      : await resolveCharacterRealNameForSharedRecord(originId)

  if (senderKind === 'player' || isSharedRecordPlayerOrigin(originId)) {
    return {
      originKnownToRecipient: true,
      linkKind: 'none',
      originNameAsKnownByRecipient: '用户',
      originRealName: '用户',
    }
  }

  const [recipientCanon, originCanon, recipientCandidates, originCandidates] = await Promise.all([
    resolveCanonicalCharacterId(recipientId),
    resolveCanonicalCharacterId(originId),
    resolveRelationshipLookupCandidates(recipientId),
    resolveRelationshipLookupCandidates(originId),
  ])

  if (!recipientId || !originId || recipientCanon.trim() === originCanon.trim()) {
    return {
      originKnownToRecipient: true,
      linkKind: 'mutual',
      originNameAsKnownByRecipient: originRealName,
      originRealName,
    }
  }

  let rels: Awaited<ReturnType<typeof personaDb.listAllRelationships>> = []
  try {
    rels = await personaDb.listAllRelationships()
  } catch {
    const unknownNickname = await resolveCharacterWechatNickname(originId)
    return {
      originKnownToRecipient: false,
      linkKind: 'none',
      originNameAsKnownByRecipient: unknownNickname,
      originRealName,
    }
  }

  const recipientToOrigin = findCharCharEdgeLoose(rels, recipientCandidates, originCandidates)
  const originToRecipient = findCharCharEdgeLoose(rels, originCandidates, recipientCandidates)
  const mutual =
    !!recipientToOrigin &&
    (!!originToRecipient || hasReverseCharacterRelationship(rels, recipientToOrigin))

  if (mutual) {
    const originNameAsKnownByRecipient = await resolveOriginNameKnownToRecipient({
      originCharacterId: originCandidates[originCandidates.length - 1] ?? originId,
      fromCallsTo: recipientToOrigin?.fromCallsTo,
      fallbackRealName: originRealName,
    })
    return {
      originKnownToRecipient: true,
      linkKind: 'mutual',
      relationLabel: recipientToOrigin?.relation?.trim() || undefined,
      originNameAsKnownByRecipient,
      originRealName,
    }
  }

  if (recipientToOrigin) {
    const originNameAsKnownByRecipient = await resolveOriginNameKnownToRecipient({
      originCharacterId: originCandidates[originCandidates.length - 1] ?? originId,
      fromCallsTo: recipientToOrigin.fromCallsTo,
      fallbackRealName: originRealName,
    })
    return {
      originKnownToRecipient: true,
      linkKind: 'one_way',
      relationLabel: recipientToOrigin.relation?.trim() || undefined,
      originNameAsKnownByRecipient,
      originRealName,
    }
  }

  const linkKind: SharedRecordOriginLinkKind = originToRecipient ? 'one_way_reverse' : 'none'
  const unknownNickname = await resolveCharacterWechatNickname(originId)

  return {
    originKnownToRecipient: false,
    linkKind,
    relationLabel: originToRecipient?.relation?.trim() || undefined,
    originNameAsKnownByRecipient: unknownNickname,
    originRealName,
  }
}
