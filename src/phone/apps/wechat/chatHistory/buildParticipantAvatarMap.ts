import type { WeChatPersonaContact } from '../../../types'
import { resolveCharacterAvatarUrl, resolveWeChatContactAvatarUrl } from '../../../utils/characterAvatarUrl'
import { personaDb } from '../newFriendsPersona/idb'
import type { WeChatChatHistoryPayload } from '../newFriendsPersona/types'
import { resolveCanonicalCharacterId } from '../wechatGlobalCharacterRegistry'
import { pickStableNetizenAvatarForChatHistoryNpc } from './ephemeralNpcChatHistoryAvatar'

/** 从聊天记录标题解析双方展示名，如「A 和 B 的聊天记录」 */
export function parseChatHistoryTitleParticipants(title: string): { a: string; b: string } | null {
  const t = title.trim()
  const patterns = [/^(.+?)\s*和\s*(.+?)\s*的聊天记录$/, /^(.+?)\s*和\s*(.+?)\s*的对话$/]
  for (const re of patterns) {
    const m = re.exec(t)
    if (!m) continue
    const a = m[1]?.trim()
    const b = m[2]?.trim()
    if (!a || !b) continue
    return { a, b }
  }
  return null
}

function isPlayerDisplayName(name: string, userDisplayName: string): boolean {
  const n = name.trim()
  if (!n) return false
  if (n === '我') return true
  const user = userDisplayName.trim()
  return !!user && n === user
}

function collectParticipantNames(data: WeChatChatHistoryPayload): string[] {
  const names = new Set<string>()
  const titleParts = parseChatHistoryTitleParticipants(data.title)
  if (titleParts) {
    names.add(titleParts.a)
    names.add(titleParts.b)
  }
  for (const m of data.messages) {
    const n = m.senderName.trim()
    if (n) names.add(n)
  }
  return [...names]
}

async function resolveCharacterAvatarById(characterId: string): Promise<string | undefined> {
  const raw = characterId.trim()
  if (!raw) return undefined
  const canon = (await resolveCanonicalCharacterId(raw)) || raw
  const ch = await personaDb.getCharacter(canon)
  if (!ch) return undefined
  const url = resolveCharacterAvatarUrl({ avatarUrl: ch.avatarUrl })
  return url || undefined
}

async function buildNameAvatarIndex(contacts: readonly WeChatPersonaContact[]): Promise<Map<string, string>> {
  const index = new Map<string, string>()
  const entries = await Promise.all(
    contacts.map(async (c) => {
      const ch = await personaDb.getCharacter(c.characterId)
      const avatar = resolveWeChatContactAvatarUrl(c.avatarUrl, ch?.avatarUrl)
      const aliases: string[] = [c.remarkName]
      if (ch?.name?.trim()) aliases.push(ch.name.trim())
      if (ch?.wechatNickname?.trim()) aliases.push(ch.wechatNickname.trim())
      if (ch?.remark?.trim()) aliases.push(ch.remark.trim())
      return { aliases, avatar }
    }),
  )
  for (const { aliases, avatar } of entries) {
    if (!avatar) continue
    for (const alias of aliases) {
      const n = alias.trim()
      if (n && !index.has(n)) index.set(n, avatar)
    }
  }
  return index
}

async function supplementNameIndexForUnresolved(
  index: Map<string, string>,
  unresolvedNames: readonly string[],
): Promise<void> {
  const want = new Set(unresolvedNames.map((n) => n.trim()).filter(Boolean))
  if (!want.size) return
  const all = await personaDb.listCharacters()
  for (const ch of all) {
    const avatar = resolveCharacterAvatarUrl({ avatarUrl: ch.avatarUrl })
    if (!avatar) continue
    const aliases = [ch.name, ch.wechatNickname, ch.remark].filter((x): x is string => !!x?.trim())
    for (const alias of aliases) {
      const n = alias.trim()
      if (want.has(n) && !index.has(n)) {
        index.set(n, avatar)
        want.delete(n)
        if (!want.size) return
      }
    }
  }
}

function senderKindForName(
  data: WeChatChatHistoryPayload,
  name: string,
): 'player' | 'character' | undefined {
  const n = name.trim()
  if (!n) return undefined
  const hit = data.messages.find((m) => m.senderName.trim() === n)
  return hit?.senderKind
}

/** 按聊天记录内出现的角色名解析头像（通讯录备注 / 人设姓名 / 微信昵称），不用当前聊天室对方头像 */
export async function resolveParticipantAvatarMap(params: {
  data: WeChatChatHistoryPayload
  userDisplayName: string
  userAvatarUrl?: string
  personaContacts: readonly WeChatPersonaContact[]
  /** 发送该聊天记录卡片的角色 id（AI 伪造时「你」对应该角色） */
  cardSenderCharacterId?: string
}): Promise<Record<string, string | undefined>> {
  const userName = params.userDisplayName.trim() || '我'
  const userAvatar = params.userAvatarUrl?.trim() || undefined
  const isCharacterForgedCard = !!params.cardSenderCharacterId?.trim()

  const cardSenderAvatar = params.cardSenderCharacterId?.trim()
    ? await resolveCharacterAvatarById(params.cardSenderCharacterId)
    : undefined

  const index = await buildNameAvatarIndex(params.personaContacts)
  const allNames = collectParticipantNames(params.data)

  const missing = allNames.filter((n) => {
    const t = n.trim()
    if (!t) return false
    if (isCharacterForgedCard && (t === '你' || t === '我')) return false
    if (isCharacterForgedCard && isPlayerDisplayName(t, userName)) return false
    return !isPlayerDisplayName(t, userName) && t !== '你' && !index.has(t)
  })
  await supplementNameIndexForUnresolved(index, missing)

  const resolveName = (raw: string): string | undefined => {
    const name = raw.trim()
    if (!name) return undefined
    const kind = senderKindForName(params.data, name)
    if (kind === 'player') return userAvatar
    if (isCharacterForgedCard) {
      if (name === '你' || name === '我') return cardSenderAvatar
      if (isPlayerDisplayName(name, userName)) return undefined
    } else {
      if (isPlayerDisplayName(name, userName)) return userAvatar
      if (name === '你') return cardSenderAvatar ?? userAvatar
    }
    return index.get(name)
  }

  const map: Record<string, string | undefined> = {}
  for (const name of allNames) {
    map[name] = resolveName(name)
  }
  if (!isCharacterForgedCard) {
    map[userName] = userAvatar
    map['我'] = userAvatar
    map['你'] = cardSenderAvatar ?? userAvatar
  } else {
    map['你'] = cardSenderAvatar
    map['我'] = cardSenderAvatar
  }

  if (isCharacterForgedCard) {
    const titleSeed = params.data.title.trim() || '聊天记录'
    for (const name of allNames) {
      const n = name.trim()
      if (!n || map[n] || isPlayerDisplayName(n, userName) || n === '你' || n === '我') continue
      const fallback = pickStableNetizenAvatarForChatHistoryNpc(`${titleSeed}::${n}`)
      if (fallback) map[n] = fallback
    }
  }

  for (const m of params.data.messages) {
    const name = m.senderName.trim()
    if (!name || map[name] !== undefined) continue
    map[name] = resolveName(name)
  }

  for (const m of params.data.messages) {
    const name = m.senderName.trim()
    if (!name) continue
    if (m.senderAvatarUrl?.trim()) {
      map[name] = m.senderAvatarUrl.trim()
    }
    if (m.senderCharacterId?.trim()) {
      const byId = await resolveCharacterAvatarById(m.senderCharacterId)
      if (byId) map[name] = byId
    }
  }

  return map
}
