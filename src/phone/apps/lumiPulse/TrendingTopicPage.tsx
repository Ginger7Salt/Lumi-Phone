import { motion, type PanInfo } from 'framer-motion'
import { useMemo } from 'react'

import { Pressable } from '../../components/Pressable'
import { PostCard } from './components/PostCard'
import { PulseNum } from './components/PulseNum'
import { PulseWeiboFaceText } from './components/PulseWeiboFaceText'
import { PULSE_COLORS, PULSE_SHEET_SPRING } from './constants'
import type { PulseComment, PulsePost, PulseTrendingTag, PulseTrendingTopic } from './pulseTypes'
import { inventHeatLabel } from './parseTrendingMarkup'
import { usePulseDiscoverPosts, usePulsePostComments } from './pulseStoreSelectors'
import { usePulseStore } from './usePulseStore'

function tagAccent(tag?: PulseTrendingTag): { bg: string; badge: string } {
  if (tag === '爆') {
    return { bg: 'bg-rose-900/[0.10]', badge: 'bg-[#D4AF37] text-white' }
  }
  if (tag === '热') {
    return { bg: 'bg-[#E5989B]/15', badge: 'bg-[#E5989B] text-white' }
  }
  if (tag === '新') {
    return { bg: 'bg-[#A3C4BC]/18', badge: 'bg-[#A3C4BC] text-white' }
  }
  return { bg: 'bg-neutral-100/80', badge: 'bg-neutral-200 text-neutral-600' }
}

function TopicFeedSkeleton() {
  return (
    <div className="space-y-4 px-4 pb-28 pt-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-black/[0.03] bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="size-10 animate-pulse rounded-full bg-neutral-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 animate-pulse rounded-full bg-neutral-100" />
              <div className="h-2.5 w-16 animate-pulse rounded-full bg-neutral-50" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full animate-pulse rounded-full bg-neutral-100" />
            <div className="h-3 w-[92%] animate-pulse rounded-full bg-neutral-100" />
            <div className="h-3 w-[70%] animate-pulse rounded-full bg-neutral-50" />
          </div>
          <div className="mt-4 h-16 animate-pulse rounded-xl bg-neutral-50" />
        </div>
      ))}
    </div>
  )
}

function PreviewComments({ postId }: { postId: string }) {
  const comments = usePulsePostComments(postId)
  const top = useMemo(() => comments.slice(0, 2), [comments])
  if (!top.length) return null
  return (
    <div className="mx-1 mt-3 space-y-2.5 rounded-xl bg-[#F8F8F7] px-3 py-2.5">
      {top.map((c: PulseComment) => (
        <p key={c.id} className="text-[12px] leading-relaxed text-neutral-600">
          <span className="font-medium text-[#1C1C1E]">{c.authorName}</span>
          <span className="mx-1.5 text-neutral-300">·</span>
          <PulseWeiboFaceText text={c.content} className="font-serif" />
        </p>
      ))}
      {comments.length > 2 ? (
        <p className="text-[11px] text-neutral-400">查看全部 {comments.length} 条评论</p>
      ) : null}
    </div>
  )
}

export function TrendingTopicPage({
  topic,
  currentPlayerPovId,
  loading = false,
  onBack,
  onOpenPost,
  onRepostPost,
}: {
  topic: PulseTrendingTopic
  currentPlayerPovId: string
  loading?: boolean
  onBack: () => void
  onOpenPost: (postId: string) => void
  onRepostPost: (postId: string) => void
}) {
  const allPosts = usePulseDiscoverPosts()
  const toggleLike = usePulseStore((s) => s.toggleLike)
  const posts = useMemo(
    () => allPosts.filter((p) => p.trendingTopicId === topic.id).sort((a, b) => b.likeCount - a.likeCount),
    [allPosts, topic.id],
  )
  const accent = tagAccent(topic.tag)
  const heat = topic.heatLabel || inventHeatLabel(topic.rank, topic.tag)

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 88 || info.velocity.x > 520) onBack()
  }

  return (
    <motion.div
      className="absolute inset-0 z-[70] flex min-h-0 flex-col bg-[#FCFCFC]"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={PULSE_SHEET_SPRING}
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 320 }}
      dragElastic={0.12}
      onDragEnd={handleDragEnd}
      style={{ touchAction: 'pan-y' }}
    >
      <header
        className="relative z-20 grid shrink-0 grid-cols-[36px_1fr_36px] items-center px-3 pb-1.5 backdrop-blur-xl"
        style={{
          paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
          backgroundColor: 'rgba(252,252,252,0.72)',
        }}
      >
        <Pressable
          type="button"
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-full text-[#1C1C1E]/70"
          aria-label="返回热搜榜"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 6L8 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Pressable>
        <p className="truncate text-center text-[16px] font-semibold tracking-[0.02em] text-[#1C1C1E]">热搜</p>
        <div aria-hidden className="size-9" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <section className={`relative px-5 pb-6 pt-5 ${accent.bg}`}>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${PULSE_COLORS.bg} 100%)`,
            }}
          />
          <div className="relative flex items-start gap-3">
            <h1 className="min-w-0 flex-1 text-[26px] font-bold leading-snug tracking-tight text-[#1C1C1E]">
              {topic.title}
            </h1>
            <div className="mt-1 flex shrink-0 flex-col items-end gap-1.5">
              {topic.tag ? (
                <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${accent.badge}`}>
                  {topic.tag}
                </span>
              ) : null}
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-neutral-500 shadow-sm">
                热度 <PulseNum>{heat}</PulseNum>
              </span>
            </div>
          </div>
          {topic.excerpt ? (
            <p className="relative mt-4 font-serif text-[15px] leading-relaxed text-neutral-600">
              <PulseWeiboFaceText text={topic.excerpt} />
            </p>
          ) : null}
        </section>

        {loading ? (
          <TopicFeedSkeleton />
        ) : posts.length ? (
          <div className="space-y-4 px-4 pb-28 pt-1">
            {posts.map((post: PulsePost) => (
              <div key={post.id}>
                <PostCard
                  post={post}
                  currentPovId={currentPlayerPovId}
                  onOpen={() => onOpenPost(post.id)}
                  onLike={() => toggleLike(post.id)}
                  onRepost={() => onRepostPost(post.id)}
                />
                <Pressable type="button" onClick={() => onOpenPost(post.id)} className="block w-full text-left">
                  <PreviewComments postId={post.id} />
                </Pressable>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
            <p className="font-serif text-[14px] text-neutral-500">舆论尚未涌入这条热搜</p>
            <p className="mt-2 text-[12px] text-neutral-400">返回榜单重新「演化新的热搜」，即可生成讨论帖</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
