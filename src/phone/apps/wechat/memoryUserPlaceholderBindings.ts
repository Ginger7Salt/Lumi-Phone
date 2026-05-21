import { personaDb } from './newFriendsPersona/idb'
import type { Character, CharacterMemory, WorldBookUserPlaceholderBinding } from './newFriendsPersona/types'
import { resolveBindingDisplayName } from './worldBookUserPlaceholderBindings'
import {
  bindingFromInsertContext,
  countWorldBookUserPlaceholderSlots,
  normalizeWorldBookItemUserPlaceholders,
} from './worldBookUserPlaceholderBindings'
import {
  resolveWorldBookUserInsertContext,
  type WorldBookUserInsertContext,
} from './charUserPlaceholders'
import { normalizeMemorySummaryBodyAfterModel } from './memory/memorySummaryContentNormalize'
import { getCharacterBoundPlayerIdentityId } from './wechatCharacterPlayerIdentity'
import { resolvePlayerIdentityWechatAccountId } from './wechatContactIdentityPrompt'
import {
  parsePrivateWeChatConversationCharacterAndSession,
  parseWechatAccountPrivateConversationKey,
  resolvePrivateWeChatStorageConversationKey,
} from './wechatConversationKey'

function isAnonymousMemoryUserDisplayName(name: string): boolean {
  const n = name.trim()
  return !n || n === '未命名身份' || n === '微信账号槽位' || n === '用户'
}

/** 有微信马甲 + 扮演身份 id 即可写入 `userPlaceholderBindings`（显示名可为「未命名身份」）。 */
export function hasMemoryUserPlaceholderBindIds(
  ctx: WorldBookUserInsertContext | null | undefined,
): boolean {
  const acc = ctx?.wechatAccountId?.trim()
  const pid = ctx?.playerIdentityId?.trim()
  return !!(acc && pid && pid !== '__none__')
}

async function resolveWechatAccountAndSessionForDatingLinked(params: {
  conversationKey: string
  datingPeerCharacterId: string
  archiveRootId: string
}): Promise<{ wechatAccountId: string; sessionPlayerId: string } | null> {
  const ck = params.conversationKey.trim()
  const scoped = parseWechatAccountPrivateConversationKey(ck)
  if (scoped?.wechatAccountId?.trim()) {
    return {
      wechatAccountId: scoped.wechatAccountId.trim(),
      sessionPlayerId: (scoped.sessionPlayerId || '__none__').trim() || '__none__',
    }
  }

  const legacy = parsePrivateWeChatConversationCharacterAndSession(ck)
  const sessionFromKey = legacy?.sessionPlayerId?.trim() || ''
  const peerId = params.datingPeerCharacterId.trim()
  const archId = params.archiveRootId.trim() || peerId

  for (const cid of [peerId, archId]) {
    if (!cid) continue
    try {
      const ch = await personaDb.getCharacter(cid)
      const boundPid = getCharacterBoundPlayerIdentityId(ch)
      const pid =
        sessionFromKey && sessionFromKey !== '__none__'
          ? sessionFromKey
          : (boundPid || '').trim()
      if (!pid || pid === '__none__') continue
      let row = null
      try {
        row = await personaDb.getPlayerIdentity(pid)
      } catch {
        row = null
      }
      const acc = resolvePlayerIdentityWechatAccountId(ch, pid, row)
      if (acc) return { wechatAccountId: acc, sessionPlayerId: pid }
    } catch {
      continue
    }
  }

  try {
    const cur = await personaDb.getCurrentIdentity()
    const acc = cur?.wechatAccountId?.trim()
    const pid =
      sessionFromKey && sessionFromKey !== '__none__'
        ? sessionFromKey
        : (cur?.id || '').trim()
    if (acc && pid && pid !== '__none__') {
      return { wechatAccountId: acc, sessionPlayerId: pid }
    }
  } catch {
    /* */
  }
  return null
}

/**
 * 约会关联记忆入库：会话键身份 → 当前全局身份 → 存档主角/约会对象绑定身份。
 * 显示名即使为「未命名身份」也仍绑定账号·身份 id，避免 {{user}} 槽位显示未绑定。
 */
export async function resolveDatingLinkedMemoryUserBindCtx(params: {
  conversationKey: string
  datingPeerCharacterId: string
  archiveRootId: string
}): Promise<WorldBookUserInsertContext | null> {
  const ck = params.conversationKey.trim()
  const accSess = await resolveWechatAccountAndSessionForDatingLinked({
    conversationKey: ck,
    datingPeerCharacterId: params.datingPeerCharacterId,
    archiveRootId: params.archiveRootId,
  })
  if (!accSess) return null
  const acc = accSess.wechatAccountId
  const sessionPid = accSess.sessionPlayerId

  let datingPeerRow: Character | null = null
  let archiveRow: Character | null = null
  const peerId = params.datingPeerCharacterId.trim()
  const archId = params.archiveRootId.trim() || peerId
  try {
    if (peerId) datingPeerRow = await personaDb.getCharacter(peerId)
  } catch {
    datingPeerRow = null
  }
  try {
    if (archId) archiveRow = await personaDb.getCharacter(archId)
  } catch {
    archiveRow = null
  }

  let globalPid = ''
  try {
    globalPid = (await personaDb.getCurrentIdentityId()).trim()
  } catch {
    globalPid = ''
  }

  const boundPeerPid = datingPeerRow ? getCharacterBoundPlayerIdentityId(datingPeerRow) : ''
  const boundArchPid = archiveRow ? getCharacterBoundPlayerIdentityId(archiveRow) : ''

  const tries: Array<{ pid?: string | null; character?: Character | null }> = [
    { pid: sessionPid, character: datingPeerRow },
    { pid: globalPid, character: datingPeerRow },
    { pid: boundPeerPid, character: datingPeerRow },
    { pid: sessionPid, character: archiveRow },
    { pid: globalPid, character: archiveRow },
    { pid: boundArchPid, character: archiveRow },
  ]

  for (const t of tries) {
    const ctx = await resolveMemoryUserInsertContextFromSource(acc, t.pid, {
      character: t.character ?? undefined,
    })
    if (hasMemoryUserPlaceholderBindIds(ctx)) return ctx
  }

  return resolveMemoryUserInsertContextFromSource(acc, sessionPid, {
    character: datingPeerRow ?? archiveRow,
  })
}

/** 由总结来源线（微信账号 + 扮演身份）解析为与世界书插入一致的绑定上下文。 */
export async function resolveMemoryUserInsertContextFromSource(
  sourceWechatAccountId?: string | null,
  sourceSessionPlayerIdentityId?: string | null,
  opts?: { character?: Character | null; characterId?: string | null },
): Promise<WorldBookUserInsertContext | null> {
  const acc = sourceWechatAccountId?.trim()
  const pid = sourceSessionPlayerIdentityId?.trim()
  if (!acc) return null
  let character = opts?.character ?? null
  const cid = opts?.characterId?.trim()
  if (!character && cid) {
    try {
      character = await personaDb.getCharacter(cid)
    } catch {
      character = null
    }
  }
  return resolveWorldBookUserInsertContext({
    wechatAccountId: acc,
    playerIdentityId: pid || undefined,
    character,
  })
}

/**
 * 记忆列表/详情展开 `{{user}}`：优先槽位绑定与 source*，人脉 NPC 关联记忆回落到 linkedFrom 存档主角的绑定身份。
 */
export async function resolveMemoryExpandUserName(
  memory: CharacterMemory,
  ownerRow: Character | null,
  baseUserName: string,
): Promise<string> {
  const rootId =
    memory.memoryScope === 'linked'
      ? (memory.linkedFromCharacterId || '').trim() || ownerRow?.generatedForCharacterId?.trim() || ''
      : ''
  let archiveRow: Character | null = ownerRow
  if (rootId && rootId !== ownerRow?.id?.trim()) {
    try {
      archiveRow = await personaDb.getCharacter(rootId)
    } catch {
      archiveRow = ownerRow
    }
  }
  const bindingCharacter =
    memory.memoryScope === 'linked' && archiveRow ? archiveRow : ownerRow

  const content = String(memory.content ?? '')
  if (content.includes('{{user')) {
    const bindings = memory.userPlaceholderBindings ?? []
    for (const b of bindings) {
      if (!b?.playerIdentityId?.trim()) continue
      const name = await resolveBindingDisplayName(b, bindingCharacter)
      if (!isAnonymousMemoryUserDisplayName(name)) return name
    }
  }

  for (const ch of [archiveRow, ownerRow]) {
    if (!ch) continue
    const ctx = await resolveWorldBookUserInsertContext({
      wechatAccountId: memory.sourceWechatAccountId,
      playerIdentityId: memory.sourceSessionPlayerIdentityId,
      character: ch,
    })
    const dn = ctx?.displayName?.trim() ?? ''
    if (!isAnonymousMemoryUserDisplayName(dn)) return dn
  }

  const srcCtx = await resolveMemoryUserInsertContextFromSource(
    memory.sourceWechatAccountId,
    memory.sourceSessionPlayerIdentityId,
    { character: archiveRow ?? ownerRow },
  )
  const srcDn = srcCtx?.displayName?.trim() ?? ''
  if (!isAnonymousMemoryUserDisplayName(srcDn)) return srcDn

  return baseUserName
}

/** 总结入库：正文中每个 `{{user}}` 绑定到同一条来源线（该段对话的账号·身份）。 */
export function buildMemoryUserPlaceholderBindingsForContent(
  content: string,
  ctx: WorldBookUserInsertContext | null,
): WorldBookUserPlaceholderBinding[] {
  if (!ctx) return []
  const n = countWorldBookUserPlaceholderSlots(content)
  if (!n) return []
  return Array.from({ length: n }, () => bindingFromInsertContext(ctx))
}

export type SanitizedMemoryBody = {
  content: string
  userPlaceholderBindings: WorldBookUserPlaceholderBinding[]
}

/** 手动保存记忆：按来源线合并 `{{user}}` 槽位绑定（不覆盖已有绑定）。 */
export async function reconcileMemoryUserPlaceholdersOnSave(
  params: Pick<
    CharacterMemory,
    'content' | 'userPlaceholderBindings' | 'sourceWechatAccountId' | 'sourceSessionPlayerIdentityId'
  >,
  opts?: { fallback?: WorldBookUserInsertContext | null },
): Promise<SanitizedMemoryBody> {
  const content = String(params.content ?? '')
  const existing = params.userPlaceholderBindings ?? []
  if (!content.includes('{{user')) {
    return { content, userPlaceholderBindings: existing }
  }
  const fallback =
    opts?.fallback ??
    (await resolveMemoryUserInsertContextFromSource(
      params.sourceWechatAccountId,
      params.sourceSessionPlayerIdentityId,
    ))
  return attachMemoryUserPlaceholderBindings({ content, userPlaceholderBindings: existing }, fallback)
}

export function attachMemoryUserPlaceholderBindings(
  sanitized: SanitizedMemoryBody,
  bindCtx: WorldBookUserInsertContext | null,
): SanitizedMemoryBody {
  const content = sanitized.content
  if (!bindCtx || !content.includes('{{user')) {
    return { content, userPlaceholderBindings: sanitized.userPlaceholderBindings ?? [] }
  }
  const sync = normalizeWorldBookItemUserPlaceholders(
    content,
    sanitized.userPlaceholderBindings,
    bindCtx,
  )
  return { content: sync.content, userPlaceholderBindings: sync.bindings }
}

export function memoryNeedsUserPlaceholderAlignment(m: CharacterMemory): boolean {
  const slots = countWorldBookUserPlaceholderSlots(m.content ?? '')
  if (!slots) return false
  const bindings = m.userPlaceholderBindings ?? []
  if (bindings.some((b) => isAnonymousMemoryUserDisplayName(b.displayName ?? ''))) return true
  const bound = bindings.filter((b) => b.wechatAccountId?.trim() && b.playerIdentityId?.trim()).length
  if (bound < slots) return true
  return normalizeWorldBookItemUserPlaceholders(m.content ?? '', m.userPlaceholderBindings, null).changed
}

async function resolveAlignFallbackCharacterForMemory(
  memory: CharacterMemory,
): Promise<Character | null> {
  if (memory.memoryScope === 'linked') {
    const root = memory.linkedFromCharacterId?.trim()
    if (root) {
      try {
        return await personaDb.getCharacter(root)
      } catch {
        /* fall through */
      }
    }
  }
  const ownerId = memory.characterId.trim()
  if (!ownerId) return null
  try {
    const owner = await personaDb.getCharacter(ownerId)
    if (memory.memoryScope === 'linked') {
      const parent = owner?.generatedForCharacterId?.trim()
      if (parent) {
        try {
          return await personaDb.getCharacter(parent)
        } catch {
          return owner
        }
      }
    }
    return owner
  } catch {
    return null
  }
}

/** 单条记忆：按 source* 或已有绑定对齐 `{{user}}` 槽位。 */
export async function alignCharacterMemoryUserPlaceholders(
  memory: CharacterMemory,
  opts?: { fallback?: WorldBookUserInsertContext | null },
): Promise<CharacterMemory> {
  const alignCharacter = await resolveAlignFallbackCharacterForMemory(memory)
  let fallback =
    opts?.fallback ??
    (await resolveMemoryUserInsertContextFromSource(
      memory.sourceWechatAccountId,
      memory.sourceSessionPlayerIdentityId,
      { character: alignCharacter },
    ))
  if (
    memory.memoryScope === 'linked' &&
    memory.sourceWechatAccountId?.trim() &&
    isAnonymousMemoryUserDisplayName(fallback?.displayName ?? '')
  ) {
    const acc = memory.sourceWechatAccountId.trim()
    const sid = memory.sourceSessionPlayerIdentityId?.trim() || '__none__'
    const npcId = memory.characterId.trim()
    const ck = resolvePrivateWeChatStorageConversationKey(npcId, acc, sid)
    const arch = memory.linkedFromCharacterId?.trim() || ''
    const datingCtx = await resolveDatingLinkedMemoryUserBindCtx({
      conversationKey: ck,
      datingPeerCharacterId: arch || npcId,
      archiveRootId: arch,
    })
    if (datingCtx && !isAnonymousMemoryUserDisplayName(datingCtx.displayName)) {
      fallback = datingCtx
    }
  }
  const sync = normalizeWorldBookItemUserPlaceholders(
    memory.content ?? '',
    memory.userPlaceholderBindings,
    fallback,
  )
  const content = normalizeMemorySummaryBodyAfterModel(sync.content)
  const firstPersonFixed = content !== (memory.content ?? '').trim()
  if (!sync.changed && !memoryNeedsUserPlaceholderAlignment(memory) && !firstPersonFixed) return memory
  return {
    ...memory,
    content,
    userPlaceholderBindings: sync.bindings,
    updatedAt: Date.now(),
  }
}

/** 某角色（及群记忆桶）下全部记忆条目对齐；返回写回条数。 */
export async function alignCharacterMemoriesUserPlaceholders(
  characterId: string,
): Promise<number> {
  const cid = characterId.trim()
  if (!cid) return 0
  const list = await personaDb.listCharacterMemoriesForCharacter(cid)
  let written = 0
  for (const m of list) {
    if (!memoryNeedsUserPlaceholderAlignment(m)) continue
    const next = await alignCharacterMemoryUserPlaceholders(m)
    if (next === m) continue
    await personaDb.upsertCharacterMemory(next)
    written += 1
  }
  return written
}

/** 全库记忆 `{{user}}` 槽位统计（供记忆档案馆「对齐」按钮） */
export function summarizeMemoryUserPlaceholders(memories: CharacterMemory[]): {
  slotCount: number
  boundCount: number
  memoryCount: number
  needsAlign: boolean
} {
  let slotCount = 0
  let boundCount = 0
  let memoryCount = 0
  for (const m of memories) {
    const slots = countWorldBookUserPlaceholderSlots(m.content ?? '')
    if (!slots) continue
    memoryCount += 1
    slotCount += slots
    boundCount += (m.userPlaceholderBindings ?? []).filter(
      (b) => b.wechatAccountId?.trim() && b.playerIdentityId?.trim(),
    ).length
  }
  return {
    slotCount,
    boundCount,
    memoryCount,
    needsAlign: memories.some((m) => memoryNeedsUserPlaceholderAlignment(m)),
  }
}

export type AlignAllMemoryUserPlaceholdersResult = {
  written: number
  after: ReturnType<typeof summarizeMemoryUserPlaceholders>
}

/**
 * 对齐全库记忆 `{{user}}`。
 * 1. 先按各条 `source*` 补绑 / 迁旧式表达式（与进微信自动对齐相同）；
 * 2. 若传入 `fillUnboundWith`，仅对仍空槽位绑到当前登录账号·扮演身份（已有绑定不改）。
 */
export async function alignAllStoredMemoryUserPlaceholders(opts?: {
  fillUnboundWith?: WorldBookUserInsertContext | null
}): Promise<AlignAllMemoryUserPlaceholdersResult> {
  const all = await personaDb.listAllCharacterMemories()
  let written = 0
  for (const m of all) {
    const slots = countWorldBookUserPlaceholderSlots(m.content ?? '')
    if (!slots) continue

    let cur = m
    if (memoryNeedsUserPlaceholderAlignment(cur)) {
      const next = await alignCharacterMemoryUserPlaceholders(cur)
      if (next !== cur) {
        await personaDb.upsertCharacterMemory(next)
        written += 1
        cur = next
      }
    }

    const fill = opts?.fillUnboundWith
    if (fill) {
      const bound = (cur.userPlaceholderBindings ?? []).filter(
        (b) => b.wechatAccountId?.trim() && b.playerIdentityId?.trim(),
      ).length
      if (bound < slots) {
        const next2 = await alignCharacterMemoryUserPlaceholders(cur, { fallback: fill })
        if (next2 !== cur) {
          await personaDb.upsertCharacterMemory(next2)
          written += 1
          cur = next2
        }
      }
    }
  }

  const fresh = await personaDb.listAllCharacterMemories()
  return { written, after: summarizeMemoryUserPlaceholders(fresh) }
}
