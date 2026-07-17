import { create } from 'zustand'

import { personaDb } from '../wechat/newFriendsPersona/idb'
import { DEFAULT_PULSE_ROOT, LUMI_PULSE_KV_KEY } from './constants'
import {
  ensureTrendingTopicPrefix,
  textMentionsAnyAlias,
} from './pulseMentionDetect'
import {
  rewritePlainMentionsToPulseExpr,
  type PulseMentionDirectoryEntry,
} from './pulseMentionExpr'
import { resolvePulseAuthorAvatarForPersist, pickStablePulseNetizenAvatarPath } from './pulseNetizenAvatar'
import { distributePulseCommentTimestamps } from './pulseTimeFormat'
import { sanitizePulseProfileSignature } from './pulseWeiboFace'
import type {
  PulseAccountData,
  PulseComment,
  PulseDmThread,
  PulseEngagementMetricsPlan,
  PulseFollowingUser,
  PulseGeneratedProfileBundle,
  PulseGeneratedSocialAccount,
  PulseInteraction,
  PulsePersistedRoot,
  PulsePovId,
  PulsePost,
  PulsePostImageSlot,
  PulseProfileStats,
  PulseSocialAccountSeed,
  PulseTrendingTopic,
  PulseWorldData,
} from './pulseTypes'
import {
  defaultProfileStats,
  emptyPulseAccountData,
  emptyPulseWorldData,
  isPulseWorldPovId,
  parsePulsePovId,
} from './pulseTypes'
import {
  cancelPendingPulsePostArchives,
  removeAllPulseMemoriesForCharacter,
  removePulsePostMemories,
  schedulePulsePostMemoryFromRoot,
} from './pulsePostMemoryArchiver'
import { cancelPlayerPostEngagement } from './pulsePlayerPostEngagement'
import { cancelPlayerPostCharacterEngagement } from './pulsePlayerPostCharacterEngagement'
import { normalizePulsePostVisibility } from './pulsePostVisibility'
import {
  cancelPendingUserPulseDistributionArchives,
  removeUserPulseViewerMemories,
  scheduleUserPulsePostDistributionFromRoot,
} from './userPulsePostDistributionArchiveService'
import {
  filterUnlockedPulseComments,
  resolveUnlockedEngagementMetrics,
} from './pulseEngagementUnlock'
import {
  computePostFollowerBoost,
  isCharacterEligibleForFollowerGrowth,
  planFollowerGrowthCatchUp,
} from './pulseFollowerGrowth'
import {
  absorbLegacyWorldIntoPov,
  getWorldSlice,
  migratePulseRoot,
} from './pulseWorldData'
import {
  filterPostsForIdentityScope,
  isPulseAuthorVisibleForIdentity,
} from './pulseIdentityScope'
import { distributeCharacterDynamicsTimestamps, DEFAULT_CHARACTER_DYNAMICS_TIME_SPAN } from './characterDynamicsTime'
import type { CharacterDynamicsTimeSpan } from './characterDynamicsTime'

type PulseStore = {
  hydrated: boolean
  currentAccountId: string | null
  /** 当前浏览的世界锚点（主要角色 char:）— 决定动态流 / 热搜等内容域 */
  currentPOVId: PulsePovId | null
  /** 当前登录的微博账号（玩家 player:）— 发帖 / 点赞 / 个人主页 / 消息 */
  currentPlayerPovId: PulsePovId | null
  /**
   * 当前正在查看的私信会话 id（不持久化）。
   * 进房写入、退房清空：该会话内网友消息不累加未读。
   */
  activeDmThreadId: string | null
  /**
   * 当前身份视角下可见的角色 char: 集合。
   * null = 尚未限定（不按身份过滤）；空数组 = 已限定但无绑定角色。
   */
  identityVisibleCharPovIds: string[] | null
  root: PulsePersistedRoot

  bindAccount: (accountId: string | null | undefined) => Promise<void>
  setCurrentPOVId: (povId: PulsePovId | null) => void
  /** 选择 / 切换玩家身份视角（进入微博时） */
  setCurrentPlayerPovId: (povId: PulsePovId | null) => void
  /** 标记正在阅读的私信会话；传 null 表示离开聊天室 */
  setActiveDmThreadId: (threadId: string | null) => void
  /** 写入当前身份可互动的角色 char: 列表 */
  setIdentityVisibleCharPovIds: (ids: string[] | null) => void
  /**
   * 切换当前身份的角色剧情线（须已生成该线社交数据）。
   * @returns ok / missing_social / no_player
   */
  setActivePlotCharPov: (charPovId: string) => 'ok' | 'missing_social' | 'no_player' | 'invalid'
  /** 融合模式：其他已生成剧情线的绑定角色也可参与用户发帖互动 */
  setFusionMode: (enabled: boolean) => void
  /** 仅清空当前身份选择（进场重选），不擦 persist 的 lastPlayerPovId */
  clearPlayerPovPick: () => void
  logoutPov: () => void

  getAccountData: () => PulseAccountData
  getProfileStats: (povId?: PulsePovId | null) => PulseProfileStats
  getPostsForDiscover: () => PulsePost[]
  getComments: (postId: string) => PulseComment[]
  getTrending: () => PulseTrendingTopic[]
  getInteractions: () => PulseInteraction[]
  getDmThreads: () => PulseDmThread[]

  publishPost: (input: {
    authorPovId: PulsePovId
    authorName: string
    authorAvatarUrl?: string
    content: string
    trendingTopicId?: string
    isAiGenerated?: boolean
    verified?: boolean
    imageUrls?: string[]
    locationLabel?: string
    /** 对绑定角色的可见范围；缺省公开 */
    visibility?: 'public' | 'partial'
    visibleToCharPovIds?: PulsePovId[]
    /** 当前玩家可被 @ 命中的昵称；命中则写 mention 互动 */
    playerMentionAliases?: string[]
  }) => string
  /** 编辑本人帖：正文/配图/位置/可见性（仅 currentPlayerPovId 作者） */
  updatePost: (
    postId: string,
    patch: {
      content?: string
      imageUrls?: string[] | null
      locationLabel?: string | null
      visibility?: 'public' | 'partial'
      visibleToCharPovIds?: PulsePovId[]
    },
  ) => boolean
  /** 删除单帖（含评论/记忆/排队互动）；仅本人帖可删 */
  deletePost: (postId: string) => boolean
  /**
   * 删除评论（含其下楼中楼）。
   * 允许：本人发出的评论（含匿名冲浪），或本人帖子下的任意评论。
   */
  deleteComment: (postId: string, commentId: string) => boolean
  toggleLike: (postId: string) => void
  addComment: (input: {
    postId: string
    authorPovId: PulsePovId
    authorName: string
    authorAvatarUrl?: string
    content: string
    parentId?: string
    isAiGenerated?: boolean
    anonymousByPlayerId?: string
    playerMentionAliases?: string[]
  }) => string
  setTrending: (topics: PulseTrendingTopic[], forPovId: PulsePovId) => void
  /** 写入热搜榜 + 话题下讨论帖/评论（替换旧热搜关联帖） */
  ingestTrendingBundle: (input: {
    forPovId: PulsePovId
    bundles: import('./parseTrendingMarkup').ParsedTrendingTopic[]
    /** 当前玩家可被 @ 命中的昵称别名（微博昵称等） */
    playerMentionAliases?: string[]
    /** 入库时把 `@昵称` 改写成 `@{{char|player:id}}` */
    mentionDirectory?: readonly PulseMentionDirectoryEntry[]
  }) => PulseTrendingTopic[]
  /** 更新帖内某张配图槽（占位 → 生成中 / 成功 / 失败） */
  patchPostImageSlot: (
    postId: string,
    slotId: string,
    patch: Partial<Pick<PulsePostImageSlot, 'url' | 'status' | 'description' | 'imagePrompt'>>,
  ) => void
  pushInteractions: (items: Omit<PulseInteraction, 'id' | 'read'>[], povId: PulsePovId) => void
  replaceDmThreads: (threads: PulseDmThread[], povId: PulsePovId) => void
  /** 前置追加私信会话（生成新网友时累加，保留旧会话未读） */
  prependDmThreads: (threads: PulseDmThread[], povId: PulsePovId) => void
  /** 向某条私信会话追加消息（玩家发出 / 网友 AI 回复） */
  appendDmMessages: (
    threadId: string,
    messages: Array<{ fromFan: boolean; content: string }>,
  ) => void
  markDmThreadRead: (threadId: string) => void
  markInteractionsRead: () => void
  markInteractionsReadByType: (type: PulseInteraction['type']) => void
  appendAiPosts: (
    rows: Array<{ authorName: string; content: string }>,
    authorPovId: PulsePovId,
  ) => void
  appendAiComments: (
    postId: string,
    comments: PulseComment[],
    opts?: { playerMentionAliases?: string[] },
  ) => void
  /** 用户发帖后标记粉丝互动待生成（退出页面亦可续跑） */
  markPlayerPostEngagementPending: (postId: string) => void
  /**
   * 用户发帖后粉丝互动：评论/通知/私信带 visibleAt 落库；赞转按里程碑延时推进。
   */
  applyPlayerPostEngagement: (input: {
    postId: string
    playerPovId: PulsePovId
    likeCount: number
    repostCount: number
    engagementMetrics: PulseEngagementMetricsPlan
    comments: PulseComment[]
    interactions: Array<Omit<PulseInteraction, 'read'> & { read?: boolean }>
    dmThreads?: PulseDmThread[]
  }) => boolean
  /**
   * 用户发帖后：可见绑定角色点赞/评论（与网友互动并存，不覆盖 pc-eng-）。
   */
  applyPlayerPostCharacterEngagement: (input: {
    postId: string
    playerPovId: PulsePovId
    comments: PulseComment[]
    likedByPovIds: string[]
    interactions: Array<Omit<PulseInteraction, 'read'> & { read?: boolean }>
  }) => boolean
  /**
   * 按墙钟补齐帖面赞/转/评展示数（进广场 / 时钟 tick 调用）。
   * 不删除未解锁的评论与通知，仅推进已到点的展示数值。
   */
  syncPlayerPostEngagementDisplay: (now?: number) => void
  /**
   * 粉丝自然增长补齐：
   * - 用户：零粉小起步 / 墙钟被动涨
   * - 角色：仅已有社交粉丝基数（followers>0）的 char:，按体量涨（明星多、素人少）
   * @returns 本次各账号涨粉合计
   */
  syncPlayerFollowerGrowth: (now?: number) => number
  /** 发帖带动的额外涨粉（仅用户） */
  applyPlayerPostFollowerBoost: (seed?: string) => number
  /** 清除当前身份「粉丝增长」角标累计（不影响实际粉丝数） */
  clearFollowersGainPending: (povId?: PulsePovId | null) => void
  /**
   * 跨世界写入评论（微信分享卡同轮角色下场评论用）。
   * 不依赖 currentPOVId；若帖不存在则返回 false。
   */
  appendCommentsToWorld: (input: {
    accountId: string
    worldPovId: PulsePovId
    postId: string
    comments: PulseComment[]
  }) => boolean
  bumpProfileStats: (povId: PulsePovId, patch: Partial<PulseProfileStats>) => void
  /**
   * 关注 / 取消关注。
   * `baseList`：当前 UI 上的关注列表（含从动态推导的），用于「尚未持久化」时首次取关仍能写回 stored。
   * @returns 操作后是否处于关注状态
   */
  toggleFollow: (
    target: PulseFollowingUser,
    baseList?: readonly PulseFollowingUser[],
  ) => boolean
  /**
   * 确保 fromPovId 已关注 target（幂等；不写用户主动关注列表）。
   * 用于私聊「角色关注用户微博」指令等。
   * @returns 是否新写入（已存在则 false）
   */
  ensureFollowEdge: (input: {
    fromPovId: string
    target: PulseFollowingUser
  }) => boolean
  /** 写入 AI 生成的个人主页数据（统计、动态、评论、消息互动） */
  applyGeneratedProfileBundle: (input: {
    povId: PulsePovId
    authorName: string
    authorAvatarUrl?: string
    bundle: PulseGeneratedProfileBundle
  }) => void
  /** 仅追加角色主页动态（不改关注列表；可按人设补赞数） */
  appendGeneratedCharacterDynamics: (input: {
    povId: PulsePovId
    authorName: string
    authorAvatarUrl?: string
    posts: import('./pulseTypes').PulseGeneratedProfilePost[]
    /** 多条动态发布时间跨度；默认 3 个月内 */
    timeSpan?: CharacterDynamicsTimeSpan
  }) => number
  /**
   * 清除指定作者在全部世界块中的动态及评论。
   * @returns 实际删除的帖子条数（按 id 去重）
   */
  clearPostsByAuthor: (authorPovId: PulsePovId) => number
  /**
   * 写入社交账号数据（简介/粉丝/关注列表）。不改动帖子。
   * - 圈内关注边由 followEdges 控制（人脉关系推导；不写玩家关注）
   * - 角色可带圈外网友关注；玩家种子只写简介粉丝，关注列表保持空
   * - playerPlotOnly：默认不改角色；可配合 overwriteCharPovIds 按需覆盖所选角色
   */
  applySocialAccountsBundle: (input: {
    seeds: PulseSocialAccountSeed[]
    generated: PulseGeneratedSocialAccount[]
    followEdges?: Array<{ fromPovId: string; toPovId: string }>
    /** 用户粉丝/认证写入的剧情锚点（char:）；同身份多线隔离 */
    plotAnchorCharPovId?: string
    /**
     * 默认只写用户剧情线社交。
     * 若同时传 overwriteCharPovIds，则额外覆盖这些角色账号。
     */
    playerPlotOnly?: boolean
    /** 按需覆盖的角色 pov（char:）；仅 playerPlotOnly 时生效 */
    overwriteCharPovIds?: string[]
    /** 不写用户本人（例如剧情线已有、只重刷所选角色） */
    skipPlayerWrite?: boolean
  }) => number
  /** 为尚无头像的 AI 网友帖/评补全并持久化随机网友头像 */
  ensurePostDetailAvatars: (postId: string) => void
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

function schedulePersist(root: PulsePersistedRoot) {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    void personaDb.setPhoneKv(LUMI_PULSE_KV_KEY, root)
  }, 280)
}

/** 正文 @ 命中玩家别名时产生未读 mention 互动（供消息 Tab 红点） */
function buildMentionInteractionIfNeeded(params: {
  text: string
  fromName: string
  fromAvatarUrl?: string
  postId: string
  authorPovId: string
  anonymousByPlayerId?: string
  aliases: string[]
  playerPovId: string | null | undefined
}): Omit<PulseInteraction, 'id' | 'read'> | null {
  const player = params.playerPovId?.trim()
  if (!player) return null
  if (params.authorPovId === player) return null
  if (params.anonymousByPlayerId?.trim() === player) return null
  const aliases = params.aliases.map((a) => a.trim()).filter(Boolean)
  if (
    !textMentionsAnyAlias(params.text, aliases, {
      playerPovId: player,
    })
  ) {
    return null
  }
  return {
    type: 'mention',
    fromName: params.fromName,
    fromAvatarUrl: params.fromAvatarUrl,
    postId: params.postId,
    postSnippet: params.text.replace(/\s+/g, ' ').trim().slice(0, 48),
    content: params.text.trim().slice(0, 200),
    createdAt: Date.now(),
  }
}

function ensureAccount(root: PulsePersistedRoot, accountId: string): PulseAccountData {
  const existing = root.byAccount[accountId]
  if (existing) return existing
  const next = emptyPulseAccountData()
  root.byAccount[accountId] = next
  return next
}

function patchAccount(
  root: PulsePersistedRoot,
  accountId: string,
  recipe: (draft: PulseAccountData) => PulseAccountData,
): PulsePersistedRoot {
  const acc = ensureAccount(root, accountId)
  return {
    ...root,
    byAccount: {
      ...root.byAccount,
      [accountId]: recipe(acc),
    },
  }
}

/** 若当前世界已有剧情线社交快照，则同步粉丝/认证/增长角标 */
function syncPlayerPlotSocialBucket(
  draft: PulseAccountData,
  worldPovId: string | null | undefined,
  next: Pick<
    PulseProfileStats,
    'followers' | 'verifyLabel' | 'followersSyncedAt' | 'followersGainPending'
  >,
): PulseAccountData {
  const world = worldPovId?.trim()
  if (!world || !isPulseWorldPovId(world)) return draft
  const prevPlot = draft.playerPlotSocialByCharPov?.[world]
  if (!prevPlot) return draft
  return {
    ...draft,
    playerPlotSocialByCharPov: {
      ...(draft.playerPlotSocialByCharPov ?? {}),
      [world]: {
        ...prevPlot,
        followers: Math.max(0, Math.floor(next.followers ?? prevPlot.followers)),
        verifyLabel: next.verifyLabel?.trim() || prevPlot.verifyLabel,
        followersSyncedAt: next.followersSyncedAt ?? prevPlot.followersSyncedAt,
        followersGainPending: next.followersGainPending ?? prevPlot.followersGainPending,
      },
    },
  }
}

/** 在当前世界数据块上 patch */
function patchWorld(
  root: PulsePersistedRoot,
  accountId: string,
  povId: PulsePovId,
  recipe: (draft: PulseWorldData) => PulseWorldData,
): PulsePersistedRoot {
  return patchAccount(root, accountId, (draft) => {
    const prev = draft.worldByPov[povId] ?? emptyPulseWorldData()
    return {
      ...draft,
      worldByPov: {
        ...draft.worldByPov,
        [povId]: recipe(prev),
      },
    }
  })
}

function requirePulseSession(): {
  worldId: PulsePovId
  playerPovId: PulsePovId
  accountId: string
  root: PulsePersistedRoot
} | null {
  const { currentPOVId, currentPlayerPovId, currentAccountId, root } = usePulseStore.getState()
  if (!currentAccountId || !currentPOVId || !currentPlayerPovId || !isPulseWorldPovId(currentPOVId)) {
    return null
  }
  return { worldId: currentPOVId, playerPovId: currentPlayerPovId, accountId: currentAccountId, root }
}

/** @deprecated 使用 requirePulseSession */
function requireWorldPov(): { pov: PulsePovId; accountId: string; root: PulsePersistedRoot } | null {
  const session = requirePulseSession()
  if (!session) return null
  return { pov: session.worldId, accountId: session.accountId, root: session.root }
}

/** 评论及其全部楼中楼后代 id */
function collectPulseCommentSubtreeIds(list: PulseComment[], rootId: string): Set<string> {
  const rid = rootId.trim()
  const ids = new Set<string>()
  if (!rid) return ids
  ids.add(rid)
  let grew = true
  while (grew) {
    grew = false
    for (const c of list) {
      const pid = c.parentId?.trim()
      if (pid && ids.has(pid) && !ids.has(c.id)) {
        ids.add(c.id)
        grew = true
      }
    }
  }
  return ids
}

function isPulseCommentOwnedByPlayer(
  comment: Pick<PulseComment, 'authorPovId' | 'anonymousByPlayerId'>,
  playerPovId: string,
): boolean {
  const player = playerPovId.trim()
  if (!player) return false
  if (comment.authorPovId.trim() === player) return true
  return (comment.anonymousByPlayerId?.trim() || '') === player
}


/** 含该帖正文或评论的世界 id（优先当前世界排前） */
function worldIdsHoldingPost(
  root: PulsePersistedRoot,
  accountId: string,
  postId: string,
  preferredWorldId?: string | null,
): PulsePovId[] {
  const pid = postId.trim()
  if (!pid) return []
  const byWorld = root.byAccount[accountId]?.worldByPov
  if (!byWorld) return []
  const hits: PulsePovId[] = []
  for (const [wid, w] of Object.entries(byWorld)) {
    if (!isPulseWorldPovId(wid)) continue
    if (w.posts.some((p) => p.id === pid) || Boolean(w.commentsByPostId[pid]?.length)) {
      hits.push(wid as PulsePovId)
    }
  }
  if (!hits.length) {
    const preferred = preferredWorldId?.trim()
    if (preferred && isPulseWorldPovId(preferred)) return [preferred as PulsePovId]
    return []
  }
  const preferred = preferredWorldId?.trim()
  if (preferred && hits.includes(preferred as PulsePovId)) {
    return [preferred as PulsePovId, ...hits.filter((id) => id !== preferred)]
  }
  return hits
}

/** 角色微博帖变更后，防抖刻录入长期记忆（私聊/线下向量召回可命中并注入原文） */
function scheduleArchivePulsePostIfCharacter(root: PulsePersistedRoot, accountId: string, postId: string) {
  schedulePulsePostMemoryFromRoot({
    root,
    accountId,
    postId,
    wechatAccountId: accountId,
  })
}

/** 用户微博：按可见角色写入观众记忆（含剧情时序锚定） */
function scheduleArchiveUserPulsePostDistribution(
  root: PulsePersistedRoot,
  accountId: string,
  postId: string,
) {
  const state = usePulseStore.getState()
  const player = state.currentPlayerPovId?.trim()
  const parsedPlayer = player ? parsePulsePovId(player) : null
  const playerIdentityId =
    parsedPlayer?.kind === 'player' ? parsedPlayer.rawId : player || undefined
  const stats = player
    ? state.root.byAccount[accountId]?.profileStatsByPov[player]
    : undefined
  scheduleUserPulsePostDistributionFromRoot({
    root,
    accountId,
    postId,
    wechatAccountId: accountId,
    playerIdentityId,
    playerDisplayName: stats?.weiboNickname?.trim() || undefined,
    boundCharPovIds: state.identityVisibleCharPovIds ?? undefined,
  })
}

function patchWorldsHoldingPost(
  root: PulsePersistedRoot,
  accountId: string,
  postId: string,
  preferredWorldId: string | null | undefined,
  recipe: (draft: PulseWorldData) => PulseWorldData,
): PulsePersistedRoot {
  const ids = worldIdsHoldingPost(root, accountId, postId, preferredWorldId)
  let next = root
  for (const wid of ids) {
    next = patchWorld(next, accountId, wid, recipe)
  }
  return next
}

export const usePulseStore = create<PulseStore>((set, get) => ({
  hydrated: false,
  currentAccountId: null,
  currentPOVId: null,
  currentPlayerPovId: null,
  activeDmThreadId: null,
  identityVisibleCharPovIds: null,
  root: DEFAULT_PULSE_ROOT,

  async bindAccount(accountId) {
    const acc = accountId?.trim() || null
    if (acc === get().currentAccountId && get().hydrated) return

    let root: PulsePersistedRoot = DEFAULT_PULSE_ROOT
    let shouldPersistMigration = false
    try {
      const raw = await personaDb.getPhoneKv(LUMI_PULSE_KV_KEY)
      if (raw && typeof raw === 'object' && (raw as PulsePersistedRoot).version === 1) {
        const loaded = raw as PulsePersistedRoot
        shouldPersistMigration = Object.values(loaded.byAccount ?? {}).some((row) => {
          const data = row as PulseAccountData
          return (
            (data.posts?.length ?? 0) > 0 ||
            (data.trending?.length ?? 0) > 0 ||
            Object.keys(data.commentsByPostId ?? {}).length > 0
          )
        })
        root = migratePulseRoot(loaded)
      }
    } catch (e) {
      console.warn('[LumiPulse] hydrate failed', e)
    }

    const savedPlayer = acc ? root.byAccount[acc]?.lastPlayerPovId ?? null : null
    const playerPovId =
      savedPlayer && parsePulsePovId(savedPlayer)?.kind === 'player' ? savedPlayer : null

    const byPlayerWorld =
      acc && playerPovId
        ? root.byAccount[acc]?.lastWorldByPlayerPov?.[playerPovId] ?? null
        : null
    const savedPov = acc ? root.byAccount[acc]?.lastPovId ?? null : null
    let lastPov = isPulseWorldPovId(byPlayerWorld)
      ? byPlayerWorld
      : isPulseWorldPovId(savedPov)
        ? savedPov
        : null

    if (acc && lastPov) {
      const accountData = ensureAccount(root, acc)
      const absorbed = absorbLegacyWorldIntoPov(accountData, lastPov)
      if (absorbed) {
        root = patchAccount(root, acc, () => absorbed)
        schedulePersist(root)
      }
    }

    set({
      hydrated: true,
      currentAccountId: acc,
      root,
      currentPOVId: lastPov,
      /** 进场由 UI 重新选择身份；此处只预读 last，不直接当作已选定 */
      currentPlayerPovId: null,
      identityVisibleCharPovIds: null,
    })

    if (shouldPersistMigration) {
      schedulePersist(root)
    }
  },

  setCurrentPOVId(povId) {
    const { currentAccountId, currentPlayerPovId, root } = get()
    const worldPov = isPulseWorldPovId(povId) ? povId : null
    if (!currentAccountId || !worldPov) {
      set({ currentPOVId: worldPov })
      return
    }

    let nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const lastWorldByPlayerPov = { ...(draft.lastWorldByPlayerPov ?? {}) }
      if (currentPlayerPovId) lastWorldByPlayerPov[currentPlayerPovId] = worldPov
      return {
        ...draft,
        lastPovId: worldPov,
        lastWorldByPlayerPov,
      }
    })

    const absorbed = absorbLegacyWorldIntoPov(
      nextRoot.byAccount[currentAccountId]!,
      worldPov,
    )
    if (absorbed) {
      nextRoot = patchAccount(nextRoot, currentAccountId, () => absorbed)
    }

    set({ currentPOVId: worldPov, root: nextRoot })
    schedulePersist(nextRoot)
  },

  setCurrentPlayerPovId(povId) {
    const { currentAccountId, root } = get()
    const parsed = povId ? parsePulsePovId(povId) : null
    const player = parsed?.kind === 'player' ? (povId as PulsePovId) : null
    if (!currentAccountId) {
      set({ currentPlayerPovId: player, identityVisibleCharPovIds: null, activeDmThreadId: null })
      return
    }
    if (!player) {
      set({ currentPlayerPovId: null, identityVisibleCharPovIds: null, activeDmThreadId: null })
      return
    }
    const nextRoot = patchAccount(root, currentAccountId, (draft) => ({
      ...draft,
      lastPlayerPovId: player,
    }))
    const remembered = nextRoot.byAccount[currentAccountId]?.lastWorldByPlayerPov?.[player]
    const worldPov = isPulseWorldPovId(remembered) ? remembered : get().currentPOVId
    set({
      currentPlayerPovId: player,
      root: nextRoot,
      ...(isPulseWorldPovId(worldPov) ? { currentPOVId: worldPov } : {}),
    })
    schedulePersist(nextRoot)
  },

  setActiveDmThreadId(threadId) {
    const next = threadId?.trim() || null
    if (get().activeDmThreadId === next) return
    set({ activeDmThreadId: next })
  },

  setIdentityVisibleCharPovIds(ids) {
    set({
      identityVisibleCharPovIds: ids ? [...new Set(ids.map((x) => x.trim()).filter(Boolean))] : null,
    })
  },

  setActivePlotCharPov(charPovId) {
    const { currentAccountId, currentPlayerPovId, root } = get()
    const player = currentPlayerPovId?.trim() || ''
    const charPov = charPovId.trim()
    if (!currentAccountId || !player) return 'no_player'
    if (!isPulseWorldPovId(charPov)) return 'invalid'
    const snap = root.byAccount[currentAccountId]?.playerPlotSocialByCharPov?.[charPov]
    if (!snap) return 'missing_social'

    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const activePlotCharPovByPlayerPov = {
        ...(draft.activePlotCharPovByPlayerPov ?? {}),
        [player]: charPov as PulsePovId,
      }
      const lastWorldByPlayerPov = {
        ...(draft.lastWorldByPlayerPov ?? {}),
        [player]: charPov as PulsePovId,
      }
      const prevStats = draft.profileStatsByPov[player] ?? defaultProfileStats()
      return {
        ...draft,
        activePlotCharPovByPlayerPov,
        lastWorldByPlayerPov,
        lastPovId: charPov as PulsePovId,
        // 切线时把展示底表同步到该线粉丝/认证
        profileStatsByPov: {
          ...draft.profileStatsByPov,
          [player]: {
            ...prevStats,
            followers: Math.max(0, Math.floor(snap.followers || 0)),
            verifyLabel: snap.verifyLabel?.trim() || prevStats.verifyLabel,
            followersSyncedAt: snap.followersSyncedAt ?? prevStats.followersSyncedAt,
            followersGainPending: snap.followersGainPending ?? 0,
          },
        },
      }
    })
    set({ root: nextRoot, currentPOVId: charPov as PulsePovId })
    schedulePersist(nextRoot)
    return 'ok'
  },

  setFusionMode(enabled) {
    const { currentAccountId, currentPlayerPovId, root } = get()
    const player = currentPlayerPovId?.trim() || ''
    if (!currentAccountId || !player) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => ({
      ...draft,
      fusionModeByPlayerPov: {
        ...(draft.fusionModeByPlayerPov ?? {}),
        [player]: enabled === true,
      },
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  clearPlayerPovPick() {
    set({ currentPlayerPovId: null, identityVisibleCharPovIds: null, activeDmThreadId: null })
  },

  logoutPov() {
    get().clearPlayerPovPick()
    get().setCurrentPOVId(null)
  },

  getAccountData() {
    const { currentAccountId, root } = get()
    if (!currentAccountId) return emptyPulseAccountData()
    return ensureAccount(root, currentAccountId)
  },

  getProfileStats(povId) {
    const id = povId ?? get().currentPlayerPovId ?? get().currentPOVId
    if (!id) return defaultProfileStats()
    const data = get().getAccountData()
    return data.profileStatsByPov[id] ?? defaultProfileStats()
  },

  getPostsForDiscover() {
    const ctx = requireWorldPov()
    if (!ctx) return []
    const world = getWorldSlice(ctx.root.byAccount[ctx.accountId]!, ctx.pov)
    const sorted = [...world.posts].sort((a, b) => b.createdAt - a.createdAt)
    return filterPostsForIdentityScope(
      sorted,
      get().currentPlayerPovId,
      get().identityVisibleCharPovIds ? new Set(get().identityVisibleCharPovIds) : null,
    )
  },

  getComments(postId) {
    const { currentAccountId, currentPOVId, root } = get()
    if (!currentAccountId) return []
    const worlds = worldIdsHoldingPost(root, currentAccountId, postId, currentPOVId)
    for (const wid of worlds) {
      const list = getWorldSlice(root.byAccount[currentAccountId]!, wid).commentsByPostId[postId]
      if (list?.length) return list
      if (list) return list
    }
    return []
  },

  getTrending() {
    const ctx = requireWorldPov()
    if (!ctx) return []
    const world = getWorldSlice(ctx.root.byAccount[ctx.accountId]!, ctx.pov)
    return [...world.trending].sort((a, b) => a.rank - b.rank)
  },

  getInteractions() {
    const player = get().currentPlayerPovId
    if (!player) return []
    const rows = get().getAccountData().interactionsByPov[player] ?? []
    return [...rows].sort((a, b) => b.createdAt - a.createdAt)
  },

  getDmThreads() {
    const player = get().currentPlayerPovId
    if (!player) return []
    const rows = get().getAccountData().dmThreadsByPov[player] ?? []
    return [...rows].sort((a, b) => b.lastAt - a.lastAt)
  },

  publishPost(input) {
    const ctx = requireWorldPov()
    if (!ctx) return ''
    const id = `pp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const player = get().currentPlayerPovId?.trim()
    const markPending =
      Boolean(player) && input.authorPovId.trim() === player && !input.isAiGenerated
    const vis = normalizePulsePostVisibility({
      visibility: input.visibility,
      visibleToCharPovIds: input.visibleToCharPovIds,
    })
    const post: PulsePost = {
      id,
      authorPovId: input.authorPovId,
      authorName: input.authorName,
      authorAvatarUrl: resolvePulseAuthorAvatarForPersist(
        input.authorPovId,
        input.authorName,
        input.authorAvatarUrl,
        input.isAiGenerated,
      ),
      content: input.content.trim(),
      createdAt: Date.now(),
      likeCount: 0,
      commentCount: 0,
      repostCount: 0,
      likedByPovIds: [],
      isAiGenerated: input.isAiGenerated,
      trendingTopicId: input.trendingTopicId,
      verified: input.verified ?? input.authorPovId.startsWith('char:'),
      imageUrls: input.imageUrls?.length ? input.imageUrls : undefined,
      locationLabel: input.locationLabel?.trim() || undefined,
      engagementStatus: markPending ? 'pending' : undefined,
      visibility: vis.visibility === 'partial' ? 'partial' : undefined,
      visibleToCharPovIds: vis.visibleToCharPovIds,
    }
    const nextRoot = patchWorld(ctx.root, ctx.accountId, ctx.pov, (draft) => ({
      ...draft,
      posts: [post, ...draft.posts],
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)

    const mention = buildMentionInteractionIfNeeded({
      text: post.content,
      fromName: post.authorName,
      fromAvatarUrl: post.authorAvatarUrl,
      postId: post.id,
      authorPovId: post.authorPovId,
      aliases: input.playerMentionAliases ?? [],
      playerPovId: get().currentPlayerPovId,
    })
    if (mention && get().currentPlayerPovId) {
      get().pushInteractions([mention], get().currentPlayerPovId!)
    }
    scheduleArchivePulsePostIfCharacter(nextRoot, ctx.accountId, post.id)
    if (markPending || (player && input.authorPovId.trim() === player)) {
      scheduleArchiveUserPulsePostDistribution(nextRoot, ctx.accountId, id)
    }
    return id
  },

  updatePost(postId, patch) {
    const ctx = requirePulseSession()
    if (!ctx) return false
    const pid = postId.trim()
    if (!pid) return false
    const holders = worldIdsHoldingPost(ctx.root, ctx.accountId, pid, ctx.worldId)
    if (!holders.length) return false

    let found: PulsePost | undefined
    for (const wid of holders) {
      found = getWorldSlice(ctx.root.byAccount[ctx.accountId]!, wid).posts.find((p) => p.id === pid)
      if (found) break
    }
    if (!found) return false
    if (found.authorPovId.trim() !== ctx.playerPovId) return false

    const nextContent =
      patch.content !== undefined ? String(patch.content ?? '').trim() : found.content
    if (patch.content !== undefined && !nextContent && !(patch.imageUrls?.length || found.imageUrls?.length || found.images?.length)) {
      return false
    }

    let nextVis = {
      visibility: found.visibility,
      visibleToCharPovIds: found.visibleToCharPovIds,
    }
    if (patch.visibility !== undefined || patch.visibleToCharPovIds !== undefined) {
      const normalized = normalizePulsePostVisibility({
        visibility: patch.visibility ?? found.visibility,
        visibleToCharPovIds:
          patch.visibleToCharPovIds !== undefined
            ? patch.visibleToCharPovIds
            : found.visibleToCharPovIds,
      })
      nextVis = {
        visibility: normalized.visibility === 'partial' ? 'partial' : undefined,
        visibleToCharPovIds: normalized.visibleToCharPovIds,
      }
    }

    const nextRoot = patchWorldsHoldingPost(ctx.root, ctx.accountId, pid, ctx.worldId, (draft) => ({
      ...draft,
      posts: draft.posts.map((p) => {
        if (p.id !== pid) return p
        const next: PulsePost = {
          ...p,
          content: patch.content !== undefined ? nextContent : p.content,
          updatedAt: Date.now(),
          visibility: nextVis.visibility,
          visibleToCharPovIds: nextVis.visibleToCharPovIds,
        }
        if (patch.imageUrls !== undefined) {
          if (patch.imageUrls === null || !patch.imageUrls.length) {
            delete next.imageUrls
            delete next.images
          } else {
            next.imageUrls = patch.imageUrls
            delete next.images
          }
        }
        if (patch.locationLabel !== undefined) {
          const loc = patch.locationLabel?.trim()
          if (loc) next.locationLabel = loc
          else delete next.locationLabel
        }
        return next
      }),
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)
    scheduleArchivePulsePostIfCharacter(nextRoot, ctx.accountId, pid)
    scheduleArchiveUserPulsePostDistribution(nextRoot, ctx.accountId, pid)
    return true
  },

  deletePost(postId) {
    const ctx = requirePulseSession()
    if (!ctx) return false
    const pid = postId.trim()
    if (!pid) return false

    let found: PulsePost | undefined
    const holders = worldIdsHoldingPost(ctx.root, ctx.accountId, pid, ctx.worldId)
    for (const wid of holders) {
      found = getWorldSlice(ctx.root.byAccount[ctx.accountId]!, wid).posts.find((p) => p.id === pid)
      if (found) break
    }
    if (!found) return false
    if (found.authorPovId.trim() !== ctx.playerPovId) return false

    cancelPlayerPostEngagement(pid)
    cancelPlayerPostCharacterEngagement(pid)
    cancelPendingUserPulseDistributionArchives([pid])

    const nextRoot = patchWorldsHoldingPost(ctx.root, ctx.accountId, pid, ctx.worldId, (draft) => {
      const commentsByPostId = { ...draft.commentsByPostId }
      delete commentsByPostId[pid]
      return {
        ...draft,
        posts: draft.posts.filter((p) => p.id !== pid),
        commentsByPostId,
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
    cancelPendingPulsePostArchives([pid])
    void removePulsePostMemories([pid])
    void removeUserPulseViewerMemories([pid])
    return true
  },

  toggleLike(postId) {
    const ctx = requirePulseSession()
    if (!ctx) return
    const worlds = worldIdsHoldingPost(ctx.root, ctx.accountId, postId, ctx.worldId)
    if (!worlds.length) return
    let post: PulsePost | undefined
    for (const wid of worlds) {
      post = getWorldSlice(ctx.root.byAccount[ctx.accountId]!, wid).posts.find((p) => p.id === postId)
      if (post) break
    }
    if (!post) return
    const allowed = get().identityVisibleCharPovIds
    if (
      allowed &&
      !isPulseAuthorVisibleForIdentity({
        authorPovId: post.authorPovId,
        playerPovId: ctx.playerPovId,
        allowedCharPovIds: new Set(allowed),
        isAiGenerated: post.isAiGenerated,
      })
    ) {
      return
    }
    const nextRoot = patchWorldsHoldingPost(ctx.root, ctx.accountId, postId, ctx.worldId, (draft) => ({
      ...draft,
      posts: draft.posts.map((p) => {
        if (p.id !== postId) return p
        const liked = p.likedByPovIds.includes(ctx.playerPovId)
        const likedByPovIds = liked
          ? p.likedByPovIds.filter((x) => x !== ctx.playerPovId)
          : [...p.likedByPovIds, ctx.playerPovId]
        return {
          ...p,
          likedByPovIds,
          likeCount: Math.max(0, p.likeCount + (liked ? -1 : 1)),
        }
      }),
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)
    scheduleArchivePulsePostIfCharacter(nextRoot, ctx.accountId, postId)
  },

  addComment(input) {
    const ctx = requirePulseSession()
    if (!ctx) return ''
    const id = `pc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const comment: PulseComment = {
      id,
      postId: input.postId,
      authorPovId: input.authorPovId,
      authorName: input.authorName,
      authorAvatarUrl: resolvePulseAuthorAvatarForPersist(
        input.authorPovId,
        input.authorName,
        input.authorAvatarUrl,
        input.isAiGenerated,
      ),
      content: input.content.trim(),
      createdAt: Date.now(),
      parentId: input.parentId,
      isAiGenerated: input.isAiGenerated,
      likeCount: 0,
      anonymousByPlayerId: input.anonymousByPlayerId?.trim() || undefined,
    }
    const holders = worldIdsHoldingPost(ctx.root, ctx.accountId, input.postId, ctx.worldId)
    const targets = holders.length ? holders : [ctx.worldId]
    let nextRoot = ctx.root
    for (const wid of targets) {
      nextRoot = patchWorld(nextRoot, ctx.accountId, wid, (draft) => {
        const list = draft.commentsByPostId[input.postId] ?? []
        return {
          ...draft,
          commentsByPostId: {
            ...draft.commentsByPostId,
            [input.postId]: [...list, comment],
          },
          posts: draft.posts.map((p) =>
            p.id === input.postId ? { ...p, commentCount: p.commentCount + 1 } : p,
          ),
        }
      })
    }
    set({ root: nextRoot })
    schedulePersist(nextRoot)

    const mention = buildMentionInteractionIfNeeded({
      text: comment.content,
      fromName: comment.authorName,
      fromAvatarUrl: comment.authorAvatarUrl,
      postId: comment.postId,
      authorPovId: comment.authorPovId,
      anonymousByPlayerId: comment.anonymousByPlayerId,
      aliases: input.playerMentionAliases ?? [],
      playerPovId: get().currentPlayerPovId,
    })
    if (mention && get().currentPlayerPovId) {
      get().pushInteractions([mention], get().currentPlayerPovId!)
    }
    scheduleArchivePulsePostIfCharacter(nextRoot, ctx.accountId, input.postId)
    return id
  },

  deleteComment(postId, commentId) {
    const ctx = requirePulseSession()
    if (!ctx) return false
    const pid = postId.trim()
    const cid = commentId.trim()
    if (!pid || !cid) return false

    const holders = worldIdsHoldingPost(ctx.root, ctx.accountId, pid, ctx.worldId)
    const targets = holders.length ? holders : [ctx.worldId]

    let post: PulsePost | undefined
    let targetComment: PulseComment | undefined
    let sourceList: PulseComment[] = []
    for (const wid of targets) {
      const world = getWorldSlice(ctx.root.byAccount[ctx.accountId]!, wid)
      const list = world.commentsByPostId[pid] ?? []
      const hit = list.find((c) => c.id === cid)
      if (hit) {
        targetComment = hit
        sourceList = list
        post = world.posts.find((p) => p.id === pid) ?? post
        break
      }
      if (!post) post = world.posts.find((p) => p.id === pid)
    }
    if (!targetComment) return false
    if (!post) {
      for (const wid of targets) {
        post = getWorldSlice(ctx.root.byAccount[ctx.accountId]!, wid).posts.find((p) => p.id === pid)
        if (post) break
      }
    }
    if (!post) return false

    const isPostOwner = post.authorPovId.trim() === ctx.playerPovId
    const isOwnComment = isPulseCommentOwnedByPlayer(targetComment, ctx.playerPovId)
    if (!isPostOwner && !isOwnComment) return false

    const removeIds = collectPulseCommentSubtreeIds(sourceList, cid)
    if (!removeIds.size) return false

    const now = Date.now()
    let nextRoot = ctx.root
    for (const wid of targets) {
      nextRoot = patchWorld(nextRoot, ctx.accountId, wid, (draft) => {
        const list = draft.commentsByPostId[pid] ?? []
        if (!list.some((c) => removeIds.has(c.id))) return draft
        const nextList = list.filter((c) => !removeIds.has(c.id))
        const unlockedCount = filterUnlockedPulseComments(nextList, now).length
        return {
          ...draft,
          commentsByPostId: {
            ...draft.commentsByPostId,
            [pid]: nextList,
          },
          posts: draft.posts.map((p) =>
            p.id === pid ? { ...p, commentCount: unlockedCount } : p,
          ),
        }
      })
    }
    set({ root: nextRoot })
    schedulePersist(nextRoot)
    scheduleArchivePulsePostIfCharacter(nextRoot, ctx.accountId, pid)
    scheduleArchiveUserPulsePostDistribution(nextRoot, ctx.accountId, pid)
    return true
  },

  setTrending(topics, forPovId) {
    const { currentAccountId, root } = get()
    if (!currentAccountId || !isPulseWorldPovId(forPovId)) return
    const ranked = topics.map((t, i) => ({
      ...t,
      rank: i + 1,
      generatedForPovId: forPovId,
    }))
    const nextRoot = patchWorld(root, currentAccountId, forPovId, (draft) => ({
      ...draft,
      trending: ranked,
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  ingestTrendingBundle(input) {
    const { currentAccountId, root } = get()
    const forPovId = input.forPovId.trim()
    if (!currentAccountId || !isPulseWorldPovId(forPovId) || !input.bundles.length) return []

    const now = Date.now()
    const topics: PulseTrendingTopic[] = []
    const newPosts: PulsePost[] = []
    const commentsByPostId: Record<string, PulseComment[]> = {}
    const oldTopicIds = new Set(
      (getWorldSlice(root.byAccount[currentAccountId]!, forPovId).trending ?? []).map((t) => t.id),
    )

    const mentionDirectory = input.mentionDirectory ?? []
    const rewriteMentions = (raw: string) =>
      mentionDirectory.length ? rewritePlainMentionsToPulseExpr(raw, mentionDirectory) : raw

    input.bundles.forEach((bundle, ti) => {
      const topicId = `pt-${now}-${ti}-${Math.random().toString(36).slice(2, 6)}`
      const posts = bundle.posts.slice(0, 6)
      topics.push({
        id: topicId,
        rank: ti + 1,
        title: bundle.title,
        tag: bundle.tag,
        excerpt: bundle.excerpt ? rewriteMentions(bundle.excerpt) : bundle.excerpt,
        heatLabel: bundle.heatLabel,
        postCount: posts.length,
        createdAt: now,
        generatedForPovId: forPovId,
      })

      posts.forEach((row, pi) => {
        const postId = `pp-trend-${topicId}-${pi}`
        const authorPovId = `ai:${row.authorName}` as PulsePovId
        // 话题内帖子时间错开数小时～一天，避免清一色同一分钟
        const createdAt =
          now -
          (ti * 5 * 3600_000 +
            pi * (70 + ((ti * 3 + pi * 7) % 50)) * 60_000 +
            ((ti + pi) % 17) * 60_000)
        const images: PulsePostImageSlot[] | undefined =
          row.images?.length
            ? row.images.slice(0, 9).map((img, ii) => ({
                id: `pis-${postId}-${ii}`,
                description: img.description.trim().slice(0, 280),
                status: 'idle' as const,
              }))
            : undefined
        newPosts.push({
          id: postId,
          authorPovId,
          authorName: row.authorName,
          authorAvatarUrl: resolvePulseAuthorAvatarForPersist(authorPovId, row.authorName, undefined, true),
          content: rewriteMentions(ensureTrendingTopicPrefix(row.content, bundle.title)),
          createdAt,
          likeCount: row.likeCount,
          commentCount: row.comments.length,
          repostCount: Math.floor(row.likeCount / 40),
          likedByPovIds: [],
          isAiGenerated: true,
          trendingTopicId: topicId,
          verified: false,
          mediaKind: row.mediaKind,
          images,
          imageUrls: undefined,
        })
        commentsByPostId[postId] = (() => {
          const nameToId = new Map<string, string>()
          const list: PulseComment[] = []
          const commentTimes = distributePulseCommentTimestamps({
            postCreatedAt: createdAt,
            count: row.comments.length,
            now,
            salt: postId,
          })
          row.comments.forEach((c, ci) => {
            const id = `pc-trend-${postId}-${ci}`
            const cPov = `ai:${c.authorName}` as PulsePovId
            let parentId: string | undefined
            const hint = c.parentHint?.trim()
            if (hint) {
              const hit =
                nameToId.get(hint) ??
                [...nameToId.entries()].find(([n]) => n.toLowerCase() === hint.toLowerCase())?.[1]
              // 找不到精确昵称时挂到最近一条评论下，便于保留楼中楼互动
              parentId = hit ?? list[list.length - 1]?.id ?? list.find((x) => !x.parentId)?.id
            }
            // 一级与二级都可进入昵称索引，便于楼中楼叠楼
            nameToId.set(c.authorName, id)
            list.push({
              id,
              postId,
              authorPovId: cPov,
              authorName: c.authorName,
              authorAvatarUrl: resolvePulseAuthorAvatarForPersist(cPov, c.authorName, undefined, true),
              content: rewriteMentions(c.content),
              createdAt: commentTimes[ci] ?? createdAt + (ci + 1) * 40_000,
              parentId,
              isAiGenerated: true,
              likeCount: Math.max(0, Math.floor(c.likeCount ?? 0)),
            })
          })
          return list
        })()
      })
    })

    const nextRoot = patchWorld(root, currentAccountId, forPovId, (draft) => {
      const keptPosts = draft.posts.filter(
        (p) => !p.trendingTopicId || !oldTopicIds.has(p.trendingTopicId),
      )
      const mergedComments = { ...draft.commentsByPostId }
      for (const p of draft.posts) {
        if (p.trendingTopicId && oldTopicIds.has(p.trendingTopicId)) {
          delete mergedComments[p.id]
        }
      }
      for (const [pid, list] of Object.entries(commentsByPostId)) {
        mergedComments[pid] = list
      }
      return {
        ...draft,
        trending: topics,
        posts: [...newPosts, ...keptPosts],
        commentsByPostId: mergedComments,
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)

    const player = get().currentPlayerPovId
    const aliases = input.playerMentionAliases ?? []
    if (player && aliases.length) {
      const mentions: Omit<PulseInteraction, 'id' | 'read'>[] = []
      for (const p of newPosts) {
        const hit = buildMentionInteractionIfNeeded({
          text: p.content,
          fromName: p.authorName,
          fromAvatarUrl: p.authorAvatarUrl,
          postId: p.id,
          authorPovId: p.authorPovId,
          aliases,
          playerPovId: player,
        })
        if (hit) mentions.push(hit)
        for (const c of commentsByPostId[p.id] ?? []) {
          const ch = buildMentionInteractionIfNeeded({
            text: c.content,
            fromName: c.authorName,
            fromAvatarUrl: c.authorAvatarUrl,
            postId: p.id,
            authorPovId: c.authorPovId,
            aliases,
            playerPovId: player,
          })
          if (ch) mentions.push(ch)
        }
      }
      if (mentions.length) get().pushInteractions(mentions, player)
    }

    return topics
  },

  patchPostImageSlot(postId, slotId, patch) {
    const ctx = requirePulseSession()
    if (!ctx) return
    const nextRoot = patchWorldsHoldingPost(ctx.root, ctx.accountId, postId, ctx.worldId, (draft) => ({
      ...draft,
      posts: draft.posts.map((p) => {
        if (p.id !== postId) return p
        const slots = [...(p.images ?? [])]
        const idx = slots.findIndex((s) => s.id === slotId)
        if (idx < 0) return p
        const prev = slots[idx]!
        const nextSlot: PulsePostImageSlot = {
          ...prev,
          ...patch,
          description: (patch.description ?? prev.description).trim().slice(0, 280),
          imagePrompt: (patch.imagePrompt ?? prev.imagePrompt)?.trim().slice(0, 800) || undefined,
        }
        slots[idx] = nextSlot
        const readyUrls = slots.map((s) => s.url?.trim()).filter((u): u is string => Boolean(u))
        return {
          ...p,
          images: slots,
          imageUrls: readyUrls.length ? readyUrls : undefined,
        }
      }),
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)
    // 配图描述/提示词更新后同步记忆，避免角色只记得「配图 N 张」
    if (patch.description !== undefined || patch.imagePrompt !== undefined || patch.url !== undefined) {
      scheduleArchivePulsePostIfCharacter(nextRoot, ctx.accountId, postId)
    }
  },

  pushInteractions(items, povId) {
    const { currentAccountId, root } = get()
    if (!currentAccountId || !items.length) return
    const stamped = items.map((it) => ({
      ...it,
      id: `pi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      read: false,
    }))
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const prev = draft.interactionsByPov[povId] ?? []
      return {
        ...draft,
        interactionsByPov: {
          ...draft.interactionsByPov,
          [povId]: [...stamped, ...prev].slice(0, 80),
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  replaceDmThreads(threads, povId) {
    const { currentAccountId, root } = get()
    if (!currentAccountId) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => ({
      ...draft,
      dmThreadsByPov: {
        ...draft.dmThreadsByPov,
        [povId]: threads,
      },
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  prependDmThreads(threads, povId) {
    const { currentAccountId, root } = get()
    if (!currentAccountId || !threads.length) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const prev = draft.dmThreadsByPov[povId] ?? []
      return {
        ...draft,
        dmThreadsByPov: {
          ...draft.dmThreadsByPov,
          [povId]: [...threads, ...prev],
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  appendDmMessages(threadId, messages) {
    const player = get().currentPlayerPovId
    const { currentAccountId, root, activeDmThreadId } = get()
    if (!player || !currentAccountId || !threadId.trim() || !messages.length) return
    const stamped = messages
      .map((m) => {
        const content = m.content.trim()
        if (!content) return null
        return {
          id: `pdm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          fromFan: Boolean(m.fromFan),
          content,
          createdAt: Date.now(),
        }
      })
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
    if (!stamped.length) return
    const last = stamped[stamped.length - 1]!
    const fanAdded = stamped.filter((m) => m.fromFan).length
    const viewing = activeDmThreadId === threadId
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const list = draft.dmThreadsByPov[player] ?? []
      return {
        ...draft,
        dmThreadsByPov: {
          ...draft.dmThreadsByPov,
          [player]: list.map((t) => {
            if (t.id !== threadId) return t
            const nextMessages = [...t.messages, ...stamped]
            // 微信同款：在聊天室内读到的不涨未读；离开会话后网友消息才累计
            const nextUnread = viewing
              ? 0
              : Math.max(0, (t.unread || 0) + fanAdded)
            return {
              ...t,
              messages: nextMessages,
              lastMessage: last.content,
              lastAt: last.createdAt,
              unread: nextUnread,
            }
          }),
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  markDmThreadRead(threadId) {
    const player = get().currentPlayerPovId
    const { currentAccountId, root } = get()
    if (!player || !currentAccountId || !threadId.trim()) return
    const list = root.byAccount[currentAccountId]?.dmThreadsByPov?.[player] ?? []
    const hit = list.find((t) => t.id === threadId)
    if (!hit || !(hit.unread > 0)) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => ({
      ...draft,
      dmThreadsByPov: {
        ...draft.dmThreadsByPov,
        [player]: (draft.dmThreadsByPov[player] ?? []).map((t) =>
          t.id === threadId ? { ...t, unread: 0 } : t,
        ),
      },
    }))
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  markInteractionsRead() {
    const player = get().currentPlayerPovId
    const { currentAccountId, root } = get()
    if (!player || !currentAccountId) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const list = draft.interactionsByPov[player] ?? []
      return {
        ...draft,
        interactionsByPov: {
          ...draft.interactionsByPov,
          [player]: list.map((it) => ({ ...it, read: true })),
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  markInteractionsReadByType(type) {
    const player = get().currentPlayerPovId
    const { currentAccountId, root } = get()
    if (!player || !currentAccountId) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const list = draft.interactionsByPov[player] ?? []
      return {
        ...draft,
        interactionsByPov: {
          ...draft.interactionsByPov,
          [player]: list.map((it) => (it.type === type ? { ...it, read: true } : it)),
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  appendAiPosts(rows, authorPovId) {
    for (const row of rows) {
      get().publishPost({
        authorPovId: `ai:${row.authorName}`,
        authorName: row.authorName,
        content: row.content,
        isAiGenerated: true,
      })
    }
    void authorPovId
  },

  appendAiComments(postId, comments, opts) {
    const ctx = requirePulseSession()
    if (!ctx) return
    const holders = worldIdsHoldingPost(ctx.root, ctx.accountId, postId, ctx.worldId)
    const targets = holders.length ? holders : [ctx.worldId]
    const now = Date.now()
    let nextRoot = ctx.root
    for (const wid of targets) {
      nextRoot = patchWorld(nextRoot, ctx.accountId, wid, (draft) => {
        const list = draft.commentsByPostId[postId] ?? []
        const merged = [...list, ...comments]
        const unlockedCount = filterUnlockedPulseComments(merged, now).length
        return {
          ...draft,
          commentsByPostId: {
            ...draft.commentsByPostId,
            [postId]: merged,
          },
          posts: draft.posts.map((p) =>
            p.id === postId ? { ...p, commentCount: unlockedCount } : p,
          ),
        }
      })
    }
    set({ root: nextRoot })
    schedulePersist(nextRoot)

    const player = get().currentPlayerPovId
    const aliases = opts?.playerMentionAliases ?? []
    if (player && aliases.length && comments.length) {
      const mentions = comments
        .map((c) =>
          buildMentionInteractionIfNeeded({
            text: c.content,
            fromName: c.authorName,
            fromAvatarUrl: c.authorAvatarUrl,
            postId,
            authorPovId: c.authorPovId,
            anonymousByPlayerId: c.anonymousByPlayerId,
            aliases,
            playerPovId: player,
          }),
        )
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
        .map((m) => {
          const src = comments.find(
            (c) => c.authorName === m.fromName && c.content === m.content,
          )
          return src?.visibleAt != null ? { ...m, visibleAt: src.visibleAt, createdAt: src.visibleAt } : m
        })
      if (mentions.length) get().pushInteractions(mentions, player)
    }
    scheduleArchivePulsePostIfCharacter(nextRoot, ctx.accountId, postId)
  },

  markPlayerPostEngagementPending(postId) {
    const pid = postId.trim()
    if (!pid) return
    const ctx = requirePulseSession()
    if (!ctx) return
    const holders = worldIdsHoldingPost(ctx.root, ctx.accountId, pid, ctx.worldId)
    const targets = holders.length ? holders : [ctx.worldId]
    let nextRoot = ctx.root
    let touched = false
    for (const wid of targets) {
      nextRoot = patchWorld(nextRoot, ctx.accountId, wid, (draft) => ({
        ...draft,
        posts: draft.posts.map((p) => {
          if (p.id !== pid) return p
          if (p.engagementStatus === 'ready') return p
          touched = true
          return { ...p, engagementStatus: 'pending' as const }
        }),
      }))
    }
    if (!touched) return
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  applyPlayerPostEngagement(input) {
    const postId = input.postId.trim()
    const player = input.playerPovId.trim()
    if (!postId || !player) return false
    const ctx = requirePulseSession()
    if (!ctx) return false

    const likeTarget = Math.max(0, Math.floor(input.likeCount))
    const comments = input.comments.filter((c) => c.postId === postId && c.content.trim())
    const holders = worldIdsHoldingPost(ctx.root, ctx.accountId, postId, ctx.worldId)
    const targets = holders.length ? holders : [ctx.worldId]
    const metrics = input.engagementMetrics
    const now = Date.now()
    const unlockedMetrics = resolveUnlockedEngagementMetrics(metrics, now)
    const unlockedComments = filterUnlockedPulseComments(comments, now)

    let touched = false
    let nextRoot = ctx.root
    for (const wid of targets) {
      nextRoot = patchWorld(nextRoot, ctx.accountId, wid, (draft) => {
        const post = draft.posts.find((p) => p.id === postId)
        if (!post) return draft
        if (post.engagementStatus === 'ready' && post.engagementMetrics) return draft
        touched = true
        const prevComments = draft.commentsByPostId[postId] ?? []
        const withoutEng = prevComments.filter((c) => !c.id.startsWith('pc-eng-'))
        return {
          ...draft,
          commentsByPostId: {
            ...draft.commentsByPostId,
            [postId]: comments.length ? [...withoutEng, ...comments] : withoutEng,
          },
          posts: draft.posts.map((p) => {
            if (p.id !== postId) return p
            return {
              ...p,
              likeCount: Math.max(p.likeCount, unlockedMetrics.likeCount),
              repostCount: Math.max(p.repostCount, unlockedMetrics.repostCount),
              commentCount: unlockedComments.length,
              engagementStatus: 'ready' as const,
              engagementMetrics: metrics,
            }
          }),
        }
      })
    }
    if (!touched) return false

    const stampedInteractions: PulseInteraction[] = input.interactions
      .filter((it) => it.postId === postId)
      .map((it) => ({
        ...it,
        id: it.id?.trim() || `pi-eng-${now}-${Math.random().toString(36).slice(2, 6)}`,
        read: it.read === true,
      }))

    if (stampedInteractions.length) {
      nextRoot = patchAccount(nextRoot, ctx.accountId, (draft) => {
        const prev = draft.interactionsByPov[player] ?? []
        const withoutEng = prev.filter((i) => !i.id.startsWith('pi-eng-') || i.postId !== postId)
        return {
          ...draft,
          interactionsByPov: {
            ...draft.interactionsByPov,
            [player]: [...stampedInteractions, ...withoutEng].slice(0, 120),
          },
        }
      })
    }

    if (likeTarget > 0) {
      nextRoot = patchAccount(nextRoot, ctx.accountId, (draft) => {
        const prev = draft.profileStatsByPov[player] ?? defaultProfileStats()
        return {
          ...draft,
          profileStatsByPov: {
            ...draft.profileStatsByPov,
            [player]: {
              ...prev,
              likesReceived: Math.max(0, (prev.likesReceived ?? 0) + likeTarget),
            },
          },
        }
      })
    }

    const dmThreads = input.dmThreads?.filter((t) => t.messages?.length) ?? []
    if (dmThreads.length) {
      nextRoot = patchAccount(nextRoot, ctx.accountId, (draft) => {
        const prev = draft.dmThreadsByPov[player] ?? []
        const withoutDup = prev.filter((t) => !dmThreads.some((n) => n.id === t.id))
        return {
          ...draft,
          dmThreadsByPov: {
            ...draft.dmThreadsByPov,
            [player]: [...dmThreads, ...withoutDup],
          },
        }
      })
    }

    set({ root: nextRoot })
    schedulePersist(nextRoot)
    return true
  },

  applyPlayerPostCharacterEngagement(input) {
    const postId = input.postId.trim()
    const player = input.playerPovId.trim()
    if (!postId || !player) return false
    const ctx = requirePulseSession()
    if (!ctx) return false

    const comments = input.comments.filter((c) => c.postId === postId && c.content.trim())
    const likedIds = [
      ...new Set(input.likedByPovIds.map((id) => id.trim()).filter((id) => id.startsWith('char:'))),
    ]
    if (!comments.length && !likedIds.length) return false

    const holders = worldIdsHoldingPost(ctx.root, ctx.accountId, postId, ctx.worldId)
    const targets = holders.length ? holders : [ctx.worldId]
    const now = Date.now()

    let touched = false
    let nextRoot = ctx.root
    for (const wid of targets) {
      nextRoot = patchWorld(nextRoot, ctx.accountId, wid, (draft) => {
        const post = draft.posts.find((p) => p.id === postId)
        if (!post) return draft
        touched = true
        const prevComments = draft.commentsByPostId[postId] ?? []
        const withoutChar = prevComments.filter((c) => !c.id.startsWith('pc-char-'))
        const mergedComments = comments.length ? [...withoutChar, ...comments] : withoutChar
        const unlockedAll = filterUnlockedPulseComments(mergedComments, now)
        const prevLiked = new Set((post.likedByPovIds ?? []).map((id) => id.trim()).filter(Boolean))
        for (const id of likedIds) prevLiked.add(id)
        const likeBump = likedIds.filter((id) => !(post.likedByPovIds ?? []).includes(id)).length
        return {
          ...draft,
          commentsByPostId: {
            ...draft.commentsByPostId,
            [postId]: mergedComments,
          },
          posts: draft.posts.map((p) => {
            if (p.id !== postId) return p
            return {
              ...p,
              likedByPovIds: [...prevLiked],
              likeCount: Math.max(p.likeCount, (p.likeCount ?? 0) + likeBump),
              commentCount: Math.max(p.commentCount, unlockedAll.length),
            }
          }),
        }
      })
    }
    if (!touched) return false

    const stampedInteractions: PulseInteraction[] = input.interactions
      .filter((it) => it.postId === postId)
      .map((it) => ({
        ...it,
        id: it.id?.trim() || `pi-char-${now}-${Math.random().toString(36).slice(2, 6)}`,
        read: it.read === true,
      }))

    if (stampedInteractions.length) {
      nextRoot = patchAccount(nextRoot, ctx.accountId, (draft) => {
        const prev = draft.interactionsByPov[player] ?? []
        const withoutChar = prev.filter((i) => !i.id.startsWith('pi-char-') || i.postId !== postId)
        return {
          ...draft,
          interactionsByPov: {
            ...draft.interactionsByPov,
            [player]: [...stampedInteractions, ...withoutChar].slice(0, 120),
          },
        }
      })
    }

    if (likedIds.length) {
      nextRoot = patchAccount(nextRoot, ctx.accountId, (draft) => {
        const prev = draft.profileStatsByPov[player] ?? defaultProfileStats()
        return {
          ...draft,
          profileStatsByPov: {
            ...draft.profileStatsByPov,
            [player]: {
              ...prev,
              likesReceived: Math.max(0, (prev.likesReceived ?? 0) + likedIds.length),
            },
          },
        }
      })
    }

    // 角色评论写入后刷新观众记忆（评论摘要）
    scheduleArchiveUserPulsePostDistribution(nextRoot, ctx.accountId, postId)

    set({ root: nextRoot })
    schedulePersist(nextRoot)
    return true
  },

  syncPlayerPostEngagementDisplay(nowMs) {
    const now = typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : Date.now()
    const { currentAccountId, root, currentPlayerPovId } = get()
    const player = currentPlayerPovId?.trim()
    if (!currentAccountId || !player) return
    const acc = root.byAccount[currentAccountId]
    if (!acc) return

    let nextRoot = root
    let changed = false
    for (const [wid, world] of Object.entries(acc.worldByPov ?? {})) {
      if (!isPulseWorldPovId(wid)) continue
      const posts = world.posts ?? []
      let worldChanged = false
      const nextPosts = posts.map((p) => {
        const allComments = world.commentsByPostId[p.id] ?? []
        const hasScheduledComments = allComments.some(
          (c) => c.visibleAt != null && Number.isFinite(c.visibleAt),
        )
        const hasEngagementPlan = p.engagementStatus === 'ready' && Boolean(p.engagementMetrics)
        if (!hasScheduledComments && !hasEngagementPlan) return p

        const unlocked = filterUnlockedPulseComments(allComments, now)
        const commentCount = unlocked.length
        let likeCount = p.likeCount
        let repostCount = p.repostCount
        if (hasEngagementPlan && p.authorPovId === player && p.engagementMetrics) {
          const metrics = resolveUnlockedEngagementMetrics(p.engagementMetrics, now)
          likeCount = Math.max(p.likeCount, metrics.likeCount)
          repostCount = Math.max(p.repostCount, metrics.repostCount)
        }
        if (
          likeCount === p.likeCount &&
          repostCount === p.repostCount &&
          commentCount === p.commentCount
        ) {
          return p
        }
        worldChanged = true
        return { ...p, likeCount, repostCount, commentCount }
      })
      if (!worldChanged) continue
      changed = true
      nextRoot = patchWorld(nextRoot, currentAccountId, wid as PulsePovId, (draft) => ({
        ...draft,
        posts: nextPosts,
      }))
    }
    if (!changed) return
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  syncPlayerFollowerGrowth(nowMs) {
    const now = typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : Date.now()
    const { currentAccountId, root, currentPlayerPovId, currentPOVId } = get()
    if (!currentAccountId) return 0
    const player = currentPlayerPovId?.trim() || ''
    const account = root.byAccount[currentAccountId]
    const world =
      (player && account?.activePlotCharPovByPlayerPov?.[player]?.trim()) ||
      currentPOVId?.trim() ||
      ''
    const statsMap = account?.profileStatsByPov ?? {}
    const plotSnap =
      player && world ? account?.playerPlotSocialByCharPov?.[world] : undefined

    type PlannedRow = {
      povId: string
      followers: number
      followersSyncedAt: number
      delta: number
    }
    const plannedRows: PlannedRow[] = []

    if (player) {
      // 有剧情线快照时，按当前世界量级涨粉，避免串线
      const prevFollowers = plotSnap?.followers ?? statsMap[player]?.followers ?? 0
      const prevSyncedAt = plotSnap?.followersSyncedAt ?? statsMap[player]?.followersSyncedAt
      const planned = planFollowerGrowthCatchUp({
        followers: prevFollowers,
        followersSyncedAt: prevSyncedAt,
        now,
        seed: `${currentAccountId}:${player}:${world || 'global'}`,
        role: 'player',
        allowSeed: true,
      })
      if (
        planned.followers !== prevFollowers ||
        planned.followersSyncedAt !== (prevSyncedAt ?? 0)
      ) {
        plannedRows.push({
          povId: player,
          followers: planned.followers,
          followersSyncedAt: planned.followersSyncedAt,
          delta: planned.delta,
        })
      }
    }

    for (const [povId, stats] of Object.entries(statsMap)) {
      if (player && povId === player) continue
      if (!isCharacterEligibleForFollowerGrowth(povId, stats.followers ?? 0)) continue
      const planned = planFollowerGrowthCatchUp({
        followers: stats.followers ?? 0,
        followersSyncedAt: stats.followersSyncedAt,
        now,
        seed: `${currentAccountId}:${povId}`,
        role: 'character',
        allowSeed: false,
      })
      if (
        planned.followers !== (stats.followers ?? 0) ||
        planned.followersSyncedAt !== (stats.followersSyncedAt ?? 0)
      ) {
        plannedRows.push({
          povId,
          followers: planned.followers,
          followersSyncedAt: planned.followersSyncedAt,
          delta: planned.delta,
        })
      }
    }

    if (!plannedRows.length) return 0

    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      let nextDraft = draft
      const nextStats = { ...draft.profileStatsByPov }
      for (const row of plannedRows) {
        const cur = nextStats[row.povId] ?? defaultProfileStats()
        const gain =
          player && row.povId === player && row.delta > 0
            ? Math.max(
                0,
                (world
                  ? (draft.playerPlotSocialByCharPov?.[world]?.followersGainPending ??
                    cur.followersGainPending ??
                    0)
                  : (cur.followersGainPending ?? 0)) + Math.max(0, row.delta),
              )
            : cur.followersGainPending
        const patched = {
          ...cur,
          followers: row.followers,
          followersSyncedAt: row.followersSyncedAt,
          ...(typeof gain === 'number' ? { followersGainPending: gain } : {}),
        }
        nextStats[row.povId] = patched
        if (player && row.povId === player) {
          nextDraft = syncPlayerPlotSocialBucket(
            { ...nextDraft, profileStatsByPov: nextStats },
            world,
            patched,
          )
        }
      }
      return { ...nextDraft, profileStatsByPov: nextStats }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
    return plannedRows.reduce((sum, r) => sum + Math.max(0, r.delta), 0)
  },

  applyPlayerPostFollowerBoost(seed) {
    const { currentAccountId, currentPlayerPovId, currentPOVId } = get()
    const player = currentPlayerPovId?.trim()
    if (!currentAccountId || !player) return 0
    // 先补齐被动涨，再叠加发帖加成，避免与 catch-up 抢同一时段
    get().syncPlayerFollowerGrowth(Date.now())
    const latest = get().root
    const account = latest.byAccount[currentAccountId]
    const world =
      account?.activePlotCharPovByPlayerPov?.[player]?.trim() ||
      currentPOVId?.trim() ||
      ''
    const plotSnap = world
      ? account?.playerPlotSocialByCharPov?.[world]
      : undefined
    const prev =
      latest.byAccount[currentAccountId]?.profileStatsByPov[player] ?? defaultProfileStats()
    const baseFollowers = plotSnap?.followers ?? prev.followers ?? 0
    const boost = computePostFollowerBoost(
      baseFollowers,
      seed?.trim() || `${currentAccountId}:${player}:${Date.now()}`,
    )
    if (boost <= 0) return 0
    const now = Date.now()
    const nextRoot = patchAccount(latest, currentAccountId, (draft) => {
      const cur = draft.profileStatsByPov[player] ?? defaultProfileStats()
      const pendingBase =
        (world
          ? draft.playerPlotSocialByCharPov?.[world]?.followersGainPending
          : undefined) ??
        cur.followersGainPending ??
        0
      const patched = {
        ...cur,
        followers: Math.max(0, baseFollowers + boost),
        followersSyncedAt: now,
        followersGainPending: Math.max(0, pendingBase) + boost,
      }
      return syncPlayerPlotSocialBucket(
        {
          ...draft,
          profileStatsByPov: {
            ...draft.profileStatsByPov,
            [player]: patched,
          },
        },
        world,
        patched,
      )
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
    return boost
  },

  clearFollowersGainPending(povId) {
    const { currentAccountId, root, currentPlayerPovId, currentPOVId } = get()
    const id = String(povId ?? currentPlayerPovId ?? '').trim()
    if (!currentAccountId || !id) return
    const account = root.byAccount[currentAccountId]
    const world =
      (currentPlayerPovId &&
        id === currentPlayerPovId &&
        account?.activePlotCharPovByPlayerPov?.[currentPlayerPovId]?.trim()) ||
      currentPOVId?.trim() ||
      ''
    const cur = account?.profileStatsByPov[id]
    const plotPending =
      currentPlayerPovId && id === currentPlayerPovId && world
        ? account?.playerPlotSocialByCharPov?.[world]?.followersGainPending ?? 0
        : 0
    if (!(cur?.followersGainPending ?? 0) && !plotPending) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const prev = draft.profileStatsByPov[id] ?? defaultProfileStats()
      const patched = { ...prev, followersGainPending: 0 }
      let nextDraft: PulseAccountData = {
        ...draft,
        profileStatsByPov: {
          ...draft.profileStatsByPov,
          [id]: patched,
        },
      }
      if (currentPlayerPovId && id === currentPlayerPovId) {
        nextDraft = syncPlayerPlotSocialBucket(nextDraft, world, patched)
      }
      return nextDraft
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  appendCommentsToWorld(input) {
    const accountId = input.accountId.trim()
    const worldPovId = input.worldPovId.trim()
    const postId = input.postId.trim()
    if (!accountId || !worldPovId || !postId || !input.comments.length) return false
    const { root } = get()
    const world = getWorldSlice(ensureAccount(root, accountId), worldPovId)
    if (!world.posts.some((p) => p.id === postId)) return false
    const nextRoot = patchWorld(root, accountId, worldPovId, (draft) => {
      const list = draft.commentsByPostId[postId] ?? []
      return {
        ...draft,
        commentsByPostId: {
          ...draft.commentsByPostId,
          [postId]: [...list, ...input.comments],
        },
        posts: draft.posts.map((p) =>
          p.id === postId ? { ...p, commentCount: p.commentCount + input.comments.length } : p,
        ),
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
    scheduleArchivePulsePostIfCharacter(nextRoot, accountId, postId)
    return true
  },

  bumpProfileStats(povId, patch) {
    const { currentAccountId, root } = get()
    if (!currentAccountId) return
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const prev = draft.profileStatsByPov[povId] ?? defaultProfileStats()
      return {
        ...draft,
        profileStatsByPov: {
          ...draft.profileStatsByPov,
          [povId]: { ...prev, ...patch },
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },

  toggleFollow(target, baseList) {
    const { currentAccountId, currentPlayerPovId, root } = get()
    const player = currentPlayerPovId?.trim()
    const targetPov = target.povId?.trim()
    if (!currentAccountId || !player || !targetPov || targetPov === player) return false

    const stored = root.byAccount[currentAccountId]?.followingByPov[player] ?? []
    const base = stored.length ? stored : [...(baseList ?? [])]
    const already = base.some((u) => u.povId === targetPov)
    const nextList = already
      ? base.filter((u) => u.povId !== targetPov)
      : [
          ...base.filter((u) => u.povId !== targetPov),
          {
            povId: targetPov,
            name: target.name.trim().slice(0, 64) || '用户',
            avatarUrl: target.avatarUrl,
            bio: target.bio?.trim().slice(0, 120),
            verified: target.verified === true || targetPov.startsWith('char:'),
          },
        ]

    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const playerStats = draft.profileStatsByPov[player] ?? defaultProfileStats()
      const targetStats = draft.profileStatsByPov[targetPov] ?? defaultProfileStats()
      const followingDelta = already ? -1 : 1
      const followingByPov = {
        ...draft.followingByPov,
        [player]: nextList,
      }

      // 新关注时：把自己已关注的角色也记为关注了该账号，便于「我关注的人也关注了 TA」
      if (!already) {
        const targetRow: PulseFollowingUser = {
          povId: targetPov,
          name: target.name.trim().slice(0, 64) || '用户',
          avatarUrl: target.avatarUrl,
          bio: target.bio?.trim().slice(0, 120),
          verified: target.verified === true || targetPov.startsWith('char:'),
        }
        for (const peer of nextList) {
          if (peer.povId === targetPov || !peer.povId.startsWith('char:')) continue
          const peerList = followingByPov[peer.povId] ?? []
          if (peerList.some((u) => u.povId === targetPov)) continue
          followingByPov[peer.povId] = [...peerList, targetRow]
        }
      }

      return {
        ...draft,
        followingByPov,
        profileStatsByPov: {
          ...draft.profileStatsByPov,
          [player]: {
            ...playerStats,
            following: Math.max(0, (playerStats.following ?? 0) + followingDelta),
          },
          [targetPov]: {
            ...targetStats,
            followers: Math.max(0, (targetStats.followers ?? 0) + followingDelta),
          },
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
    return !already
  },

  ensureFollowEdge(input) {
    const { currentAccountId, root } = get()
    const fromPov = input.fromPovId?.trim()
    const targetPov = input.target?.povId?.trim()
    if (!currentAccountId || !fromPov || !targetPov || fromPov === targetPov) return false
    // 不写用户主动关注（用户关注走 toggleFollow）
    if (fromPov.startsWith('player:')) return false

    const existing = root.byAccount[currentAccountId]?.followingByPov[fromPov] ?? []
    if (existing.some((u) => u.povId === targetPov)) return false

    const row: PulseFollowingUser = {
      povId: targetPov,
      name: input.target.name.trim().slice(0, 64) || '用户',
      avatarUrl: input.target.avatarUrl,
      bio: input.target.bio?.trim().slice(0, 120),
      verified: input.target.verified === true || targetPov.startsWith('char:'),
    }

    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const fromStats = draft.profileStatsByPov[fromPov] ?? defaultProfileStats()
      const toStats = draft.profileStatsByPov[targetPov] ?? defaultProfileStats()
      const prevList = draft.followingByPov[fromPov] ?? []
      if (prevList.some((u) => u.povId === targetPov)) return draft
      return {
        ...draft,
        followingByPov: {
          ...draft.followingByPov,
          [fromPov]: [...prevList, row],
        },
        profileStatsByPov: {
          ...draft.profileStatsByPov,
          [fromPov]: {
            ...fromStats,
            following: Math.max(0, (fromStats.following ?? 0) + 1),
          },
          [targetPov]: {
            ...toStats,
            followers: Math.max(0, (toStats.followers ?? 0) + 1),
          },
        },
      }
    })
    set({ root: nextRoot })
    schedulePersist(nextRoot)
    return true
  },

  applySocialAccountsBundle(input) {
    const { currentAccountId, root, currentPlayerPovId, currentPOVId } = get()
    if (!currentAccountId) return 0
    const player = currentPlayerPovId?.trim() || ''
    const playerPlotOnly = input.playerPlotOnly === true
    const skipPlayerWrite = input.skipPlayerWrite === true
    const overwriteSet = new Set(
      (input.overwriteCharPovIds ?? []).map((id) => id.trim()).filter(Boolean),
    )
    const allSeeds = input.seeds.filter((s) => s.povId?.trim() && s.key?.trim())
    const seeds = allSeeds.filter((s) => {
      const isPlayer = s.key === 'player' || (player && s.povId === player)
      if (isPlayer) return !skipPlayerWrite
      if (!playerPlotOnly) return true
      return overwriteSet.has(s.povId.trim())
    })
    if (!seeds.length) return 0

    const writingAnyChar = seeds.some(
      (s) => s.key !== 'player' && !(player && s.povId === player),
    )
    const plotAnchor = input.plotAnchorCharPovId?.trim() || ''
    const normalizeSocialKey = (raw: string) =>
      raw
        .trim()
        .replace(/^char:/i, '')
        .replace(/^player:/i, '')
        .toLowerCase()
    const genByKey = new Map<string, (typeof input.generated)[number]>()
    for (const g of input.generated) {
      const k = normalizeSocialKey(g.key)
      if (k) genByKey.set(k, g)
      // 兼容未规范化的原样 key
      if (g.key.trim()) genByKey.set(g.key.trim(), g)
    }
    const lookupGen = (seedKey: string) =>
      genByKey.get(normalizeSocialKey(seedKey)) ?? genByKey.get(seedKey.trim())

    const rosterByPov = new Map<string, PulseFollowingUser>()
    // 写角色时用全量种子补圈内关注名单；否则仅本次写入种子
    const rosterSeeds = writingAnyChar ? allSeeds : seeds
    for (const s of rosterSeeds) {
      const gen = lookupGen(s.key)
      const isPlayerSeed = s.key === 'player' || (player && s.povId === player)
      // 用户展示名用微信昵称；不吃模型生成的微博昵称
      const weibo = isPlayerSeed
        ? s.wechatNickname?.trim() || s.name.trim() || '用户'
        : gen?.weiboNickname?.trim() || s.name.trim() || s.wechatNickname?.trim() || '用户'
      rosterByPov.set(s.povId, {
        povId: s.povId,
        name: weibo.slice(0, 64),
        avatarUrl: s.avatarUrl,
        bio: isPlayerSeed
          ? s.roleHint?.trim().slice(0, 120)
          : gen?.verifyLabel?.trim() || s.roleHint?.trim().slice(0, 120),
        verified: s.verified === true || s.povId.startsWith('char:'),
      })
    }

    const followTargets = new Map<string, Set<string>>()
    if (writingAnyChar) {
      for (const edge of input.followEdges ?? []) {
        const from = edge.fromPovId.trim()
        const to = edge.toPovId.trim()
        if (!from || !to || from === to) continue
        if (player && from === player) continue
        if (!rosterByPov.has(from) || !rosterByPov.has(to)) continue
        let set = followTargets.get(from)
        if (!set) {
          set = new Set()
          followTargets.set(from, set)
        }
        set.add(to)
      }
    }

    let written = 0
    let boundActivePlot: string | null = null
    const nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const followingByPov = { ...draft.followingByPov }
      const profileStatsByPov = { ...draft.profileStatsByPov }
      const playerPlotSocialByCharPov = { ...(draft.playerPlotSocialByCharPov ?? {}) }
      const activePlotCharPovByPlayerPov = { ...(draft.activePlotCharPovByPlayerPov ?? {}) }
      const lastWorldByPlayerPov = { ...(draft.lastWorldByPlayerPov ?? {}) }
      const followerCount = new Map<string, number>()

      for (const seed of seeds) {
        const gen = lookupGen(seed.key)
        const isPlayer = seed.povId === player || seed.key === 'player'
        let followingList: PulseFollowingUser[] = []

        if (!isPlayer) {
          const peerIds = followTargets.get(seed.povId) ?? new Set<string>()
          const peers: PulseFollowingUser[] = []
          for (const peerId of peerIds) {
            const peer = rosterByPov.get(peerId)
            if (peer) peers.push(peer)
          }
          const extras: PulseFollowingUser[] = (gen?.extraFollowing ?? []).map((u) => {
            const povId = `ai:${u.name}` as PulsePovId
            return {
              povId,
              name: u.name.trim().slice(0, 64) || '网友',
              bio: sanitizePulseProfileSignature(u.bio?.trim() || '').slice(0, 120) || undefined,
              avatarUrl: pickStablePulseNetizenAvatarPath(povId),
              verified: false,
            }
          })
          followingList = [...peers, ...extras]
          followingByPov[seed.povId] = followingList
          for (const peerId of peerIds) {
            followerCount.set(peerId, (followerCount.get(peerId) ?? 0) + 1)
          }
        } else {
          // 用户关注不生成：清空或保持空列表
          followingByPov[seed.povId] = []
          followingList = []
        }

        const prevStats = profileStatsByPov[seed.povId] ?? defaultProfileStats()
        const fallbackFollowers = isPlayer ? 12 + Math.max(1, seeds.length) : 80 + seeds.length * 20
        const followers = Math.max(
          0,
          gen && gen.followers > 0 ? gen.followers : fallbackFollowers,
        )

        if (isPlayer) {
          // 用户：写粉丝数 + 认证；不写微博昵称 / 简介 / 获赞 / 关注列表
          // 锚定增长同步点，避免刚生成完就被被动涨粉再叠一层爆炸增量
          const verifyLabel =
            gen?.verifyLabel?.trim().slice(0, 24) ||
            prevStats.verifyLabel ||
            '城市青年'
          const syncedAt = Date.now()
          const playerStats = {
            ...prevStats,
            following: followingList.length,
            followers,
            followersSyncedAt: syncedAt,
            followersGainPending: 0,
            likesReceived: 0,
            verifyLabel,
            weiboAvatarUrl: prevStats.weiboAvatarUrl,
            coverUrl: prevStats.coverUrl,
          }
          // 生成社交后绑定该剧情线为当前线，并刷新展示底表
          if (plotAnchor && isPulseWorldPovId(plotAnchor)) {
            playerPlotSocialByCharPov[plotAnchor] = {
              followers,
              verifyLabel,
              followersSyncedAt: syncedAt,
              followersGainPending: 0,
            }
            if (player) {
              activePlotCharPovByPlayerPov[player] = plotAnchor as PulsePovId
              lastWorldByPlayerPov[player] = plotAnchor as PulsePovId
              boundActivePlot = plotAnchor
            }
            profileStatsByPov[seed.povId] = playerStats
          } else if (!plotAnchor || plotAnchor === (currentPOVId ?? '')) {
            profileStatsByPov[seed.povId] = playerStats
          } else {
            profileStatsByPov[seed.povId] = {
              ...prevStats,
              following: followingList.length,
              likesReceived: 0,
              weiboAvatarUrl: prevStats.weiboAvatarUrl,
              coverUrl: prevStats.coverUrl,
            }
          }
          written += 1
          continue
        }

        const weiboNickname =
          gen?.weiboNickname?.trim() ||
          seed.name.trim() ||
          seed.wechatNickname?.trim() ||
          undefined
        profileStatsByPov[seed.povId] = {
          ...prevStats,
          following: followingList.length,
          followers,
          followersSyncedAt: Date.now(),
          // 获赞不生成，展示时按动态帖点赞汇总
          likesReceived: 0,
          bio: sanitizePulseProfileSignature(
            gen?.bio?.trim() || seed.roleHint?.trim() || prevStats.bio || '',
          ).slice(0, 120) || prevStats.bio,
          verifyLabel:
            gen?.verifyLabel?.trim() ||
            (seed.povId.startsWith('char:')
              ? seed.roleHint?.trim().slice(0, 24) || '角色认证'
              : prevStats.verifyLabel),
          weiboNickname: weiboNickname?.slice(0, 24) || prevStats.weiboNickname,
          // 用户手改的微博头像 / 封面不被社交生成覆盖
          weiboAvatarUrl: prevStats.weiboAvatarUrl,
          coverUrl: prevStats.coverUrl,
        }
        written += 1
      }

      if (writingAnyChar) {
        for (const [povId, n] of followerCount) {
          const stats = profileStatsByPov[povId] ?? defaultProfileStats()
          const nextFollowers = Math.max(stats.followers ?? 0, n)
          profileStatsByPov[povId] = {
            ...stats,
            followers: nextFollowers,
            followersSyncedAt:
              nextFollowers !== (stats.followers ?? 0)
                ? Date.now()
                : stats.followersSyncedAt ?? Date.now(),
          }
        }
      }

      return {
        ...draft,
        followingByPov,
        profileStatsByPov,
        playerPlotSocialByCharPov,
        activePlotCharPovByPlayerPov,
        lastWorldByPlayerPov,
        ...(boundActivePlot ? { lastPovId: boundActivePlot as PulsePovId } : {}),
      }
    })
    if (boundActivePlot && isPulseWorldPovId(boundActivePlot)) {
      set({ root: nextRoot, currentPOVId: boundActivePlot as PulsePovId })
    } else {
      set({ root: nextRoot })
    }
    schedulePersist(nextRoot)
    return written
  },

  applyGeneratedProfileBundle(input) {
    const { currentAccountId, root } = get()
    const pov = input.povId.trim()
    if (!currentAccountId || !isPulseWorldPovId(pov)) return

    const now = Date.now()
    const newPosts: PulsePost[] = []
    const commentsByPostId: Record<string, PulseComment[]> = {}
    const interactionItems: Omit<PulseInteraction, 'id' | 'read'>[] = []

    input.bundle.posts.forEach((row, index) => {
      const postId = `pp-gen-${now}-${index}-${Math.random().toString(36).slice(2, 6)}`
      const createdAt = now - (input.bundle.posts.length - index) * 86_400_000 - index * 120_000

      newPosts.push({
        id: postId,
        authorPovId: pov,
        authorName: input.authorName,
        authorAvatarUrl: input.authorAvatarUrl,
        content: row.content,
        createdAt,
        likeCount: row.likeCount,
        commentCount: row.commentCount,
        repostCount: row.repostCount,
        likedByPovIds: [],
        verified: true,
        isAiGenerated: true,
      })

      const snippet = row.content.slice(0, 48)
      const commentTimes = distributePulseCommentTimestamps({
        postCreatedAt: createdAt,
        count: row.comments.length,
        now,
        salt: postId,
      })
      const builtComments: PulseComment[] = row.comments.map((c, ci) => ({
        id: `pc-gen-${postId}-${ci}`,
        postId,
        authorPovId: `ai:${c.authorName}`,
        authorName: c.authorName,
        authorAvatarUrl: resolvePulseAuthorAvatarForPersist(
          `ai:${c.authorName}`,
          c.authorName,
          undefined,
          true,
        ),
        content: c.content,
        createdAt: commentTimes[ci] ?? createdAt + (ci + 1) * 45_000,
        isAiGenerated: true,
        likeCount: 2 + Math.floor(Math.random() * 48),
      }))
      commentsByPostId[postId] = builtComments

      for (const c of builtComments) {
        interactionItems.push({
          type: 'comment',
          fromName: c.authorName,
          fromAvatarUrl: c.authorAvatarUrl,
          postId,
          postSnippet: snippet,
          content: c.content,
          createdAt: c.createdAt,
        })
      }
      if (row.repostCount > 0) {
        const fromName = builtComments[0]?.authorName ?? '网友'
        interactionItems.push({
          type: 'repost',
          fromName,
          fromAvatarUrl:
            builtComments[0]?.authorAvatarUrl ||
            pickStablePulseNetizenAvatarPath(`ai:${fromName}`),
          postId,
          postSnippet: snippet,
          createdAt: createdAt + 60_000,
        })
      }
      if (row.likeCount > 0) {
        const liker = builtComments[1] ?? builtComments[0]
        const fromName = liker?.authorName ?? '路人'
        interactionItems.push({
          type: 'like',
          fromName,
          fromAvatarUrl:
            liker?.authorAvatarUrl || pickStablePulseNetizenAvatarPath(`ai:${fromName}`),
          postId,
          postSnippet: snippet,
          createdAt: createdAt + 90_000,
        })
      }
    })

    let nextRoot = patchAccount(root, currentAccountId, (draft) => {
      const followingRows: PulseFollowingUser[] = input.bundle.followingUsers.map((u) => {
        const povId = `ai:${u.name}` as PulsePovId
        return {
          povId,
          name: u.name,
          bio: u.bio,
          avatarUrl: pickStablePulseNetizenAvatarPath(povId),
          verified: false,
        }
      })
      const followingByPov: Record<string, PulseFollowingUser[]> = {
        ...draft.followingByPov,
        [pov]: followingRows,
      }

      // 玩家已关注的角色，记为也关注了本主页角色（「我关注的人也关注了 TA」）
      const player = get().currentPlayerPovId?.trim()
      const playerFollowing = player ? (followingByPov[player] ?? []) : []
      const targetRow: PulseFollowingUser = {
        povId: pov,
        name: input.authorName.trim().slice(0, 64) || '用户',
        avatarUrl: input.authorAvatarUrl,
        verified: true,
      }
      for (const peer of playerFollowing) {
        if (peer.povId === pov || !peer.povId.startsWith('char:')) continue
        const peerList = followingByPov[peer.povId] ?? []
        if (peerList.some((u) => u.povId === pov)) continue
        followingByPov[peer.povId] = [...peerList, targetRow]
      }

      return {
        ...draft,
        profileStatsByPov: {
          ...draft.profileStatsByPov,
          [pov]: {
            ...input.bundle.profileStats,
            likesReceived: 0,
            followersSyncedAt: Date.now(),
          },
        },
        followingByPov,
      }
    })

    nextRoot = patchWorld(nextRoot, currentAccountId, pov, (draft) => {
      const mergedComments = { ...draft.commentsByPostId }
      for (const [pid, list] of Object.entries(commentsByPostId)) {
        mergedComments[pid] = list
      }
      return {
        ...draft,
        posts: [...newPosts, ...draft.posts],
        commentsByPostId: mergedComments,
      }
    })

    if (interactionItems.length) {
      const stamped = interactionItems.map((it) => ({
        ...it,
        id: `pi-${now}-${Math.random().toString(36).slice(2, 6)}`,
        read: false,
      }))
      nextRoot = patchAccount(nextRoot, currentAccountId, (draft) => {
        const prev = draft.interactionsByPov[pov] ?? []
        return {
          ...draft,
          interactionsByPov: {
            ...draft.interactionsByPov,
            [pov]: [...stamped, ...prev].slice(0, 80),
          },
        }
      })
    }

    set({ root: nextRoot })
    schedulePersist(nextRoot)
    for (const p of newPosts) {
      scheduleArchivePulsePostIfCharacter(nextRoot, currentAccountId, p.id)
    }
  },

  appendGeneratedCharacterDynamics(input) {
    const { currentAccountId, root, currentPOVId } = get()
    const pov = input.povId.trim()
    const worldPov = currentPOVId?.trim()
    if (!currentAccountId || !isPulseWorldPovId(pov)) return 0
    if (!input.posts.length) return 0

    const now = Date.now()
    const timeSpan = input.timeSpan ?? DEFAULT_CHARACTER_DYNAMICS_TIME_SPAN
    const timestamps = distributeCharacterDynamicsTimestamps(input.posts.length, timeSpan, now)
    const newPosts: PulsePost[] = []
    const commentsByPostId: Record<string, PulseComment[]> = {}

    input.posts.forEach((row, index) => {
      const postId = `pp-char-${now}-${index}-${Math.random().toString(36).slice(2, 6)}`
      const createdAt = timestamps[index] ?? now - (input.posts.length - index) * 86_400_000
      const images: PulsePostImageSlot[] | undefined = row.images?.length
        ? row.images.slice(0, 9).map((img, ii) => ({
            id: `pis-${postId}-${ii}`,
            description: img.description.trim().slice(0, 280),
            status: 'idle' as const,
          }))
        : undefined

      newPosts.push({
        id: postId,
        authorPovId: pov,
        authorName: input.authorName,
        authorAvatarUrl: input.authorAvatarUrl,
        content: row.content,
        createdAt,
        likeCount: row.likeCount,
        commentCount: Math.max(row.comments.length, row.commentCount),
        repostCount: row.repostCount,
        likedByPovIds: [],
        verified: true,
        isAiGenerated: true,
        mediaKind: row.mediaKind,
        images,
        locationLabel: row.locationLabel?.trim() || undefined,
      })

      const nameToId = new Map<string, string>()
      const list: PulseComment[] = []
      const commentTimes = distributePulseCommentTimestamps({
        postCreatedAt: createdAt,
        count: row.comments.length,
        now,
        salt: postId,
      })
      row.comments.forEach((c, ci) => {
        const id = `pc-char-${postId}-${ci}`
        const isAuthor = c.isAuthor === true
        const cPov = (isAuthor ? pov : (`ai:${c.authorName}` as PulsePovId)) as PulsePovId
        let parentId: string | undefined
        const hint = c.parentHint?.trim()
        if (hint) {
          const hit =
            nameToId.get(hint) ??
            [...nameToId.entries()].find(([n]) => n.toLowerCase() === hint.toLowerCase())?.[1]
          parentId = hit ?? list[list.length - 1]?.id ?? list.find((x) => !x.parentId)?.id
        }
        nameToId.set(c.authorName, id)
        list.push({
          id,
          postId,
          authorPovId: cPov,
          authorName: isAuthor ? input.authorName : c.authorName,
          authorAvatarUrl: isAuthor
            ? input.authorAvatarUrl
            : resolvePulseAuthorAvatarForPersist(cPov, c.authorName, undefined, true),
          content: c.content,
          createdAt: commentTimes[ci] ?? createdAt + (ci + 1) * 40_000,
          parentId,
          isAiGenerated: true,
          likeCount: Math.max(0, Math.floor(c.likeCount ?? 0)),
        })
      })
      commentsByPostId[postId] = list
    })

    /** 写入角色本世界；若当前世界不同则镜像一份，保证详情页评论可读 */
    const targetWorlds = [...new Set([pov, worldPov].filter((id): id is string => Boolean(id && isPulseWorldPovId(id))))]

    let nextRoot = root
    for (const worldId of targetWorlds) {
      nextRoot = patchWorld(nextRoot, currentAccountId, worldId, (draft) => {
        const mergedComments = { ...draft.commentsByPostId }
        for (const [pid, list] of Object.entries(commentsByPostId)) {
          mergedComments[pid] = list
        }
        const existingIds = new Set(draft.posts.map((p) => p.id))
        const toAdd = newPosts.filter((p) => !existingIds.has(p.id))
        return {
          ...draft,
          posts: [...toAdd, ...draft.posts],
          commentsByPostId: mergedComments,
        }
      })
    }

    set({ root: nextRoot })
    schedulePersist(nextRoot)
    for (const p of newPosts) {
      scheduleArchivePulsePostIfCharacter(nextRoot, currentAccountId, p.id)
    }
    return newPosts.length
  },

  clearPostsByAuthor(authorPovId) {
    const { currentAccountId, root } = get()
    const author = authorPovId.trim()
    if (!currentAccountId || !author) return 0

    const account = root.byAccount[currentAccountId]
    if (!account) return 0

    const removedIds = new Set<string>()
    let nextRoot = root

    for (const [worldId, world] of Object.entries(account.worldByPov ?? {})) {
      if (!isPulseWorldPovId(worldId)) continue
      const toRemove = world.posts.filter((p) => p.authorPovId.trim() === author)
      if (!toRemove.length) continue
      for (const p of toRemove) {
        removedIds.add(p.id)
      }
      const removeSet = new Set(toRemove.map((p) => p.id))
      nextRoot = patchWorld(nextRoot, currentAccountId, worldId as PulsePovId, (draft) => {
        const commentsByPostId = { ...draft.commentsByPostId }
        for (const id of removeSet) {
          delete commentsByPostId[id]
        }
        return {
          ...draft,
          posts: draft.posts.filter((p) => !removeSet.has(p.id)),
          commentsByPostId,
        }
      })
    }

    if (!removedIds.size) return 0

    set({ root: nextRoot })
    schedulePersist(nextRoot)

    cancelPendingPulsePostArchives(removedIds)
    cancelPendingUserPulseDistributionArchives(removedIds)
    const parsedAuthor = parsePulsePovId(author)
    if (parsedAuthor?.kind === 'char') {
      void removeAllPulseMemoriesForCharacter(parsedAuthor.rawId)
    } else {
      void removePulsePostMemories([...removedIds])
      void removeUserPulseViewerMemories([...removedIds])
    }
    return removedIds.size
  },

  ensurePostDetailAvatars(postId) {
    const ctx = requirePulseSession()
    if (!ctx) return
    const pid = postId.trim()
    if (!pid) return

    const holders = worldIdsHoldingPost(ctx.root, ctx.accountId, pid, ctx.worldId)
    if (!holders.length) return

    let nextRoot = ctx.root
    let anyChanged = false
    for (const wid of holders) {
      const world = getWorldSlice(nextRoot.byAccount[ctx.accountId]!, wid)
      let postsChanged = false
      const posts = world.posts.map((p) => {
        if (p.id !== pid || p.authorAvatarUrl?.trim()) return p
        const nextUrl = resolvePulseAuthorAvatarForPersist(
          p.authorPovId,
          p.authorName,
          p.authorAvatarUrl,
          p.isAiGenerated,
        )
        if (!nextUrl) return p
        postsChanged = true
        return { ...p, authorAvatarUrl: nextUrl }
      })

      const commentList = world.commentsByPostId[pid] ?? []
      let commentsChanged = false
      const nextComments = commentList.map((c) => {
        if (c.authorAvatarUrl?.trim()) return c
        const nextUrl = resolvePulseAuthorAvatarForPersist(
          c.authorPovId,
          c.authorName,
          c.authorAvatarUrl,
          c.isAiGenerated,
        )
        if (!nextUrl) return c
        commentsChanged = true
        return { ...c, authorAvatarUrl: nextUrl }
      })

      if (!postsChanged && !commentsChanged) continue
      anyChanged = true
      nextRoot = patchWorld(nextRoot, ctx.accountId, wid, (draft) => ({
        ...draft,
        posts: postsChanged ? posts : draft.posts,
        commentsByPostId: commentsChanged
          ? { ...draft.commentsByPostId, [pid]: nextComments }
          : draft.commentsByPostId,
      }))
    }

    if (!anyChanged) return
    set({ root: nextRoot })
    schedulePersist(nextRoot)
  },
}))
