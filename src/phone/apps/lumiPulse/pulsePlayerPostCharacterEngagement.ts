import type { ApiConfig } from '../api/types'

import { personaDb } from '../wechat/newFriendsPersona/idb'
import {
  aiGeneratePulseCharacterPostReactions,
  aiGeneratePulseNetizenReplies,
  scalePulseCommentThreadEngagement,
} from './lumiPulseAi'
import { buildStaggeredDelaySeconds } from './pulseEngagementUnlock'
import { collectPulsePostVisionImageDataUrls } from './pulsePostImageVision'
import { loadPulseCharacterPersonaContext } from './pulseProfilePersona'
import { isPulsePostPartialVisibility, isPulsePostVisibleToCharacter } from './pulsePostVisibility'
import { selectPulsePostById } from './pulseStoreSelectors'
import type { PulseComment, PulseInteraction, PulsePovId, PulsePost } from './pulseTypes'
import {
  buildPulsePostMediaBriefForAi,
  defaultProfileStats,
  isPulseWorldPovId,
  parsePulsePovId,
  toCharPovId,
} from './pulseTypes'
import { pickStablePulseNetizenAvatarPath } from './pulseNetizenAvatar'
import { usePulseStore } from './usePulseStore'

const CHAR_ENGAGE_DELAY_MS = 2200
const MAX_CHARS = 8
/** 最多给几条角色一级评挂网友楼中楼，避免一次打太多 API */
const MAX_CHAR_COMMENTS_FOR_NETIZEN = 3

/** 按角色粉丝体量估算其一级评论的路人点赞数（写入 likeCount） */
function estimateCharacterCommentLikeCount(followers: number, seed: string): number {
  const f = Math.max(0, Math.floor(followers || 0))
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const jitter = Math.abs(h) % 100
  if (f <= 0) return 12 + (jitter % 48)
  if (f < 1_000) return Math.max(8, Math.floor(f / 60) + (jitter % 28))
  if (f < 50_000) return Math.max(24, Math.floor(f / 180) + (jitter % 90))
  if (f < 500_000) return Math.max(90, Math.floor(f / 350) + (jitter % 220))
  return Math.min(48_000, Math.max(220, Math.floor(f / 700) + (jitter % 600)))
}

const inFlight = new Set<string>()
const timers = new Map<string, number>()

export type SchedulePlayerPostCharacterEngagementParams = {
  postId: string
  apiConfig: ApiConfig | null
  playerDisplayName?: string
  onToast?: (msg: string) => void
}

function resolveAudienceCharIds(params: {
  post: PulsePost
  boundCharPovIds: readonly string[] | null | undefined
  activePlotCharPov: string | null | undefined
  fusionMode: boolean
  plotSocialByCharPov: Record<string, { followers?: number; verifyLabel?: string }> | undefined
}): string[] {
  const bound = (params.boundCharPovIds ?? [])
    .map((id) => id.trim())
    .filter((id) => id.startsWith('char:'))

  let candidates: string[]
  if (isPulsePostPartialVisibility(params.post)) {
    candidates = (params.post.visibleToCharPovIds ?? [])
      .map((id) => id.trim())
      .filter((id) => id.startsWith('char:'))
    if (bound.length) {
      const allowed = new Set(bound)
      candidates = candidates.filter((id) => allowed.has(id))
    }
  } else {
    candidates = bound
  }

  const active = params.activePlotCharPov?.trim() || ''
  if (!params.fusionMode) {
    // 非融合：仅当前剧情线角色下场
    candidates = active ? candidates.filter((id) => id === active) : []
  } else {
    // 融合：仅已生成社交数据的线（有认知锚点）才跨线参与；当前线始终可参与
    const social = params.plotSocialByCharPov ?? {}
    candidates = candidates.filter((id) => id === active || Boolean(social[id]))
  }

  const out: string[] = []
  const seen = new Set<string>()
  for (const pov of candidates) {
    if (!isPulsePostVisibleToCharacter(params.post, pov)) continue
    const raw = parsePulsePovId(pov)?.rawId?.trim()
    if (!raw || seen.has(raw)) continue
    seen.add(raw)
    out.push(raw)
  }
  return out.slice(0, MAX_CHARS)
}

function postAlreadyHasCharacterEngagement(postId: string): boolean {
  const state = usePulseStore.getState()
  const post = selectPulsePostById(state, postId)
  if (!post) return true
  const acc = state.currentAccountId
  if (!acc) return true
  for (const world of Object.values(state.root.byAccount[acc]?.worldByPov ?? {})) {
    const comments = world.commentsByPostId[postId] ?? []
    if (comments.some((c) => c.id.startsWith('pc-char-'))) return true
    const hit = world.posts.find((p) => p.id === postId)
    if (hit?.likedByPovIds?.some((id) => id.startsWith('char:'))) return true
  }
  return false
}

function buildNetizenRepliesUnderSeed(params: {
  postId: string
  seed: PulseComment
  rows: Array<{ authorName: string; content: string; parentHint?: string; likeCount?: number }>
}): PulseComment[] {
  const { postId, seed, rows } = params
  if (!rows.length) return []
  const seedName = seed.authorName.trim()
  const nameToId = new Map<string, string>([[seedName, seed.id]])
  const visibleAtById = new Map<string, number>([
    [seed.id, seed.visibleAt ?? seed.createdAt],
  ])
  const baseAt = seed.visibleAt ?? seed.createdAt
  const delays = buildStaggeredDelaySeconds(rows.length, `${postId}:char-thread:${seed.id}`)
  const built: PulseComment[] = []
  rows.forEach((row, ci) => {
    const id = `pc-char-thread-${postId}-${ci}-${Math.random().toString(36).slice(2, 6)}`
    const hint = row.parentHint?.trim() || seedName
    const hit =
      nameToId.get(hint) ??
      [...nameToId.entries()].find(([n]) => n.toLowerCase() === hint.toLowerCase())?.[1]
    const parentId = hit ?? seed.id
    nameToId.set(row.authorName, id)
    const delaySec = delays[ci] ?? 30 + ci * 40
    let visibleAt = baseAt + delaySec * 1000
    const parentVisible = visibleAtById.get(parentId)
    if (parentVisible != null) {
      visibleAt = Math.max(visibleAt, parentVisible + 42_000)
    }
    visibleAtById.set(id, visibleAt)
    built.push({
      id,
      postId,
      authorPovId: `ai:${row.authorName}` as PulsePovId,
      authorName: row.authorName,
      authorAvatarUrl: pickStablePulseNetizenAvatarPath(`ai:${row.authorName}`),
      content: row.content.trim(),
      createdAt: visibleAt,
      visibleAt,
      parentId,
      isAiGenerated: true,
      likeCount: Math.max(0, Math.floor(row.likeCount ?? 2 + Math.floor(Math.random() * 40))),
    })
  })
  return built
}

/** 角色一级评落库后：路人挂在角色楼下讨论 */
async function elicitNetizenUnderCharacterComments(params: {
  apiConfig: ApiConfig
  post: PulsePost
  playerPovId: string
  playerWeiboNickname: string
  characterComments: PulseComment[]
}): Promise<void> {
  const seeds = params.characterComments
    .filter((c) => c.content.trim() && c.authorPovId.startsWith('char:'))
    .slice(0, MAX_CHAR_COMMENTS_FOR_NETIZEN)
  if (!seeds.length) return

  const state = usePulseStore.getState()
  const accId = state.currentAccountId ?? ''
  const account = accId ? state.root.byAccount[accId] : undefined
  const player = params.playerPovId
  const baseStats = account?.profileStatsByPov[player] ?? defaultProfileStats()
  const activePlot =
    account?.activePlotCharPovByPlayerPov?.[player]?.trim() ||
    state.currentPOVId?.trim() ||
    ''
  const plotSnap =
    activePlot && isPulseWorldPovId(activePlot)
      ? account?.playerPlotSocialByCharPov?.[activePlot]
      : undefined
  const followers = Math.max(0, Math.floor(plotSnap?.followers ?? baseStats.followers ?? 0))
  const threadScale = scalePulseCommentThreadEngagement(followers)
  if (threadScale.netizenReplyCount <= 0) return

  let realName = ''
  try {
    const parsed = parsePulsePovId(player)
    const identityId = parsed?.kind === 'player' ? parsed.rawId : ''
    if (identityId) {
      const identity = await personaDb.getPlayerIdentity(identityId)
      realName = identity?.name?.trim() || ''
    }
  } catch {
    // 无真实姓名仍可生成，称呼侧用「你」
  }

  const perCount =
    seeds.length === 1
      ? threadScale.netizenReplyCount
      : Math.max(1, Math.min(8, Math.ceil((threadScale.netizenReplyCount * 0.85) / seeds.length)))

  const allBuilt: PulseComment[] = []
  for (const seed of seeds) {
    try {
      const rows = await aiGeneratePulseNetizenReplies({
        apiConfig: params.apiConfig,
        post: { authorName: params.post.authorName, content: params.post.content },
        userComment: { authorName: seed.authorName, content: seed.content },
        count: perCount,
        engagementHint: threadScale.engagementHint,
        playerRealName: realName || undefined,
        playerWeiboNickname:
          params.playerWeiboNickname && params.playerWeiboNickname !== realName
            ? params.playerWeiboNickname
            : undefined,
        threadContext: {
          bannedAuthorNames: [seed.authorName],
          replyTarget: {
            authorName: seed.authorName,
            content: seed.content,
            kind: 'char_top',
          },
          priorReplies: [{ authorName: seed.authorName, content: seed.content }],
        },
      })
      allBuilt.push(
        ...buildNetizenRepliesUnderSeed({
          postId: params.post.id,
          seed,
          rows,
        }),
      )
    } catch {
      // 单楼失败不阻断其他角色楼
    }
  }

  if (!allBuilt.length) return
  usePulseStore.getState().appendAiComments(params.post.id, allBuilt, {
    playerMentionAliases: [params.playerWeiboNickname].filter(Boolean),
  })
  if (player) {
    const snippet = params.post.content.replace(/\s+/g, ' ').trim().slice(0, 48) || '你的动态'
    usePulseStore.getState().pushInteractions(
      allBuilt.map((c) => ({
        type: 'comment' as const,
        fromName: c.authorName,
        fromAvatarUrl: c.authorAvatarUrl,
        fromPovId: c.authorPovId,
        postId: params.post.id,
        postSnippet: snippet,
        content: c.content,
        createdAt: c.createdAt,
        visibleAt: c.visibleAt ?? c.createdAt,
      })),
      player,
    )
  }
  usePulseStore.getState().syncPlayerPostEngagementDisplay(Date.now())
}


async function runPlayerPostCharacterEngagement(
  params: SchedulePlayerPostCharacterEngagementParams,
): Promise<void> {
  const postId = params.postId.trim()
  if (!postId || !params.apiConfig) return
  if (inFlight.has(postId)) return
  if (postAlreadyHasCharacterEngagement(postId)) return

  const state = usePulseStore.getState()
  const player = state.currentPlayerPovId?.trim()
  if (!player) return
  const post = selectPulsePostById(state, postId)
  if (!post || post.authorPovId !== player) return

  const account = state.root.byAccount[state.currentAccountId ?? '']
  const activePlot =
    account?.activePlotCharPovByPlayerPov?.[player]?.trim() ||
    state.currentPOVId?.trim() ||
    ''
  const fusionMode = account?.fusionModeByPlayerPov?.[player] === true
  const plotSocial = account?.playerPlotSocialByCharPov

  const audience = resolveAudienceCharIds({
    post,
    boundCharPovIds: state.identityVisibleCharPovIds,
    activePlotCharPov: activePlot,
    fusionMode,
    plotSocialByCharPov: plotSocial,
  })
  if (!audience.length) return

  inFlight.add(postId)
  try {
    const statsMap = account?.profileStatsByPov ?? {}
    const playerName =
      params.playerDisplayName?.trim() ||
      statsMap[player]?.weiboNickname?.trim() ||
      post.authorName.trim() ||
      '用户'

    const activeSnap = activePlot ? plotSocial?.[activePlot] : undefined
    const activePlotPublicSummary = [
      activeSnap?.verifyLabel ? `认证：${activeSnap.verifyLabel}` : '',
      activeSnap ? `粉丝约 ${Math.max(0, Math.floor(activeSnap.followers || 0))}` : '',
    ]
      .filter(Boolean)
      .join('；')

    const characters = await Promise.all(
      audience.map(async (characterId) => {
        const pov = toCharPovId(characterId)
        const { character, personaSummary } = await loadPulseCharacterPersonaContext(characterId, {
          bioMaxChars: 900,
          worldBookMaxChars: 900,
          worldBackgroundMaxChars: 500,
          includeBoundPlayerIdentity: true,
        })
        const weibo = statsMap[pov]?.weiboNickname?.trim()
        const name =
          weibo ||
          character?.wechatNickname?.trim() ||
          character?.name?.trim() ||
          '角色'
        const theirSnap = plotSocial?.[pov]
        const knownUserOnTheirLine = theirSnap
          ? [
              theirSnap.verifyLabel ? `认证「${theirSnap.verifyLabel}」` : '',
              `粉丝约 ${Math.max(0, Math.floor(theirSnap.followers || 0))}`,
              pov === activePlot ? '（与当前公开线一致）' : '（可能与当前公开帖形象不同）',
            ]
              .filter(Boolean)
              .join('，')
          : ''
        return {
          characterId,
          name,
          personaSummary,
          avatarUrl: character?.avatarUrl,
          knownUserOnTheirLine,
        }
      }),
    )

    const postImageDataUrls = await collectPulsePostVisionImageDataUrls(post)
    const mediaBrief = buildPulsePostMediaBriefForAi(post)
    const drafts = await aiGeneratePulseCharacterPostReactions({
      apiConfig: params.apiConfig,
      post: { authorName: post.authorName, content: post.content },
      playerDisplayName: playerName,
      characters: characters.map((c) => ({
        characterId: c.characterId,
        name: c.name,
        personaSummary: c.personaSummary,
        knownUserOnTheirLine: c.knownUserOnTheirLine,
      })),
      activePlotPublicSummary: activePlotPublicSummary || undefined,
      fusionMode,
      postMediaBrief: mediaBrief || undefined,
      postImageDataUrls: postImageDataUrls.length ? postImageDataUrls : undefined,
    })
    if (!drafts.length) return

    const delaysFallback = buildStaggeredDelaySeconds(drafts.length, `${postId}:char`)
    const nameById = new Map(characters.map((c) => [c.characterId, c]))
    const comments: PulseComment[] = []
    const likedByPovIds: string[] = []
    const interactions: Array<Omit<PulseInteraction, 'read'> & { read?: boolean }> = []
    const snippet = post.content.replace(/\s+/g, ' ').trim().slice(0, 48) || '你的动态'

    drafts.forEach((d, i) => {
      const meta = nameById.get(d.characterId)
      if (!meta) return
      const charPov = toCharPovId(d.characterId) as PulsePovId
      const delaySec = d.delaySeconds || delaysFallback[i] || 40 + i * 50
      const visibleAt = post.createdAt + delaySec * 1000

      if (d.like) {
        likedByPovIds.push(charPov)
        interactions.push({
          id: `pi-char-${postId}-like-${d.characterId}`,
          type: 'like',
          fromName: meta.name,
          fromAvatarUrl: meta.avatarUrl,
          fromPovId: charPov,
          postId,
          postSnippet: snippet,
          createdAt: visibleAt,
          visibleAt,
          read: false,
        })
      }

      const text = d.comment?.trim()
      if (text) {
        const id = `pc-char-${postId}-${d.characterId}`
        const charFollowers = Math.max(
          0,
          Math.floor(statsMap[charPov]?.followers ?? 0),
        )
        comments.push({
          id,
          postId,
          authorPovId: charPov,
          authorName: meta.name,
          authorAvatarUrl: meta.avatarUrl,
          content: text,
          createdAt: visibleAt,
          visibleAt,
          isAiGenerated: true,
          likeCount: estimateCharacterCommentLikeCount(charFollowers, id),
        })
        interactions.push({
          id: `pi-char-${postId}-cmt-${d.characterId}`,
          type: 'comment',
          fromName: meta.name,
          fromAvatarUrl: meta.avatarUrl,
          fromPovId: charPov,
          postId,
          postSnippet: snippet,
          content: text,
          createdAt: visibleAt,
          visibleAt,
          read: false,
        })
      }
    })

    if (!comments.length && !likedByPovIds.length) return

    const ok = usePulseStore.getState().applyPlayerPostCharacterEngagement({
      postId,
      playerPovId: player,
      comments,
      likedByPovIds,
      interactions,
    })
    if (ok) {
      usePulseStore.getState().syncPlayerPostEngagementDisplay(Date.now())
      params.onToast?.('角色开始互动了')
      if (comments.length && params.apiConfig) {
        try {
          await elicitNetizenUnderCharacterComments({
            apiConfig: params.apiConfig,
            post,
            playerPovId: player,
            playerWeiboNickname: playerName,
            characterComments: comments,
          })
        } catch {
          // 角色楼下网友讨论失败不回滚角色互动
        }
      }
    }
  } catch {
    // 静默：不影响网友互动与发帖
  } finally {
    inFlight.delete(postId)
  }
}

/** 用户发帖后：可见绑定角色点赞/评论（与网友互动并行） */
export function schedulePlayerPostCharacterEngagementAfterPublish(
  params: SchedulePlayerPostCharacterEngagementParams,
): void {
  const postId = params.postId.trim()
  if (!postId || !params.apiConfig) return

  const prev = timers.get(postId)
  if (prev != null) window.clearTimeout(prev)

  const timer = window.setTimeout(() => {
    timers.delete(postId)
    void runPlayerPostCharacterEngagement(params)
  }, CHAR_ENGAGE_DELAY_MS)
  timers.set(postId, timer)
}

/** 进广场时：若尚无角色互动则补跑（与网友 pending 续跑独立） */
export function resumePlayerPostCharacterEngagementOnEnter(params: {
  apiConfig: ApiConfig | null
  playerDisplayName?: string
  onToast?: (msg: string) => void
}): void {
  if (!params.apiConfig) return
  const state = usePulseStore.getState()
  const player = state.currentPlayerPovId?.trim()
  const acc = state.currentAccountId
  if (!player || !acc) return

  const recent: PulsePost[] = []
  for (const world of Object.values(state.root.byAccount[acc]?.worldByPov ?? {})) {
    for (const p of world.posts ?? []) {
      if (p.authorPovId !== player) continue
      if (Date.now() - p.createdAt > 36 * 3600_000) continue
      recent.push(p)
    }
  }
  recent.sort((a, b) => b.createdAt - a.createdAt)

  for (const post of recent.slice(0, 2)) {
    if (inFlight.has(post.id) || timers.has(post.id)) continue
    if (postAlreadyHasCharacterEngagement(post.id)) continue
    void runPlayerPostCharacterEngagement({
      postId: post.id,
      apiConfig: params.apiConfig,
      playerDisplayName: params.playerDisplayName,
      onToast: params.onToast,
    })
  }
}

export function cancelPlayerPostCharacterEngagement(postId: string): void {
  const id = postId.trim()
  if (!id) return
  const prev = timers.get(id)
  if (prev != null) {
    window.clearTimeout(prev)
    timers.delete(id)
  }
  inFlight.delete(id)
}
