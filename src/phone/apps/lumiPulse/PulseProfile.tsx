import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion'
import { Pencil, ShieldCheck, Sparkles, Wand2 } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { MediaWaterfall } from './components/MediaWaterfall'
import { PulseFollowingList } from './components/PulseFollowingList'
import { PulseUserProfileView } from './components/PulseUserProfileView'
import { PostCard } from './components/PostCard'
import { PulseProfileGenerateSheet } from './components/PulseProfileGenerateSheet'
import { PulseNum } from './components/PulseNum'
import { PULSE_COLORS, PULSE_DEFAULT_COVER, PULSE_SHEET_SPRING, PULSE_TAB_SPRING } from './constants'
import { aiGeneratePulseProfileBundle } from './lumiPulseAi'
import { loadPulseCharacterPersonaContext } from './pulseProfilePersona'
import { PublishEditor } from './PublishEditor'
import type { PulseFollowingUser, PulsePovOption, PulseProfileSegment, PulseProfileStats } from './pulseTypes'
import { formatPulseCount } from './pulseTypes'
import {
  usePulseFollowingList,
  usePulseLikedPosts,
  usePulseMediaPosts,
  usePulsePostsByAuthor,
} from './pulseStoreSelectors'
import { usePulseStore } from './usePulseStore'

const PROFILE_TABS: { id: PulseProfileSegment; label: string }[] = [
  { id: 'posts', label: '动态' },
  { id: 'media', label: '媒体' },
  { id: 'liked', label: '赞过' },
]

type ProfileOverlay =
  | { kind: 'following' }
  | { kind: 'user'; user: PulseFollowingUser }

/** 从世界选项补全 char: 角色的头像与认证信息 */
function enrichFollowingUser(user: PulseFollowingUser, options: PulsePovOption[]): PulseFollowingUser {
  const opt = options.find((o) => o.povId === user.povId)
  if (!opt) return user
  return {
    ...user,
    name: opt.label || user.name,
    avatarUrl: opt.avatarUrl || user.avatarUrl,
    verified: true,
  }
}

function PovSwitcherSheet({
  options,
  currentPovId,
  onSelect,
  onClose,
}: {
  options: PulsePovOption[]
  currentPovId: string
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1300] bg-black/15 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-label="关闭"
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-[1310] rounded-t-[24px] bg-white/95 px-5 pb-8 pt-4 backdrop-blur-2xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_SHEET_SPRING}
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/10" />
        <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-400">World Switch</p>
        <h3 className="mt-1 font-serif text-[18px] text-[#1C1C1E]">切换世界</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
          选择另一位主要角色，进入不同的世界观
        </p>
        <div className="mt-5 space-y-2">
          {options.map((opt) => (
            <Pressable
              key={opt.povId}
              type="button"
              onClick={() => {
                onSelect(opt.povId)
                onClose()
              }}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 ${
                opt.povId === currentPovId ? 'bg-[#FCFCFC] shadow-[0_2px_15px_rgba(0,0,0,0.03)]' : ''
              }`}
            >
              {opt.avatarUrl ? (
                <img src={opt.avatarUrl} alt="" className="size-11 rounded-full object-cover" />
              ) : (
                <div className="size-11 rounded-full bg-[#F5F5F4]" />
              )}
              <div className="min-w-0 flex-1 text-left">
                <span className="block text-[14px] font-medium text-[#1C1C1E]">{opt.label}</span>
                <span className="mt-0.5 block truncate text-[11px] text-neutral-400">{opt.worldName}</span>
              </div>
              {opt.povId === currentPovId ? (
                <span className="ml-auto shrink-0 text-[10px] tracking-wide" style={{ color: PULSE_COLORS.dustyRose }}>
                  当前
                </span>
              ) : null}
            </Pressable>
          ))}
        </div>
      </motion.div>
    </>
  )
}

export function PulseProfile({
  displayName,
  avatarUrl,
  stats,
  currentPovId,
  characterId,
  worldName,
  povOptions,
  onSwitchPov,
  onOpenPost,
  onRepostPost,
  onToast,
}: {
  displayName: string
  avatarUrl?: string
  stats: PulseProfileStats
  currentPovId: string
  characterId: string
  worldName: string
  povOptions: PulsePovOption[]
  onSwitchPov: (povId: string) => void
  onOpenPost: (postId: string) => void
  onRepostPost: (postId: string) => void
  onToast: (msg: string) => void
}) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const [tab, setTab] = useState<PulseProfileSegment>('posts')
  const [editorOpen, setEditorOpen] = useState(false)
  const [povOpen, setPovOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [overlay, setOverlay] = useState<ProfileOverlay | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const toggleLike = usePulseStore((s) => s.toggleLike)
  const applyGeneratedProfileBundle = usePulseStore((s) => s.applyGeneratedProfileBundle)

  const { scrollY } = useScroll({ container: scrollRef })
  const coverY = useTransform(scrollY, [0, 180], [0, 48])

  const myPosts = usePulsePostsByAuthor(currentPovId)
  const mediaPosts = usePulseMediaPosts(currentPovId)
  const likedPosts = usePulseLikedPosts(currentPovId)
  const followingList = usePulseFollowingList(currentPovId)

  const likesReceived = useMemo(() => {
    const postSum = myPosts.reduce((sum, p) => sum + p.likeCount, 0)
    if (stats.likesReceived > 0) return stats.likesReceived
    return postSum
  }, [myPosts, stats.likesReceived])

  const listPosts = tab === 'posts' ? myPosts : tab === 'media' ? mediaPosts : likedPosts

  const handleGenerateProfile = useCallback(
    async (postCount: number) => {
      setGenerating(true)
      try {
        const { personaSummary } = await loadPulseCharacterPersonaContext(characterId)
        const bundle = await aiGeneratePulseProfileBundle({
          apiConfig,
          characterName: displayName,
          worldName,
          personaSummary,
          postCount,
        })
        applyGeneratedProfileBundle({
          povId: currentPovId,
          authorName: displayName,
          authorAvatarUrl: avatarUrl,
          bundle,
        })
        setGenerateOpen(false)
        setTab('posts')
        onToast(`已生成 ${bundle.posts.length} 条动态与主页数据`)
      } catch (e) {
        onToast(e instanceof Error ? e.message : '生成失败')
      } finally {
        setGenerating(false)
      }
    },
    [
      apiConfig,
      applyGeneratedProfileBundle,
      avatarUrl,
      characterId,
      currentPovId,
      displayName,
      onToast,
      worldName,
    ],
  )

  return (
    <>
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#FCFCFC] pb-28">
        <div className="relative h-48 overflow-hidden">
          <motion.img
            src={PULSE_DEFAULT_COVER}
            alt=""
            className="absolute inset-0 size-full object-cover"
            style={{ y: coverY, scale: 1.08 }}
            draggable={false}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(180deg, transparent 40%, ${PULSE_COLORS.bg} 100%)`,
            }}
          />
          <Pressable
            type="button"
            onClick={() => setPovOpen(true)}
            className="absolute right-4 top-4 rounded-full bg-white/80 px-3 py-1.5 text-[11px] tracking-wide text-[#1C1C1E] shadow-[0_2px_15px_rgba(0,0,0,0.06)] backdrop-blur-md"
            style={{ boxShadow: `0 0 24px ${PULSE_COLORS.lightGold}33` }}
          >
            <span className="flex items-center gap-1">
              <Sparkles className="size-3" strokeWidth={1.4} style={{ color: PULSE_COLORS.lightGold }} />
              切换世界
            </span>
          </Pressable>
        </div>

        <div className="relative px-4">
          <div className="-mt-11">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="size-[88px] -translate-y-1/2 rounded-full border-4 border-white object-cover shadow-[0_2px_15px_rgba(0,0,0,0.06)]"
              />
            ) : (
              <div className="size-[88px] -translate-y-1/2 rounded-full border-4 border-white bg-[#F5F5F4] shadow-[0_2px_15px_rgba(0,0,0,0.06)]" />
            )}
          </div>

          <div className="-mt-2 flex items-center gap-1">
            <h1 className="text-[20px] font-semibold text-[#1C1C1E]">{displayName}</h1>
            <ShieldCheck className="size-4" style={{ color: PULSE_COLORS.lightGold }} strokeWidth={1.5} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-neutral-600">
            <Pressable type="button" onClick={() => setOverlay({ kind: 'following' })} className="text-left">
              关注{' '}
              <strong className="font-semibold text-[#1C1C1E]">
                <PulseNum>{stats.following > 0 ? stats.following : followingList.length}</PulseNum>
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
              获赞与收藏{' '}
              <strong className="font-semibold text-[#1C1C1E]">
                <PulseNum>{formatPulseCount(likesReceived)}</PulseNum>
              </strong>
            </span>
          </div>

          <div className="mt-3 flex items-start gap-2">
            <p className="flex-1 font-serif text-[13px] italic leading-relaxed text-neutral-400">
              {stats.bio?.trim() || '在脉冲里，每一句话都是一次呼吸。'}
            </p>
            <Pencil className="mt-0.5 size-3.5 shrink-0 text-neutral-300" strokeWidth={1.3} />
          </div>

          <Pressable
            type="button"
            onClick={() => setGenerateOpen(true)}
            disabled={generating}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.04] bg-white py-3 text-[13px] font-medium text-[#1C1C1E] shadow-[0_2px_15px_rgba(0,0,0,0.03)] disabled:opacity-50"
          >
            <Wand2 className="size-4" strokeWidth={1.35} style={{ color: PULSE_COLORS.lightGold }} />
            {generating ? '正在按人设生成…' : '按人设生成主页'}
          </Pressable>

          <div className="mt-5 flex shadow-[0_2px_15px_rgba(0,0,0,0.03)]">
            {PROFILE_TABS.map(({ id, label }) => {
              const active = tab === id
              return (
                <Pressable
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className="relative flex-1 py-3 text-center"
                >
                  <motion.span
                    animate={{ scale: active ? 1 : 0.96, opacity: active ? 1 : 0.5 }}
                    transition={PULSE_TAB_SPRING}
                    className={`text-[14px] ${active ? 'font-semibold text-[#1C1C1E]' : 'text-neutral-400'}`}
                  >
                    {label}
                  </motion.span>
                  {active ? (
                    <motion.span
                      layoutId="pulse-profile-tab"
                      className="absolute inset-x-4 bottom-0 h-[2px] rounded-full"
                      style={{ backgroundColor: PULSE_COLORS.dustyRose }}
                      transition={PULSE_TAB_SPRING}
                    />
                  ) : null}
                </Pressable>
              )
            })}
          </div>

          <div className="mt-4 pb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={PULSE_TAB_SPRING}
              >
                {tab === 'media' && listPosts.length ? (
                  <MediaWaterfall posts={listPosts} onOpen={onOpenPost} />
                ) : listPosts.length ? (
                  <div className="space-y-3">
                    {listPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        currentPovId={currentPovId}
                        onOpen={() => onOpenPost(post.id)}
                        onLike={() => toggleLike(post.id)}
                        onRepost={() => onRepostPost(post.id)}
                        compact
                      />
                    ))}
                  </div>
                ) : (
                  <p className="py-12 text-center text-[13px] text-neutral-400">
                    {tab === 'liked' ? '还没有赞过的动态' : '暂无内容'}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Pressable
        type="button"
        onClick={() => setEditorOpen(true)}
        className="fixed bottom-24 right-4 z-20 rounded-full bg-[#1C1C1E] px-4 py-3 text-[11px] tracking-[0.08em] text-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
      >
        + 写微博
      </Pressable>

      <AnimatePresence>
        {editorOpen ? (
          <PublishEditor
            authorPovId={currentPovId}
            authorName={displayName}
            authorAvatarUrl={avatarUrl}
            onClose={() => setEditorOpen(false)}
            onPublished={() => setEditorOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {povOpen ? (
          <PovSwitcherSheet
            options={povOptions}
            currentPovId={currentPovId}
            onSelect={onSwitchPov}
            onClose={() => setPovOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {generateOpen ? (
          <PulseProfileGenerateSheet
            characterName={displayName}
            worldName={worldName}
            generating={generating}
            onClose={() => setGenerateOpen(false)}
            onGenerate={(count) => void handleGenerateProfile(count)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {overlay && (overlay.kind === 'following' || overlay.kind === 'user') ? (
          <PulseFollowingList
            ownerName={displayName}
            following={followingList.map((u) => enrichFollowingUser(u, povOptions))}
            onBack={() => setOverlay(null)}
            onOpenUser={(user) =>
              setOverlay({ kind: 'user', user: enrichFollowingUser(user, povOptions) })
            }
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {overlay?.kind === 'user' ? (
          <PulseUserProfileView
            user={overlay.user}
            currentPovId={currentPovId}
            onBack={() => setOverlay({ kind: 'following' })}
            onOpenPost={onOpenPost}
            onRepostPost={onRepostPost}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}
