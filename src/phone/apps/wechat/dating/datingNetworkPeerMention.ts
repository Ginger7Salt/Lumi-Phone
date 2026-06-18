import {
  characterDisplayNameForIdMap,
  listAllLinkedMemoryEligibleCharacters,
} from '../memory/linkedMemoryEligiblePeers'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'
import { resolveCharacterAvatarUrl } from '../../../utils/characterAvatarUrl'
import { resolveOfflineDatingArchiveContext } from './offlineDatingArchiveResolve'

export type DatingNetworkPeerOption = {
  id: string
  displayName: string
  avatarUrl?: string
  roleLabel: '人脉子角色' | '已绑定主角'
}

export async function loadDatingNetworkPeerOptions(datingCharacterId: string): Promise<DatingNetworkPeerOption[]> {
  const perspectiveId = datingCharacterId.trim()
  if (!perspectiveId) return []

  const arch = await resolveOfflineDatingArchiveContext(perspectiveId)
  const rootId = arch?.archiveCharacterId?.trim() || perspectiveId

  const { npcs, boundProtagonists } = await listAllLinkedMemoryEligibleCharacters(rootId)
  const out: DatingNetworkPeerOption[] = []

  for (const ch of npcs) {
    const id = ch.id.trim()
    if (!id || id === perspectiveId) continue
    out.push({
      id,
      displayName: characterDisplayNameForIdMap(ch, id),
      avatarUrl: resolveCharacterAvatarUrl(ch) || undefined,
      roleLabel: '人脉子角色',
    })
  }
  for (const ch of boundProtagonists) {
    const id = ch.id.trim()
    if (!id || id === perspectiveId) continue
    out.push({
      id,
      displayName: characterDisplayNameForIdMap(ch, id),
      avatarUrl: resolveCharacterAvatarUrl(ch) || undefined,
      roleLabel: '已绑定主角',
    })
  }

  out.sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-CN'))
  return out
}

/** 本轮玩家指定出场的人脉角色：按 id 注入模型，附真实姓名与关系提示 */
export async function buildDatingPresentNetworkCharactersPromptBlock(params: {
  characterIds: readonly string[]
  datingPeerRealName: string
}): Promise<string> {
  const ids = [...new Set(params.characterIds.map((x) => x.trim()).filter(Boolean))]
  if (!ids.length) return ''

  const datingPeer = params.datingPeerRealName.trim() || '约会对象'
  const lines: string[] = [
    '【本轮玩家指定出场·人脉角色（须落实）】',
    '玩家在本轮输入中指定下列角色须在本段剧情中出场、被当面提及、或产生可感知影响（到场、电话、他人转述、消息等均可）。',
    `须与下方人设档案一致，禁止写成无名路人或与档案矛盾的言行。当前约会对象为「${datingPeer}」，下列角色来自其人脉圈。`,
  ]

  for (const id of ids) {
    let ch: Character | null = null
    try {
      ch = await personaDb.getCharacter(id)
    } catch {
      ch = null
    }
    const name = characterDisplayNameForIdMap(ch, id)
    const gen = ch?.generatedForCharacterId?.trim()
    const role = gen ? '人脉子角色' : '已绑定主角'
    const identity = ch?.identity?.trim()
    const relBit = identity ? `；档案身份：${identity}` : ''
    lines.push(`- ${name}（${role}${relBit}；系统 id={{id:${id}}}，正文勿输出 id）`)
  }

  lines.push('正文叙述该角色时优先用上表真实姓名；须与 system 内人脉档案一致。')
  return lines.join('\n')
}
