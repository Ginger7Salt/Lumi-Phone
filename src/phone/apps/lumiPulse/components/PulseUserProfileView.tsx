import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Eraser, ShieldCheck, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { PostCard } from './PostCard'
import { PulseFollowButton } from './PulseFollowButton'
import { PulseFollowingList } from './PulseFollowingList'
import { PulseNum } from './PulseNum'
import { PulseVerifiedAvatar } from './PulseVerifiedAvatar'
import {
  CharacterDynamicsGenerateSheet,
  type CharacterDynamicsGenerateSettings,
} from './CharacterDynamicsGenerateSheet'
import { PULSE_COLORS, PULSE_DEFAULT_COVER, PULSE_MODAL_SPRING } from '../constants'
import { buildTrendingRefContext } from '../buildTrendingRefContext'
import { resolvePulseFollowRelation } from '../pulseFollowRelation'
import { aiGeneratePulseCharacterDynamics } from '../lumiPulseAi'
import { scheduleAllCharacterPulsePostsMemoryFromRoot } from '../pulsePostMemoryArchiver'
import { resolvePulseAuthorAvatarUrl } from '../pulseNetizenAvatar'
import { loadPulseCharacterPersonaContext } from '../pulseProfilePersona'
import { sanitizePulseProfileSignature } from '../pulseWeiboFace'
import type { PulseFollowingUser } from '../pulseTypes'
import { formatPulseCount, parsePulsePovId } from '../pulseTypes'
import {
  usePulseAlsoFollowTarget,
  usePulseFollowingList,
  usePulsePostsByAuthor,
  usePulseProfileStats,
} from '../pulseStoreSelectors'
import { usePulsePlayerAccount } from '../usePulsePlayerAccount'
import { usePulseStore } from '../usePulseStore'

/** 他人微博主页 — 从关注列表头像进入 */
export function PulseUserProfileView({
  user,
  currentPlayerPovId,
  onBack,
  onOpenPost,
  onRepostPost,
}: {
  user: PulseFollowingUser
  currentPlayerPovId: string
  onBack: () => void
  onOpenPost: (postId: string) => void
  onRepostPost: (postId: string) => void
}) {
  const [showTheirFollowing, setShowTheirFollowing] = useState(false)
  const [nestedUser, setNestedUser] = useState<PulseFollowingUser | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const apiConfig = useCurrentApiConfig('chatCard')
  const { wechatNickname } = usePulsePlayerAccount()
  const toggleLike = usePulseStore((s) => s.toggleLike)
  const toggleFollow = usePulseStore((s) => s.toggleFollow)
  const appendGeneratedCharacterDynamics = usePulseStore((s) => s.appendGeneratedCharacterDynamics)
  const clearPostsByAuthor = usePulseStore((s) => s.clearPostsByAuthor)
  const posts = usePulsePostsByAuthor(user.povId)
  const following = usePulseFollowingList(currentPlayerPovId)
  const theirFollowing = usePulseFollowingList(user.povId)
  const alsoFollow = usePulseAlsoFollowTarget(user.povId, currentPlayerPovId)
  const stats = usePulseProfileStats(user.povId)
  const playerStats = usePulseProfileStats(currentPlayerPovId)
  const avatarSrc = user.avatarUrl

  const likesTotal = useMemo(
    () => posts.reduce((sum, p) => sum + p.likeCount, 0),
    [posts],
  )
  const followingCount = stats.following > 0 ? stats.following : theirFollowing.length
  const isSelf = user.povId === currentPlayerPovId
  const parsed = parsePulsePovId(user.povId)
  const isCharacter = parsed?.kind === 'char'
  const characterId = parsed?.kind === 'char' ? parsed.rawId : ''
  const isFollowing = useMemo(
    () => following.some((u) => u.povId === user.povId),
    [following, user.povId],
  )
  const theyFollowMe = useMemo(
    () => theirFollowing.some((u) => u.povId === currentPlayerPovId),
    [theirFollowing, currentPlayerPovId],
  )
  const followRelation = resolvePulseFollowRelation({
    iFollow: isFollowing,
    theyFollow: theyFollowMe,
  })
  const showVerified = user.verified === true || isCharacter
  const alsoFollowLead = alsoFollow[0]
  const alsoFollowPreview = alsoFollow.slice(0, 3)
  const ownerDisplayName = stats.weiboNickname?.trim() || user.name

  // 打开角色主页时，把已有动态补刻录进长期记忆（防抖 upsert）
  useEffect(() => {
    if (!isCharacter) return
    const { currentAccountId, root } = usePulseStore.getState()
    if (!currentAccountId) return
    scheduleAllCharacterPulsePostsMemoryFromRoot({
      root,
      accountId: currentAccountId,
      authorPovId: user.povId,
      apiConfig,
      wechatAccountId: currentAccountId,
    })
  }, [apiConfig, isCharacter, posts.length, user.povId])

  const handleClearPosts = useCallback(() => {
    if (!isCharacter) return
    if (!posts.length) {
      window.alert('暂无动态可清除')
      return
    }
    const ok = window.confirm(
      `确定清除「${ownerDisplayName}」主页上的全部历史动态？共 ${posts.length} 条，清除后无法恢复。`,
    )
    if (!ok) return
    const n = clearPostsByAuthor(user.povId)
    if (!n) {
      window.alert('清除失败，请稍后重试')
      return
    }
  }, [clearPostsByAuthor, isCharacter, ownerDisplayName, posts.length, user.povId])

  const handleGenerate = useCallback(
    async (settings: CharacterDynamicsGenerateSettings) => {
      if (!isCharacter || !characterId) return
      setGenerating(true)
      try {
        const { character, personaSummary } = await loadPulseCharacterPersonaContext(characterId, {
          includeBoundPlayerIdentity: settings.includeUserMention,
        })
        const archiveName =
          character?.name?.trim() || character?.wechatNickname?.trim() || ownerDisplayName
        const plotContext = await buildTrendingRefContext({
          refCharacters: [{ characterId, name: archiveName }],
          chatRefRounds: settings.chatRefRounds,
          datingRefRounds: settings.datingRefRounds,
          includePlayerIdentity: settings.includeUserMention,
        })
        const playerWeibo =
          playerStats.weiboNickname?.trim() || wechatNickname.trim() || '我'
        const recentPulseLocations = posts
          .map((p) => p.locationLabel?.trim())
          .filter((x): x is string => Boolean(x))
          .slice(0, 8)
        const { currentAccountId } = usePulseStore.getState()
        const sessionPlayerIdentityId =
          parsePulsePovId(currentPlayerPovId)?.kind === 'player'
            ? parsePulsePovId(currentPlayerPovId)?.rawId
            : undefined
        const pack = await aiGeneratePulseCharacterDynamics({
          apiConfig,
          characterName: archiveName,
          weiboNickname: ownerDisplayName,
          worldName: undefined,
          personaSummary,
          followers: stats.followers,
          verifyLabel: stats.verifyLabel || user.bio,
          bio: stats.bio || user.bio,
          postCount: settings.postCount,
          commentsPerPost: settings.commentsPerPost,
          postKinds: settings.postKinds,
          postStyles: settings.postStyles,
          postStyleCustom: settings.postStyleCustom,
          commentStyles: settings.commentStyles,
          commentStyleCustom: settings.commentStyleCustom,
          includeAuthorReplies: settings.includeAuthorReplies,
          plotContext: plotContext || undefined,
          includeUserMention: settings.includeUserMention,
          /** 始终传入以便过滤「替用户发的评论」；是否可被 @ 仍由 includeUserMention 控制 */
          playerDisplayName: playerWeibo,
          timeSpan: settings.timeSpan,
          contentLenMin: settings.contentLenMin,
          contentLenMax: settings.contentLenMax,
          customRequirements: settings.customRequirements,
          characterId,
          sessionPlayerIdentityId,
          accountId: currentAccountId,
          recentPulseLocations,
        })
        const n = appendGeneratedCharacterDynamics({
          povId: user.povId,
          authorName: ownerDisplayName,
          authorAvatarUrl: user.avatarUrl || stats.weiboAvatarUrl,
          posts: pack.posts,
          timeSpan: settings.timeSpan,
        })
        if (!n) throw new Error('生成失败：未能写入动态')
        setSheetOpen(false)
      } catch (e) {
        window.alert(e instanceof Error ? e.message : '生成失败')
      } finally {
        setGenerating(false)
      }
    },
    [
      apiConfig,
      appendGeneratedCharacterDynamics,
      characterId,
      isCharacter,
      ownerDisplayName,
      playerStats.weiboNickname,
      posts,
      stats.bio,
      stats.followers,
      stats.verifyLabel,
      stats.weiboAvatarUrl,
      user.avatarUrl,
      user.bio,
      user.povId,
      currentPlayerPovId,
      wechatNickname,
    ],
  )

  return (
    <motion.div
      className="fixed inset-0 z-[1290] flex flex-col bg-[#FCFCFC]"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={PULSE_MODAL_SPRING}
    >
      <header
        className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 py-3"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable
          type="button"
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-full bg-white/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] backdrop-blur-md"
        >
          <ArrowLeft className="size-5" strokeWidth={1.3} />
        </Pressable>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="relative h-40 overflow-hidden">
          <img src={PULSE_DEFAULT_COVER} alt="" className="size-full object-cover" draggable={false} />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: `linear-gradient(180deg, transparent 40%, ${PULSE_COLORS.bg} 100%)` }}
          />
        </div>

        <div className="relative px-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-end gap-3">
              <div className="relative -mt-10 shrink-0">
                <PulseVerifiedAvatar
                  src={avatarSrc}
                  verified={showVerified}
                  sizeClass="size-20"
                  className="shadow-[0_2px_15px_rgba(0,0,0,0.06)]"
                />
              </div>
              <div className="min-w-0 pb-1">
                <h1 className="truncate text-[18px] font-semibold text-[#1C1C1E]">{ownerDisplayName}</h1>
              </div>
            </div>
            {!isSelf ? (
              <PulseFollowButton
                relation={followRelation}
                onClick={() => toggleFollow(user, following)}
                className="mb-1"
              />
            ) : null}
          </div>

          {showVerified ? (
            <div className="mt-3 flex items-start gap-1.5">
              <ShieldCheck
                className="mt-0.5 size-3.5 shrink-0"
                style={{ color: PULSE_COLORS.lightGold }}
                strokeWidth={1.6}
                aria-hidden
              />
              <p className="min-w-0 text-[12px] leading-snug" style={{ color: '#B8952E' }}>
                {stats.verifyLabel?.trim() || user.bio?.trim() || '角色认证'}
              </p>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-neutral-600">
            <Pressable type="button" onClick={() => setShowTheirFollowing(true)} className="text-left">
              关注{' '}
              <strong className="font-semibold text-[#1C1C1E]">
                <PulseNum>{followingCount}</PulseNum>
              </strong>
            </Pressable>
            <span className="text-neutral-300">|</span>
            <span>
              粉丝{' '}
              <strong className="font-semibold text-[#1C1C1E]">
                <PulseNum>{formatPulseCount(stats.followers)}</PulseNum>
              </strong>
            </span>
            <span className="text-neutral-300">|</span>
            <span>
              微博{' '}
              <strong className="font-semibold text-[#1C1C1E]">
                <PulseNum>{posts.length}</PulseNum>
              </strong>
            </span>
            <span className="text-neutral-300">|</span>
            <span>
              获赞{' '}
              <strong className="font-semibold text-[#1C1C1E]">
                <PulseNum>{formatPulseCount(likesTotal)}</PulseNum>
              </strong>
            </span>
          </div>

          <p className="mt-3 font-serif text-[13px] italic leading-relaxed text-neutral-400">
            {sanitizePulseProfileSignature(stats.bio || user.bio || '') ||
              '这位用户还没有留下简介。'}
          </p>

          {!isSelf && alsoFollowLead ? (
            <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-[#F7F6F5] px-3 py-2.5">
              <div className="flex shrink-0 -space-x-1.5">
                {alsoFollowPreview.map((peer) => {
                  const src = resolvePulseAuthorAvatarUrl(peer.avatarUrl)
                  return src ? (
                    <img
                      key={peer.povId}
                      src={src}
                      alt=""
                      className="size-6 rounded-full object-cover ring-2 ring-[#F7F6F5]"
                    />
                  ) : (
                    <div
                      key={peer.povId}
                      className="size-6 rounded-full bg-neutral-200 ring-2 ring-[#F7F6F5]"
                    />
                  )
                })}
              </div>
              <p className="min-w-0 flex-1 text-[12px] leading-snug text-neutral-500">
                我关注的{' '}
                <span className="font-medium text-neutral-700">{alsoFollowLead.name}</span>
                {alsoFollow.length > 1 ? (
                  <>
                    {' '}
                    等 <PulseNum>{alsoFollow.length}</PulseNum> 人
                  </>
                ) : null}
                也关注了 TA
              </p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.04] pb-2">
            <span className="text-[14px] font-semibold text-[#1C1C1E]">动态</span>
            {isCharacter ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <Pressable
                  type="button"
                  onClick={handleClearPosts}
                  disabled={!posts.length}
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-600 disabled:opacity-40"
                >
                  <Eraser className="size-3.5" strokeWidth={1.6} />
                  清除历史动态
                </Pressable>
                <Pressable
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium text-white"
                  style={{ backgroundColor: PULSE_COLORS.dustyRose }}
                >
                  <Sparkles className="size-3.5" strokeWidth={1.6} />
                  生成动态
                </Pressable>
              </div>
            ) : null}
          </div>

          <div className="mt-3 space-y-3 pb-4">
            {posts.length ? (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentPovId={currentPlayerPovId}
                  onOpen={() => onOpenPost(post.id)}
                  onLike={() => toggleLike(post.id)}
                  onRepost={() => onRepostPost(post.id)}
                  compact
                />
              ))
            ) : (
              <p className="py-12 text-center text-[13px] text-neutral-400">TA 还没有发布动态</p>
            )}
          </div>
        </div>
      </div>

      <CharacterDynamicsGenerateSheet
        open={sheetOpen}
        characterName={ownerDisplayName}
        loading={generating}
        onClose={() => !generating && setSheetOpen(false)}
        onConfirm={handleGenerate}
      />

      <AnimatePresence>
        {showTheirFollowing ? (
          <PulseFollowingList
            ownerName={ownerDisplayName}
            following={theirFollowing}
            currentPlayerPovId={currentPlayerPovId}
            onBack={() => setShowTheirFollowing(false)}
            onOpenUser={(u) => setNestedUser(u)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {nestedUser ? (
          <PulseUserProfileView
            user={nestedUser}
            currentPlayerPovId={currentPlayerPovId}
            onBack={() => setNestedUser(null)}
            onOpenPost={onOpenPost}
            onRepostPost={onRepostPost}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
