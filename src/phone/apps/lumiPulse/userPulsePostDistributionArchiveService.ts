import type { ApiConfig } from '../api/types'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { CharacterMemory, PulseMemoryPayload } from '../wechat/newFriendsPersona/types'
import { composeMemoryWithSourcePrefix } from '../wechat/memory/memorySourceBadges'
import { textMentionsAnyAlias } from './pulseMentionDetect'
import {
  buildPulsePostMemoryPayload,
  buildUserPulseViewerMemoryContent,
  userPulseViewerMemoryId,
} from './pulsePostMemoryContentBuilder'
import { extractPulsePostMemoryKeywords } from './pulsePostMemoryKeywordAi'
import { resolvePulsePostStoryPublishAnchor } from './pulsePostStoryTime'
import {
  formatPulsePostVisibilityLabel,
  isPulsePostPartialVisibility,
  isPulsePostVisibleToCharacter,
} from './pulsePostVisibility'
import type { PulseComment, PulsePersistedRoot, PulsePost } from './pulseTypes'
import { parsePulsePovId, toCharPovId } from './pulseTypes'

const ARCHIVE_DEBOUNCE_MS = 4500

export type UserPulseDistributionArchiveJob = {
  post: PulsePost
  comments: PulseComment[]
  trendingTitle?: string
  apiConfig?: ApiConfig | null
  wechatAccountId?: string | null
  playerIdentityId?: string | null
  playerDisplayName: string
  /** 当前身份绑定的角色 char: povId */
  boundCharPovIds?: readonly string[]
}

type PendingArchive = {
  timer: number
  job: UserPulseDistributionArchiveJob
}

const pendingArchives = new Map<string, PendingArchive>()

export function isUserPulseViewerMemory(memory: CharacterMemory): boolean {
  return memory.pulseUserAuthored === true || memory.id.trim().startsWith('user-pulse-mem-')
}

function isUserPulsePost(post: PulsePost): boolean {
  return parsePulsePovId(post.authorPovId)?.kind === 'player'
}

function resolveVisibilityLabel(post: PulsePost): string {
  if (!isPulsePostPartialVisibility(post)) return '全部绑定角色可见'
  return formatPulsePostVisibilityLabel(post) || '部分角色可见'
}

function resolveAudienceCharIds(job: UserPulseDistributionArchiveJob): string[] {
  const post = job.post
  const bound = (job.boundCharPovIds ?? [])
    .map((id) => id.trim())
    .filter((id) => id.startsWith('char:'))

  let candidates: string[]
  if (isPulsePostPartialVisibility(post)) {
    candidates = (post.visibleToCharPovIds ?? [])
      .map((id) => id.trim())
      .filter((id) => id.startsWith('char:'))
    if (bound.length) {
      const allowed = new Set(bound)
      candidates = candidates.filter((id) => allowed.has(id))
    }
  } else {
    candidates = bound
  }

  const out: string[] = []
  const seen = new Set<string>()
  for (const pov of candidates) {
    if (!isPulsePostVisibleToCharacter(post, pov)) continue
    const raw = parsePulsePovId(pov)?.rawId?.trim()
    if (!raw || seen.has(raw)) continue
    seen.add(raw)
    out.push(raw)
  }
  return out
}

async function findViewerPulseMemory(
  viewerCharacterId: string,
  postId: string,
): Promise<CharacterMemory | null> {
  const list = await personaDb.listCharacterMemoriesForCharacter(viewerCharacterId)
  const stableId = userPulseViewerMemoryId(postId, viewerCharacterId)
  return (
    list.find(
      (m) =>
        m.id === stableId ||
        (m.pulseSourcePostId === postId &&
          (m.pulseUserAuthored === true || m.pulseMemoryRole === 'viewer')),
    ) ?? null
  )
}

async function pruneStaleViewerPulseMemories(
  postId: string,
  activeViewerIds: Set<string>,
): Promise<void> {
  const all = await personaDb.listAllCharacterMemories()
  const prefix = `user-pulse-mem-${postId.trim()}::`
  for (const m of all) {
    if (!m.id.startsWith(prefix)) continue
    const viewerId = m.id.slice(prefix.length).trim()
    if (!viewerId || activeViewerIds.has(viewerId)) continue
    await personaDb.deleteCharacterMemory(m.id)
  }
}

async function flushUserPulseDistributionArchive(job: UserPulseDistributionArchiveJob): Promise<void> {
  const post = job.post
  if (!isUserPulsePost(post)) return

  const audienceCharIds = resolveAudienceCharIds(job)
  const activeViewerIds = new Set<string>()

  if (!audienceCharIds.length) {
    await pruneStaleViewerPulseMemories(post.id, activeViewerIds)
    return
  }

  const playerDisplayName = job.playerDisplayName.trim() || post.authorName.trim() || '用户'
  const visibilityLabel = resolveVisibilityLabel(post)
  const builtBase = buildPulsePostMemoryPayload({
    post,
    comments: job.comments,
    trendingTitle: job.trendingTitle,
  })
  const keywords = await extractPulsePostMemoryKeywords({
    apiConfig: job.apiConfig,
    postText: builtBase.payload.originalText,
    location: post.locationLabel,
    trendingTitle: job.trendingTitle,
    imageDescriptions: builtBase.payload.imageDescriptions,
  })

  const archivedAt = Date.now()
  const systemPublishedAt =
    Number.isFinite(post.createdAt) && post.createdAt > 0 ? post.createdAt : archivedAt

  for (const charId of audienceCharIds) {
    activeViewerIds.add(charId)
    const charPov = toCharPovId(charId)
    const mentionedViewer = textMentionsAnyAlias(post.content, [], {
      playerPovId: charPov,
    })

    const storyAnchor = await resolvePulsePostStoryPublishAnchor({
      characterId: charId,
      systemPublishedAt,
    })

    const memoryContent = buildUserPulseViewerMemoryContent({
      post,
      comments: job.comments,
      playerDisplayName,
      visibilityLabel,
      mentionedViewer,
      trendingTitle: job.trendingTitle,
      publishLines: storyAnchor.publishLines,
    })

    const existing = await findViewerPulseMemory(charId, post.id)
    const createdAt = existing?.createdAt ?? systemPublishedAt
    const memoryId = existing?.id ?? userPulseViewerMemoryId(post.id, charId)

    const payload: PulseMemoryPayload = {
      ...builtBase.payload,
      publishedAt: systemPublishedAt,
      systemPublishedAt,
      publisherDisplayName: playerDisplayName,
      visibilityLabel,
      mentionedViewer,
      ...(storyAnchor.storyPublishLabel
        ? { storyPublishLabel: storyAnchor.storyPublishLabel }
        : {}),
    }

    const row: CharacterMemory = {
      id: memoryId,
      characterId: charId,
      content: composeMemoryWithSourcePrefix({ hasPulseTag: true }, memoryContent).slice(0, 4000),
      createdAt,
      updatedAt: archivedAt,
      isAutoGenerated: true,
      memoryScope: 'pulse',
      memoryTriggerMode: 'keyword',
      memoryKeywords: keywords.length ? keywords : ['微博', '用户'],
      pulseSourcePostId: post.id,
      pulseMemoryRole: 'viewer',
      pulseUserAuthored: true,
      pulsePayload: payload,
      ...(job.wechatAccountId?.trim()
        ? { sourceWechatAccountId: job.wechatAccountId.trim() }
        : {}),
      ...(job.playerIdentityId?.trim() && job.playerIdentityId !== '__none__'
        ? { sourceSessionPlayerIdentityId: job.playerIdentityId.trim() }
        : {}),
    }

    await personaDb.upsertCharacterMemory(row)
  }

  await pruneStaleViewerPulseMemories(post.id, activeViewerIds)
}

/** 用户发帖 / 编辑后：按可见角色防抖写入观众记忆 */
export function scheduleUserPulsePostDistributionArchive(job: UserPulseDistributionArchiveJob): void {
  const postId = job.post.id.trim()
  if (!postId || !isUserPulsePost(job.post)) return

  const prev = pendingArchives.get(postId)
  if (prev) window.clearTimeout(prev.timer)

  const timer = window.setTimeout(() => {
    pendingArchives.delete(postId)
    void flushUserPulseDistributionArchive(job).catch(() => {
      /* silent */
    })
  }, ARCHIVE_DEBOUNCE_MS)

  pendingArchives.set(postId, { timer, job })
}

export function cancelPendingUserPulseDistributionArchives(postIds: Iterable<string>): void {
  for (const raw of postIds) {
    const postId = raw.trim()
    if (!postId) continue
    const prev = pendingArchives.get(postId)
    if (!prev) continue
    window.clearTimeout(prev.timer)
    pendingArchives.delete(postId)
  }
}

/** 从 Pulse 树调度用户帖观众记忆 */
export function scheduleUserPulsePostDistributionFromRoot(params: {
  root: PulsePersistedRoot
  accountId: string
  postId: string
  apiConfig?: ApiConfig | null
  wechatAccountId?: string | null
  playerIdentityId?: string | null
  playerDisplayName?: string
  boundCharPovIds?: readonly string[]
}): void {
  const acc = params.root.byAccount[params.accountId]
  if (!acc) return
  const pid = params.postId.trim()
  if (!pid) return

  let post: PulsePost | undefined
  let comments: PulseComment[] = []
  let trendingTitle: string | undefined

  for (const world of Object.values(acc.worldByPov ?? {})) {
    const hit = world.posts.find((p) => p.id === pid)
    if (hit) {
      post = hit
      comments = world.commentsByPostId[pid] ?? []
      if (hit.trendingTopicId) {
        const topic = world.trending.find((t) => t.id === hit.trendingTopicId)
        trendingTitle = topic?.title
      }
      break
    }
  }

  if (!post || !isUserPulsePost(post)) return

  scheduleUserPulsePostDistributionArchive({
    post,
    comments,
    trendingTitle,
    apiConfig: params.apiConfig,
    wechatAccountId: params.wechatAccountId ?? params.accountId,
    playerIdentityId: params.playerIdentityId,
    playerDisplayName: params.playerDisplayName?.trim() || post.authorName || '用户',
    boundCharPovIds: params.boundCharPovIds,
  })
}

/** 删除用户帖对应的全部观众记忆 */
export async function removeUserPulseViewerMemories(postIds: string[]): Promise<void> {
  const ids = [...new Set(postIds.map((x) => x.trim()).filter(Boolean))]
  if (!ids.length) return
  cancelPendingUserPulseDistributionArchives(ids)

  const all = await personaDb.listAllCharacterMemories()
  const idSet = new Set(ids)
  const toDelete = all.filter((m) => {
    if (!isUserPulseViewerMemory(m)) return false
    if (m.pulseSourcePostId && idSet.has(m.pulseSourcePostId)) return true
    for (const pid of ids) {
      if (m.id.startsWith(`user-pulse-mem-${pid}::`)) return true
    }
    return false
  })
  if (!toDelete.length) return
  await Promise.all(toDelete.map((m) => personaDb.deleteCharacterMemory(m.id)))
}
