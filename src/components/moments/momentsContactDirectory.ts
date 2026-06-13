import type { MomentContactRef } from './newMomentTypes'

export type MomentsContactDirectory = {
  /** 微信备注 / 通讯录展示名 */
  getDisplayName: (charId: string) => string
  /** 人设原始姓名（非备注） */
  getPersonaName: (charId: string) => string
  getAvatar: (charId: string) => string | undefined
  getByCharId: (charId: string) => MomentContactRef | undefined
}

export function buildMomentsContactDirectory(contacts: MomentContactRef[]): MomentsContactDirectory {
  const byCharId = new Map<string, MomentContactRef>()
  for (const c of contacts) {
    const cid = c.characterId?.trim()
    if (cid) byCharId.set(cid, c)
  }

  return {
    getDisplayName(charId) {
      const hit = byCharId.get(charId)
      return hit?.name.trim() || '未命名'
    },
    getPersonaName(charId) {
      const hit = byCharId.get(charId)
      return hit?.name.trim() || '未命名'
    },
    getAvatar(charId) {
      return byCharId.get(charId)?.avatarUrl
    },
    getByCharId(charId) {
      return byCharId.get(charId)
    },
  }
}

/** 为人设库 `Character.name` 覆盖通讯录展示名，供面板等需要原始姓名的场景 */
export async function buildMomentsContactDirectoryWithPersonaNames(
  contacts: MomentContactRef[],
): Promise<MomentsContactDirectory> {
  const base = buildMomentsContactDirectory(contacts)
  const personaNames = new Map<string, string>()
  const charIds = [
    ...new Set(contacts.map((c) => c.characterId?.trim()).filter((x): x is string => !!x)),
  ]
  if (charIds.length) {
    const { personaDb } = await import('../../phone/apps/wechat/newFriendsPersona/idb')
    await Promise.all(
      charIds.map(async (cid) => {
        try {
          const ch = await personaDb.getCharacter(cid)
          const name = ch?.name?.trim()
          if (name) personaNames.set(cid, name)
        } catch {
          /* 静默 */
        }
      }),
    )
  }
  return {
    ...base,
    getPersonaName(charId) {
      const cid = charId.trim()
      return personaNames.get(cid) || base.getPersonaName(cid)
    },
  }
}

/** 通讯录快照可能滞后：用人设库最新头像覆盖各联系人展示头像 */
export async function enrichMomentContactsWithLiveCharacterAvatars(
  contacts: MomentContactRef[],
): Promise<MomentContactRef[]> {
  const { personaDb } = await import('../../phone/apps/wechat/newFriendsPersona/idb')
  const { resolveCharacterAvatarUrl } = await import('../../phone/utils/characterAvatarUrl')

  return Promise.all(
    contacts.map(async (c) => {
      const cid = c.characterId?.trim()
      if (!cid) return c
      try {
        const character = await personaDb.getCharacter(cid)
        const raw = character?.avatarUrl?.trim()
        if (!raw) return c
        const live = resolveCharacterAvatarUrl({ avatarUrl: raw })
        return live ? { ...c, avatarUrl: live } : c
      } catch {
        return c
      }
    }),
  )
}
