import type { Character, Gender, PlayerIdentity, PlayerNetworkLink } from './types'
import {
  addressingGenderMismatch,
  describeGenderMismatchInAddressing,
  describeGenderMismatchInView,
  viewTextGenderMismatch,
} from './personaIdentityGenderRules'
import { isCliqueIdentitySyncAckCurrent } from './personaIdentitySyncAck'

export type AfterAttitudeItemRef = {
  characterId: string
  characterName: string
  worldBookId: string
  worldBookName: string
  itemId: string
  itemName: string
  content: string
}

export type IdentityBindingIssueKind =
  | 'character_binding_id'
  | 'worldbook_binding_name'
  | 'worldbook_binding_id'
  | 'player_addressing'
  | 'player_addressing_gender'
  | 'player_view_text'
  | 'player_view_gender'
  | 'after_attitude_content'
  | 'after_attitude_gender'
  | 'identity_relationship_text'

export type IdentityBindingIssue = {
  kind: IdentityBindingIssueKind
  characterId?: string
  characterName?: string
  detail: string
}

export type CliqueIdentityBindingAudit = {
  needsAttention: boolean
  boundIdentityId: string
  currentIdentityName: string
  currentIdentityGender: Gender | undefined
  /** 检测到的外来/旧身份显示名（去重） */
  foreignIdentityNames: string[]
  /** 兼容旧 UI 字段，同 foreignIdentityNames */
  previousIdentityNames: string[]
  issues: IdentityBindingIssue[]
  hasStalePlayerAddressing: boolean
  stalePlayerAddressingCount: number
  staleAddressingSamples: string[]
  hasStalePlayerView: boolean
  stalePlayerViewCount: number
  staleViewSamples: string[]
  hasAfterAttitudeEntries: boolean
  afterAttitudeEntryCount: number
  afterContentMentionsForeignNames: boolean
  afterAttitudeItems: AfterAttitudeItemRef[]
}

const ATTITUDE_BOOK_NAME = '当前对你的态度'

const HONORIFIC_SUFFIXES = [
  '同学',
  '小姐',
  '先生',
  '老师',
  '哥哥',
  '姐姐',
  '师兄',
  '师姐',
  '师妹',
  '师弟',
  '总',
  '兄',
  '弟',
  '妹',
  '哥',
  '姐',
]

const GENERIC_ADDRESSINGS = new Set([
  '你',
  '您',
  '同学',
  '朋友',
  '兄弟',
  '姐妹',
  '哥们',
  '亲',
  '老板',
  '同志',
  '喂',
  '嗨',
  '亲爱的',
  '大佬',
  '宝',
])

type IdentityTokens = {
  fullName: string
  displayName: string
  nickname: string
  surname: string | null
  allowedFragments: Set<string>
}

export function collectCharacterBindingDisplayNames(character: Character): string[] {
  const names = new Set<string>()
  for (const wb of character.worldBooks ?? []) {
    for (const it of wb.items ?? []) {
      for (const b of it.userPlaceholderBindings ?? []) {
        const n = b.displayName?.trim()
        if (n) names.add(n)
      }
    }
  }
  return [...names]
}

export function listAfterAttitudeWorldBookItems(character: Character): AfterAttitudeItemRef[] {
  const out: AfterAttitudeItemRef[] = []
  const charName = character.name?.trim() || '角色'
  for (const wb of character.worldBooks ?? []) {
    if (wb.enabled === false) continue
    const bookName = wb.name?.trim() || '未命名世界书'
    const isAttitudeBook = bookName === ATTITUDE_BOOK_NAME
    for (const it of wb.items ?? []) {
      if (it.enabled === false || it.priority !== 'after') continue
      const content = String(it.content ?? '').trim()
      if (!isAttitudeBook && !content) continue
      if (isAttitudeBook || content) {
        out.push({
          characterId: character.id,
          characterName: charName,
          worldBookId: wb.id,
          worldBookName: bookName,
          itemId: it.id,
          itemName: it.name?.trim() || '未命名条目',
          content,
        })
      }
    }
  }
  return out
}

function buildIdentityTokens(identity: PlayerIdentity | null, displayName: string): IdentityTokens {
  const fullName = (identity?.name || '').trim()
  const nickname = (identity?.wechatNickname || '').trim()
  const display = displayName.trim() || nickname || fullName
  const surname = fullName ? fullName[0]! : null
  const allowed = new Set<string>()
  for (const part of [fullName, nickname, display]) {
    if (part) allowed.add(part)
  }
  if (surname) allowed.add(surname)
  if (fullName.length >= 2) {
    allowed.add(fullName.slice(1))
    allowed.add(`小${surname}`)
  }
  return { fullName, displayName: display, nickname, surname, allowedFragments: allowed }
}

function isGenericAddressing(phrase: string): boolean {
  const p = phrase.trim()
  if (!p) return true
  if (GENERIC_ADDRESSINGS.has(p)) return true
  if (/^(老|小)?朋友$/.test(p)) return true
  if (/^(兄弟|姐妹|哥们|老铁|大佬)$/.test(p)) return true
  if (!/[\u4e00-\u9fff]/.test(p) && p.length <= 8) return true
  return false
}

function phraseAllowedByTokens(phrase: string, tokens: IdentityTokens): boolean {
  const p = phrase.trim()
  if (!p || isGenericAddressing(p)) return true
  if (tokens.allowedFragments.has(p)) return true
  if (tokens.fullName && p.includes(tokens.fullName)) return true
  if (tokens.displayName && p.includes(tokens.displayName)) return true
  if (tokens.nickname && p.includes(tokens.nickname)) return true
  if (tokens.surname && p.includes(tokens.surname)) return true
  return false
}

/** 从称呼里提取可能指向「他人」的姓/名片段，如「顾同学」→「顾」 */
function extractForeignFragmentFromAddressing(phrase: string, tokens: IdentityTokens): string | null {
  const p = phrase.trim()
  if (!p || isGenericAddressing(p)) return null
  if (phraseAllowedByTokens(p, tokens)) return null

  const xiao = p.match(/^小([\u4e00-\u9fff])$/)
  if (xiao) {
    const s = xiao[1]!
    if (tokens.surname && s === tokens.surname) return null
    return s
  }

  for (const suf of HONORIFIC_SUFFIXES.sort((a, b) => b.length - a.length)) {
    if (!p.endsWith(suf)) continue
    const prefix = p.slice(0, -suf.length).trim()
    if (!prefix) return null
    if (prefix.length === 1) {
      const s = prefix
      if (tokens.surname && s === tokens.surname) return null
      return s
    }
    if (phraseAllowedByTokens(prefix, tokens)) return null
    return prefix
  }

  if (p.length <= 4 && /[\u4e00-\u9fff]/.test(p)) return p
  return null
}

function contentMentionsForeignName(content: string, foreignNames: string[]): boolean {
  const text = String(content ?? '')
  if (!text.trim() || !foreignNames.length) return false
  return foreignNames.some((n) => n.length >= 1 && text.includes(n))
}

function collectForeignNamesFromBindings(
  clique: Character[],
  boundIdentityId: string,
  currentDisplayName: string,
): { foreignNames: Set<string>; issues: IdentityBindingIssue[] } {
  const foreignNames = new Set<string>()
  const issues: IdentityBindingIssue[] = []
  const current = currentDisplayName.trim()

  for (const ch of clique) {
    const charName = ch.name?.trim() || '角色'
    const bound = ch.playerIdentityId?.trim()
    if (boundIdentityId && bound && bound !== boundIdentityId) {
      issues.push({
        kind: 'character_binding_id',
        characterId: ch.id,
        characterName: charName,
        detail: `档案绑定身份 id 与主角不一致（${bound} ≠ ${boundIdentityId}）`,
      })
    }

    for (const wb of ch.worldBooks ?? []) {
      const bookName = wb.name?.trim() || '世界书'
      for (const it of wb.items ?? []) {
        for (const b of it.userPlaceholderBindings ?? []) {
          const dn = b.displayName?.trim()
          const bid = b.playerIdentityId?.trim()
          if (dn && current && dn !== current) {
            foreignNames.add(dn)
            issues.push({
              kind: 'worldbook_binding_name',
              characterId: ch.id,
              characterName: charName,
              detail: `世界书「${bookName}」条目「${it.name}」user 绑定显示名仍为「${dn}」，当前身份为「${current}」`,
            })
          }
          if (boundIdentityId && bid && bid !== boundIdentityId) {
            issues.push({
              kind: 'worldbook_binding_id',
              characterId: ch.id,
              characterName: charName,
              detail: `世界书「${bookName}」条目「${it.name}」user 绑定身份 id 不一致`,
            })
          }
        }
      }
    }
  }

  return { foreignNames, issues }
}

async function foreignNamesFromImportArchive(
  rootId: string,
  wechatAccountId: string | undefined,
  currentDisplayName: string,
): Promise<string[]> {
  const acc = wechatAccountId?.trim()
  if (!acc) return []
  const { listImportedCharacterBundleArchives } = await import('./characterBundleIo')
  const archives = await listImportedCharacterBundleArchives(acc)
  const hit = archives.find((a) => a.rootCharacterId.trim() === rootId.trim())
  if (!hit?.bundle) return []
  const chars = [hit.bundle.mainCharacter, ...(hit.bundle.npcs ?? [])]
  const names = new Set<string>()
  for (const ch of chars) {
    for (const n of collectCharacterBindingDisplayNames(ch)) names.add(n)
  }
  return [...names]
    .map((n) => n.trim())
    .filter((n) => n && n !== currentDisplayName.trim())
}

function liveTextBlob(clique: Character[], playerLinks: PlayerNetworkLink[]): string {
  const parts: string[] = []
  for (const link of playerLinks) {
    parts.push(String(link.theyCallYou ?? ''), String(link.theySeeYou ?? ''))
  }
  for (const ch of clique) {
    for (const wb of ch.worldBooks ?? []) {
      for (const it of wb.items ?? []) {
        parts.push(String(it.content ?? ''))
      }
    }
  }
  return parts.join('\n')
}

function archiveNameStillInLiveData(name: string, blob: string): boolean {
  const n = name.trim()
  if (!n || n.length < 1) return false
  return blob.includes(n)
}

function characterNameById(main: Character, npcs: Character[]): Map<string, string> {
  const map = new Map<string, string>()
  map.set(main.id, main.name?.trim() || '主角')
  for (const n of npcs) map.set(n.id, n.name?.trim() || 'NPC')
  return map
}

/** 检测人脉圈内绑定身份与各角色数据（称呼、世界书、尾声延展）是否一致 */
export async function auditCliqueIdentityBinding(opts: {
  rootId: string
  main: Character
  npcs: Character[]
  playerLinks: PlayerNetworkLink[]
  wechatAccountId?: string
  knownPreviousIdentityNames?: string[]
}): Promise<CliqueIdentityBindingAudit> {
  const { personaDb } = await import('./idb')
  const boundIdentityId =
    opts.main.playerIdentityId?.trim() || (await personaDb.getCurrentIdentityId()).trim() || ''
  let identityRow: PlayerIdentity | null = null
  if (boundIdentityId) {
    identityRow = await personaDb.getPlayerIdentity(boundIdentityId)
  }
  const { formatPlayerIdentityDisplayName } = await import('../wechatCharacterPlayerIdentity')
  const currentIdentityName = formatPlayerIdentityDisplayName(identityRow, boundIdentityId)
  const currentIdentityGender = identityRow?.gender
  const tokens = buildIdentityTokens(identityRow, currentIdentityName)

  const clique = [opts.main, ...opts.npcs]
  const idToName = characterNameById(opts.main, opts.npcs)
  const issues: IdentityBindingIssue[] = []
  const liveBlob = liveTextBlob(clique, opts.playerLinks)

  const syncAckCurrent = await isCliqueIdentitySyncAckCurrent(
    opts.rootId,
    boundIdentityId,
    currentIdentityName,
  )

  const foreignNames = new Set<string>()

  if (!syncAckCurrent) {
    for (const n of opts.knownPreviousIdentityNames ?? []) {
      const t = n.trim()
      if (t && t !== currentIdentityName && archiveNameStillInLiveData(t, liveBlob)) {
        foreignNames.add(t)
      }
    }
    for (const n of await foreignNamesFromImportArchive(
      opts.rootId,
      opts.wechatAccountId,
      currentIdentityName,
    )) {
      if (archiveNameStillInLiveData(n, liveBlob)) foreignNames.add(n)
    }
  }

  const bindingScan = collectForeignNamesFromBindings(clique, boundIdentityId, currentIdentityName)
  for (const n of bindingScan.foreignNames) foreignNames.add(n)
  issues.push(...bindingScan.issues)

  const staleAddressingSamples: string[] = []
  const staleViewSamples: string[] = []
  let stalePlayerAddressingCount = 0
  let stalePlayerViewCount = 0

  for (const link of opts.playerLinks) {
    const charName = idToName.get(link.characterId) ?? '角色'
    const call = String(link.theyCallYou ?? '').trim()
    const view = String(link.theySeeYou ?? '').trim()

    if (call) {
      const fragment = extractForeignFragmentFromAddressing(call, tokens)
      const genderBad = addressingGenderMismatch(call, currentIdentityGender)
      const mentionsForeignName = [...foreignNames].some((n) => n.length >= 2 && call.includes(n))
      const mentionsForeign = fragment != null || mentionsForeignName

      if (mentionsForeign || genderBad) {
        stalePlayerAddressingCount += 1
        staleAddressingSamples.push(`${charName} 称呼你「${call}」`)
        if (fragment) foreignNames.add(fragment)
        if (mentionsForeign) {
          issues.push({
            kind: 'player_addressing',
            characterId: link.characterId,
            characterName: charName,
            detail: `称呼「${call}」与当前身份「${currentIdentityName}」不一致`,
          })
        }
        const genderDetail = describeGenderMismatchInAddressing(call, currentIdentityGender)
        if (genderBad && genderDetail) {
          issues.push({
            kind: 'player_addressing_gender',
            characterId: link.characterId,
            characterName: charName,
            detail: genderDetail,
          })
        }
      }
    }

    if (view) {
      const foreignHit = [...foreignNames].find((n) => n.length >= 2 && view.includes(n))
      const viewFragment =
        !foreignHit && !syncAckCurrent && !phraseAllowedByTokens(view, tokens)
          ? extractForeignFragmentFromAddressing(view.slice(0, 12), tokens)
          : null
      const genderBad = viewTextGenderMismatch(view, currentIdentityGender)
      if (foreignHit || viewFragment || genderBad) {
        stalePlayerViewCount += 1
        staleViewSamples.push(`${charName} 的看法`)
        if (foreignHit) foreignNames.add(foreignHit)
        if (viewFragment) foreignNames.add(viewFragment)
        if (foreignHit || viewFragment) {
          issues.push({
            kind: 'player_view_text',
            characterId: link.characterId,
            characterName: charName,
            detail: `「${charName}看你」仍含旧身份表述`,
          })
        }
        const genderDetail = describeGenderMismatchInView(view, currentIdentityGender)
        if (genderBad && genderDetail) {
          issues.push({
            kind: 'player_view_gender',
            characterId: link.characterId,
            characterName: charName,
            detail: genderDetail,
          })
        }
      }
    }
  }

  const afterAttitudeItems = clique.flatMap((ch) =>
    listAfterAttitudeWorldBookItems(ch).filter((x) => x.worldBookName === ATTITUDE_BOOK_NAME),
  )
  const hasAfterAttitudeEntries = afterAttitudeItems.some((x) => x.content.trim().length > 0)
  const foreignList = [...foreignNames].filter(Boolean)

  for (const item of afterAttitudeItems) {
    if (!item.content.trim()) continue
    const genderBad = viewTextGenderMismatch(item.content, currentIdentityGender)
    if (contentMentionsForeignName(item.content, foreignList)) {
      issues.push({
        kind: 'after_attitude_content',
        characterId: item.characterId,
        characterName: item.characterName,
        detail: `尾声延展「${item.itemName}」正文仍含旧身份名`,
      })
    } else if (
      !syncAckCurrent &&
      !phraseAllowedByTokens(item.content.slice(0, 12), tokens)
    ) {
      const frag = extractForeignFragmentFromAddressing(item.content.slice(0, 12), tokens)
      if (frag) {
        foreignNames.add(frag)
        issues.push({
          kind: 'after_attitude_content',
          characterId: item.characterId,
          characterName: item.characterName,
          detail: `尾声延展「${item.itemName}」可能仍按旧身份撰写`,
        })
      }
    }
    if (genderBad) {
      issues.push({
        kind: 'after_attitude_gender',
        characterId: item.characterId,
        characterName: item.characterName,
        detail: `尾声延展「${item.itemName}」与当前身份性别不符`,
      })
    }
  }

  if (boundIdentityId) {
    const piRels = await personaDb.listRelationshipsForIdentity(boundIdentityId)
    const cliqueIds = new Set(clique.map((c) => c.id))
    for (const r of piRels) {
      if (!cliqueIds.has(r.fromCharacterId) && !cliqueIds.has(r.toCharacterId)) continue
      const text = `${r.fromPerspective} ${r.toPerspective} ${r.fromCallsTo}`
      for (const n of foreignList) {
        if (n.length >= 2 && text.includes(n)) {
          issues.push({
            kind: 'identity_relationship_text',
            detail: `身份绑定关系文案仍含「${n}」`,
          })
          break
        }
      }
    }
  }

  const foreignIdentityNames = [...foreignNames]
    .map((n) => n.trim())
    .filter((n) => n && n !== currentIdentityName)

  const dedupedIssues = issues.filter(
    (issue, idx) =>
      issues.findIndex(
        (x) => x.kind === issue.kind && x.detail === issue.detail && x.characterId === issue.characterId,
      ) === idx,
  )

  const hasStalePlayerAddressing = stalePlayerAddressingCount > 0
  const hasStalePlayerView = stalePlayerViewCount > 0
  const afterContentMentionsForeignNames = afterAttitudeItems.some((x) =>
    contentMentionsForeignName(x.content, foreignIdentityNames),
  )

  return {
    needsAttention: dedupedIssues.length > 0,
    boundIdentityId,
    currentIdentityName,
    currentIdentityGender,
    foreignIdentityNames,
    previousIdentityNames: foreignIdentityNames,
    issues: dedupedIssues,
    hasStalePlayerAddressing,
    stalePlayerAddressingCount,
    staleAddressingSamples,
    hasStalePlayerView,
    stalePlayerViewCount,
    staleViewSamples,
    hasAfterAttitudeEntries,
    afterAttitudeEntryCount: afterAttitudeItems.filter((x) => x.content.trim()).length,
    afterContentMentionsForeignNames,
    afterAttitudeItems,
  }
}
