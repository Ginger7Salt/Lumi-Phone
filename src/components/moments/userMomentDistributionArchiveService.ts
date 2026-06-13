import type { ApiConfig } from '../../phone/apps/api/types'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { CharacterMemory } from '../../phone/apps/wechat/newFriendsPersona/types'
import { composeMemoryWithSourcePrefix } from '../../phone/apps/wechat/memory/memorySourceBadges'
import {
  isMomentMemoryArchiveSuppressed,
  MOMENT_MEMORY_ARCHIVE_SUPPRESSED_EVENT,
} from '../../phone/apps/wechat/memory/momentMemoryArchiveSuppression'

import type { MomentItemModel } from './mockMoments'
import {
  buildMomentInteractionsSnapshot,
  buildUserMomentViewerMemoryPayload,
  collectUserMomentInteractionRowsForPanel,
  userMomentViewerMemoryId,
} from './momentMemoryContentBuilder'
import { extractMomentMemoryKeywords } from './momentMemoryKeywordAi'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import { buildMomentsContactDirectoryWithPersonaNames } from './momentsContactDirectory'
import { loadMomentRelationships } from './momentRelationshipGraph'
import { getUserMomentMentionedContacts } from './momentMentionUtils'
import { sanitizeMomentBodyText } from './momentTextSanitize'
import type { ContactTag, MomentContactRef } from './newMomentTypes'
import { resolveUserMomentAudience } from './userMomentDistributionAudience'
import {
  clearAllUserMomentDistributionRecords,
  loadUserMomentDistributionRecords,
  removeUserMomentDistributionRecord,
  upsertUserMomentDistributionRecord,
  type UserMomentDistributionCommentRef,
  type UserMomentDistributionRecord,
} from './userMomentDistributionStorage'

const ARCHIVE_DEBOUNCE_MS = 5000

export type UserMomentDistributionArchiveJob = {
  moment: MomentItemModel
  apiConfig: ApiConfig | null | undefined
  wechatAccountId: string | null | undefined
  playerIdentityId: string
  playerDisplayName: string
  contactDirectory: MomentsContactDirectory
  momentContacts: MomentContactRef[]
  tags?: ContactTag[]
  now?: number
}

type PendingArchive = {
  timer: number
  job: UserMomentDistributionArchiveJob
}

const pendingArchives = new Map<string, PendingArchive>()

export function isUserMomentViewerMemory(memory: CharacterMemory): boolean {
  return memory.momentUserAuthored === true || memory.id.trim().startsWith('user-moment-mem-')
}

async function findViewerMomentMemory(
  viewerCharacterId: string,
  momentId: string,
): Promise<CharacterMemory | null> {
  const list = await personaDb.listCharacterMemoriesForCharacter(viewerCharacterId)
  const stableId = userMomentViewerMemoryId(momentId, viewerCharacterId)
  return (
    list.find(
      (m) =>
        m.id === stableId ||
        (m.momentSourceMomentId === momentId && m.momentUserAuthored && m.momentMemoryRole === 'viewer'),
    ) ?? null
  )
}

async function pruneStaleViewerMomentMemories(
  momentId: string,
  activeViewerIds: Set<string>,
): Promise<void> {
  const all = await personaDb.listAllCharacterMemories()
  const prefix = `user-moment-mem-${momentId.trim()}::`
  for (const m of all) {
    if (!m.id.startsWith(prefix)) continue
    const viewerId = m.id.slice(prefix.length).trim()
    if (!viewerId || activeViewerIds.has(viewerId)) continue
    await personaDb.deleteCharacterMemory(m.id)
  }
}

async function flushUserMomentDistributionArchive(job: UserMomentDistributionArchiveJob): Promise<void> {
  const moment = job.moment
  if (!moment.isUserAuthored) return
  if (await isMomentMemoryArchiveSuppressed(moment.id)) return

  const interactionNow = job.now ?? Date.now()
  const archivedAt = Date.now()
  const playerDisplayName = job.playerDisplayName.trim() || '用户'
  const tags = job.tags ?? []
  const relationships = await loadMomentRelationships()
  const { visible, hidden } = resolveUserMomentAudience({
    moment,
    momentContacts: job.momentContacts,
    tags,
    playerIdentityId: job.playerIdentityId,
    relationships,
  })

  const mentionedIds = new Set(
    getUserMomentMentionedContacts(moment)
      .map((c) => c.characterId?.trim())
      .filter(Boolean) as string[],
  )

  const previewText = sanitizeMomentBodyText(moment.content) || '（图片动态）'
  const visibilityLabel = moment.privacy?.visibilityLabel?.trim() || '公开'
  const keywords = await extractMomentMemoryKeywords({
    apiConfig: job.apiConfig,
    momentText: previewText,
    location: moment.location ?? '',
  })

  const activeViewerIds = new Set<string>()

  if (!visible.length) {
    await pruneStaleViewerMomentMemories(moment.id, activeViewerIds)
    await removeUserMomentDistributionRecord(job.wechatAccountId, moment.id)
    return
  }

  for (const viewer of visible) {
    activeViewerIds.add(viewer.charId)
    const mentionedViewer = mentionedIds.has(viewer.charId)
    const built = buildUserMomentViewerMemoryPayload({
      moment,
      now: interactionNow,
      contactDirectory: job.contactDirectory,
      playerDisplayName,
      viewerCharacterId: viewer.charId,
      relationships,
      visibilityLabel,
      mentionedViewer,
    })

    const existing = await findViewerMomentMemory(viewer.charId, moment.id)
    const createdAt = existing?.createdAt ?? moment.timestamp
    const memoryId = existing?.id ?? userMomentViewerMemoryId(moment.id, viewer.charId)
    const publishedAt =
      Number.isFinite(moment.timestamp) && moment.timestamp > 0 ? moment.timestamp : createdAt

    const row: CharacterMemory = {
      id: memoryId,
      characterId: viewer.charId,
      content: composeMemoryWithSourcePrefix({ hasMomentTag: true }, built.memoryContent).slice(0, 4000),
      createdAt,
      updatedAt: archivedAt,
      isAutoGenerated: true,
      memoryScope: 'moment',
      memoryTriggerMode: 'keyword',
      memoryKeywords: keywords.length ? keywords : undefined,
      momentSourceMomentId: moment.id,
      momentMemoryRole: 'viewer',
      momentUserAuthored: true,
      momentPayload: { ...built.payload, publishedAt },
      ...(job.wechatAccountId?.trim()
        ? { sourceWechatAccountId: job.wechatAccountId.trim() }
        : {}),
      ...(job.playerIdentityId.trim() && job.playerIdentityId !== '__none__'
        ? { sourceSessionPlayerIdentityId: job.playerIdentityId.trim() }
        : {}),
    }

    await personaDb.upsertCharacterMemory(row)
  }

  await pruneStaleViewerMomentMemories(moment.id, activeViewerIds)

  const personaContactDirectory = await buildMomentsContactDirectoryWithPersonaNames(job.momentContacts)
  const panelRows = collectUserMomentInteractionRowsForPanel({
    moment,
    now: interactionNow,
    contactDirectory: personaContactDirectory,
    playerDisplayName,
  })
  const interactionsSnapshot = buildMomentInteractionsSnapshot(panelRows)
  const likes = panelRows.filter((r) => r.kind === 'like').map((r) => r.authorName)
  const comments: UserMomentDistributionCommentRef[] = panelRows
    .filter((r) => r.kind === 'comment' || r.kind === 'stored_comment' || r.kind === 'user_comment')
    .map((r) => ({
      authorName: r.authorName,
      content: r.content?.trim() || '',
      ...(r.replyToName?.trim() ? { replyToName: r.replyToName.trim() } : {}),
    }))
    .filter((c) => c.content)

  const record: UserMomentDistributionRecord = {
    momentId: moment.id,
    updatedAt: archivedAt,
    publishedAt: moment.timestamp,
    previewText: previewText.slice(0, 120),
    isPinned: !!moment.isPinned,
    visibilityLabel,
    privacyMode: moment.privacy?.mode ?? 'public',
    memoryKeywords: keywords,
    visibleTo: visible.map((v) => ({
      charId: v.charId,
      displayName: personaContactDirectory.getPersonaName(v.charId) || v.displayName,
    })),
    hiddenFrom: hidden.map((h) => ({
      charId: h.charId,
      displayName: personaContactDirectory.getPersonaName(h.charId) || h.displayName,
    })),
    likes,
    comments,
    interactionsSnapshot,
  }
  await upsertUserMomentDistributionRecord(job.wechatAccountId, record)
}

export function scheduleUserMomentDistributionArchive(job: UserMomentDistributionArchiveJob): void {
  if (!job.moment.isUserAuthored) return

  void isMomentMemoryArchiveSuppressed(job.moment.id).then((suppressed) => {
    if (suppressed) return
    scheduleUserMomentDistributionArchiveInner(job)
  })
}

function scheduleUserMomentDistributionArchiveInner(job: UserMomentDistributionArchiveJob): void {
  const key = job.moment.id
  const prev = pendingArchives.get(key)
  if (prev) window.clearTimeout(prev.timer)

  const merged: UserMomentDistributionArchiveJob = prev
    ? {
        ...prev.job,
        ...job,
        moment: job.moment,
        now: job.now ?? Date.now(),
      }
    : { ...job, now: job.now ?? Date.now() }

  const timer = window.setTimeout(() => {
    pendingArchives.delete(key)
    void flushUserMomentDistributionArchive(merged).catch(() => {
      /* 后台任务：静默失败 */
    })
  }, ARCHIVE_DEBOUNCE_MS)

  pendingArchives.set(key, { timer, job: merged })
}

export function cancelUserMomentDistributionArchive(momentId: string): void {
  const prev = pendingArchives.get(momentId)
  if (prev) window.clearTimeout(prev.timer)
  pendingArchives.delete(momentId)
}

export async function deleteUserMomentDistributionForMoment(params: {
  accountId: string | null | undefined
  momentId: string
}): Promise<void> {
  const id = params.momentId.trim()
  if (!id) return
  cancelUserMomentDistributionArchive(id)
  await removeUserMomentDistributionRecord(params.accountId, id)
  const all = await personaDb.listAllCharacterMemories()
  const prefix = `user-moment-mem-${id}::`
  for (const m of all) {
    if (m.id.startsWith(prefix)) await personaDb.deleteCharacterMemory(m.id)
  }
}

function normalizeDistributionKeywords(raw: string[]): string[] {
  const out: string[] = []
  for (const item of raw) {
    const t = item.replace(/\s+/g, ' ').trim()
    if (!t || t.length > 16) continue
    if (!out.includes(t)) out.push(t)
    if (out.length >= 5) break
  }
  return out
}

/** 编辑面板关键词：同步 KV 记录与各角色观众记忆 */
export async function applyUserMomentDistributionKeywordsEdit(params: {
  accountId: string | null | undefined
  momentId: string
  memoryKeywords: string[]
}): Promise<boolean> {
  const acc = params.accountId?.trim()
  const id = params.momentId.trim()
  if (!acc || !id) return false

  const kws = normalizeDistributionKeywords(params.memoryKeywords)
  const records = await loadUserMomentDistributionRecords(acc)
  const existing = records.find((r) => r.momentId === id)
  if (!existing) return false

  await upsertUserMomentDistributionRecord(acc, {
    ...existing,
    memoryKeywords: kws,
    updatedAt: Date.now(),
  })

  const prefix = `user-moment-mem-${id}::`
  const all = await personaDb.listAllCharacterMemories()
  const now = Date.now()
  for (const m of all) {
    const isViewer =
      m.id.startsWith(prefix) ||
      (m.momentSourceMomentId === id && m.momentUserAuthored && m.momentMemoryRole === 'viewer')
    if (!isViewer) continue
    await personaDb.upsertCharacterMemory({
      ...m,
      memoryKeywords: kws.length ? kws : undefined,
      updatedAt: now,
    })
  }
  return true
}

export async function clearAllUserMomentDistributionArchives(params: {
  accountId: string | null | undefined
}): Promise<number> {
  const all = await personaDb.listAllCharacterMemories()
  let deleted = 0
  for (const m of all) {
    if (!isUserMomentViewerMemory(m)) continue
    await personaDb.deleteCharacterMemory(m.id)
    deleted += 1
  }
  await clearAllUserMomentDistributionRecords(params.accountId)
  return deleted
}

if (typeof window !== 'undefined') {
  window.addEventListener(MOMENT_MEMORY_ARCHIVE_SUPPRESSED_EVENT, (event) => {
    const momentId = (event as CustomEvent<{ momentId?: string }>).detail?.momentId?.trim()
    if (momentId) cancelUserMomentDistributionArchive(momentId)
  })
}
