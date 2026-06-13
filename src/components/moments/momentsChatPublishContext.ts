import type { ApiConfig } from '../../phone/apps/api/types'
import { loadResolvedImageGenSettings } from '../../phone/apps/api/loadResolvedImageGenSettings'
import { resolveCharacterAvatarUrl } from '../../phone/utils/characterAvatarUrl'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { findAccountById, loadAccountsBundle } from '../../phone/apps/wechat/wechatAccountPersistence'
import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'
import { buildMomentsContactDirectory } from './momentsContactDirectory'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import { mockContactsToMomentRefs } from './publishMomentUtils'
import type { MomentContactRef } from './newMomentTypes'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

export type MomentsChatPublishContext = {
  wechatCtx: AnonymousQaWechatContext
  momentContacts: MomentContactRef[]
  characterContact: MomentContactRef
  blockedCharacterIds: Set<string>
  imageGenSettings: MomentsImageGenSettings
  contactDirectory: MomentsContactDirectory
}

async function resolveBlockedCharacterIds(
  momentContacts: MomentContactRef[],
): Promise<Set<string>> {
  const blocked = new Set<string>()
  for (const c of momentContacts) {
    const charId = c.characterId?.trim()
    if (!charId) continue
    try {
      const character = await personaDb.getCharacter(charId)
      if (character?.momentsPermission?.blocked) blocked.add(charId)
    } catch {
      // ignore
    }
  }
  return blocked
}

/** 私聊触发角色发朋友圈时，解析通讯录、屏蔽名单与 API/生图配置 */
export async function resolveMomentsChatPublishContext(params: {
  accountId: string | null | undefined
  characterId: string
  playerIdentityId: string
  playerDisplayName: string
  apiConfig: ApiConfig | null | undefined
}): Promise<MomentsChatPublishContext | null> {
  const accountId = params.accountId?.trim()
  const characterId = params.characterId.trim()
  if (!accountId || !characterId) return null

  const bundle = await loadAccountsBundle()
  const account = bundle ? findAccountById(bundle, accountId) : null
  if (!account) return null

  const selfAvatar =
    resolveCharacterAvatarUrl({ avatarUrl: account.avatarUrl }) || undefined
  const selfContact = {
    id: 'self',
    remarkName: params.playerDisplayName.trim() || account.nickname.trim() || '我',
    avatarUrl: selfAvatar,
  }
  const friends = account.personaContacts.map((c) => ({
    id: c.id,
    characterId: c.characterId,
    remarkName: c.remarkName,
    avatarUrl: resolveCharacterAvatarUrl({ avatarUrl: c.avatarUrl }) || undefined,
  }))
  const momentContacts = mockContactsToMomentRefs([selfContact, ...friends])
  const characterContact = momentContacts.find((c) => c.characterId?.trim() === characterId)
  if (!characterContact) return null

  const blockedCharacterIds = await resolveBlockedCharacterIds(momentContacts)
  if (blockedCharacterIds.has(characterId)) return null

  const imageGenSettings = await loadResolvedImageGenSettings()
  const wechatCtx: AnonymousQaWechatContext = {
    wechatAccountId: accountId,
    playerIdentityId: params.playerIdentityId.trim() || '__none__',
    playerDisplayName: params.playerDisplayName.trim() || '我',
    apiConfig: params.apiConfig ?? null,
  }

  return {
    wechatCtx,
    momentContacts,
    characterContact,
    blockedCharacterIds,
    imageGenSettings,
    contactDirectory: buildMomentsContactDirectory(momentContacts),
  }
}
