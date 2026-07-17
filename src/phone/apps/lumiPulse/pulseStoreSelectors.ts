import { useMemo } from 'react'

import {
  filterUnlockedPulseComments,
  filterUnlockedPulseDmThreads,
  filterUnlockedPulseInteractions,
} from './pulseEngagementUnlock'
import { isPulseNetizenAuthor } from './pulseNetizenAvatar'
import type { PulseComment, PulseDmThread, PulseFollowingUser, PulseInteraction, PulsePost, PulseProfileStats, PulseTrendingTopic } from './pulseTypes'
import { defaultProfileStats, mergePlayerStatsWithPlotSocial } from './pulseTypes'
import { filterPostsForIdentityScope } from './pulseIdentityScope'
import { usePulseStore } from './usePulseStore'

const EMPTY_POSTS: PulsePost[] = []
const EMPTY_COMMENTS: PulseComment[] = []
const EMPTY_TRENDING: PulseTrendingTopic[] = []
const EMPTY_INTERACTIONS: PulseInteraction[] = []
const EMPTY_DM_THREADS: PulseDmThread[] = []
const EMPTY_FOLLOWING: PulseFollowingUser[] = []
const DEFAULT_PROFILE_STATS = defaultProfileStats()

/** 当前世界的动态流（各世界完全隔离） */
function selectWorldPosts(state: ReturnType<typeof usePulseStore.getState>): PulsePost[] {
  const acc = state.currentAccountId
  const pov = state.currentPOVId
  if (!acc || !pov) return EMPTY_POSTS
  return state.root.byAccount[acc]?.worldByPov[pov]?.posts ?? EMPTY_POSTS
}

function selectStoredFollowing(
  state: ReturnType<typeof usePulseStore.getState>,
  povId: string | null | undefined,
): PulseFollowingUser[] {
  const acc = state.currentAccountId
  const id = povId?.trim()
  if (!acc || !id) return EMPTY_FOLLOWING
  return state.root.byAccount[acc]?.followingByPov[id] ?? EMPTY_FOLLOWING
}

export function usePulseDiscoverPosts(): PulsePost[] {
  const posts = usePulseStore(selectWorldPosts)
  const playerPovId = usePulseStore((s) => s.currentPlayerPovId)
  const identityVisible = usePulseStore((s) => s.identityVisibleCharPovIds)
  return useMemo(() => {
    const scoped = filterPostsForIdentityScope(
      posts,
      playerPovId,
      identityVisible ? new Set(identityVisible) : null,
    )
    return [...scoped].sort((a, b) => b.createdAt - a.createdAt)
  }, [posts, playerPovId, identityVisible])
}

/**
 * 首页：
 * - 关注 = 仅关注列表中的博主发帖（不含热搜生成/未关注网友）
 * - 推荐 = 当前世界全站
 */
export function usePulseHomePosts(
  segment: 'following' | 'recommended',
  currentPovId: string,
): PulsePost[] {
  const posts = usePulseDiscoverPosts()
  const worldPovId = usePulseStore((s) => s.currentPOVId)
  const followingForPlayer = usePulseStore((s) => selectStoredFollowing(s, currentPovId))
  const followingForWorld = usePulseStore((s) => selectStoredFollowing(s, worldPovId))

  return useMemo(() => {
    if (segment === 'recommended') return posts

    const followedIds = new Set<string>()
    const followedNames = new Set<string>()
    for (const u of [...followingForPlayer, ...followingForWorld]) {
      const id = u.povId.trim()
      const name = u.name.trim().toLowerCase()
      if (id) followedIds.add(id)
      if (name) followedNames.add(name)
    }
    if (!followedIds.size && !followedNames.size) return EMPTY_POSTS

    return posts.filter((p) => {
      if (p.authorPovId === currentPovId) return false
      // 热搜演化帖永不进关注流
      if (p.trendingTopicId) return false
      if (followedIds.has(p.authorPovId)) return true
      if (followedNames.has(p.authorName.trim().toLowerCase())) return true
      return false
    })
  }, [posts, segment, currentPovId, followingForPlayer, followingForWorld])
}

export function usePulsePostsByAuthor(authorPovId: string): PulsePost[] {
  const posts = usePulseDiscoverPosts()
  const authorWorldPosts = usePulseStore((s) => {
    const acc = s.currentAccountId
    const id = authorPovId.trim()
    if (!acc || !id.startsWith('char:')) return EMPTY_POSTS
    return s.root.byAccount[acc]?.worldByPov[id]?.posts ?? EMPTY_POSTS
  })

  return useMemo(() => {
    const id = authorPovId.trim()
    const merged = new Map<string, PulsePost>()
    for (const p of posts) {
      if (p.authorPovId === id) merged.set(p.id, p)
    }
    if (id.startsWith('char:')) {
      for (const p of authorWorldPosts) {
        if (p.authorPovId === id) merged.set(p.id, p)
      }
    }
    return [...merged.values()].sort((a, b) => b.createdAt - a.createdAt)
  }, [posts, authorWorldPosts, authorPovId])
}

/** 在账号全部世界块中按 id 查找帖子（优先当前世界） */
export function selectPulsePostById(
  state: ReturnType<typeof usePulseStore.getState>,
  postId: string | null | undefined,
): PulsePost | null {
  const pid = postId?.trim()
  const acc = state.currentAccountId
  if (!pid || !acc) return null
  const byWorld = state.root.byAccount[acc]?.worldByPov
  if (!byWorld) return null
  const current = state.currentPOVId?.trim()
  if (current) {
    const hit = byWorld[current]?.posts.find((p) => p.id === pid)
    if (hit) return hit
  }
  for (const world of Object.values(byWorld)) {
    const hit = world.posts.find((p) => p.id === pid)
    if (hit) return hit
  }
  return null
}

export function usePulsePostById(postId: string | null | undefined): PulsePost | null {
  return usePulseStore((s) => selectPulsePostById(s, postId))
}

export function usePulseLikedPosts(currentPovId: string): PulsePost[] {
  const posts = usePulseDiscoverPosts()
  return useMemo(
    () => posts.filter((p) => p.likedByPovIds.includes(currentPovId)),
    [posts, currentPovId],
  )
}

/** 评论：优先当前世界；否则回落到实际存有该帖的世界块（含未解锁 visibleAt） */
export function usePulsePostComments(postId: string): PulseComment[] {
  return usePulseStore((s) => {
    const pid = postId.trim()
    const acc = s.currentAccountId
    if (!acc || !pid) return EMPTY_COMMENTS
    const byWorld = s.root.byAccount[acc]?.worldByPov
    if (!byWorld) return EMPTY_COMMENTS
    const current = s.currentPOVId?.trim()
    if (current) {
      const w = byWorld[current]
      if (w) {
        const list = w.commentsByPostId[pid]
        if (list?.length) return list
        if (w.posts.some((p) => p.id === pid)) return list ?? EMPTY_COMMENTS
      }
    }
    for (const w of Object.values(byWorld)) {
      const list = w.commentsByPostId[pid]
      if (list?.length) return list
      if (w.posts.some((p) => p.id === pid)) return list ?? EMPTY_COMMENTS
    }
    return EMPTY_COMMENTS
  })
}

/** 仅返回墙钟已解锁的评论（朋友圈 visibleAt 同思路） */
export function useUnlockedPulsePostComments(postId: string, now: number): PulseComment[] {
  const all = usePulsePostComments(postId)
  return useMemo(
    () => filterUnlockedPulseComments(all, now),
    [all, now],
  )
}

/** 当前世界的热搜榜 */
export function usePulseTrendingTopics(): PulseTrendingTopic[] {
  const trending = usePulseStore((s) => {
    const acc = s.currentAccountId
    const pov = s.currentPOVId
    if (!acc || !pov) return EMPTY_TRENDING
    return s.root.byAccount[acc]?.worldByPov[pov]?.trending ?? EMPTY_TRENDING
  })
  return useMemo(() => [...trending].sort((a, b) => a.rank - b.rank), [trending])
}

export function usePulseInteractions(): PulseInteraction[] {
  const rows = usePulseStore((s) => {
    const acc = s.currentAccountId
    const player = s.currentPlayerPovId
    if (!acc || !player) return EMPTY_INTERACTIONS
    return s.root.byAccount[acc]?.interactionsByPov[player] ?? EMPTY_INTERACTIONS
  })
  return useMemo(() => [...rows].sort((a, b) => b.createdAt - a.createdAt), [rows])
}

/** 消息 Tab：仅展示墙钟已解锁的互动 */
export function useUnlockedPulseInteractions(now: number): PulseInteraction[] {
  const rows = usePulseInteractions()
  return useMemo(
    () =>
      filterUnlockedPulseInteractions(rows, now).sort((a, b) => b.createdAt - a.createdAt),
    [rows, now],
  )
}

export function usePulseDmThreads(): PulseDmThread[] {
  const rows = usePulseStore((s) => {
    const acc = s.currentAccountId
    const player = s.currentPlayerPovId
    if (!acc || !player) return EMPTY_DM_THREADS
    return s.root.byAccount[acc]?.dmThreadsByPov[player] ?? EMPTY_DM_THREADS
  })
  return useMemo(() => [...rows].sort((a, b) => b.lastAt - a.lastAt), [rows])
}

/** 私信列表：仅展示墙钟已解锁的会话 */
export function useUnlockedPulseDmThreads(now: number): PulseDmThread[] {
  const rows = usePulseDmThreads()
  return useMemo(
    () => filterUnlockedPulseDmThreads(rows, now).sort((a, b) => b.lastAt - a.lastAt),
    [rows, now],
  )
}

export function usePulseProfileStats(povId: string | null | undefined): PulseProfileStats {
  const resolvedId = usePulseStore((s) => povId ?? s.currentPlayerPovId)
  const player = usePulseStore((s) => s.currentPlayerPovId)
  const activePlot = usePulseStore((s) => {
    const acc = s.currentAccountId
    const p = s.currentPlayerPovId
    if (!acc || !p) return s.currentPOVId
    return s.root.byAccount[acc]?.activePlotCharPovByPlayerPov?.[p] ?? s.currentPOVId
  })
  // 只订阅原始引用，禁止在 selector 里每次 new 对象（会触发 getSnapshot 死循环）
  const base = usePulseStore((s) => {
    const acc = s.currentAccountId
    const id = resolvedId
    if (!acc || !id) return DEFAULT_PROFILE_STATS
    return s.root.byAccount[acc]?.profileStatsByPov[id] ?? DEFAULT_PROFILE_STATS
  })
  const plotSnap = usePulseStore((s) => {
    const acc = s.currentAccountId
    if (!acc || !activePlot) return undefined
    return s.root.byAccount[acc]?.playerPlotSocialByCharPov?.[activePlot]
  })
  const hasAnyPlotSocial = usePulseStore((s) => {
    const acc = s.currentAccountId
    if (!acc) return false
    const map = s.root.byAccount[acc]?.playerPlotSocialByCharPov
    return Boolean(map && Object.keys(map).length > 0)
  })

  return useMemo(() => {
    if (!resolvedId || resolvedId !== player || !activePlot) return base
    if (plotSnap) return mergePlayerStatsWithPlotSocial(base, plotSnap)
    if (hasAnyPlotSocial) {
      return {
        ...base,
        followers: 0,
        verifyLabel: undefined,
        followersGainPending: 0,
        followersSyncedAt: undefined,
      }
    }
    return base
  }, [activePlot, base, hasAnyPlotSocial, player, plotSnap, resolvedId])
}

/** 当前身份选用的角色剧情线 char: */
export function usePulseActivePlotCharPov(): string | null {
  return usePulseStore((s) => {
    const acc = s.currentAccountId
    const player = s.currentPlayerPovId
    if (!acc || !player) return null
    const plot = s.root.byAccount[acc]?.activePlotCharPovByPlayerPov?.[player]?.trim()
    return plot && plot.startsWith('char:') ? plot : null
  })
}

/** 当前身份是否开启融合模式 */
export function usePulseFusionMode(): boolean {
  return usePulseStore((s) => {
    const acc = s.currentAccountId
    const player = s.currentPlayerPovId
    if (!acc || !player) return false
    return s.root.byAccount[acc]?.fusionModeByPlayerPov?.[player] === true
  })
}

const EMPTY_GENERATED_PLOT_IDS: string[] = []

/** 已生成社交数据的剧情线 char: 集合 */
export function usePulseGeneratedPlotCharPovIds(): string[] {
  // 只订阅 map 引用；禁止在 selector 里 Object.keys 出新数组
  const map = usePulseStore((s) => {
    const acc = s.currentAccountId
    if (!acc) return undefined
    return s.root.byAccount[acc]?.playerPlotSocialByCharPov
  })
  return useMemo(() => {
    if (!map) return EMPTY_GENERATED_PLOT_IDS
    return Object.keys(map).filter((k) => k.startsWith('char:'))
  }, [map])
}

const EMPTY_PROFILE_STATS_MAP: Record<string, PulseProfileStats> = {}

/** 当前账号下全部 POV 的主页统计（含 AI 微博昵称） */
export function usePulseProfileStatsByPov(): Record<string, PulseProfileStats> {
  return usePulseStore((s) => {
    const acc = s.currentAccountId
    if (!acc) return EMPTY_PROFILE_STATS_MAP
    return s.root.byAccount[acc]?.profileStatsByPov ?? EMPTY_PROFILE_STATS_MAP
  })
}

/** 当前 POV 的关注列表；无持久化数据时仅从主要角色动态推导（不含 AI 网友） */
export function usePulseFollowingList(povId: string | null | undefined): PulseFollowingUser[] {
  const resolvedPovId = povId ?? usePulseStore((s) => s.currentPlayerPovId)
  const stored = usePulseStore((s) => selectStoredFollowing(s, povId ?? s.currentPlayerPovId))
  const posts = usePulseDiscoverPosts()

  return useMemo(() => {
    if (stored.length) return stored
    if (!resolvedPovId) return EMPTY_FOLLOWING
    const seen = new Set<string>()
    const derived: PulseFollowingUser[] = []
    for (const p of posts) {
      if (p.authorPovId === resolvedPovId || seen.has(p.authorPovId)) continue
      if (p.trendingTopicId) continue
      if (isPulseNetizenAuthor(p.authorPovId, p.isAiGenerated)) continue
      if (!p.authorPovId.startsWith('char:')) continue
      seen.add(p.authorPovId)
      derived.push({
        povId: p.authorPovId,
        name: p.authorName,
        avatarUrl: p.authorAvatarUrl,
        verified: p.verified,
      })
    }
    return derived
  }, [posts, resolvedPovId, stored])
}

/**
 * 我关注的人里，也关注了 target 的账号（用于主页「我关注的 XXX 等也关注了 TA」）。
 * 无图边时：若目标有粉丝且我还关注了其他人，用关注列表作稳定展示回退。
 */
export function usePulseAlsoFollowTarget(
  targetPovId: string | null | undefined,
  playerPovId: string | null | undefined,
): PulseFollowingUser[] {
  const myFollowing = usePulseFollowingList(playerPovId)
  const followingMap = usePulseStore((s) => {
    const acc = s.currentAccountId
    if (!acc) return null
    return s.root.byAccount[acc]?.followingByPov ?? null
  })
  const targetFollowers = usePulseStore((s) => {
    const acc = s.currentAccountId
    const id = targetPovId?.trim()
    if (!acc || !id) return 0
    return s.root.byAccount[acc]?.profileStatsByPov[id]?.followers ?? 0
  })

  return useMemo(() => {
    const target = targetPovId?.trim()
    const player = playerPovId?.trim()
    if (!target || !player || target === player) return EMPTY_FOLLOWING

    const peers = myFollowing.filter((u) => u.povId !== target && u.povId !== player)
    if (!peers.length) return EMPTY_FOLLOWING

    const map = followingMap ?? {}
    const hit = peers.filter((f) => (map[f.povId] ?? []).some((u) => u.povId === target))
    if (hit.length) return hit

    if (targetFollowers <= 0 && !target.startsWith('char:')) return EMPTY_FOLLOWING
    return [...peers].sort((a, b) => a.povId.localeCompare(b.povId))
  }, [followingMap, myFollowing, playerPovId, targetFollowers, targetPovId])
}
