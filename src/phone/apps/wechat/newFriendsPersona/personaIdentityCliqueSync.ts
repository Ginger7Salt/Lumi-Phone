import type { ApiConfig } from '../../api/types'
import { openAiCompatibleChat } from './ai'
import { listAfterAttitudeWorldBookItems } from './personaIdentityBindingAudit'
import { playerIdentityGenderRulesForAi } from './personaIdentityGenderRules'
import type { Character, PlayerIdentity, PlayerNetworkLink } from './types'
import { genderLabelZh } from './utils'

type AiAfterEntryRow = {
  entryName: string
  content: string
}

type AiAfterCharacterRow = {
  characterName: string
  entries: AiAfterEntryRow[]
}

export type RegenerateAfterAttitudeInput = {
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

function characterNameById(rootCharacter: Character, npcs: Character[]): Map<string, string> {
  const map = new Map<string, string>()
  map.set(rootCharacter.id, rootCharacter.name.trim() || '主角')
  for (const n of npcs) map.set(n.id, n.name.trim() || 'NPC')
  return map
}

function linkByCharacterId(links: PlayerNetworkLink[]): Map<string, PlayerNetworkLink> {
  return new Map(links.map((l) => [l.characterId, l]))
}

/**
 * 按新身份重写各角色世界书「当前对你的态度」中的尾声延展条目正文。
 */
export async function regenerateAfterAttitudeEntriesForClique(
  cfg: ApiConfig,
  input: RegenerateAfterAttitudeInput,
): Promise<Character[]> {
  const { rootCharacter, npcs, playerLinks, playerIdentity, previousIdentityNames, currentIdentityName } = input
  const clique = [rootCharacter, ...npcs]
  const idToName = characterNameById(rootCharacter, npcs)
  const linksById = linkByCharacterId(playerLinks)

  const rowsForPrompt: Array<{
    characterName: string
    theySeeYou: string
    theyCallYou: string
    entries: Array<{ entryName: string; content: string }>
  }> = []

  for (const ch of clique) {
    const items = listAfterAttitudeWorldBookItems(ch).filter((x) => x.worldBookName === '当前对你的态度')
    if (!items.length) continue
    const link = linksById.get(ch.id)
    rowsForPrompt.push({
      characterName: (idToName.get(ch.id) ?? ch.name.trim()) || '角色',
      theySeeYou: String(link?.theySeeYou ?? '').trim(),
      theyCallYou: String(link?.theyCallYou ?? '').trim(),
      entries: items.map((it) => ({
        entryName: it.itemName,
        content: it.content,
      })),
    })
  }

  if (!rowsForPrompt.length) return []

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
请为每名角色重写世界书「当前对你的态度」中的尾声延展（priority=after）条目正文。
只输出 JSON 数组；每项：characterName（与输入完全一致）、entries（数组，每项 entryName 与输入条目名完全一致、content 为替换后全文）。
正文须用「{{char}}」指该角色本人、「{{user}}」指操作者；禁止写「玩家」；禁止把旧身份名「${prevNames}」当作对新身份的指称。
文风：第三人称旁白、口语化，描述该角色对 {{user}} 的当前态度与相处体感；勿书信体、勿第一人称台词。
${genderRules}`

  const user = `【新身份参考】
${identityBlock}

【各角色现有态度条目（请按 entryName 逐条重写 content）】
${rowsForPrompt
  .map(
    (r) =>
      `- ${r.characterName}（称呼你：${r.theyCallYou || '—'}；看法摘要：${r.theySeeYou || '—'}）\n${r.entries
        .map((e) => `  · ${e.entryName}：${e.content || '（空）'}`)
        .join('\n')}`,
  )
  .join('\n\n')}`

  const raw = await openAiCompatibleChat(cfg, [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ])

  let aiRows: AiAfterCharacterRow[]
  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as unknown
    if (!Array.isArray(parsed)) throw new Error('not array')
    aiRows = parsed as AiAfterCharacterRow[]
  } catch {
    throw new Error('AI 返回 JSON 无法解析')
  }

  const nameToAi = new Map<string, AiAfterCharacterRow>()
  for (const row of aiRows) {
    const name = String(row?.characterName ?? '').trim()
    if (name) nameToAi.set(name, row)
  }

  const updated: Character[] = []
  const now = Date.now()

  for (const ch of clique) {
    const charName = idToName.get(ch.id)
    if (!charName) continue
    const ai = nameToAi.get(charName)
    if (!ai?.entries?.length) continue

    const byEntryName = new Map<string, string>()
    for (const e of ai.entries) {
      const en = String(e?.entryName ?? '').trim()
      const content = String(e?.content ?? '').trim()
      if (en && content) byEntryName.set(en, content)
    }
    if (!byEntryName.size) continue

    let changed = false
    const worldBooks = (ch.worldBooks ?? []).map((wb) => {
      if (wb.name?.trim() !== '当前对你的态度') return wb
      const items = (wb.items ?? []).map((it) => {
        if (it.priority !== 'after') return it
        const next = byEntryName.get(it.name?.trim() || '')
        if (!next || next === String(it.content ?? '').trim()) return it
        changed = true
        return { ...it, content: next, updatedAt: now }
      })
      return { ...wb, items }
    })

    if (changed) {
      updated.push({ ...ch, worldBooks, updatedAt: now })
    }
  }

  return updated
}

export function mergeUpdatedCharactersIntoClique(
  rootCharacter: Character,
  npcs: Character[],
  updated: Character[],
): { root: Character; npcs: Character[] } {
  const byId = new Map(updated.map((c) => [c.id, c]))
  const root = byId.get(rootCharacter.id) ?? rootCharacter
  const nextNpcs = npcs.map((n) => byId.get(n.id) ?? n)
  return { root, npcs: nextNpcs }
}

/** 批量写回角色档案 */
export async function persistCliqueCharacterUpdates(characters: Character[]): Promise<void> {
  if (!characters.length) return
  const { emitWeChatStorageChanged, personaDb } = await import('./idb')
  for (const ch of characters) {
    await personaDb.upsertCharacter(ch)
  }
  emitWeChatStorageChanged()
}

export type IdentityCliqueSyncScope = 'addressing' | 'afterEntries' | 'all'

export async function runIdentityCliqueSyncWithAi(
  cfg: ApiConfig,
  scope: IdentityCliqueSyncScope,
  input: RegenerateAfterAttitudeInput & { playerLinks: PlayerNetworkLink[] },
): Promise<{ updatedLinks: PlayerNetworkLink[]; updatedCharacters: Character[] }> {
  const { regeneratePlayerAddressingAfterImport } = await import('./personaImportAddressingAi')
  let updatedLinks = input.playerLinks
  let updatedCharacters: Character[] = []

  if (scope === 'addressing' || scope === 'all') {
    updatedLinks = await regeneratePlayerAddressingAfterImport(cfg, {
      rootCharacter: input.rootCharacter,
      npcs: input.npcs,
      playerLinks: input.playerLinks,
      playerIdentity: input.playerIdentity,
      previousIdentityNames: input.previousIdentityNames,
      currentIdentityName: input.currentIdentityName,
    })
  }

  if (scope === 'afterEntries' || scope === 'all') {
    updatedCharacters = await regenerateAfterAttitudeEntriesForClique(cfg, {
      rootCharacter: input.rootCharacter,
      npcs: input.npcs,
      playerLinks: updatedLinks,
      playerIdentity: input.playerIdentity,
      previousIdentityNames: input.previousIdentityNames,
      currentIdentityName: input.currentIdentityName,
    })
  }

  return { updatedLinks, updatedCharacters }
}
