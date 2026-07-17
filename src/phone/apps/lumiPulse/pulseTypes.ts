export type PulseTab = 'home' | 'discover' | 'inbox' | 'profile'

export type PulseHomeSegment = 'following' | 'recommended'

export type PulseProfileSegment = 'posts' | 'liked'

/** 世界锚点：`char:{characterId}`（主要角色）；历史数据可能含 `player:{identityId}` */
export type PulsePovId = string

export type PulseTrendingTag = '爆' | '新' | '热'

/** 热搜/讨论帖形态：纯文字、图文、纯图 */
export type PulsePostMediaKind = 'text' | 'text_image' | 'image'

/** 单张配图：默认仅文字描述占位，点击后手动生图写入 url */
export type PulsePostImageSlot = {
  id: string
  /** 展示用画面描述（占位 / 确认弹层文案） */
  description: string
  /** 生图时由剧情配图链路推演得到的提示词缓存（非热搜模型直接生成） */
  imagePrompt?: string
  /** 已生成的图片（data URL / http） */
  url?: string
  status?: 'idle' | 'generating' | 'failed'
}

/** 用户发帖粉丝互动：赞/转随墙钟里程碑推进（与朋友圈 visibleAt 同思路） */
export type PulseEngagementMetricsPlan = {
  likeTarget: number
  repostTarget: number
  milestones: Array<{ visibleAt: number; likeCount: number; repostCount: number }>
}

export type PulsePost = {
  id: string
  authorPovId: PulsePovId
  authorName: string
  authorAvatarUrl?: string
  content: string
  createdAt: number
  likeCount: number
  commentCount: number
  repostCount: number
  likedByPovIds: string[]
  isAiGenerated?: boolean
  trendingTopicId?: string
  /** 展示认证 V 标（主要角色 / 热搜帖） */
  verified?: boolean
  /** 兼容旧发布流：已就绪图片 URL 列表 */
  imageUrls?: string[]
  /** 结构化配图（占位描述 + 可选已生成 url） */
  images?: PulsePostImageSlot[]
  /** 帖形态（热搜生成写入） */
  mediaKind?: PulsePostMediaKind
  /** 发布时附带的位置标签 */
  locationLabel?: string
  /**
   * 用户发帖后粉丝互动生成状态：
   * pending=已排队待 AI；ready=计划已落库按 visibleAt 解锁；none/缺省=无计划
   */
  engagementStatus?: 'pending' | 'ready' | 'none'
  /** 赞/转目标与里程碑（ready 后写入） */
  engagementMetrics?: PulseEngagementMetricsPlan
  /**
   * 对绑定角色的可见范围。
   * - 缺省 / `public`：全部绑定角色可见
   * - `partial`：仅 `visibleToCharPovIds` 内角色可见（作者本人始终可见）
   */
  visibility?: 'public' | 'partial'
  /** `visibility === 'partial'` 时生效；值为 `char:{id}` */
  visibleToCharPovIds?: PulsePovId[]
  /** 编辑正文/配图/可见性后的更新时间 */
  updatedAt?: number
}

export type PulseComment = {
  id: string
  postId: string
  authorPovId: PulsePovId
  authorName: string
  authorAvatarUrl?: string
  content: string
  createdAt: number
  parentId?: string
  isAiGenerated?: boolean
  /** 评论点赞数 */
  likeCount?: number
  /**
   * 异步解锁时间（墙钟）。缺省视为已解锁。
   * 退出网页后仍按此时间在下次进入时补齐展示。
   */
  visibleAt?: number
  /**
   * 匿名冲浪：界面显示为普通网友，但标记为该玩家 POV 发出，
   * 便于本人点「回复」时找回最新匿名评，且 AI 不会当成真人设身份。
   */
  anonymousByPlayerId?: string
}

export type PulseTrendingTopic = {
  id: string
  rank: number
  title: string
  tag?: PulseTrendingTag
  excerpt?: string
  postCount?: number
  /** 展示用热度，如「1.2亿」 */
  heatLabel?: string
  createdAt: number
  generatedForPovId?: PulsePovId
}

export type PulseInteraction = {
  id: string
  type: 'like' | 'comment' | 'repost' | 'follow' | 'mention'
  fromName: string
  fromAvatarUrl?: string
  /** 互动来源 POV（角色 char: / 网友 ai:）；有则用于认证角标等 */
  fromPovId?: PulsePovId
  postId?: string
  postSnippet?: string
  content?: string
  createdAt: number
  read: boolean
  /** 异步解锁时间（墙钟）；缺省视为已解锁 */
  visibleAt?: number
}

export type PulseDmMessage = {
  id: string
  fromFan: boolean
  content: string
  createdAt: number
}

export type PulseDmThread = {
  id: string
  fanName: string
  fanAvatarUrl?: string
  /** 该网友是否已关注用户（用户的粉丝）；生成时写入，标题栏展示 */
  isUserFan?: boolean
  lastMessage: string
  lastAt: number
  unread: number
  messages: PulseDmMessage[]
  /** 异步解锁时间（墙钟）；缺省视为已解锁 */
  visibleAt?: number
}

export type PulseProfileStats = {
  following: number
  followers: number
  likesReceived: number
  /**
   * 粉丝自然增长上次墙钟同步点。
   * 缺省：下次补齐时锚定为现在（不补历史爆炸涨幅）；被动涨 / 发帖加成后更新。
   */
  followersSyncedAt?: number
  /**
   * 尚未被用户确认的粉丝增量（被动涨 + 发帖加成累计）。
   * 角标展示用；用户点击角标后清零，不影响实际 followers。
   */
  followersGainPending?: number
  /** AI 按人设生成的个人简介 */
  bio?: string
  /** AI 生成的认证身份文案（主页单独一行展示） */
  verifyLabel?: string
  /** 微博昵称（与微信昵称独立；未设时展示回退微信昵称） */
  weiboNickname?: string
  /** 微博头像（与微信头像独立；未设时展示回退微信头像） */
  weiboAvatarUrl?: string
  /** 微博个人页背景图（未设时用默认封面） */
  coverUrl?: string
}

/** 粉丝增长角标文案：+12 / +99+ */
export function formatFollowersGainBadge(n: number): string {
  const v = Math.max(0, Math.floor(n || 0))
  if (v <= 0) return ''
  if (v > 99) return '+99+'
  return `+${v}`
}

/** 关注列表中的用户 */
export type PulseFollowingUser = {
  povId: PulsePovId
  /** 微博侧展示名（优先 AI 微博昵称） */
  name: string
  avatarUrl?: string
  bio?: string
  verified?: boolean
  /** 微信昵称（与微博昵称独立，供生成/对照） */
  wechatNickname?: string
}

/** AI 生成个人主页：单条动态及互动 */
export type PulseGeneratedProfilePost = {
  content: string
  likeCount: number
  commentCount: number
  repostCount: number
  comments: Array<{
    authorName: string
    content: string
    parentHint?: string
    likeCount?: number
    /** 是否角色本人回复 */
    isAuthor?: boolean
  }>
  mediaKind?: PulsePostMediaKind
  images?: Array<{ description: string }>
  /** 可选位置标注（市·区·地标）；无则不强调地点 */
  locationLabel?: string
}

/** 仅追加角色动态时用（不含整页关注列表改写） */
export type PulseGeneratedCharacterDynamics = {
  posts: PulseGeneratedProfilePost[]
}

/** AI 生成个人主页完整包 */
export type PulseGeneratedProfileBundle = {
  profileStats: PulseProfileStats
  posts: PulseGeneratedProfilePost[]
  followingUsers: Array<{ name: string; bio?: string }>
}

/** 社交账号种子（用户本人 + 通讯录好友，不含帖子） */
export type PulseSocialAccountSeed = {
  /** `player` 或角色 characterId */
  key: string
  povId: PulsePovId
  /** 展示/回退名（可先用微信昵称） */
  name: string
  avatarUrl?: string
  verified?: boolean
  /** 微信昵称（禁止模型直接当作微博昵称复用） */
  wechatNickname?: string
  /** 身份/备注提示，供模型写简介与认证 */
  roleHint?: string
}

/** AI 为单个账号生成的社交向数据（无帖子） */
export type PulseGeneratedSocialAccount = {
  key: string
  /** 微博端独立昵称 */
  weiboNickname?: string
  bio?: string
  /** 认证身份行，如「米兰法理的执行者」 */
  verifyLabel?: string
  followers: number
  likesReceived: number
  /** 圈子外额外关注（网友/博主昵称） */
  extraFollowing: Array<{ name: string; bio?: string }>
}

/** 单个世界（主要角色）内的微博数据 */
export type PulseWorldData = {
  posts: PulsePost[]
  commentsByPostId: Record<string, PulseComment[]>
  trending: PulseTrendingTopic[]
}

/** 用户相对某条角色剧情线的社交量级（生成社交时按锚点写入） */
export type PulsePlayerPlotSocialSnapshot = {
  followers: number
  verifyLabel?: string
  followersSyncedAt?: number
  followersGainPending?: number
}

export type PulseAccountData = {
  /** 上次进入的世界锚点（主要角色 char:）；也会按身份写入 lastWorldByPlayerPov */
  lastPovId?: PulsePovId
  /** 上次选中的玩家身份视角（player:） */
  lastPlayerPovId?: PulsePovId
  /** 各身份视角记住的世界锚点 */
  lastWorldByPlayerPov?: Record<string, PulsePovId>
  profileStatsByPov: Record<string, PulseProfileStats>
  /**
   * 用户在「某绑定角色剧情线」下的社交快照（粉丝/认证等）。
   * key = char: 角色 povId；展示时按当前剧情线合并到用户主页。
   */
  playerPlotSocialByCharPov?: Record<string, PulsePlayerPlotSocialSnapshot>
  /**
   * 各玩家身份当前选用的角色剧情线（char:）。
   * 生成社交时选定；可切换到已生成过社交数据的其他线。
   */
  activePlotCharPovByPlayerPov?: Record<string, PulsePovId>
  /**
   * 融合模式：同身份下其他已生成剧情线的绑定角色，也可参与用户发帖互动（跨线认知冲突）。
   */
  fusionModeByPlayerPov?: Record<string, boolean>
  /** 各角色 POV 的关注列表 */
  followingByPov: Record<string, PulseFollowingUser[]>
  /** 各世界完全隔离：动态流 / 评论 / 热搜 */
  worldByPov: Record<string, PulseWorldData>
  interactionsByPov: Record<string, PulseInteraction[]>
  dmThreadsByPov: Record<string, PulseDmThread[]>
  /** @deprecated v1 旧版全局数据，hydrate 时迁移至 worldByPov */
  posts?: PulsePost[]
  commentsByPostId?: Record<string, PulseComment[]>
  trending?: PulseTrendingTopic[]
}

export type PulsePersistedRoot = {
  version: 1
  byAccount: Record<string, PulseAccountData>
}

export type PulsePovOption = {
  povId: PulsePovId
  /** 主要角色名（微博展示昵称优先） */
  label: string
  /** 关联世界背景名，如「现代都市」 */
  worldName: string
  /** 角色身份（发现页搜索副标题等） */
  identity?: string
  avatarUrl?: string
  kind: 'char'
  rawId: string
  /** 主绑定 + 关联的玩家身份 id（用于身份视角隔离） */
  linkedPlayerIdentityIds?: string[]
}

export function toPlayerPovId(identityId: string): PulsePovId {
  return `player:${identityId.trim()}`
}

export function toCharPovId(characterId: string): PulsePovId {
  return `char:${characterId.trim()}`
}

/** 是否为有效「世界」锚点（仅主要角色 char:） */
export function isPulseWorldPovId(povId: string | null | undefined): boolean {
  const parsed = povId ? parsePulsePovId(povId) : null
  return parsed?.kind === 'char'
}

export function parsePulsePovId(povId: string): { kind: 'player' | 'char'; rawId: string } | null {
  const t = povId.trim()
  if (t.startsWith('player:')) {
    const rawId = t.slice('player:'.length).trim()
    return rawId ? { kind: 'player', rawId } : null
  }
  if (t.startsWith('char:')) {
    const rawId = t.slice('char:'.length).trim()
    return rawId ? { kind: 'char', rawId } : null
  }
  return null
}

export function emptyPulseWorldData(): PulseWorldData {
  return {
    posts: [],
    commentsByPostId: {},
    trending: [],
  }
}

export function emptyPulseAccountData(): PulseAccountData {
  return {
    profileStatsByPov: {},
    followingByPov: {},
    worldByPov: {},
    interactionsByPov: {},
    dmThreadsByPov: {},
  }
}

export function defaultProfileStats(): PulseProfileStats {
  return { following: 0, followers: 0, likesReceived: 0 }
}

/** 将「角色剧情线」下的用户社交快照合并进主页统计（粉丝/认证/增长角标） */
export function mergePlayerStatsWithPlotSocial(
  base: PulseProfileStats,
  plot: PulsePlayerPlotSocialSnapshot | null | undefined,
): PulseProfileStats {
  if (!plot) return base
  return {
    ...base,
    followers: Math.max(0, Math.floor(plot.followers || 0)),
    verifyLabel: plot.verifyLabel?.trim() || base.verifyLabel,
    followersSyncedAt: plot.followersSyncedAt ?? base.followersSyncedAt,
    followersGainPending: plot.followersGainPending ?? base.followersGainPending,
  }
}

export function formatPulseCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 10_000) {
    const w = n / 10_000
    const body = w >= 100 ? String(Math.round(w)) : w.toFixed(1).replace(/\.0$/, '')
    return `${body}w`
  }
  return String(Math.floor(n))
}

/** 评论点赞：缺省时用 id 生成稳定展示值，避免旧数据空白 */
export function pulseCommentLikeCount(
  comment: Pick<PulseComment, 'id' | 'likeCount' | 'authorPovId'>,
): number {
  const explicit = comment.likeCount
  const hasPositive =
    typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0
  if (hasPositive) return Math.floor(explicit)

  // 角色一级评曾误写成 likeCount=0：按 id 生成稳定展示量，避免认证评「零赞」
  const isChar =
    typeof comment.authorPovId === 'string' && comment.authorPovId.startsWith('char:')
  if (isChar && (explicit === 0 || explicit == null || !Number.isFinite(explicit))) {
    let h = 2166136261
    const s = comment.id || ''
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return (Math.abs(h) % 380) + 18
  }

  if (typeof explicit === 'number' && Number.isFinite(explicit)) {
    return Math.max(0, Math.floor(explicit))
  }
  let h = 2166136261
  const s = comment.id || ''
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (Math.abs(h) % 86) + 2
}

/** 统一取出帖子配图槽（优先结构化 images，其次旧 imageUrls） */
export function pulsePostImageSlots(post: Pick<PulsePost, 'images' | 'imageUrls'>): PulsePostImageSlot[] {
  if (post.images?.length) return post.images.slice(0, 9)
  return (post.imageUrls ?? []).slice(0, 9).map((url, i) => ({
    id: `legacy-${i}`,
    description: '',
    url,
    status: 'idle' as const,
  }))
}

export function pulsePostHasMedia(post: Pick<PulsePost, 'images' | 'imageUrls'>): boolean {
  return pulsePostImageSlots(post).length > 0
}

export function pulsePostReadyImageUrls(post: Pick<PulsePost, 'images' | 'imageUrls'>): string[] {
  return pulsePostImageSlots(post)
    .map((s) => s.url?.trim())
    .filter((u): u is string => Boolean(u))
}

/**
 * 供粉丝评论/私信 AI 理解帖子画面：有描述则列描述；仅有上传图无描述时也须标明「可见配图」，
 * 避免模型只读正文短句就说「没头没尾」。
 */
export function buildPulsePostMediaBriefForAi(
  post: Pick<PulsePost, 'images' | 'imageUrls' | 'mediaKind'>,
): string {
  const slots = pulsePostImageSlots(post)
  if (!slots.length) return ''
  const lines: string[] = []
  slots.forEach((s, i) => {
    const desc = s.description?.trim()
    const hasUrl = Boolean(s.url?.trim())
    if (desc) {
      lines.push(`${i + 1}. ${desc.slice(0, 160)}`)
    } else if (hasUrl) {
      lines.push(`${i + 1}. （用户上传的配图/截图，画面对粉丝可见，但无文字描述）`)
    }
  })
  if (!lines.length) return ''
  return [
    `本帖附有 ${slots.length} 张配图（粉丝与路人刷到时能看见画面，禁止假装只有文字、禁止说「没头没尾/就几个字」而忽略配图）。`,
    '配图内容：',
    ...lines,
  ].join('\n')
}
