import type { ApiConfig } from '../api/types'
import { personaDb } from '../wechat/newFriendsPersona/idb'

import { buildTrendingRefContext } from './buildTrendingRefContext'
import {
  aiGeneratePulseComments,
  aiGeneratePulseDmThreads,
  flatToDmThreads,
  scalePlayerPostEngagement,
} from './lumiPulseAi'
import {
  buildEngagementMetricsPlan,
  buildStaggeredDelaySeconds,
} from './pulseEngagementUnlock'
import { resolvePulseAuthorAvatarForPersist } from './pulseNetizenAvatar'
import { loadPulsePlayerIdentityPersonaContext } from './pulseProfilePersona'
import { selectPulsePostById } from './pulseStoreSelectors'
import type { PulseComment, PulseInteraction, PulsePovId, PulsePost } from './pulseTypes'
import { collectPulsePostVisionImageDataUrls } from './pulsePostImageVision'
import {
  buildPulsePostMediaBriefForAi,
  defaultProfileStats,
  isPulseWorldPovId,
  parsePulsePovId,
} from './pulseTypes'
import { usePulseStore } from './usePulseStore'

const ENGAGEMENT_DELAY_MS = 1600

const inFlightPostIds = new Set<string>()
const scheduledTimers = new Map<string, number>()

export type SchedulePlayerPostEngagementParams = {
  postId: string
  apiConfig: ApiConfig | null
  /** 网友须知晓身份真实姓名，并以此衍生口语称呼（不必死喊全名） */
  playerRealName?: string
  playerWeiboNickname?: string
  onToast?: (msg: string) => void
}

/**
 * 同一身份 × 当前角色剧情线：粉丝量取剧情线快照，并拼「公开形象优先」上下文。
 * 避免粉丝互动只读身份卡（高考集训）而忽略当前线「小有名气艺人」等公开人设。
 */
async function resolvePlayerPlotEngagementContext(params: {
  playerPovId: string
  playerWeiboNickname?: string
  playerRealName?: string
}): Promise<{
  followers: number
  verifyLabel?: string
  publicContext: string
  identityContext: string
  plotCharName?: string
  realName: string
}> {
  const state = usePulseStore.getState()
  const accId = state.currentAccountId ?? ''
  const player = params.playerPovId.trim()
  const account = accId ? state.root.byAccount[accId] : undefined
  const baseStats = account?.profileStatsByPov[player] ?? defaultProfileStats()
  const activePlot =
    account?.activePlotCharPovByPlayerPov?.[player]?.trim() ||
    state.currentPOVId?.trim() ||
    ''
  const plotSnap =
    activePlot && isPulseWorldPovId(activePlot)
      ? account?.playerPlotSocialByCharPov?.[activePlot]
      : undefined

  const followers = Math.max(
    0,
    Math.floor(plotSnap?.followers ?? baseStats.followers ?? 0),
  )
  const verifyLabel =
    plotSnap?.verifyLabel?.trim() || baseStats.verifyLabel?.trim() || undefined

  const parsedPlayer = parsePulsePovId(player)
  let identityContext = ''
  let realName = params.playerRealName?.trim() || ''
  if (parsedPlayer?.kind === 'player' && parsedPlayer.rawId) {
    identityContext = await loadPulsePlayerIdentityPersonaContext(parsedPlayer.rawId)
    if (!realName) {
      try {
        const identity = await personaDb.getPlayerIdentity(parsedPlayer.rawId)
        realName = identity?.name?.trim() || ''
      } catch {
        // ignore
      }
    }
  }

  let plotCharName: string | undefined
  let plotBlock = ''
  const worldParsed = activePlot ? parsePulsePovId(activePlot) : null
  if (worldParsed?.kind === 'char' && worldParsed.rawId) {
    const charStats = account?.profileStatsByPov[activePlot]
    try {
      const ch = await personaDb.getCharacter(worldParsed.rawId)
      plotCharName =
        charStats?.weiboNickname?.trim() ||
        ch?.wechatNickname?.trim() ||
        ch?.name?.trim() ||
        '角色'
    } catch {
      plotCharName = charStats?.weiboNickname?.trim() || '角色'
    }
    try {
      plotBlock = await buildTrendingRefContext({
        refCharacters: [
          {
            characterId: worldParsed.rawId,
            name: plotCharName,
          },
        ],
        chatRefRounds: 5,
        datingRefRounds: 3,
        includePlayerIdentity: false,
      })
    } catch {
      plotBlock = ''
    }
  }

  const weibo =
    params.playerWeiboNickname?.trim() ||
    baseStats.weiboNickname?.trim() ||
    ''

  const publicParts: string[] = []
  publicParts.push('【当前剧情线公开形象｜粉丝/路人须以此理解博主量级与处境】')
  if (plotCharName) {
    publicParts.push(`剧情锚点角色：${plotCharName}（用户与该角色相处的这条线）`)
  }
  if (weibo) {
    publicParts.push(
      `微博展示名：${weibo}（仅账号标识；禁止粉丝当面用此网名招呼）`,
    )
  }
  if (verifyLabel) {
    publicParts.push(
      `对外认证：${verifyLabel}（可聊人设背景；禁止当口头称呼/名字喊）`,
    )
  }
  if (realName) {
    publicParts.push(
      `身份真实姓名：${realName}（须知晓；当面称呼优先用其衍生口语昵称，如小顾、顾老公、阿X等，或「你」；不必篇篇喊全名）`,
    )
  }
  publicParts.push(`本线粉丝约：${followers}`)
  publicParts.push(
    '规则：公开形象与身份档案冲突时，量级/处境以本块公开形象为准；当面称呼从真实姓名衍生，勿改用微博昵称或认证称号。',
  )
  if (plotBlock.trim()) {
    publicParts.push(`【剧情锚点语境｜人设与近期剧情｜可取材公开可聊细节】\n${plotBlock.trim().slice(0, 6_500)}`)
  }
  if (identityContext.trim()) {
    publicParts.push(
      `【身份档案｜仅作底色；与上方公开形象冲突时勿采用冲突细节】\n${identityContext.trim().slice(0, 4_500)}`,
    )
  }

  return {
    followers,
    verifyLabel,
    publicContext: publicParts.join('\n'),
    identityContext,
    plotCharName,
    realName,
  }
}

function listPendingEngagementPosts(): PulsePost[] {
  const state = usePulseStore.getState()
  const accId = state.currentAccountId
  const player = state.currentPlayerPovId?.trim()
  if (!accId || !player) return []
  const byWorld = state.root.byAccount[accId]?.worldByPov
  if (!byWorld) return []
  const out: PulsePost[] = []
  for (const [wid, world] of Object.entries(byWorld)) {
    if (!isPulseWorldPovId(wid)) continue
    for (const p of world.posts ?? []) {
      if (p.authorPovId !== player) continue
      if (p.engagementStatus !== 'pending') continue
      out.push(p)
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

function buildCommentsFromAiRows(params: {
  postId: string
  publishedAt: number
  rows: Array<{ authorName: string; content: string; parentHint?: string; likeCount?: number }>
}): PulseComment[] {
  const delays = buildStaggeredDelaySeconds(params.rows.length, `${params.postId}:comments`)
  const nameToId = new Map<string, string>()
  const list: PulseComment[] = []
  params.rows.forEach((c, ci) => {
    const id = `pc-eng-${params.postId}-${ci}-${Math.random().toString(36).slice(2, 5)}`
    const cPov = `ai:${c.authorName}` as PulsePovId
    let parentId: string | undefined
    const hint = c.parentHint?.trim()
    if (hint) {
      const hit =
        nameToId.get(hint) ??
        [...nameToId.entries()].find(([n]) => n.toLowerCase() === hint.toLowerCase())?.[1]
      parentId = hit ?? list[list.length - 1]?.id ?? list.find((x) => !x.parentId)?.id
    }
    nameToId.set(c.authorName, id)
    const delaySec = delays[ci] ?? 30 + ci * 40
    let visibleAt = params.publishedAt + delaySec * 1000
    // 回复不得早于父评
    if (parentId) {
      const parent = list.find((x) => x.id === parentId)
      if (parent?.visibleAt != null) {
        visibleAt = Math.max(visibleAt, parent.visibleAt + 42_000)
      }
    }
    list.push({
      id,
      postId: params.postId,
      authorPovId: cPov,
      authorName: c.authorName,
      authorAvatarUrl: resolvePulseAuthorAvatarForPersist(cPov, c.authorName, undefined, true),
      content: c.content.trim(),
      createdAt: visibleAt,
      visibleAt,
      parentId,
      isAiGenerated: true,
      likeCount: Math.max(0, Math.floor(c.likeCount ?? 0)),
    })
  })
  return list
}

function buildScheduledInteractions(params: {
  postId: string
  publishedAt: number
  snippet: string
  comments: PulseComment[]
  likeTarget: number
  repostTarget: number
}): Array<Omit<PulseInteraction, 'read'> & { read?: boolean }> {
  const { postId, publishedAt, snippet, comments, likeTarget, repostTarget } = params
  const items: Array<Omit<PulseInteraction, 'read'> & { read?: boolean }> = []

  for (const c of comments) {
    items.push({
      id: `pi-eng-${c.id}`,
      type: 'comment',
      fromName: c.authorName,
      fromAvatarUrl: c.authorAvatarUrl,
      postId,
      postSnippet: snippet,
      content: c.content,
      createdAt: c.createdAt,
      visibleAt: c.visibleAt ?? c.createdAt,
      read: false,
    })
  }

  if (repostTarget > 0) {
    const delays = buildStaggeredDelaySeconds(
      repostTarget >= 8 ? 2 : 1,
      `${postId}:repost-notice`,
    )
    const sources = [
      comments[0],
      comments[2] ?? comments[1] ?? comments[0],
    ].filter(Boolean)
    sources.slice(0, delays.length).forEach((src, i) => {
      const visibleAt = publishedAt + (delays[i] ?? 90) * 1000
      items.push({
        id: `pi-eng-${postId}-repost-${i}`,
        type: 'repost',
        fromName: src!.authorName,
        fromAvatarUrl: src!.authorAvatarUrl,
        postId,
        postSnippet: snippet,
        createdAt: visibleAt,
        visibleAt,
        read: false,
      })
    })
  }

  if (likeTarget > 0) {
    const n = likeTarget >= 40 ? 2 : 1
    const delays = buildStaggeredDelaySeconds(n, `${postId}:like-notice`)
    const sources = [
      comments[1] ?? comments[0],
      comments[3] ?? comments[0],
    ]
    for (let i = 0; i < n; i += 1) {
      const src = sources[i]
      const visibleAt = publishedAt + (delays[i] ?? 60) * 1000
      items.push({
        id: `pi-eng-${postId}-like-${i}`,
        type: 'like',
        fromName: src?.authorName ?? (i === 0 ? '路人' : '网友'),
        fromAvatarUrl: src?.authorAvatarUrl,
        postId,
        postSnippet: snippet,
        createdAt: visibleAt,
        visibleAt,
        read: false,
      })
    }
  }

  return items
}

async function runPlayerPostEngagement(params: SchedulePlayerPostEngagementParams): Promise<void> {
  const postId = params.postId.trim()
  if (!postId) return
  if (inFlightPostIds.has(postId)) return
  if (!params.apiConfig) return

  const state = usePulseStore.getState()
  const player = state.currentPlayerPovId?.trim()
  if (!player) return

  const post = selectPulsePostById(state, postId)
  if (!post) return
  if (post.authorPovId !== player) return
  if (post.engagementStatus === 'ready') return

  const weiboNick =
    params.playerWeiboNickname?.trim() ||
    state.root.byAccount[state.currentAccountId ?? '']?.profileStatsByPov[player]?.weiboNickname?.trim() ||
    post.authorName

  const plotCtx = await resolvePlayerPlotEngagementContext({
    playerPovId: player,
    playerWeiboNickname: weiboNick,
    playerRealName: params.playerRealName,
  })
  const scale = scalePlayerPostEngagement(plotCtx.followers)
  const mediaBrief = buildPulsePostMediaBriefForAi(post)
  const realName = plotCtx.realName.trim() || params.playerRealName?.trim() || ''

  inFlightPostIds.add(postId)
  usePulseStore.getState().markPlayerPostEngagementPending(postId)

  try {
    const postImageDataUrls = await collectPulsePostVisionImageDataUrls(post)
    const commentRows = await aiGeneratePulseComments({
      apiConfig: params.apiConfig,
      post: { authorName: post.authorName, content: post.content },
      count: scale.commentCount,
      engagementHint: scale.engagementHint,
      blockedAuthorNames: [weiboNick].filter(Boolean),
      playerPublicContext: plotCtx.publicContext,
      postMediaBrief: mediaBrief || undefined,
      postImageDataUrls: postImageDataUrls.length ? postImageDataUrls : undefined,
      playerRealName: realName || undefined,
      playerWeiboNickname: weiboNick || undefined,
      playerVerifyLabel: plotCtx.verifyLabel,
    })

    const comments = buildCommentsFromAiRows({
      postId,
      publishedAt: post.createdAt,
      rows: commentRows,
    })

    const engagementMetrics = buildEngagementMetricsPlan({
      publishedAt: post.createdAt,
      likeTarget: scale.likeCount,
      repostTarget: scale.repostCount,
      seed: postId,
    })

    const snippet = post.content.replace(/\s+/g, ' ').trim().slice(0, 48) || '你的动态'
    const interactions = buildScheduledInteractions({
      postId,
      publishedAt: post.createdAt,
      snippet,
      comments,
      likeTarget: scale.likeCount,
      repostTarget: scale.repostCount,
    })

    let dmThreads = undefined as ReturnType<typeof flatToDmThreads> | undefined
    if (scale.dmThreadCount > 0) {
      try {
        // 无真实姓名时仍生成，但强制提示词侧只用「你」，绝不把微博昵称当 realName 传入
        const addressName = realName || '你'
        const hasPostMedia = Boolean(mediaBrief) || postImageDataUrls.length > 0
        const postLine =
          post.content.trim().slice(0, 120) || (hasPostMedia ? '（配图动态）' : '（短动态）')
        const mediaLine = hasPostMedia
          ? mediaBrief
            ? `\n【配图可见】粉丝能看到帖图：\n${mediaBrief.slice(0, 800)}`
            : `\n【配图可见】本帖附有 ${postImageDataUrls.length} 张真实配图，粉丝能看见画面。`
          : `\n【无配图｜最高优先级】本帖只有文字，没有任何配图/截图/自拍。禁止提「配图」「图里」「照片里」及任何臆造画面细节（呆毛、红血丝、妆造等）。`
        const rows = await aiGeneratePulseDmThreads({
          apiConfig: params.apiConfig,
          playerRealName: addressName === '你' ? '用户' : addressName,
          playerWeiboNickname: weiboNick || undefined,
          refCharacterNames: plotCtx.plotCharName ? [plotCtx.plotCharName] : undefined,
          threadCount: scale.dmThreadCount,
          messagesPerThread: Math.random() < 0.4 ? 2 : 1,
          styles: ['mixed', 'fandom', 'casual'],
          povContext: plotCtx.publicContext || plotCtx.identityContext || undefined,
          customRequirements: `用户刚发了微博，正文：「${postLine}」。${mediaLine}
私信可顺带聊这则动态${hasPostMedia ? '与配图画面' : ''}，但不要通篇复制正文。须按「当前剧情线公开形象」理解量级；须知晓身份真实姓名并优先用其衍生口语昵称（小顾、顾老公等）或「你」，不必死喊全名；禁用微博昵称与认证称号当名字。`,
        })
        const dmDelays = buildStaggeredDelaySeconds(
          Math.min(rows.length, scale.dmThreadCount),
          `${postId}:dm`,
        )
        dmThreads = flatToDmThreads(rows.slice(0, scale.dmThreadCount)).map((t, i) => {
          const visibleAt = post.createdAt + (dmDelays[i] ?? 120 + i * 60) * 1000
          return {
            ...t,
            visibleAt,
            lastAt: visibleAt,
            messages: t.messages.map((m, mi) => ({
              ...m,
              createdAt: visibleAt - (t.messages.length - mi) * 40_000,
            })),
          }
        })
      } catch {
        // 私信失败不阻断赞评
      }
    }

    const ok = usePulseStore.getState().applyPlayerPostEngagement({
      postId,
      playerPovId: player,
      likeCount: scale.likeCount,
      repostCount: scale.repostCount,
      engagementMetrics,
      comments,
      interactions,
      dmThreads,
    })
    if (ok) {
      const store = usePulseStore.getState()
      store.syncPlayerPostEngagementDisplay(Date.now())
      store.applyPlayerPostFollowerBoost(postId)
      params.onToast?.('粉丝开始互动了')
    }
  } catch {
    // 失败静默：保持 pending，下次进广场可续跑
  } finally {
    inFlightPostIds.delete(postId)
  }
}

/** 删除帖子时取消排队中的粉丝互动生成 */
export function cancelPlayerPostEngagement(postId: string): void {
  const id = postId.trim()
  if (!id) return
  const prev = scheduledTimers.get(id)
  if (prev != null) {
    window.clearTimeout(prev)
    scheduledTimers.delete(id)
  }
  inFlightPostIds.delete(id)
}

/** 用户发帖成功后：短延迟再按粉丝体量生成赞/转/评与可选私信（带 visibleAt） */
export function schedulePlayerPostEngagementAfterPublish(
  params: SchedulePlayerPostEngagementParams,
): void {
  const postId = params.postId.trim()
  if (!postId || !params.apiConfig) return

  usePulseStore.getState().markPlayerPostEngagementPending(postId)

  const prev = scheduledTimers.get(postId)
  if (prev != null) window.clearTimeout(prev)

  const timer = window.setTimeout(() => {
    scheduledTimers.delete(postId)
    void runPlayerPostEngagement(params)
  }, ENGAGEMENT_DELAY_MS)
  scheduledTimers.set(postId, timer)
}

/**
 * 进入微博广场时：
 * 1) 补齐已到墙钟的赞/转/评展示数
 * 2) 续跑仍为 pending 的发帖互动生成（退出网页中断后）
 */
export function resumePlayerPostEngagementOnEnter(params: {
  apiConfig: ApiConfig | null
  playerRealName?: string
  playerWeiboNickname?: string
  onToast?: (msg: string) => void
}): void {
  usePulseStore.getState().syncPlayerPostEngagementDisplay(Date.now())

  if (!params.apiConfig) return
  const pending = listPendingEngagementPosts()
  for (const post of pending.slice(0, 3)) {
    if (inFlightPostIds.has(post.id) || scheduledTimers.has(post.id)) continue
    void runPlayerPostEngagement({
      postId: post.id,
      apiConfig: params.apiConfig,
      playerRealName: params.playerRealName,
      playerWeiboNickname: params.playerWeiboNickname,
      onToast: params.onToast,
    })
  }
}
