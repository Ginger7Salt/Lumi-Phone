import { listAllLinkedMemoryEligibleCharacters } from '../memory/linkedMemoryEligiblePeers'
import { buildNetworkRelationshipsPromptBlock } from '../networkRelationshipsPrompt'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'
import { formatWorldBackgroundForPrompt } from '../newFriendsPersona/worldBackgroundFormat'
import { buildPrivateChatNetworkNpcPronounBlock } from '../privateChatNetworkNpcPronoun'
import { resolveOfflineDatingArchiveContext } from './offlineDatingArchiveResolve'
import { buildCharacterCard, buildWorldBookText } from '../wechatChatAi'

/** 人脉全员完整档案 + 关系边的总预算（约会参考资料内单独一块） */
const NETWORK_BLOCK_MAX_CHARS = 96_000
const RELATIONSHIPS_MAX_CHARS = 14_000
const MAX_PEER_PROFILES = 32

type PeerRoleLabel = '人脉子角色' | '已绑定主角'

function peerRoleLabel(ch: Character, rootId: string): PeerRoleLabel {
  const gen = ch.generatedForCharacterId?.trim()
  if (gen && gen === rootId) return '人脉子角色'
  return '已绑定主角'
}

function allocatePeerCaps(peerCount: number): { bioMax: number; wbMax: number; wbgMax: number } {
  const relReserve = RELATIONSHIPS_MAX_CHARS
  const headerReserve = 2400
  const rosterBudget = Math.max(8000, NETWORK_BLOCK_MAX_CHARS - relReserve - headerReserve)
  const perPeer = peerCount > 0 ? Math.floor(rosterBudget / peerCount) : rosterBudget
  return {
    bioMax: Math.min(8000, Math.max(600, Math.floor(perPeer * 0.28))),
    wbMax: Math.min(6000, Math.max(1600, Math.floor(perPeer * 0.58))),
    wbgMax: Math.min(5000, Math.max(400, Math.floor(perPeer * 0.12))),
  }
}

async function formatFullPeerProfileForDatingPrompt(
  ch: Character,
  roleLabel: PeerRoleLabel,
  caps: { bioMax: number; wbMax: number; wbgMax: number },
): Promise<string> {
  const name = (ch.name || ch.wechatNickname || '').trim() || '未命名'
  const chunks: string[] = []
  chunks.push(`### ${name}（${roleLabel}；正文勿输出人设 id）`)
  chunks.push(`【角色档案】\n${buildCharacterCard(ch, { bioMaxChars: caps.bioMax })}`)

  if (ch.worldBackgroundEnabled !== false && ch.worldBackgroundId?.trim()) {
    try {
      const wbg = await personaDb.getWorldBackground(ch.worldBackgroundId.trim())
      const block = formatWorldBackgroundForPrompt(wbg).trim().slice(0, caps.wbgMax)
      if (block) chunks.push(`【世界背景】\n${block}`)
    } catch {
      /* 无世界背景仍继续拼世界书 */
    }
  }

  const wb = buildWorldBookText(ch, caps.wbMax).trim()
  if (wb) chunks.push(`【世界书】\n${wb}`)

  return chunks.join('\n\n')
}

/**
 * 组装「约会对象人脉圈」完整人设 + 关系边，供线下剧情 AI 写配角时不 OOC。
 * 含绑定 NPC 与「管理关系」里的主角型人脉；当前约会对象本人已在别处注入，此处不重复。
 */
export async function loadDatingNpcNetworkPromptBlock(params: {
  mainCharacterId: string
  mainRealName: string
}): Promise<string> {
  const perspectiveId = params.mainCharacterId.trim()
  if (!perspectiveId) return ''
  const mainLabel = params.mainRealName.trim() || '约会对象'

  try {
    const archCtx = await resolveOfflineDatingArchiveContext(perspectiveId)
    const rootId = archCtx?.archiveCharacterId?.trim() || perspectiveId

    const { all: linkedRows } = await listAllLinkedMemoryEligibleCharacters(rootId)
    const peers = linkedRows
      .filter((c) => c.id.trim() && c.id.trim() !== perspectiveId)
      .slice(0, MAX_PEER_PROFILES)

    const relBlock = await buildNetworkRelationshipsPromptBlock({
      rootId,
      focusCharacterId: perspectiveId,
      mainToNpcOnly: false,
      maxChars: RELATIONSHIPS_MAX_CHARS,
    })

    const mainRow = await personaDb.getCharacter(perspectiveId).catch(() => null)
    const pronounBlock = mainRow
      ? await buildPrivateChatNetworkNpcPronounBlock({ character: mainRow })
      : ''

    if (!peers.length && !relBlock.trim() && !pronounBlock.trim()) return ''

    const caps = allocatePeerCaps(peers.length)
    const profileSections: string[] = []
    for (const ch of peers) {
      profileSections.push(
        await formatFullPeerProfileForDatingPrompt(ch, peerRoleLabel(ch, rootId), caps),
      )
    }

    const intro =
      `【主角人脉网·完整人设·须参考】下列为「${mainLabel}」人脉圈内**其它角色**的完整档案（档案 / 简介 / 世界书 / 关系），` +
      `线下剧情中若让其出场、对白或被人提及，须与下表一致，**禁止**写成 generic 路人腔或与档案矛盾的言行。` +
      `须优先使用表内真实姓名；勿用新全名顶替已有职能位。无名龙套可用「工作人员」「路人」等弱指代。\n\n` +
      `【当前约会对象】${mainLabel}（完整档案已在「角色信息 / 世界书」中注入，此处不重复。）`

    const bodyParts = [intro]
    if (profileSections.length) {
      bodyParts.push('\n【人脉角色·完整档案】\n' + profileSections.join('\n\n---\n\n'))
    }
    if (relBlock.trim()) bodyParts.push(relBlock.trim())
    if (pronounBlock.trim()) bodyParts.push(pronounBlock.trim())

    return bodyParts.join('\n\n').slice(0, NETWORK_BLOCK_MAX_CHARS)
  } catch {
    return ''
  }
}
