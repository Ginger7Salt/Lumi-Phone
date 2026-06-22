import { loadResolvedApiConfig } from '../../phone/apps/api/loadResolvedApiConfig'
import { loadResolvedImageGenSettings } from '../../phone/apps/api/loadResolvedImageGenSettings'
import { publishCharacterMoment } from './characterMomentPublishService'
import { scheduleCharacterMomentArchive } from './momentArchiverService'
import { isMomentsChatApiConfigured } from './momentsChatApiReady'
import { resolveMomentsChatPublishContext } from './momentsChatPublishContext'
import { loadUserMoments, upsertUserMoment } from './momentsFeedStorage'
import {
  buildProactiveCharacterMomentKey,
  hasProactiveCharacterMomentScheduleSaved,
  isCharacterProactiveMomentDue,
  PROACTIVE_CHARACTER_MOMENT_PICK_COUNT_MAX,
  resolveCharacterProactiveMomentSchedule,
  resolveProactiveCharacterMomentIntervalSeconds,
  clampProactiveCharacterMomentPickCount,
  type ProactiveCharacterMomentsSettings,
} from './proactiveCharacterMomentTypes'
import { loadResolvedMomentsImageGenSettings } from './resolveMomentsImageGenSettings'
import {
  loadMomentsSettings,
  persistMomentsSettings,
  type MomentsSettings,
} from './useMomentsSettingsStore'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import {
  findAccountById,
  loadAccountsBundle,
  resolveAccountSessionIdentityId,
} from '../../phone/apps/wechat/wechatAccountPersistence'
import type { WeChatPersonaContact } from '../../phone/types'

const TICK_MS = 30_000

let installed = false
let runningTick = false
let inFlight = false

function isGlobalDue(settings: MomentsSettings, now: number): boolean {
  const pm = settings.proactiveCharacterMoments
  if (pm.mode !== 'global') return false
  const g = pm.global
  if (!g.enabled || !hasProactiveCharacterMomentScheduleSaved(g)) return false
  const intervalMs = resolveProactiveCharacterMomentIntervalSeconds(g) * 1000
  return now - (g.lastFiredAtMs ?? 0) >= intervalMs
}

async function isCharacterEligible(
  _accountId: string,
  characterId: string,
  personaContacts: WeChatPersonaContact[],
): Promise<boolean> {
  const cid = characterId.trim()
  if (!cid) return false
  if (!personaContacts.some((c) => c.characterId?.trim() === cid)) return false
  try {
    const character = await personaDb.getCharacter(cid)
    return !!character && !character.momentsPermission?.blocked
  } catch {
    return false
  }
}

async function pickGlobalProactiveMomentCharacters(
  accountId: string,
  personaContacts: WeChatPersonaContact[],
  pickCount: number,
): Promise<string[]> {
  const moments = await loadUserMoments(accountId)
  const eligible: { characterId: string; lastTs: number }[] = []

  for (const pc of personaContacts) {
    const cid = pc.characterId?.trim()
    if (!cid) continue
    if (!(await isCharacterEligible(accountId, cid, personaContacts))) continue
    const charMoments = moments.filter((m) => m.authorCharacterId?.trim() === cid)
    const lastTs = charMoments.length
      ? Math.max(...charMoments.map((m) => m.timestamp))
      : 0
    eligible.push({ characterId: cid, lastTs })
  }

  if (!eligible.length) return []
  eligible.sort((a, b) => a.lastTs - b.lastTs)

  const want = Math.min(
    Math.max(1, pickCount),
    eligible.length,
    PROACTIVE_CHARACTER_MOMENT_PICK_COUNT_MAX,
  )
  const poolSize = Math.max(want, Math.ceil(eligible.length / 2))
  const pool = eligible.slice(0, poolSize)
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, want).map((x) => x.characterId)
}

async function pickPerCharacterDueTarget(
  accountId: string,
  pm: ProactiveCharacterMomentsSettings,
  personaContacts: WeChatPersonaContact[],
  now: number,
): Promise<string | null> {
  let best: { characterId: string; overdueMs: number } | null = null

  for (const pc of personaContacts) {
    const cid = pc.characterId?.trim()
    if (!cid) continue
    if (!(await isCharacterEligible(accountId, cid, personaContacts))) continue

    const schedule = resolveCharacterProactiveMomentSchedule(pm, accountId, cid)
    if (!isCharacterProactiveMomentDue(schedule, now)) continue

    const intervalMs = resolveProactiveCharacterMomentIntervalSeconds(schedule) * 1000
    const overdueMs = now - (schedule.lastFiredAtMs ?? 0) - intervalMs
    if (!best || overdueMs > best.overdueMs) {
      best = { characterId: cid, overdueMs }
    }
  }

  return best?.characterId ?? null
}

function persistProactiveMomentFired(
  settings: MomentsSettings,
  params: { mode: 'global' } | { mode: 'per_character'; accountId: string; characterId: string },
): void {
  const pm = settings.proactiveCharacterMoments
  const now = Date.now()
  let nextPm: ProactiveCharacterMomentsSettings

  if (params.mode === 'global') {
    nextPm = {
      ...pm,
      global: { ...pm.global, lastFiredAtMs: now },
    }
  } else {
    const key = buildProactiveCharacterMomentKey(params.accountId, params.characterId)
    const existing = resolveCharacterProactiveMomentSchedule(pm, params.accountId, params.characterId)
    nextPm = {
      ...pm,
      byCharacter: {
        ...pm.byCharacter,
        [key]: { ...existing, lastFiredAtMs: now },
      },
    }
  }

  persistMomentsSettings({ ...settings, proactiveCharacterMoments: nextPm })
  window.dispatchEvent(new Event('moments-settings-changed'))
}

async function publishProactiveMomentForCharacter(params: {
  accountId: string
  characterId: string
  playerIdentityId: string
  playerDisplayName: string
}): Promise<boolean> {
  const apiConfig = await loadResolvedApiConfig('chatCard')
  if (!isMomentsChatApiConfigured(apiConfig)) return false

  const ctx = await resolveMomentsChatPublishContext({
    accountId: params.accountId,
    characterId: params.characterId,
    playerIdentityId: params.playerIdentityId,
    playerDisplayName: params.playerDisplayName,
    apiConfig,
  })
  if (!ctx) return false

  const imageGenSettings = await loadResolvedMomentsImageGenSettings(loadResolvedImageGenSettings)
  const settings = loadMomentsSettings()

  const result = await publishCharacterMoment({
    wechatCtx: ctx.wechatCtx,
    characterId: params.characterId,
    characterContact: ctx.characterContact,
    momentContacts: ctx.momentContacts,
    blockedCharacterIds: ctx.blockedCharacterIds,
    imageGenSettings,
    triggeredByUserRequest: false,
    musicShareLanguageRatio: settings.proactiveCharacterMoments.musicShareLanguageRatio,
    followUserMusicTaste: settings.proactiveCharacterMoments.followUserMusicTaste,
  })

  await upsertUserMoment(params.accountId, result.item)
  scheduleCharacterMomentArchive({
    moment: result.item,
    apiConfig,
    wechatAccountId: params.accountId,
    playerIdentityId: params.playerIdentityId,
    playerDisplayName: params.playerDisplayName,
    contactDirectory: ctx.contactDirectory,
  })
  return true
}

async function fireProactiveCharacterMoment(): Promise<void> {
  if (inFlight) return
  inFlight = true
  try {
    const settings = loadMomentsSettings()
    const pm = settings.proactiveCharacterMoments
    const now = Date.now()

    const bundle = await loadAccountsBundle()
    if (!bundle) return
    const account = findAccountById(bundle, bundle.currentAccountId)
    if (!account) return

    const playerIdentityId = resolveAccountSessionIdentityId(account)
    const playerDisplayName = account.nickname?.trim() || '我'

    if (pm.mode === 'global' && isGlobalDue(settings, now)) {
      const pickCount = clampProactiveCharacterMomentPickCount(pm.globalPickCount)
      const characterIds = await pickGlobalProactiveMomentCharacters(
        account.accountId,
        account.personaContacts,
        pickCount,
      )
      if (!characterIds.length) return

      let anyOk = false
      for (const characterId of characterIds) {
        const ok = await publishProactiveMomentForCharacter({
          accountId: account.accountId,
          characterId,
          playerIdentityId,
          playerDisplayName,
        })
        if (ok) anyOk = true
      }
      if (anyOk) persistProactiveMomentFired(settings, { mode: 'global' })
      return
    }

    if (pm.mode === 'per_character') {
      const characterId = await pickPerCharacterDueTarget(
        account.accountId,
        pm,
        account.personaContacts,
        now,
      )
      if (!characterId) return

      const ok = await publishProactiveMomentForCharacter({
        accountId: account.accountId,
        characterId,
        playerIdentityId,
        playerDisplayName,
      })
      if (!ok) return

      persistProactiveMomentFired(settings, {
        mode: 'per_character',
        accountId: account.accountId,
        characterId,
      })
    }
  } catch (err) {
    console.warn('[proactiveCharacterMoment]', err)
  } finally {
    inFlight = false
  }
}

function hasAnyDueSchedule(settings: MomentsSettings, now: number): boolean {
  const pm = settings.proactiveCharacterMoments
  if (pm.mode === 'global') return isGlobalDue(settings, now)
  return Object.keys(pm.byCharacter).some((key) => {
    const schedule = pm.byCharacter[key]
    return schedule?.enabled && isCharacterProactiveMomentDue(schedule, now)
  })
}

async function runTick(): Promise<void> {
  if (runningTick || inFlight) return
  runningTick = true
  try {
    const settings = loadMomentsSettings()
    const now = Date.now()
    if (!hasAnyDueSchedule(settings, now)) return
    await fireProactiveCharacterMoment()
  } finally {
    runningTick = false
  }
}

export function installProactiveCharacterMomentEngine(): void {
  if (installed) return
  installed = true

  const onWake = () => void runTick()
  window.addEventListener('wechat-storage-changed', onWake)
  window.addEventListener('moments-settings-changed', onWake)
  document.addEventListener('visibilitychange', onWake)

  void runTick()
  setInterval(() => void runTick(), TICK_MS)
}
