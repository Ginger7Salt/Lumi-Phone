import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { PostCard } from './components/PostCard'
import { PULSE_COLORS, PULSE_TAB_SPRING } from './constants'
import { PublishEditor } from './PublishEditor'
import type { PulseHomeSegment, PulsePost, PulsePovOption } from './pulseTypes'
import { usePulseHomePosts } from './pulseStoreSelectors'
import { usePublishMentionCandidates } from './usePublishMentionCandidates'
import { usePulseVisibilityCandidates } from './usePulseVisibilityCandidates'
import { usePulseStore } from './usePulseStore'

const SEGMENTS: { id: PulseHomeSegment; label: string }[] = [
  { id: 'following', label: '关注' },
  { id: 'recommended', label: '推荐' },
]

export function PulseHomeFeed({
  currentPlayerPovId,
  authorName,
  authorAvatarUrl,
  povOptions,
  onOpenPost,
  onRepostPost,
  onToast,
  coachOpenPublishEditor = false,
}: {
  currentPlayerPovId: string
  authorName: string
  authorAvatarUrl?: string
  povOptions: PulsePovOption[]
  onOpenPost: (postId: string) => void
  onRepostPost: (postId: string) => void
  onToast?: (msg: string) => void
  /** 玩法引导：强制打开发帖页 */
  coachOpenPublishEditor?: boolean
}) {
  const [segment, setSegment] = useState<PulseHomeSegment>('following')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editPost, setEditPost] = useState<PulsePost | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCoachPublishOpen = useRef(false)
  const posts = usePulseHomePosts(segment, currentPlayerPovId)
  const toggleLike = usePulseStore((s) => s.toggleLike)
  const mentionCandidates = usePublishMentionCandidates(currentPlayerPovId, povOptions)
  const visibilityCandidates = usePulseVisibilityCandidates(povOptions)
  const visibilityNameByPovId = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of visibilityCandidates) m.set(c.povId, c.name)
    return m
  }, [visibilityCandidates])

  const editorVisible = editorOpen || Boolean(editPost)

  // 发帖层关掉后清焦点，避免键盘残留影响滑动
  useEffect(() => {
    if (editorVisible) return
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  }, [editorVisible])

  useEffect(() => {
    if (coachOpenPublishEditor && !prevCoachPublishOpen.current) {
      setEditPost(null)
      setEditorOpen(true)
    } else if (!coachOpenPublishEditor && prevCoachPublishOpen.current) {
      setEditorOpen(false)
      setEditPost(null)
    }
    prevCoachPublishOpen.current = coachOpenPublishEditor
  }, [coachOpenPublishEditor])

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-[#FCFCFC]" style={{ minHeight: 0 }}>
        <header className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
          <div className="flex items-center gap-6">
            {SEGMENTS.map(({ id, label }) => {
              const active = segment === id
              return (
                <Pressable key={id} type="button" onClick={() => setSegment(id)} className="relative py-2">
                  <motion.span
                    animate={{ scale: active ? 1 : 0.96, opacity: active ? 1 : 0.55 }}
                    transition={PULSE_TAB_SPRING}
                    className={`text-[16px] ${active ? 'font-semibold text-[#1C1C1E]' : 'text-neutral-400'}`}
                  >
                    {label}
                  </motion.span>
                  {active ? (
                    <motion.span
                      layoutId="pulse-home-seg"
                      className="absolute inset-x-0 -bottom-0.5 mx-auto h-[2px] w-5 rounded-full"
                      style={{ backgroundColor: PULSE_COLORS.dustyRose }}
                      transition={PULSE_TAB_SPRING}
                    />
                  ) : null}
                </Pressable>
              )
            })}
          </div>
          <Pressable
            type="button"
            onClick={() => setEditorOpen(true)}
            className="flex size-9 items-center justify-center rounded-full text-white shadow-[0_2px_14px_rgba(229,152,155,0.35)]"
            style={{ backgroundColor: PULSE_COLORS.dustyRose }}
            aria-label="发布"
            data-pulse-coach="home-publish-btn"
          >
            <Plus className="size-5" strokeWidth={1.5} />
          </Pressable>
        </header>

        <div
          ref={scrollRef}
          className="relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-28 pt-1"
          style={{
            minHeight: 0,
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {posts.length ? (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentPovId={currentPlayerPovId}
                onOpen={() => onOpenPost(post.id)}
                onLike={() => toggleLike(post.id)}
                onRepost={() => onRepostPost(post.id)}
                onEdit={(p) => setEditPost(p)}
                visibilityNameByPovId={visibilityNameByPovId}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
              <p className="font-serif text-[15px] text-neutral-500">
                {segment === 'following' ? '关注流尚空' : '推荐流尚空'}
              </p>
              <p className="mt-2 text-[12px] text-neutral-400">
                {segment === 'following'
                  ? '这里只显示你关注的博主动态'
                  : '点击右上角发布，或去发现页演化热搜'}
              </p>
            </div>
          )}
        </div>
      </div>

      {editorVisible ? (
        <PublishEditor
          authorPovId={currentPlayerPovId}
          authorName={authorName}
          authorAvatarUrl={authorAvatarUrl}
          mentionCandidates={mentionCandidates}
          visibilityCandidates={visibilityCandidates}
          editPost={editPost}
          suppressAutoFocus={coachOpenPublishEditor}
          onClose={() => {
            setEditorOpen(false)
            setEditPost(null)
          }}
          onPublished={() => {
            setEditorOpen(false)
            setEditPost(null)
          }}
          onToast={onToast}
        />
      ) : null}
    </>
  )
}
