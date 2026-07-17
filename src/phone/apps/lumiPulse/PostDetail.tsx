import { motion } from 'framer-motion'
import { ArrowLeft, Heart, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { PostCard } from './components/PostCard'
import { PulseNumericText } from './components/PulseNum'
import { PulseWeiboFaceComposer, type PulseWeiboFaceComposerHandle } from './components/PulseWeiboFaceComposer'
import { PulseWeiboFacePicker } from './components/PulseWeiboFacePicker'
import { PulseWeiboFaceText } from './components/PulseWeiboFaceText'
import { PULSE_COLORS, PULSE_MODAL_SPRING } from './constants'
import { PublishEditor } from './PublishEditor'
import { usePulsePovOptions } from './usePulsePovOptions'
import { usePublishMentionCandidates } from './usePublishMentionCandidates'
import { usePulseVisibilityCandidates } from './usePulseVisibilityCandidates'
import {
  aiGeneratePulseCharacterCommentReply,
  aiGeneratePulseNetizenReplies,
  nestPulseComments,
  scalePulseCommentThreadEngagement,
} from './lumiPulseAi'
import type { NestedPulseComment } from './lumiPulseAi'
import {
  pickStablePulseNetizenAvatarPath,
  resolvePulseAuthorAvatarForPersist,
  resolvePulseAuthorAvatarUrl,
} from './pulseNetizenAvatar'
import { collectPulsePostVisionImageDataUrls } from './pulsePostImageVision'
import { loadPulseCharacterPersonaContext } from './pulseProfilePersona'
import type { PulseComment, PulseInteraction, PulsePost } from './pulseTypes'
import {
  buildPulsePostMediaBriefForAi,
  formatPulseCount,
  parsePulsePovId,
  pulseCommentLikeCount,
  toCharPovId,
} from './pulseTypes'
import { formatPulseFeedTime } from './pulseTimeFormat'
import {
  inventPlayerAnonymousSurfNick,
  isPulsePlayerAnonymousComment,
  playerAnonymousSurfAvatarSeed,
  PULSE_PLAYER_ANONYMOUS_DISPLAY_NAME,
} from './pulseSurfNetizenNick'
import { usePulseCommentKeyboardLayout } from './hooks/usePulseCommentKeyboardLayout'
import { buildStaggeredDelaySeconds, usePulseEngagementClock } from './pulseEngagementUnlock'
import { useUnlockedPulsePostComments, usePulseProfileStats } from './pulseStoreSelectors'
import { usePulsePlayerAccount } from './usePulsePlayerAccount'
import { usePulseStore } from './usePulseStore'

type CommentReplyTarget = {
  id: string
  authorName: string
  authorPovId: string
  content: string
  /** 所属一级评论 id（楼中楼展开用） */
  rootId: string
}

function isCharacterVerifiedComment(comment: PulseComment): boolean {
  return parsePulsePovId(comment.authorPovId)?.kind === 'char'
}

function isPlayerIdentityComment(comment: PulseComment, currentPlayerPovId: string): boolean {
  return (
    comment.authorPovId === currentPlayerPovId &&
    !isPulsePlayerAnonymousComment(comment, currentPlayerPovId)
  )
}

/** 角色 / 已生成社交的本人：金色 V；本人匿名：右下角「我」 */
function CommentAvatar({
  comment,
  currentPlayerPovId,
  sizeClass,
  badgeSizeClass = 'size-[12px]',
  badgeTextClass = 'text-[7px]',
  isPlayerAnonymous = false,
  playerVerified = false,
}: {
  comment: PulseComment
  currentPlayerPovId: string
  sizeClass: string
  badgeSizeClass?: string
  badgeTextClass?: string
  /** 当前登录玩家自己的匿名评论 */
  isPlayerAnonymous?: boolean
  /** 当前用户已生成社交（有认证等） */
  playerVerified?: boolean
}) {
  const charVerified = isCharacterVerifiedComment(comment)
  const selfVerified =
    playerVerified && isPlayerIdentityComment(comment, currentPlayerPovId)
  const showVBadge = !isPlayerAnonymous && (charVerified || selfVerified)
  const avatarSrc = useMemo(() => {
    if (isPlayerAnonymous) {
      const path = pickStablePulseNetizenAvatarPath(
        playerAnonymousSurfAvatarSeed(comment.anonymousByPlayerId || comment.authorPovId),
      )
      return resolvePulseAuthorAvatarUrl(path)
    }
    const stored = resolvePulseAuthorAvatarUrl(comment.authorAvatarUrl)
    if (stored) return stored
    const path = resolvePulseAuthorAvatarForPersist(
      comment.authorPovId,
      comment.authorName,
      comment.authorAvatarUrl,
      comment.isAiGenerated,
    )
    return resolvePulseAuthorAvatarUrl(path)
  }, [
    comment.anonymousByPlayerId,
    comment.authorAvatarUrl,
    comment.authorName,
    comment.authorPovId,
    comment.isAiGenerated,
    isPlayerAnonymous,
  ])

  return (
    <div className={`relative shrink-0 ${sizeClass}`}>
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt=""
          className={`size-full rounded-full object-cover ${
            isPlayerAnonymous
              ? 'ring-2 ring-[#E5989B]/70 ring-offset-1 ring-offset-white'
              : showVBadge
                ? 'ring-1 ring-[#D4AF37]/55'
                : 'ring-1 ring-black/[0.04]'
          }`}
        />
      ) : (
        <div
          className={`flex size-full items-center justify-center rounded-full ${
            isPlayerAnonymous ? 'ring-2 ring-[#E5989B]/70' : ''
          }`}
          style={{
            background: isPlayerAnonymous
              ? 'linear-gradient(145deg, #FFF5F5 0%, #F0EDEA 100%)'
              : '#F5F5F4',
          }}
        >
          {isPlayerAnonymous ? (
            <span className="text-[10px] font-bold leading-none text-[#C97B7E]">匿</span>
          ) : null}
        </div>
      )}
      {isPlayerAnonymous ? (
        <span
          className={`absolute -bottom-px -right-px flex ${badgeSizeClass} items-center justify-center rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.12)] ring-[1.5px] ring-white`}
          style={{ backgroundColor: PULSE_COLORS.dustyRose }}
          aria-label="本人匿名"
          title="本人匿名冲浪"
        >
          <span className={`${badgeTextClass} font-bold leading-none text-white`}>我</span>
        </span>
      ) : showVBadge ? (
        <span
          className={`absolute -bottom-px -right-px flex ${badgeSizeClass} items-center justify-center rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.12)] ring-[1.5px] ring-white`}
          style={{ backgroundColor: PULSE_COLORS.lightGold }}
          aria-label={selfVerified ? '本人认证' : '角色认证'}
          title={selfVerified ? '本人认证' : '角色认证'}
        >
          <span className={`${badgeTextClass} font-bold leading-none text-white`}>V</span>
        </span>
      ) : null}
    </div>
  )
}

function commentDisplayName(comment: PulseComment, currentPlayerPovId: string): string {
  if (isPulsePlayerAnonymousComment(comment, currentPlayerPovId)) {
    return PULSE_PLAYER_ANONYMOUS_DISPLAY_NAME
  }
  return comment.authorName
}

function ReplyRow({
  comment,
  currentPlayerPovId,
  rootId,
  canDelete,
  onReplyTo,
  onDelete,
  playerVerified,
}: {
  comment: NestedPulseComment
  currentPlayerPovId: string
  rootId: string
  canDelete: boolean
  onReplyTo: (target: CommentReplyTarget) => void
  onDelete: (commentId: string) => void
  playerVerified?: boolean
}) {
  const likes = pulseCommentLikeCount(comment)
  const isPlayerAnonymous = isPulsePlayerAnonymousComment(comment, currentPlayerPovId)
  const displayName = commentDisplayName(comment, currentPlayerPovId)
  return (
    <div className="mt-3 flex items-start gap-2">
      <CommentAvatar
        comment={comment}
        currentPlayerPovId={currentPlayerPovId}
        sizeClass="size-7"
        badgeSizeClass="size-[11px]"
        badgeTextClass="text-[6.5px]"
        isPlayerAnonymous={isPlayerAnonymous}
        playerVerified={playerVerified}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-[12px] font-medium ${
              isPlayerAnonymous ? 'text-[#C97B7E]' : 'text-[#1C1C1E]'
            }`}
          >
            {displayName}
          </span>
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-neutral-400">
            <Heart className="size-3" strokeWidth={1.4} />
            <PulseNumericText text={likes ? formatPulseCount(likes) : ''} />
          </span>
        </div>
        <p className="mt-1 font-serif text-[13px] leading-relaxed text-neutral-600">
          {comment.replyToName ? (
            <>
              <span className="text-neutral-400">回复</span>
              <span className="mx-0.5 font-medium text-[#1C1C1E]">{comment.replyToName}</span>
              <span className="text-neutral-400">：</span>
            </>
          ) : null}
          <PulseWeiboFaceText text={comment.content} />
        </p>
        <div className="mt-1 flex items-center gap-3">
          <p className="text-[10px] tabular-nums tracking-wide text-neutral-300">
            <PulseNumericText text={formatPulseFeedTime(comment.createdAt)} />
          </p>
          <Pressable
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() =>
              onReplyTo({
                id: comment.id,
                authorName: displayName,
                authorPovId: comment.authorPovId,
                content: comment.content,
                rootId,
              })
            }
            className="text-[11px] font-medium text-neutral-400"
          >
            回复
          </Pressable>
          {canDelete ? (
            <Pressable
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onDelete(comment.id)}
              className="text-[11px] font-medium text-[#DC2626]/85"
            >
              删除
            </Pressable>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CommentBlock({
  comment,
  currentPlayerPovId,
  replyTarget,
  canDeleteComment,
  onReplyTo,
  onDeleteComment,
  playerVerified,
}: {
  comment: PulseComment & { replies?: NestedPulseComment[] }
  currentPlayerPovId: string
  replyTarget: CommentReplyTarget | null
  canDeleteComment: (comment: PulseComment) => boolean
  onReplyTo: (target: CommentReplyTarget) => void
  onDeleteComment: (commentId: string) => void
  playerVerified?: boolean
}) {
  const replies = comment.replies ?? []
  const isMine =
    comment.authorPovId === currentPlayerPovId ||
    comment.anonymousByPlayerId === currentPlayerPovId
  const isPlayerAnonymous = isPulsePlayerAnonymousComment(comment, currentPlayerPovId)
  const displayName = commentDisplayName(comment, currentPlayerPovId)
  const [expanded, setExpanded] = useState(false)
  const canDelete = canDeleteComment(comment)

  useEffect(() => {
    if (isMine && replies.length > 0) setExpanded(true)
  }, [isMine, replies.length])

  useEffect(() => {
    if (replyTarget?.rootId === comment.id && replies.length > 0) setExpanded(true)
  }, [comment.id, replies.length, replyTarget?.rootId])

  const likes = pulseCommentLikeCount(comment)

  return (
    <div className="mt-4">
      <div className="flex items-start gap-2">
        <CommentAvatar
          comment={comment}
          currentPlayerPovId={currentPlayerPovId}
          sizeClass="size-8"
          badgeSizeClass="size-[13px]"
          isPlayerAnonymous={isPlayerAnonymous}
          playerVerified={playerVerified}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`truncate text-[12px] font-medium ${
                isPlayerAnonymous ? 'text-[#C97B7E]' : 'text-[#1C1C1E]'
              }`}
            >
              {displayName}
            </span>
            <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-neutral-400">
              <Heart className="size-3" strokeWidth={1.4} />
              <PulseNumericText text={likes ? formatPulseCount(likes) : ''} />
            </span>
          </div>
          <p className="mt-1 font-serif text-[13px] leading-relaxed text-neutral-600">
            <PulseWeiboFaceText text={comment.content} />
          </p>
          <div className="mt-1 flex items-center gap-3">
            <p className="text-[10px] tabular-nums tracking-wide text-neutral-300">
              <PulseNumericText text={formatPulseFeedTime(comment.createdAt)} />
            </p>
            <Pressable
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() =>
                onReplyTo({
                  id: comment.id,
                  authorName: displayName,
                  authorPovId: comment.authorPovId,
                  content: comment.content,
                  rootId: comment.id,
                })
              }
              className="text-[11px] font-medium text-neutral-400"
            >
              回复
            </Pressable>
            {canDelete ? (
              <Pressable
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onDeleteComment(comment.id)}
                className="text-[11px] font-medium text-[#DC2626]/85"
              >
                删除
              </Pressable>
            ) : null}
          </div>
        </div>
      </div>

      {replies.length > 0 ? (
        // 二级头像左缘对齐一级头像右缘（size-8 = 32px）
        <div className="mt-2 ml-8">
          <Pressable
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] tracking-wide text-neutral-400"
          >
            {expanded ? '收起回复' : `展开 ${replies.length} 条回复`}
          </Pressable>
          {expanded
            ? replies.map((r) => (
                <ReplyRow
                  key={r.id}
                  comment={r}
                  currentPlayerPovId={currentPlayerPovId}
                  rootId={comment.id}
                  canDelete={canDeleteComment(r)}
                  onReplyTo={onReplyTo}
                  onDelete={onDeleteComment}
                  playerVerified={playerVerified}
                />
              ))
            : null}
        </div>
      ) : null}
    </div>
  )
}

export function PostDetail({
  post,
  currentPlayerPovId,
  authorLabel,
  authorAvatarUrl,
  onBack,
  onToast,
  onRepost,
}: {
  post: PulsePost
  currentPlayerPovId: string
  authorLabel: string
  authorAvatarUrl?: string
  onBack: () => void
  onToast: (msg: string) => void
  onRepost: () => void
}) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const engagementNow = usePulseEngagementClock()
  const { identityRealName } = usePulsePlayerAccount()
  const playerRealName = identityRealName?.trim() || authorLabel?.trim() || '用户'
  const playerWeiboNickname = authorLabel?.trim() || ''
  const profileStats = usePulseProfileStats(currentPlayerPovId)
  const playerVerified = Boolean(
    profileStats.verifyLabel?.trim() ||
      ((profileStats.followers ?? 0) > 0 && profileStats.followersSyncedAt),
  )
  const threadEngagement = useMemo(
    () => scalePulseCommentThreadEngagement(profileStats.followers),
    [profileStats.followers],
  )
  const comments = useUnlockedPulsePostComments(post.id, engagementNow)
  const toggleLike = usePulseStore((s) => s.toggleLike)
  const addUserComment = usePulseStore((s) => s.addComment)
  const deleteComment = usePulseStore((s) => s.deleteComment)
  const appendAiComments = usePulseStore((s) => s.appendAiComments)
  const pushInteractions = usePulseStore((s) => s.pushInteractions)
  const ensurePostDetailAvatars = usePulseStore((s) => s.ensurePostDetailAvatars)
  const { options: povOptions } = usePulsePovOptions()
  const mentionCandidates = usePublishMentionCandidates(currentPlayerPovId, povOptions)
  const visibilityCandidates = usePulseVisibilityCandidates(povOptions)
  const visibilityNameByPovId = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of visibilityCandidates) m.set(c.povId, c.name)
    return m
  }, [visibilityCandidates])
  const [editPost, setEditPost] = useState<PulsePost | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [replying, setReplying] = useState(false)
  const [replyTarget, setReplyTarget] = useState<CommentReplyTarget | null>(null)
  /** 默认匿名：以冲浪网友身份发言，接话方不知道是玩家本人 */
  const [anonymous, setAnonymous] = useState(true)
  const commentComposerRef = useRef<PulseWeiboFaceComposerHandle>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const commentBarRef = useRef<HTMLDivElement>(null)
  const { sheetStyle, scrollPadPx } = usePulseCommentKeyboardLayout(
    sheetRef,
    commentBarRef,
  )

  const insertCommentToken = useCallback((token: string) => {
    commentComposerRef.current?.insertToken(token)
    commentComposerRef.current?.focus()
  }, [])

  /** 只选回复对象，不自动聚焦：避免弹键盘触发底栏避让测算抖动 */
  const handleReplyTo = useCallback((target: CommentReplyTarget) => {
    setReplyTarget(target)
  }, [])

  const isPostOwner = post.authorPovId.trim() === currentPlayerPovId.trim()

  const canDeleteComment = useCallback(
    (c: Pick<PulseComment, 'authorPovId' | 'anonymousByPlayerId'>) => {
      if (isPostOwner) return true
      if (c.authorPovId.trim() === currentPlayerPovId.trim()) return true
      return (c.anonymousByPlayerId?.trim() || '') === currentPlayerPovId.trim()
    },
    [currentPlayerPovId, isPostOwner],
  )

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      const ok = window.confirm('确定删除这条评论吗？\n\n删除后无法恢复，其下回复也会一并删除。')
      if (!ok) return
      const deleted = deleteComment(post.id, commentId)
      if (!deleted) {
        onToast('删除失败')
        return
      }
      setReplyTarget((prev) => {
        if (!prev) return null
        if (prev.id === commentId || prev.rootId === commentId) return null
        const state = usePulseStore.getState()
        const accountId = state.currentAccountId
        const worldId = state.currentPOVId
        if (!accountId || !worldId) return null
        const list =
          state.root.byAccount[accountId]?.worldByPov[worldId]?.commentsByPostId[post.id] ?? []
        return list.some((c) => c.id === prev.id) ? prev : null
      })
      onToast('已删除评论')
    },
    [deleteComment, onToast, post.id],
  )

  const nested = useMemo(() => nestPulseComments(comments), [comments])

  /** 首次打开详情：为 AI 网友帖/评分配随机网友头像并写入 IndexedDB */
  useEffect(() => {
    ensurePostDetailAvatars(post.id)
  }, [ensurePostDetailAvatars, post.id])

  const publishUserComment = useCallback(
    (
      content: string,
      asAnonymous: boolean,
      parentId?: string,
    ): { id: string; authorName: string } => {
      const aliases = [authorLabel].filter(Boolean)
      if (asAnonymous) {
        const nick = inventPlayerAnonymousSurfNick(currentPlayerPovId)
        const povId = `ai:${nick}`
        const id = addUserComment({
          postId: post.id,
          authorPovId: povId,
          authorName: nick,
          authorAvatarUrl: pickStablePulseNetizenAvatarPath(
            playerAnonymousSurfAvatarSeed(currentPlayerPovId),
          ),
          content,
          parentId,
          isAiGenerated: true,
          anonymousByPlayerId: currentPlayerPovId,
          playerMentionAliases: aliases,
        })
        return { id, authorName: nick }
      }
      const id = addUserComment({
        postId: post.id,
        authorPovId: currentPlayerPovId,
        authorName: authorLabel,
        authorAvatarUrl,
        content,
        parentId,
        playerMentionAliases: aliases,
      })
      return { id, authorName: authorLabel }
    },
    [addUserComment, authorAvatarUrl, authorLabel, currentPlayerPovId, post.id],
  )

  const buildNetizenReplyComments = useCallback(
    (
      rows: Array<{ authorName: string; content: string; parentHint?: string; likeCount?: number }>,
      seedId: string,
      seedName: string,
      opts?: {
        extraSeeds?: Array<{ name: string; id: string; visibleAt?: number }>
        /** 用户发出回复的墙钟时刻；延时相对此点错落解锁 */
        publishedAt?: number
      },
    ): PulseComment[] => {
      const publishedAt = opts?.publishedAt ?? Date.now()
      const nameToId = new Map<string, string>([[seedName, seedId]])
      const visibleAtById = new Map<string, number>([[seedId, publishedAt]])
      for (const s of opts?.extraSeeds ?? []) {
        const n = s.name.trim()
        if (n && s.id) {
          nameToId.set(n, s.id)
          if (s.visibleAt != null) visibleAtById.set(s.id, s.visibleAt)
        }
      }
      const delays = buildStaggeredDelaySeconds(rows.length, `${post.id}:thread:${seedId}`)
      const built: PulseComment[] = []
      rows.forEach((row, ci) => {
        const id = `pc-reply-${publishedAt}-${ci}-${Math.random().toString(36).slice(2, 6)}`
        const hint = row.parentHint?.trim() || seedName
        const hit =
          nameToId.get(hint) ??
          [...nameToId.entries()].find(([n]) => n.toLowerCase() === hint.toLowerCase())?.[1]
        const parentId = hit ?? seedId
        nameToId.set(row.authorName, id)
        const delaySec = delays[ci] ?? 30 + ci * 40
        let visibleAt = publishedAt + delaySec * 1000
        const parentVisible = visibleAtById.get(parentId)
        if (parentVisible != null) {
          visibleAt = Math.max(visibleAt, parentVisible + 42_000)
        }
        visibleAtById.set(id, visibleAt)
        built.push({
          id,
          postId: post.id,
          authorPovId: `ai:${row.authorName}`,
          authorName: row.authorName,
          authorAvatarUrl: pickStablePulseNetizenAvatarPath(`ai:${row.authorName}`),
          content: row.content,
          createdAt: visibleAt,
          visibleAt,
          parentId,
          isAiGenerated: true,
          likeCount: row.likeCount ?? 2 + Math.floor(Math.random() * 40),
        })
      })
      return built
    },
    [post.id],
  )

  const pushScheduledCommentInteractions = useCallback(
    (comments: PulseComment[]) => {
      if (!comments.length || !currentPlayerPovId) return
      const snippet = post.content.replace(/\s+/g, ' ').trim().slice(0, 48) || '你的动态'
      const items: Array<Omit<PulseInteraction, 'id' | 'read'>> = comments.map((c) => ({
        type: 'comment' as const,
        fromName: c.authorName,
        fromAvatarUrl: c.authorAvatarUrl,
        fromPovId: c.authorPovId,
        postId: post.id,
        postSnippet: snippet,
        content: c.content,
        createdAt: c.createdAt,
        visibleAt: c.visibleAt ?? c.createdAt,
      }))
      pushInteractions(items, currentPlayerPovId)
    },
    [currentPlayerPovId, post.content, post.id, pushInteractions],
  )

  const elicitCommentReplies = useCallback(
    async (
      userComment: { id: string; authorName: string; content: string },
      target: CommentReplyTarget,
    ) => {
      const publishedAt = Date.now()
      const parsed = parsePulsePovId(target.authorPovId)
      if (parsed?.kind === 'char') {
        const characterId = parsed.rawId
        const { character, personaSummary } = await loadPulseCharacterPersonaContext(characterId, {
          bioMaxChars: 900,
          worldBookMaxChars: 900,
          worldBackgroundMaxChars: 500,
          includeBoundPlayerIdentity: true,
        })
        const postImageDataUrls = await collectPulsePostVisionImageDataUrls(post)
        const mediaBrief = buildPulsePostMediaBriefForAi(post)
        const replies = await aiGeneratePulseCharacterCommentReply({
          apiConfig,
          post: { authorName: post.authorName, content: post.content },
          character: {
            characterId,
            name: target.authorName,
            personaSummary,
          },
          playerDisplayName: playerRealName,
          playerRealName,
          playerWeiboNickname:
            playerWeiboNickname && playerWeiboNickname !== playerRealName
              ? playerWeiboNickname
              : undefined,
          targetComment: { authorName: target.authorName, content: target.content },
          userReply: { authorName: userComment.authorName, content: userComment.content },
          postMediaBrief: mediaBrief || undefined,
          postImageDataUrls: postImageDataUrls.length ? postImageDataUrls : undefined,
          characterReplyMin: threadEngagement.characterReplyMin,
          characterReplyMax: threadEngagement.characterReplyMax,
          engagementHint: threadEngagement.engagementHint,
        })
        const charPov = toCharPovId(characterId)
        const charDelays = buildStaggeredDelaySeconds(
          replies.length,
          `${post.id}:char-reply:${userComment.id}`,
        )
        const charBuilt: PulseComment[] = replies.map((content, i) => {
          const delaySec = charDelays[i] ?? 25 + i * 35
          const visibleAt = publishedAt + delaySec * 1000
          return {
            id: `pc-char-reply-${publishedAt}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            postId: post.id,
            authorPovId: charPov,
            authorName: target.authorName,
            authorAvatarUrl: resolvePulseAuthorAvatarForPersist(
              charPov,
              target.authorName,
              character?.avatarUrl,
              true,
            ),
            content,
            createdAt: visibleAt,
            visibleAt,
            parentId: userComment.id,
            isAiGenerated: true,
            likeCount: 2 + Math.floor(Math.random() * 24),
          }
        })

        // 角色接话后：网友继续围观楼中楼（可挂用户或角色回复下）
        let netizenBuilt: PulseComment[] = []
        if (threadEngagement.netizenReplyCount > 0) {
          try {
            const rows = await aiGeneratePulseNetizenReplies({
              apiConfig,
              post: { authorName: post.authorName, content: post.content },
              userComment: { authorName: userComment.authorName, content: userComment.content },
              count: threadEngagement.netizenReplyCount,
              engagementHint: threadEngagement.engagementHint,
              playerRealName,
              playerWeiboNickname:
                playerWeiboNickname && playerWeiboNickname !== playerRealName
                  ? playerWeiboNickname
                  : undefined,
              threadContext: {
                bannedAuthorNames: [target.authorName],
                replyTarget: {
                  authorName: target.authorName,
                  content: target.content,
                  kind: 'char',
                },
                priorReplies: [
                  { authorName: target.authorName, content: target.content },
                  ...charBuilt.map((c) => ({ authorName: c.authorName, content: c.content })),
                ],
              },
            })
            netizenBuilt = buildNetizenReplyComments(rows, userComment.id, userComment.authorName, {
              extraSeeds: charBuilt.map((c) => ({
                name: c.authorName,
                id: c.id,
                visibleAt: c.visibleAt,
              })),
              publishedAt,
            })
          } catch {
            // 网友接话失败不阻断角色回复
          }
        }

        const scheduled = [...charBuilt, ...netizenBuilt]
        appendAiComments(post.id, scheduled, {
          playerMentionAliases: [authorLabel].filter(Boolean),
        })
        pushScheduledCommentInteractions(scheduled)
        onToast(
          scheduled.length
            ? `${target.authorName} 与网友接话已安排，稍后陆续出现`
            : `${target.authorName} 接话已安排`,
        )
        return
      }

      if (threadEngagement.netizenReplyCount <= 0) {
        onToast('粉丝不多，暂时没人围观')
        return
      }

      const rows = await aiGeneratePulseNetizenReplies({
        apiConfig,
        post: { authorName: post.authorName, content: post.content },
        userComment: { authorName: userComment.authorName, content: userComment.content },
        count: threadEngagement.netizenReplyCount,
        engagementHint: threadEngagement.engagementHint,
        playerRealName,
        playerWeiboNickname:
          playerWeiboNickname && playerWeiboNickname !== playerRealName
            ? playerWeiboNickname
            : undefined,
        threadContext: {
          bannedAuthorNames: parsePulsePovId(target.authorPovId)?.kind === 'char'
            ? [target.authorName]
            : undefined,
          replyTarget: {
            authorName: target.authorName,
            content: target.content,
            kind: parsePulsePovId(target.authorPovId)?.kind === 'char' ? 'char' : 'netizen',
          },
          priorReplies: [{ authorName: target.authorName, content: target.content }],
        },
      })
      const built = buildNetizenReplyComments(rows, userComment.id, userComment.authorName, {
        publishedAt,
      })
      appendAiComments(post.id, built, { playerMentionAliases: [authorLabel].filter(Boolean) })
      pushScheduledCommentInteractions(built)
      onToast('网友接话已安排，稍后陆续出现')
    },
    [
      apiConfig,
      appendAiComments,
      authorLabel,
      buildNetizenReplyComments,
      onToast,
      playerRealName,
      playerWeiboNickname,
      post,
      pushScheduledCommentInteractions,
      threadEngagement,
    ],
  )

  /** 仅发评论：有回复目标则挂楼中楼，不自动召唤接话 */
  const handleSend = useCallback(() => {
    const text = commentDraft.trim()
    if (!text || replying) return
    const published = publishUserComment(text, anonymous, replyTarget?.id)
    setCommentDraft('')
    setReplyTarget(null)
    if (!published.id) {
      onToast('评论发送失败，请稍后重试')
    }
  }, [anonymous, commentDraft, onToast, publishUserComment, replying, replyTarget])

  /**
   * 回复：发送（可选）并触发接话。
   * - 有选中评论：挂该楼下并召唤角色/网友接话
   * - 无选中：围绕自己刚发的/最新评论召唤网友讨论
   */
  const handleReply = useCallback(async () => {
    if (replying) return
    const draft = commentDraft.trim()
    const target = replyTarget

    if (target) {
      if (!draft) {
        onToast('请先写回复内容，再点回复召唤接话')
        return
      }
      const published = publishUserComment(draft, anonymous, target.id)
      setCommentDraft('')
      setReplyTarget(null)
      if (!published.id) {
        onToast('评论发送失败，请稍后重试')
        return
      }
      setReplying(true)
      try {
        await elicitCommentReplies(
          { id: published.id, authorName: published.authorName, content: draft },
          target,
        )
      } catch (e) {
        onToast(e instanceof Error ? e.message : '回复生成失败')
      } finally {
        setReplying(false)
      }
      return
    }

    let seedId = ''
    let seedContent = draft
    let seedName = authorLabel

    if (draft) {
      const published = publishUserComment(draft, anonymous)
      setCommentDraft('')
      seedId = published.id
      seedName = published.authorName
      seedContent = draft
      if (!seedId) {
        onToast('评论发送失败，请稍后重试')
        return
      }
    } else {
      const mine = [...comments]
        .filter(
          (c) =>
            c.authorPovId === currentPlayerPovId || c.anonymousByPlayerId === currentPlayerPovId,
        )
        .sort((a, b) => b.createdAt - a.createdAt)[0]
      if (!mine) {
        onToast('请先写一条评论，再点回复召唤接话')
        return
      }
      seedId = mine.id
      seedContent = mine.content
      seedName = mine.authorName
    }

    setReplying(true)
    try {
      if (threadEngagement.netizenReplyCount <= 0) {
        onToast('粉丝不多，暂时没人接话')
        return
      }
      const publishedAt = Date.now()
      const rows = await aiGeneratePulseNetizenReplies({
        apiConfig,
        post: { authorName: post.authorName, content: post.content },
        userComment: { authorName: seedName, content: seedContent },
        count: threadEngagement.netizenReplyCount,
        engagementHint: threadEngagement.engagementHint,
        playerRealName,
        playerWeiboNickname:
          playerWeiboNickname && playerWeiboNickname !== playerRealName
            ? playerWeiboNickname
            : undefined,
      })
      const built = buildNetizenReplyComments(rows, seedId, seedName, { publishedAt })
      appendAiComments(post.id, built, { playerMentionAliases: [authorLabel].filter(Boolean) })
      pushScheduledCommentInteractions(built)
      onToast('网友接话已安排，稍后陆续出现')
    } catch (e) {
      onToast(e instanceof Error ? e.message : '回复生成失败')
    } finally {
      setReplying(false)
    }
  }, [
    anonymous,
    apiConfig,
    appendAiComments,
    authorLabel,
    buildNetizenReplyComments,
    commentDraft,
    comments,
    currentPlayerPovId,
    elicitCommentReplies,
    onToast,
    playerRealName,
    playerWeiboNickname,
    post.authorName,
    post.content,
    post.id,
    publishUserComment,
    pushScheduledCommentInteractions,
    replying,
    replyTarget,
    threadEngagement,
  ])

  return (
    <>
      <motion.div
        ref={sheetRef}
        className="fixed inset-0 z-[1350] flex flex-col bg-[#FCFCFC]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_MODAL_SPRING}
        style={sheetStyle}
      >
        <header
          className="flex shrink-0 items-center gap-2 bg-white/90 px-3 py-3 backdrop-blur-xl"
          style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
        >
          <Pressable type="button" onClick={onBack} className="flex size-9 items-center justify-center rounded-full">
            <ArrowLeft className="size-5" strokeWidth={1.3} />
          </Pressable>
          <span className="text-[13px] text-neutral-500">动态详情</span>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-3 pt-2"
          style={{
            paddingBottom: `calc(8.75rem + ${scrollPadPx}px)`,
          }}
        >
          <PostCard
            post={post}
            currentPovId={currentPlayerPovId}
            onOpen={() => {}}
            onLike={() => toggleLike(post.id)}
            onRepost={onRepost}
            onEdit={(p) => setEditPost(p)}
            visibilityNameByPovId={visibilityNameByPovId}
            compact
          />

          <section className="mt-6 px-1">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-neutral-400">评论</h3>
            {nested.length ? (
              nested.map((c) => (
                <CommentBlock
                  key={c.id}
                  comment={c}
                  currentPlayerPovId={currentPlayerPovId}
                  replyTarget={replyTarget}
                  canDeleteComment={canDeleteComment}
                  onReplyTo={handleReplyTo}
                  onDeleteComment={handleDeleteComment}
                  playerVerified={playerVerified}
                />
              ))
            ) : (
              <p className="mt-4 text-[12px] text-neutral-400">暂无评论</p>
            )}
          </section>
        </div>

        <div
          ref={commentBarRef}
          className="absolute inset-x-0 bottom-0 z-10 border-t border-black/[0.04] bg-white/92 px-4 pt-2 pb-3 backdrop-blur-xl"
          style={{
            paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
          }}
        >
          {/* 固定占位：有无回复目标高度一致，避免底栏跳动 */}
          <div
            className={`mb-1.5 flex h-7 items-center gap-2 px-1 transition-opacity duration-150 ${
              replyTarget ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={!replyTarget}
          >
            <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-500">
              {replyTarget ? (
                <>
                  回复 <span className="font-medium text-[#1C1C1E]">{replyTarget.authorName}</span>
                </>
              ) : (
                '占位'
              )}
            </span>
            {replyTarget ? (
              <Pressable
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setReplyTarget(null)}
                className="shrink-0 text-[11px] text-neutral-400"
              >
                取消
              </Pressable>
            ) : null}
          </div>
          <div className="flex items-center gap-1 rounded-full bg-[#F5F5F4]/80 px-2 py-2">
            <PulseWeiboFacePicker onPick={insertCommentToken} panelMode="page" />
            <Pressable
              type="button"
              onClick={() => setAnonymous((v) => !v)}
              className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                anonymous ? 'bg-[#E5989B]/18' : ''
              }`}
              aria-label={anonymous ? '匿名冲浪中，点击改用本人身份' : '点击匿名冲浪'}
              title={anonymous ? '匿名冲浪' : '本人身份'}
            >
              <UserRound
                className="size-4"
                strokeWidth={1.35}
                style={{ color: anonymous ? PULSE_COLORS.dustyRose : PULSE_COLORS.ink }}
              />
            </Pressable>
            <PulseWeiboFaceComposer
              ref={commentComposerRef}
              value={commentDraft}
              onChange={setCommentDraft}
              disabled={replying}
              placeholder={
                replying
                  ? '接话中…'
                  : replyTarget
                    ? `回复 ${replyTarget.authorName}…`
                    : anonymous
                      ? '匿名冲浪评论…'
                      : '写评论…'
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && commentDraft.trim() && !replying) {
                  handleSend()
                }
              }}
            />
            <Pressable
              type="button"
              disabled={!commentDraft.trim() || replying}
              onClick={handleSend}
              className="shrink-0 px-1.5 text-[12px] font-medium disabled:opacity-30"
              style={{ color: PULSE_COLORS.dustyRose }}
            >
              发送
            </Pressable>
            <Pressable
              type="button"
              disabled={replying}
              onClick={() => void handleReply()}
              className="shrink-0 px-1.5 text-[12px] font-medium disabled:opacity-30"
              style={{ color: PULSE_COLORS.ink }}
            >
              {replying ? '接话中…' : '回复'}
            </Pressable>
          </div>
        </div>
      </motion.div>

      {editPost ? (
        <PublishEditor
          authorPovId={currentPlayerPovId}
          authorName={authorLabel}
          authorAvatarUrl={authorAvatarUrl}
          mentionCandidates={mentionCandidates}
          visibilityCandidates={visibilityCandidates}
          editPost={editPost}
          onClose={() => setEditPost(null)}
          onPublished={() => setEditPost(null)}
          onToast={onToast}
        />
      ) : null}
    </>
  )
}
