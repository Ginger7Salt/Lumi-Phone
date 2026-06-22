import type { ApiConfig } from '../../phone/apps/api/types'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { CharacterMemory } from '../../phone/apps/wechat/newFriendsPersona/types'
import { composeMemoryWithSourcePrefix } from '../../phone/apps/wechat/memory/memorySourceBadges'

import type { MomentItemModel } from './mockMoments'
import {
  buildInteractorMomentMemoryNaturalContent,
  buildMomentMemoryPayload,
  collectMomentInteractorCharIds,
  mergeInteractorMomentMemoryKeywords,
  momentMemoryIdForMoment,
  momentMemoryIdForMomentInteractor,
  summarizeInteractorOwnMomentActions,
} from './momentMemoryContentBuilder'
import { extractMomentMemoryKeywords } from './momentMemoryKeywordAi'
import { enrichMomentAttachedMusic } from './momentAttachedMusic'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import { isMomentMemoryArchiveSuppressed, MOMENT_MEMORY_ARCHIVE_SUPPRESSED_EVENT } from '../../phone/apps/wechat/memory/momentMemoryArchiveSuppression'

const ARCHIVE_DEBOUNCE_MS = 5000

export type CharacterMomentArchiveJob = {
  moment: MomentItemModel
  apiConfig: ApiConfig | null | undefined
  wechatAccountId: string | null | undefined
  playerIdentityId: string
  playerDisplayName: string
  contactDirectory: MomentsContactDirectory
  now?: number
}

type PendingArchive = {
  timer: number
  job: CharacterMomentArchiveJob
}

const pendingArchives = new Map<string, PendingArchive>()

function isArchivableCharacterMoment(moment: MomentItemModel): boolean {
  return !moment.isUserAuthored && !!moment.authorCharacterId?.trim()
}

function isPublisherMomentMemory(m: CharacterMemory, momentId: string, publisherId: string): boolean {
  if (m.momentMemoryRole === 'interactor') return false
  if (m.momentMemoryRole === 'publisher') return true
  if (m.id === momentMemoryIdForMoment(momentId)) return true
  return m.characterId.trim() === publisherId && !m.id.includes('::')
}

async function findPublisherMomentMemory(
  publisherCharacterId: string,
  momentId: string,
): Promise<CharacterMemory | null> {
  const list = await personaDb.listCharacterMemoriesForCharacter(publisherCharacterId)
  const stableId = momentMemoryIdForMoment(momentId)
  return (
    list.find(
      (m) =>
        m.id === stableId ||
        (m.momentSourceMomentId === momentId && isPublisherMomentMemory(m, momentId, publisherCharacterId)),
    ) ?? null
  )
}

async function findInteractorMomentMemory(
  interactorCharacterId: string,
  momentId: string,
): Promise<CharacterMemory | null> {
  const list = await personaDb.listCharacterMemoriesForCharacter(interactorCharacterId)
  const stableId = momentMemoryIdForMomentInteractor(momentId, interactorCharacterId)
  return (
    list.find(
      (m) =>
        m.id === stableId ||
        (m.momentSourceMomentId === momentId && m.momentMemoryRole === 'interactor'),
    ) ?? null
  )
}

async function pruneStaleInteractorMomentMemories(
  momentId: string,
  activeInteractorIds: Set<string>,
  previousLinked: string[],
): Promise<void> {
  const stale = previousLinked.filter((id) => id.trim() && !activeInteractorIds.has(id.trim()))
  await Promise.all(
    stale.map(async (cid) => {
      const existing = await findInteractorMomentMemory(cid.trim(), momentId)
      if (existing) await personaDb.deleteCharacterMemory(existing.id)
    }),
  )
}

async function flushCharacterMomentArchive(job: CharacterMomentArchiveJob): Promise<void> {
  let moment = job.moment
  if (!isArchivableCharacterMoment(moment)) return
  if (await isMomentMemoryArchiveSuppressed(moment.id)) return

  if (moment.attachedMusic) {
    const enrichedMusic = await enrichMomentAttachedMusic(moment.attachedMusic)
    moment = { ...moment, attachedMusic: enrichedMusic }
  }

  const publisherCharacterId = moment.authorCharacterId!.trim()
  const publisherDisplayName = moment.authorName.trim() || '未命名'
  const interactionNow = job.now ?? Date.now()
  const archivedAt = Date.now()

  const built = buildMomentMemoryPayload({
    moment,
    now: interactionNow,
    contactDirectory: job.contactDirectory,
    playerDisplayName: job.playerDisplayName,
    publisherCharacterId,
    publisherDisplayName,
  })
  const { payload, memoryContent, interactionRows } = built

  const interactorCharIds = collectMomentInteractorCharIds(moment, interactionNow, publisherCharacterId)
  const interactorIdSet = new Set(interactorCharIds)

  const existingPublisher = await findPublisherMomentMemory(publisherCharacterId, moment.id)
  const createdAt = existingPublisher?.createdAt ?? moment.timestamp
  const memoryId = existingPublisher?.id ?? momentMemoryIdForMoment(moment.id)
  const publishedAt =
    Number.isFinite(moment.timestamp) && moment.timestamp > 0 ? moment.timestamp : createdAt

  const keywords = await extractMomentMemoryKeywords({
    apiConfig: job.apiConfig,
    momentText: payload.originalText,
    location: payload.location ?? '',
  })

  const publisherBody = memoryContent.trim()
  const publisherContent = composeMemoryWithSourcePrefix({ hasMomentTag: true }, publisherBody)

  const publisherRow: CharacterMemory = {
    id: memoryId,
    characterId: publisherCharacterId,
    content: publisherContent.slice(0, 4000),
    createdAt,
    updatedAt: archivedAt,
    isAutoGenerated: true,
    memoryScope: 'moment',
    memoryTriggerMode: 'keyword',
    memoryKeywords: keywords.length ? keywords : undefined,
    momentSourceMomentId: moment.id,
    momentMemoryRole: 'publisher',
    momentLinkedInteractorCharIds: interactorCharIds.length ? interactorCharIds : undefined,
    momentPayload: { ...payload, publishedAt },
    ...(job.wechatAccountId?.trim()
      ? { sourceWechatAccountId: job.wechatAccountId.trim() }
      : {}),
    ...(job.playerIdentityId.trim() && job.playerIdentityId !== '__none__'
      ? { sourceSessionPlayerIdentityId: job.playerIdentityId.trim() }
      : {}),
  }

  await personaDb.upsertCharacterMemory(publisherRow)

  await pruneStaleInteractorMomentMemories(
    moment.id,
    interactorIdSet,
    existingPublisher?.momentLinkedInteractorCharIds ?? [],
  )

  const locationLabel = payload.location ?? ''
  await Promise.all(
    interactorCharIds.map(async (interactorCharId) => {
      const ownSummary = summarizeInteractorOwnMomentActions(moment, interactorCharId, interactionNow)
      const interactorBody = buildInteractorMomentMemoryNaturalContent({
        moment,
        publisherDisplayName,
        interactorCharId,
        rows: interactionRows,
        locationLabel,
        now: interactionNow,
      })
      const interactorKeywords = mergeInteractorMomentMemoryKeywords(
        keywords,
        publisherDisplayName,
        ownSummary,
      )
      const existingInteractor = await findInteractorMomentMemory(interactorCharId, moment.id)
      const interactorCreatedAt = existingInteractor?.createdAt ?? moment.timestamp
      const interactorMemoryId =
        existingInteractor?.id ?? momentMemoryIdForMomentInteractor(moment.id, interactorCharId)

      const interactorRow: CharacterMemory = {
        id: interactorMemoryId,
        characterId: interactorCharId,
        content: composeMemoryWithSourcePrefix({ hasMomentTag: true }, interactorBody).slice(0, 4000),
        createdAt: interactorCreatedAt,
        updatedAt: archivedAt,
        isAutoGenerated: true,
        memoryScope: 'moment',
        memoryTriggerMode: 'keyword',
        memoryKeywords: interactorKeywords.length ? interactorKeywords : undefined,
        momentSourceMomentId: moment.id,
        momentMemoryRole: 'interactor',
        momentPublisherCharacterId: publisherCharacterId,
        momentPayload: {
          ...payload,
          publishedAt,
          publisherCharacterId,
          publisherDisplayName,
          ownInteractionSummary: ownSummary,
        },
        ...(job.wechatAccountId?.trim()
          ? { sourceWechatAccountId: job.wechatAccountId.trim() }
          : {}),
        ...(job.playerIdentityId.trim() && job.playerIdentityId !== '__none__'
          ? { sourceSessionPlayerIdentityId: job.playerIdentityId.trim() }
          : {}),
      }

      await personaDb.upsertCharacterMemory(interactorRow)
    }),
  )
}

/**
 * 静默刻录：防抖 5 秒后 upsert 记忆并提炼关键词。不抛出 UI 提示。
 */
export function scheduleCharacterMomentArchive(job: CharacterMomentArchiveJob): void {
  if (!isArchivableCharacterMoment(job.moment)) return

  void isMomentMemoryArchiveSuppressed(job.moment.id).then((suppressed) => {
    if (suppressed) return
    scheduleCharacterMomentArchiveInner(job)
  })
}

function scheduleCharacterMomentArchiveInner(job: CharacterMomentArchiveJob): void {
  const key = job.moment.id
  const prev = pendingArchives.get(key)
  if (prev) window.clearTimeout(prev.timer)

  const merged: CharacterMomentArchiveJob = prev
    ? {
        ...prev.job,
        ...job,
        moment: job.moment,
        now: job.now ?? Date.now(),
      }
    : { ...job, now: job.now ?? Date.now() }

  const timer = window.setTimeout(() => {
    pendingArchives.delete(key)
    void flushCharacterMomentArchive(merged).catch(() => {
      /* 后台任务：静默失败 */
    })
  }, ARCHIVE_DEBOUNCE_MS)

  pendingArchives.set(key, { timer, job: merged })
}

export function cancelCharacterMomentArchive(momentId: string): void {
  const prev = pendingArchives.get(momentId)
  if (prev) window.clearTimeout(prev.timer)
  pendingArchives.delete(momentId)
}

if (typeof window !== 'undefined') {
  window.addEventListener(MOMENT_MEMORY_ARCHIVE_SUPPRESSED_EVENT, (event) => {
    const momentId = (event as CustomEvent<{ momentId?: string }>).detail?.momentId?.trim()
    if (momentId) cancelCharacterMomentArchive(momentId)
  })
}
