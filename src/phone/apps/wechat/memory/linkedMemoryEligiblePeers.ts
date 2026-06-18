import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'
import { resolveCanonicalCharacterId } from '../wechatGlobalCharacterRegistry'
import {
  applyMemoryIdPlaceholderCorrections,
  collectMemoryIdPlaceholderIds,
} from './memoryIdPlaceholderNormalize'
import { hasReverseCharacterRelationship } from '../newFriendsPersona/personaRoster/crossBindings/crossBindingEngine'

/**
 * 存档主角在「管理关系 / 人脉」中通过角色↔角色边绑定的其它主角（非 `generatedForCharacterId` 人脉子角色）。
 * 与 {@link personaDb.listNpcsFor} 互补，供关联记忆 linked 落库与模型 id 表共用。
 */
export async function listRelationshipBoundProtagonistPeers(archiveOwnerId: string): Promise<Character[]> {
  const owner = archiveOwnerId.trim()
  if (!owner) return []

  let rels: Awaited<ReturnType<typeof personaDb.listAllRelationships>> = []
  try {
    rels = await personaDb.listAllRelationships()
  } catch {
    return []
  }

  const peerIds = new Set<string>()
  for (const r of rels) {
    if (r.isPlayerIdentity) continue
    if (r.fromCharacterId === owner) peerIds.add(r.toCharacterId.trim())
    else if (
      r.toCharacterId === owner &&
      hasReverseCharacterRelationship(rels, r)
    ) {
      peerIds.add(r.fromCharacterId.trim())
    }
  }

  const out: Character[] = []
  for (const id of peerIds) {
    if (!id || id === owner) continue
    let ch: Character | null = null
    try {
      ch = await personaDb.getCharacter(id)
    } catch {
      ch = null
    }
    if (!ch) continue
    if (ch.generatedForCharacterId?.trim() === owner) continue
    out.push(ch)
  }
  return out
}

export function characterDisplayNameForIdMap(ch: Character | null, id: string): string {
  const name = String(ch?.name ?? ch?.wechatNickname ?? '').trim()
  if (name) return name
  const nid = id.trim()
  if (nid.length <= 12) return nid
  return nid.slice(0, 12) + '…'
}

/** 人设 id 去连字符后的前 8 位，用于匹配模型臆造的 id 简码 / 伪 UUID（仅 hex）。 */
export function compactCharacterIdPrefix(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toLowerCase()
}

function isHexCompactPrefix(id: string): boolean {
  const compact = id.replace(/-/g, '')
  return compact.length >= 6 && /^[a-f0-9]+$/i.test(compact)
}

function isUnusableMemoryIdDisplayName(displayName: string, placeholderId: string): boolean {
  const dn = displayName.trim()
  if (!dn) return true
  const prefix = compactCharacterIdPrefix(placeholderId)
  if (prefix.length >= 6 && dn.toLowerCase() === prefix) return true
  if (/^[a-f0-9]{6,12}$/i.test(dn)) return true
  if (dn === placeholderId.trim()) return true
  return false
}

/**
 * 将记忆正文里的 `{{id:…}}` 键纠正为可解析的 canonical 人设 id（前缀匹配 / alias 表）。
 */
export async function resolveCanonicalCharacterIdForMemoryPlaceholder(
  placeholderId: string,
  knownPool: Iterable<string>,
): Promise<string | null> {
  const raw = placeholderId.trim()
  if (!raw) return null

  if (raw.endsWith('-') && /^ch-[a-z0-9-]*$/i.test(raw)) {
    let prefixMatch: string | null = null
    for (const id of knownPool) {
      const nid = id.trim()
      if (!nid.startsWith(raw) || nid.length <= raw.length) continue
      if (prefixMatch && prefixMatch !== nid) return prefixMatch
      prefixMatch = nid
    }
    if (prefixMatch) return prefixMatch
  }

  try {
    const ch = await personaDb.getCharacter(raw)
    if (ch?.id?.trim()) return ch.id.trim()
  } catch {
    /* continue */
  }

  const canon = (await resolveCanonicalCharacterId(raw)) || ''
  if (canon && canon !== raw) {
    try {
      const ch = await personaDb.getCharacter(canon)
      if (ch?.id?.trim()) return ch.id.trim()
    } catch {
      /* continue */
    }
  }

  const rawPrefix = compactCharacterIdPrefix(raw)
  if (rawPrefix.length >= 6 && isHexCompactPrefix(raw)) {
    let prefixMatch: string | null = null
    for (const id of knownPool) {
      const nid = id.trim()
      if (!nid) continue
      if (!isHexCompactPrefix(nid)) continue
      if (compactCharacterIdPrefix(nid) !== rawPrefix) continue
      if (prefixMatch && prefixMatch !== nid) return prefixMatch
      prefixMatch = nid
    }
    if (prefixMatch) return prefixMatch
  }
  return canon || null
}

/** 模型写错的 `{{id:…}}` → 正确 canonical id，供入库前替换。 */
export async function buildMemoryIdPlaceholderCorrections(
  texts: Iterable<string>,
  knownPool: Iterable<string>,
): Promise<Record<string, string>> {
  const pool = new Set<string>()
  for (const id of knownPool) {
    const nid = id.trim()
    if (nid) pool.add(nid)
  }
  const corrections: Record<string, string> = {}
  for (const id of collectMemoryIdPlaceholderIds(texts)) {
    const resolved = await resolveCanonicalCharacterIdForMemoryPlaceholder(id, pool)
    if (resolved && resolved !== id) corrections[id] = resolved
  }
  return corrections
}

/** @deprecated 使用 applyMemoryIdPlaceholderCorrections */
export function repairIdPlaceholdersInMemoryText(
  text: string,
  idCorrections: Readonly<Record<string, string>>,
): string {
  return applyMemoryIdPlaceholderCorrections(text, idCorrections)
}

/** 合并总结 primary：线上摘录里其它人设写 `{{id:…}}` 时用的对照表（含收藏原发送者）。 */
export async function buildMemorySummaryPrimaryIdRoster(params: {
  archiveRootId: string
  peerCharacterId: string
  extraCharacterIds?: readonly string[]
}): Promise<string> {
  const peer = params.peerCharacterId.trim()
  const owner = (params.archiveRootId.trim() || peer).trim()
  const lines: string[] = []
  const seen = new Set<string>()

  const addLine = async (id: string, materialHint?: string) => {
    const nid = id.trim()
    if (!nid || nid === peer || seen.has(nid)) return
    seen.add(nid)
    let ch: Character | null = null
    try {
      ch = await personaDb.getCharacter(nid)
    } catch {
      ch = null
    }
    const nm = characterDisplayNameForIdMap(ch, nid)
    const hint = materialHint?.trim()
    if (hint) {
      lines.push(`- {{id:${nid}}} ← 材料中「${hint}」`)
    } else {
      lines.push(`- {{id:${nid}}} ← ${nm}`)
    }
  }

  if (owner) {
    try {
      const { all } = await listAllLinkedMemoryEligibleCharacters(owner)
      for (const n of all) await addLine(n.id.trim())
    } catch {
      /* keep extra only */
    }
  }
  for (const extraId of params.extraCharacterIds ?? []) await addLine(extraId)

  if (!lines.length) {
    return '（无可用人设 id；primary 里其它角色请用「另一名角色」等泛称，禁止写 id 简码或臆造 UUID）'
  }
    return [
    '（primary.content 提到除 {{user}}/{{char}} 外的其它人设时，**必须**用下列 {{id:…}}，id 须与反引号内**完全一致**；只写一层，禁止 {{id:{{id:…}}}}）',
    ...lines,
  ].join('\n')
}

/** 存档主角 + 人脉子角色 + 已绑定跨档案主角 → `{{id:…}}` 展开表（与入库 sanitize 一致） */
export async function buildLinkedMemoryIdDisplayNameMap(
  archiveOwnerId: string,
  seed?: Readonly<Record<string, string>>,
): Promise<Record<string, string>> {
  const owner = archiveOwnerId.trim()
  const map: Record<string, string> = { ...(seed ?? {}) }
  if (!owner) return map

  let main: Character | null = null
  try {
    main = await personaDb.getCharacter(owner)
  } catch {
    main = null
  }
  map[owner] = characterDisplayNameForIdMap(main, owner)

  try {
    const { all } = await listAllLinkedMemoryEligibleCharacters(owner)
    for (const n of all) {
      const nid = n.id.trim()
      if (!nid) continue
      map[nid] = characterDisplayNameForIdMap(n, nid)
    }
  } catch {
    /* keep seed */
  }
  return map
}

/** @deprecated 使用 collectMemoryIdPlaceholderIds */
export function collectIdPlaceholderCharacterIds(texts: Iterable<string>): string[] {
  return collectMemoryIdPlaceholderIds(texts)
}

/** 正文中出现但未在档案人脉表里的 `{{id:…}}`（如跨角色绑定主角）按人设 id 兜底查库 */
export async function resolveMissingIdPlaceholderDisplayNames(
  idMap: Readonly<Record<string, string>>,
  texts: Iterable<string>,
  knownResolvePool?: Iterable<string>,
): Promise<Record<string, string>> {
  const out: Record<string, string> = { ...idMap }
  const pool = new Set<string>()
  for (const id of Object.keys(out)) {
    const nid = id.trim()
    if (nid) pool.add(nid)
  }
  for (const id of knownResolvePool ?? []) {
    const nid = id.trim()
    if (nid) pool.add(nid)
  }
  for (const id of collectMemoryIdPlaceholderIds(texts)) {
    const existing = String(out[id] ?? '').trim()
    if (existing && !isUnusableMemoryIdDisplayName(existing, id)) continue

    const resolvedId = await resolveCanonicalCharacterIdForMemoryPlaceholder(id, pool)
    const lookupId = resolvedId || id
    try {
      const ch = await personaDb.getCharacter(lookupId)
      const dn = characterDisplayNameForIdMap(ch, lookupId)
      out[id] = isUnusableMemoryIdDisplayName(dn, id) ? '其他角色' : dn
      if (resolvedId && resolvedId !== id) {
        out[resolvedId] = out[id]
        pool.add(resolvedId)
      }
    } catch {
      out[id] = isUnusableMemoryIdDisplayName(existing, id) ? '其他角色' : existing || '其他角色'
    }
  }
  return out
}

export async function listAllLinkedMemoryEligibleCharacters(archiveOwnerId: string): Promise<{
  npcs: Character[]
  boundProtagonists: Character[]
  all: Character[]
  allIds: Set<string>
}> {
  const owner = archiveOwnerId.trim()
  const npcs = (await personaDb.listNpcsFor(owner)) as Character[]
  const boundProtagonists = await listRelationshipBoundProtagonistPeers(owner)
  const seen = new Set<string>()
  const all: Character[] = []
  for (const row of [...npcs, ...boundProtagonists]) {
    const id = row.id.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    all.push(row)
  }
  return { npcs, boundProtagonists, all, allIds: seen }
}

/** 约会合并记忆附录：可写入 linked 的角色 id 表（人脉子角色 + 已绑定主角） */
export async function buildEligibleLinkedMemoryRosterForDatingAppendix(
  plotsArchiveId: string,
  datingPeerCharacterId: string,
): Promise<string> {
  const peer = datingPeerCharacterId.trim()
  const owner = plotsArchiveId.trim()
  if (!owner) return '（当前无可关联角色，linked 一般为 []）'

  let mainLabel = owner.slice(0, 8)
  try {
    const mainRow = await personaDb.getCharacter(owner)
    mainLabel = (mainRow?.name || mainRow?.wechatNickname || '').trim() || mainLabel
  } catch {
    /* keep slice */
  }

  const header = `- \`${owner}\`：${mainLabel}（线下存档主角；正文用 {{archive_char}}，**勿**将此 id 填入 linked.character_id）`

  try {
    const { npcs, boundProtagonists } = await listAllLinkedMemoryEligibleCharacters(owner)
    const npcLines = npcs
      .filter((n) => String(n.id || '').trim() && String(n.id).trim() !== peer)
      .map((n) => {
        const nm = (n.name || n.wechatNickname || '').trim() || '未命名'
        return `- \`${String(n.id).trim()}\`：${nm}（人脉子角色）`
      })
    const protagLines = boundProtagonists
      .filter((n) => String(n.id || '').trim() && String(n.id).trim() !== peer)
      .map((n) => {
        const nm = (n.name || n.wechatNickname || '').trim() || '未命名'
        return `- \`${String(n.id).trim()}\`：${nm}（已绑定主角）`
      })

    const sections: string[] = [header]
    if (npcLines.length) {
      sections.push('【人脉子角色】', npcLines.join('\n'))
    }
    if (protagLines.length) {
      sections.push('【已绑定主角】', protagLines.join('\n'))
    }
    if (!npcLines.length && !protagLines.length) {
      sections.push('（当前无人脉子角色且未绑定其它主角；linked 可为 []）')
    }
    return sections.join('\n')
  } catch {
    return `${header}\n（可关联角色列表读取失败；若无把握请 linked=[]）`
  }
}
