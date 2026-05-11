import { upsertLoreEntry } from '../../worldbook/worldbookLoreStore'
import type { ComprehensivePersona } from './comprehensivePersona'
import { formatComprehensivePersonaMarkdown } from './formatComprehensivePersonaWorldbook'

const LORE_TITLE = '核心人设档案'

export function getMeetNineDossierEntryId(characterId: string): string {
  return `meet-nine-dossier-${characterId.trim()}`
}

/** 若 NPC 含九维档案则写入（或刷新）档案法则条目 */
export function ensureMeetNpcDossierInWorldbook(npc: {
  id: string
  nickname: string
  comprehensivePersona?: ComprehensivePersona | null
}): boolean {
  if (!npc.comprehensivePersona) return false
  syncMeetDossierToWorldbookLore(npc.id, npc.nickname, npc.comprehensivePersona)
  return true
}

/** 将九维档案写入全局档案法则（世界书），绑定指定角色 id */
export function syncMeetDossierToWorldbookLore(
  characterId: string,
  nickname: string,
  dossier: ComprehensivePersona,
): void {
  const id = getMeetNineDossierEntryId(characterId)
  upsertLoreEntry({
    id,
    title: LORE_TITLE,
    content: formatComprehensivePersonaMarkdown(nickname, dossier),
    enabled: true,
    plateScope: { mode: 'all' },
    characterScope: { mode: 'characters', ids: [characterId] },
    updatedAt: Date.now(),
  })
}

/** 遇见结业「初印象 / 尾声延展」条目 id（与九维档案分列） */
export function getMeetEpilogueImpressionEntryId(characterId: string): string {
  return `meet-epilogue-impression-${characterId.trim()}`
}

/** 互换联络完成后写入档案法则：尾声延展视角，作用范围为该 NPC 对应人设 id */
export function syncMeetEpilogueImpressionToWorldbookLore(params: {
  characterId: string
  playerDisplayName?: string
  content: string
}): void {
  const dn = params.playerDisplayName?.trim()
  const title = dn ? `对 ${dn} 的初印象 (Lumi Meet)` : '初遇印象 (Lumi Meet)'
  upsertLoreEntry({
    id: getMeetEpilogueImpressionEntryId(params.characterId),
    title,
    content: params.content.trim(),
    enabled: true,
    plateScope: { mode: 'all' },
    characterScope: { mode: 'characters', ids: [params.characterId] },
    updatedAt: Date.now(),
  })
}
