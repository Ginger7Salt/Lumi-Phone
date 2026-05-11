import { offlinePlotBodyRelevantToNpcForLinkedExcerpt } from '../dating/offlineDatingNpcSpeakerDetect'
import { collectCharacterMentionSearchTokens } from '../dating/offlineDatingArchiveResolve'
import { splitDatingAssistantOutput } from '../dating/plotCoT'
import { extractVnVoiceParamsBlock } from '../dating/vnVoiceParamsStrip'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'

const PER_NPC_CAP = 4500
const PER_PLOT_SNIP = 1200

/** 与 {@link unifiedMemoryAutoSummary.DatingPlotSnapshotItem} 结构一致，避免循环依赖 */
type PlotSnap = { type: string; content: string; timestamp?: number }

function plotBodyForExcerpt(p: PlotSnap): string {
  const raw = String(p.content || '').trim()
  if (!raw) return ''
  if (p.type === 'ai') {
    const prose = splitDatingAssistantOutput(raw).content.trim()
    return extractVnVoiceParamsBlock(prose).cleanedText.trim()
  }
  return raw
}

/**
 * 为「合并自动总结」拼出各人脉 NPC 在本次未游标线下剧情中的有关摘录，供模型同轮生成 `linked` 记忆。
 * `archiveCharacterId` 为 KV 存档归属 id（与 {@link resolveOfflineDatingArchiveContext} 一致）。
 */
export async function buildNpcLinkedOfflineExcerptUserBlock(params: {
  archiveCharacterId: string
  perspectiveCharacterId: string
  offlinePlots: PlotSnap[]
}): Promise<{ linkedArchiveOwnerId: string; allowedNpcIds: Set<string>; block: string }> {
  const archiveId = params.archiveCharacterId.trim()
  const peerId = params.perspectiveCharacterId.trim()
  const linkedArchiveOwnerId = archiveId || peerId
  if (!params.offlinePlots.length || !archiveId) {
    return { linkedArchiveOwnerId, allowedNpcIds: new Set(), block: '（无）' }
  }
  const npcs = await personaDb.listNpcsFor(archiveId)
  const sections: string[] = []
  const allowed = new Set<string>()
  for (const npc of npcs) {
    const nid = npc.id.trim()
    if (!nid || nid === peerId) continue
    const ch = npc as Character
    const mentionTokens = collectCharacterMentionSearchTokens(ch)
    const chunks: string[] = []
    let total = 0
    for (const plot of params.offlinePlots) {
      const body = plotBodyForExcerpt(plot)
      if (!body) continue
      if (!offlinePlotBodyRelevantToNpcForLinkedExcerpt(body, ch, mentionTokens)) continue
      const snip = body.length > PER_PLOT_SNIP ? `${body.slice(0, PER_PLOT_SNIP)}\n…` : body
      const piece = snip.length + 24
      if (total + piece > PER_NPC_CAP) break
      chunks.push(snip)
      total += piece
    }
    if (!chunks.length) continue
    allowed.add(nid)
    const label = (npc.name || npc.wechatNickname || nid).trim()
    sections.push(`### character_id: ${nid}\n显示名：${label}\n${chunks.join('\n\n---\n\n')}`)
  }
  if (!sections.length) return { linkedArchiveOwnerId, allowedNpcIds: new Set(), block: '（无）' }
  return { linkedArchiveOwnerId, allowedNpcIds: allowed, block: sections.join('\n\n===\n\n') }
}
