import type { ApiConfig } from '../../api/types'
import { openAiCompatibleChat } from './ai'
import { playerIdentityGenderRulesForAi } from './personaIdentityGenderRules'
import type { Character, PlayerIdentity, PlayerNetworkLink } from './types'
import { genderLabelZh } from './utils'

type AiPlayerLinkRow = {
  characterName: string
  theyCallYou: string
  theySeeYou: string
}

export type RegenerateImportAddressingInput = {
  rootCharacter: Character
  npcs: Character[]
  playerLinks: PlayerNetworkLink[]
  playerIdentity: PlayerIdentity | null
  previousIdentityNames: string[]
  currentIdentityName: string
}

function stripJsonFence(raw: string): string {
  const t = raw.trim()
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return m ? m[1].trim() : t
}

function characterNameById(
  rootCharacter: Character,
  npcs: Character[],
): Map<string, string> {
  const map = new Map<string, string>()
  map.set(rootCharacter.id, rootCharacter.name.trim() || '主角')
  for (const n of npcs) map.set(n.id, n.name.trim() || 'NPC')
  return map
}

/**
 * 按新身份为各角色重写「如何称呼你」（theyCallYou）与「对你看法」（theySeeYou）。
 */
export async function regeneratePlayerAddressingAfterImport(
  cfg: ApiConfig,
  input: RegenerateImportAddressingInput,
): Promise<PlayerNetworkLink[]> {
  const { rootCharacter, npcs, playerLinks, playerIdentity, previousIdentityNames, currentIdentityName } = input
  if (!playerLinks.length) return playerLinks

  const idToName = characterNameById(rootCharacter, npcs)

  const linkRows = playerLinks.map((link) => {
    const name = idToName.get(link.characterId) ?? '角色'
    return {
      characterName: name,
      relationThemToYou: String(link.relationThemToYou ?? '').trim(),
      theySeeYou: String(link.theySeeYou ?? '').trim(),
      theyCallYou: String(link.theyCallYou ?? '').trim(),
    }
  })

  const prevNames = previousIdentityNames.filter(Boolean).join('、') || '（未知）'
  const genderRules = playerIdentityGenderRulesForAi(playerIdentity?.gender)
  const identityBlock = playerIdentity
    ? `姓名：${currentIdentityName}
性别：${genderLabelZh(playerIdentity.gender)}
年龄：${playerIdentity.age != null && Number.isFinite(playerIdentity.age) ? `${playerIdentity.age}岁` : '未设定'}
职业/身份：${playerIdentity.identity?.trim() || '未设定'}
简介：${playerIdentity.bio?.trim() || '无'}`
    : `姓名：${currentIdentityName}`

  const system = `你是人设编辑助手。用户绑定身份已从「${prevNames}」切换为「${currentIdentityName}」。
请为每名角色重新生成：
- theyCallYou：该角色平时如何称呼操作者「你」（短词或短语，如「小姚」「老同学」「兄弟」）；
- theySeeYou：【该角色看你】的完整一句第三人称旁白（描述该角色对「你」的看法与相处体感，须出现角色名与对操作者的指称，禁止「玩家」二字）。
只输出 JSON 数组，每项字段：characterName（必须与输入完全一致）、theyCallYou、theySeeYou。
禁止输出其它字段；禁止把旧身份名「${prevNames}」当作对新身份的称呼或看法。
${genderRules}`

  const user = `【新身份参考】
${identityBlock}

【各角色对你（操作者）的现有关系、称呼与看法】
${linkRows
  .map(
    (r) =>
      `- ${r.characterName}：关系词=${r.relationThemToYou || '—'}；称呼你=${r.theyCallYou || '（空）'}；看法=${r.theySeeYou || '—'}`,
  )
  .join('\n')}

请为以上每一名角色输出 theyCallYou 与 theySeeYou，须与关系、新身份姓名与性别整体自洽。`

  const raw = await openAiCompatibleChat(cfg, [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ])

  let rows: AiPlayerLinkRow[]
  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as unknown
    if (!Array.isArray(parsed)) throw new Error('not array')
    rows = parsed as AiPlayerLinkRow[]
  } catch {
    throw new Error('AI 返回 JSON 无法解析')
  }

  const byName = new Map<string, AiPlayerLinkRow>()
  for (const row of rows) {
    const name = String(row?.characterName ?? '').trim()
    if (!name) continue
    byName.set(name, row)
  }

  return playerLinks.map((link) => {
    const name = idToName.get(link.characterId)
    if (!name || !byName.has(name)) return link
    const row = byName.get(name)!
    return {
      ...link,
      theyCallYou: String(row.theyCallYou ?? '').trim() || link.theyCallYou,
      theySeeYou: String(row.theySeeYou ?? '').trim() || link.theySeeYou,
    }
  })
}
