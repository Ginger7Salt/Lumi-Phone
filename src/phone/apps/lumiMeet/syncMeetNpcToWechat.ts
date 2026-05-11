import { normalizeBirthdayMD, zodiacZhFromStoredMD } from '../wechat/newFriendsPersona/characterProfilePhysioUtils'
import { personaDb, emitWeChatStorageChanged } from '../wechat/newFriendsPersona/idb'
import type { Character, Gender, WorldBook, WorldBookItem } from '../wechat/newFriendsPersona/types'
import { buildMeetNpcDigestForModel } from './meetPersonaPreview'
import type { EncounterNPC } from './meetTypes'

function mapGenderLabel(g: string): Gender {
  if (g.includes('女')) return 'female'
  if (g.includes('男')) return 'male'
  return 'other'
}

/**
 * 将「遇见」NPC 写入人设库并可用于镜像微信；须在 UI 层再调用 `replaceWeChatPersonaContacts` 注入通讯录。
 */
export async function upsertMeetNpcAsCharacter(npc: EncounterNPC, wechatId: string): Promise<Character> {
  const identities = await personaDb.listPlayerIdentities()
  const rawPid = identities[0]?.id?.trim()
  const playerIdentityId = rawPid && rawPid !== '__none__' ? rawPid : undefined

  const now = Date.now()
  const wbBody = npc.comprehensivePersona
    ? `${buildMeetNpcDigestForModel(npc).slice(0, 3200)}\n\n（完整九维长档案见档案法则条目《核心人设档案》）`
    : npc.persona
  const item: WorldBookItem = {
    id: `meet-wb-item-${npc.id}`,
    name: '遇见·人设',
    enabled: true,
    priority: 'before',
    keywords: '遇见',
    content: wbBody,
    updatedAt: now,
    collapsed: false,
  }
  const wb: WorldBook = {
    id: `meet-wb-${npc.id}`,
    name: '遇见',
    enabled: true,
    collapsed: false,
    items: [item],
  }

  const base = npc.comprehensivePersona?.base
  const birthdayRaw = npc.birthdayMD ?? base?.birthdayMD ?? '06-15'
  const birthdayMD = normalizeBirthdayMD(birthdayRaw)
  const legalName = (npc.realName ?? base?.realName)?.trim() || npc.nickname
  const ageYears =
    npc.ageYears != null && Number.isFinite(npc.ageYears)
      ? Math.max(16, Math.min(99, Math.floor(npc.ageYears)))
      : 24
  const weightStr = (npc.weightKg ?? base?.weightKg)?.trim()
  const zodiac =
    (npc.zodiac ?? base?.zodiac)?.trim() || zodiacZhFromStoredMD(birthdayMD)

  const ch: Character = {
    id: npc.id,
    createdAt: now,
    updatedAt: now,
    name: legalName,
    gender: mapGenderLabel(npc.gender),
    age: ageYears,
    birthdayMD,
    zodiac,
    identity: '遇见用户',
    bio: npc.persona.slice(0, 480),
    motto: npc.persona.slice(0, 48),
    openingLines: '',
    avatarUrl: npc.avatarUrl,
    wechatNickname: npc.nickname,
    ...(weightStr ? { weight: weightStr } : {}),
    wechatId,
    wechatSignature: npc.persona.slice(0, 120),
    worldBooks: [wb],
    playerIdentityId,
    remark: npc.nickname,
    worldBackgroundEnabled: true,
  }

  await personaDb.upsertCharacter(ch)
  emitWeChatStorageChanged()
  return ch
}
