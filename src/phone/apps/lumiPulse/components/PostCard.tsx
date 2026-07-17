import { AnimatePresence, motion } from 'framer-motion'
import { Heart, ImageIcon, Loader2, Lock, MapPin, MessageCircle, Repeat2, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { MomentImageViewer } from '../../../../components/moments/MomentImageViewer'
import { Pressable } from '../../../components/Pressable'
import { PULSE_CARD_SHADOW, PULSE_COLORS, PULSE_LIKE_SPRING } from '../constants'
import { PulseNum, PulseNumericText } from './PulseNum'
import {
  isPulseNetizenAuthor,
  pickStablePulseNetizenAvatarPath,
  resolvePulseAuthorAvatarUrl,
} from '../pulseNetizenAvatar'
import type { PulsePost, PulsePostImageSlot } from '../pulseTypes'
import { formatPulseCount, pulsePostImageSlots } from '../pulseTypes'
import { contentHasLeadingTopicHashtag, ensureTrendingTopicPrefix } from '../pulseMentionDetect'
import { generatePulsePostSlotImage } from '../pulsePostImageGen'
import { formatPulsePostVisibilityLabel } from '../pulsePostVisibility'
import { formatPulseFeedTime } from '../pulseTimeFormat'
import { usePulseTrendingTopics } from '../pulseStoreSelectors'
import { usePulseStore } from '../usePulseStore'
import { PostOwnerMenu } from './PostOwnerMenu'
import { PulseWeiboFaceText } from './PulseWeiboFaceText'
import { PulseVerifiedAvatar } from './PulseVerifiedAvatar'

const LINE_CLAMP = 5

function PostImageGenConfirm({
  slot,
  onClose,
  onConfirm,
}: {
  slot: PulsePostImageSlot
  onClose: () => void
  onConfirm: () => void
}) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1400] bg-black/25 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-label="关闭"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }}
      />
      <div className="pointer-events-none fixed inset-0 z-[1410] flex items-center justify-center px-4">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="生成配图"
          className="pointer-events-auto w-full max-w-md rounded-[24px] bg-white/96 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" style={{ color: PULSE_COLORS.lightGold }} strokeWidth={1.5} />
              <p className="text-[14px] font-medium text-[#1C1C1E]">生成配图</p>
            </div>
            <Pressable
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClose()
              }}
              className="flex size-9 items-center justify-center rounded-full text-neutral-400"
              aria-label="关闭"
            >
              <X className="size-5" strokeWidth={1.5} />
            </Pressable>
          </div>
          <p className="text-[12px] leading-relaxed text-neutral-500">帖子画面描述：</p>
          <p className="mt-2 max-h-40 overflow-y-auto rounded-2xl bg-[#F8F7F5] px-3.5 py-3 font-serif text-[13px] leading-relaxed text-[#1C1C1E]">
            {slot.description || '（无描述）'}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
            点确认后面板可立即关闭；配图格会显示「生成中」，多张可同时排队生图。
          </p>
          <Pressable
            type="button"
            disabled={!slot.description.trim()}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onConfirm()
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: PULSE_COLORS.dustyRose }}
          >
            确认生成
          </Pressable>
        </motion.div>
      </div>
    </>,
    document.body,
  )
}

function PostImageSlotGrid({
  postId,
  slots,
  postContent,
}: {
  postId: string
  slots: PulsePostImageSlot[]
  postContent?: string
}) {
  const patchPostImageSlot = usePulseStore((s) => s.patchPostImageSlot)
  const worldPovId = usePulseStore((s) => s.currentPOVId)
  const playerPovId = usePulseStore((s) => s.currentPlayerPovId)
  const visible = slots.slice(0, 9)
  const cols = visible.length === 1 ? 1 : visible.length <= 4 ? 2 : 3
  const [pending, setPending] = useState<PulsePostImageSlot | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerImages, setViewerImages] = useState<string[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)
  /** 同槽位防重复请求；不同槽位可并行（进程内，刷新后失效） */
  const inFlightSlotIdsRef = useRef(new Set<string>())
  const [viewerRegenBusy, setViewerRegenBusy] = useState(false)

  const readySlots = useMemo(
    () => visible.filter((s) => Boolean(s.url?.trim())),
    [visible],
  )
  const readyUrls = useMemo(() => readySlots.map((s) => s.url!.trim()), [readySlots])
  const readyPrompts = useMemo(
    () => readySlots.map((s) => (s.imagePrompt || s.description || '').trim()),
    [readySlots],
  )
  /** 本地上传图无画面描述/提示词；仅 AI 配图槽可重新生成与改提示词 */
  const readyRegenFlags = useMemo(
    () => readySlots.map((s) => Boolean((s.imagePrompt || s.description || '').trim())),
    [readySlots],
  )
  const allowImageRegen = readyRegenFlags.some(Boolean)

  /** 刷新后残留的 generating 无真实任务，清掉以免永久转圈 */
  useEffect(() => {
    for (const slot of slots) {
      if (slot.status !== 'generating') continue
      if (inFlightSlotIdsRef.current.has(slot.id)) continue
      patchPostImageSlot(postId, slot.id, {
        status: slot.url?.trim() ? 'idle' : 'failed',
      })
    }
  }, [postId, slots, patchPostImageSlot])

  const openViewer = (url: string) => {
    const index = readyUrls.indexOf(url)
    if (index < 0) return
    setViewerImages(readyUrls)
    setViewerIndex(index)
    setViewerOpen(true)
  }

  const runGenerate = (slot: PulsePostImageSlot) => {
    if (!slot.description.trim()) return
    if (inFlightSlotIdsRef.current.has(slot.id)) return
    inFlightSlotIdsRef.current.add(slot.id)
    setPending(null)
    patchPostImageSlot(postId, slot.id, { status: 'generating' })
    void (async () => {
      try {
        const { dataUrl, imagePrompt } = await generatePulsePostSlotImage({
          description: slot.description,
          postContent,
          worldOrCharacterPovId: worldPovId,
          playerPovId,
        })
        patchPostImageSlot(postId, slot.id, {
          url: dataUrl,
          status: 'idle',
          imagePrompt,
        })
      } catch {
        patchPostImageSlot(postId, slot.id, { status: 'failed' })
      } finally {
        inFlightSlotIdsRef.current.delete(slot.id)
      }
    })()
  }

  const regenerateReadySlot = async (viewerIndex: number, prompt: string) => {
    const slot = readySlots[viewerIndex]
    if (!slot) throw new Error('未找到配图')
    if (inFlightSlotIdsRef.current.has(slot.id)) {
      throw new Error('该图正在生成中')
    }
    inFlightSlotIdsRef.current.add(slot.id)
    setViewerRegenBusy(true)
    patchPostImageSlot(postId, slot.id, { status: 'generating', imagePrompt: prompt })
    try {
      const { dataUrl, imagePrompt } = await generatePulsePostSlotImage({
        description: slot.description || prompt,
        postContent,
        worldOrCharacterPovId: worldPovId,
        playerPovId,
        imagePromptOverride: prompt,
      })
      patchPostImageSlot(postId, slot.id, {
        url: dataUrl,
        status: 'idle',
        imagePrompt,
      })
      setViewerImages((prev) => {
        const next = [...prev]
        next[viewerIndex] = dataUrl
        return next
      })
    } catch (e) {
      patchPostImageSlot(postId, slot.id, { status: 'failed', imagePrompt: prompt })
      throw e
    } finally {
      inFlightSlotIdsRef.current.delete(slot.id)
      setViewerRegenBusy(false)
    }
  }

  const saveReadySlotPrompt = (viewerIndex: number, prompt: string) => {
    const slot = readySlots[viewerIndex]
    if (!slot) return
    patchPostImageSlot(postId, slot.id, { imagePrompt: prompt })
  }

  return (
    <>
      <div
        className="mt-3 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {visible.map((slot) => {
          const busy = slot.status === 'generating'
          if (slot.url) {
            return (
              <button
                key={slot.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  openViewer(slot.url!)
                }}
                className="relative aspect-square overflow-hidden rounded-xl bg-[#F5F5F4]"
                aria-label="放大查看图片"
              >
                <img src={slot.url} alt="" className="size-full object-cover" draggable={false} />
                {busy ? (
                  <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-black/25">
                    <Loader2 className="size-6 animate-spin text-white" strokeWidth={1.6} />
                  </div>
                ) : null}
              </button>
            )
          }
          return (
            <button
              key={slot.id}
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setPending(slot)
              }}
              className={`relative aspect-square overflow-hidden rounded-xl border border-dashed p-2 text-left transition-colors disabled:opacity-100 ${
                busy
                  ? 'border-[#E8C9A8]/60 bg-[#FBF6F0]'
                  : 'border-black/[0.08] bg-[#F8F7F5]'
              }`}
              aria-busy={busy}
              aria-label={busy ? '配图生成中' : slot.status === 'failed' ? '生成失败，点侧重试' : '点按生成配图'}
            >
              <div
                className={`absolute inset-x-2 top-2 z-[1] flex items-center gap-1 text-[10px] ${
                  busy ? 'text-[#B8956C]' : 'text-neutral-400'
                }`}
              >
                {busy ? (
                  <Loader2 className="size-3 animate-spin" strokeWidth={1.6} />
                ) : (
                  <ImageIcon className="size-3" strokeWidth={1.5} />
                )}
                <span>{busy ? '生成中…' : slot.status === 'failed' ? '失败·点侧重试' : '点按生成'}</span>
              </div>
              <div className="flex size-full items-center justify-center px-1.5 pb-1 pt-6">
                <p
                  className={`line-clamp-5 text-center font-serif text-[11px] leading-snug ${
                    busy ? 'text-[#9A8B78]' : 'text-[#3A3A3C]'
                  }`}
                >
                  {slot.description || '配图占位'}
                </p>
              </div>
              {busy ? (
                <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-[#FBF6F0]/55 backdrop-blur-[1px]">
                  <div className="flex flex-col items-center gap-1.5">
                    <Loader2
                      className="size-6 animate-spin"
                      style={{ color: PULSE_COLORS.dustyRose }}
                      strokeWidth={1.6}
                    />
                    <span className="text-[11px] font-medium text-[#8A6A4A]">正在生成</span>
                  </div>
                </div>
              ) : null}
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {pending ? (
          <PostImageGenConfirm
            slot={pending}
            onClose={() => setPending(null)}
            onConfirm={() => runGenerate(pending)}
          />
        ) : null}
      </AnimatePresence>

      <MomentImageViewer
        open={viewerOpen}
        images={viewerImages}
        initialIndex={viewerIndex}
        prompts={readyPrompts}
        allowImageRegen={allowImageRegen}
        regenEnabledByIndex={readyRegenFlags}
        regenTheme="pulse"
        regenerating={viewerRegenBusy}
        onClose={() => setViewerOpen(false)}
        onRegenerate={
          allowImageRegen ? (i, prompt) => regenerateReadySlot(i, prompt) : undefined
        }
        onSavePrompt={
          allowImageRegen ? (i, prompt) => saveReadySlotPrompt(i, prompt) : undefined
        }
      />
    </>
  )
}

export function PostCard({
  post,
  currentPovId,
  onOpen,
  onLike,
  onRepost,
  compact = false,
  onEdit,
  visibilityNameByPovId,
}: {
  post: PulsePost
  currentPovId: string
  onOpen: () => void
  onLike: () => void
  onRepost: () => void
  compact?: boolean
  /** 本人帖：编辑回调（提供后显示管理菜单） */
  onEdit?: (post: PulsePost) => void
  /** 部分可见时展示角色名 */
  visibilityNameByPovId?: ReadonlyMap<string, string> | Record<string, string>
}) {
  const liked = post.likedByPovIds.includes(currentPovId)
  const isOwner = Boolean(currentPovId) && post.authorPovId.trim() === currentPovId.trim()
  const deletePost = usePulseStore((s) => s.deletePost)
  const [expanded, setExpanded] = useState(false)
  const imageSlots = useMemo(() => pulsePostImageSlots(post), [post])
  const trending = usePulseTrendingTopics()
  const displayContent = useMemo(() => {
    const raw = post.content || ''
    if (!post.trendingTopicId) return raw
    const topic = trending.find((t) => t.id === post.trendingTopicId)
    if (!topic?.title) return raw
    if (contentHasLeadingTopicHashtag(raw, topic.title)) return raw
    return ensureTrendingTopicPrefix(raw, topic.title)
  }, [post.content, post.trendingTopicId, trending])
  const showText = Boolean(displayContent.trim())
  const visibilityLabel = useMemo(
    () => (isOwner ? formatPulsePostVisibilityLabel(post, visibilityNameByPovId) : null),
    [isOwner, post, visibilityNameByPovId],
  )

  const authorAvatarSrc = useMemo(() => {
    const stored = resolvePulseAuthorAvatarUrl(post.authorAvatarUrl)
    if (stored) return stored
    if (!isPulseNetizenAuthor(post.authorPovId, post.isAiGenerated)) return undefined
    return resolvePulseAuthorAvatarUrl(
      pickStablePulseNetizenAvatarPath(post.authorPovId.trim() || post.authorName),
    )
  }, [post.authorAvatarUrl, post.authorName, post.authorPovId, post.isAiGenerated])

  const { preview, needsClamp } = useMemo(() => {
    const text = displayContent
    const lines = text.split('\n')
    if (lines.length <= LINE_CLAMP && text.length < 180) {
      return { preview: text, needsClamp: false }
    }
    const clipped = lines.slice(0, LINE_CLAMP).join('\n')
    return { preview: clipped, needsClamp: true }
  }, [displayContent])

  return (
    <motion.article
      className={`bg-white px-4 py-4 ${compact ? '' : 'mb-3'} ${PULSE_CARD_SHADOW} rounded-2xl`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="flex items-center gap-3">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <PulseVerifiedAvatar
            src={authorAvatarSrc || post.authorAvatarUrl}
            verified={Boolean(post.verified)}
            sizeClass="size-11"
            borderClass="ring-1 ring-black/[0.04]"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-[#1C1C1E]">{post.authorName}</p>
            <p className="text-[11px] text-neutral-400">
              <PulseNumericText text={formatPulseFeedTime(post.createdAt)} />
              {post.updatedAt && post.updatedAt > post.createdAt + 1000 ? (
                <span className="ml-1.5 text-neutral-300">已编辑</span>
              ) : null}
            </p>
          </div>
        </button>
        {isOwner && onEdit ? (
          <PostOwnerMenu
            onEdit={() => onEdit(post)}
            onDelete={() => {
              deletePost(post.id)
            }}
          />
        ) : null}
      </header>

      <button type="button" onClick={onOpen} className="block w-full text-left">

        {showText ? (
          <div className="mt-3">
            <PulseWeiboFaceText
              text={
                expanded || !needsClamp
                  ? displayContent
                  : preview + (needsClamp && !expanded ? '…' : '')
              }
              className="font-serif text-[15px] leading-relaxed tracking-[0.01em] text-[#1C1C1E]"
            />
            {needsClamp && !expanded ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setExpanded(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    setExpanded(true)
                  }
                }}
                className="mt-1 inline-block text-[13px] font-medium"
                style={{ color: PULSE_COLORS.mistBlue }}
              >
                全文
              </span>
            ) : null}
          </div>
        ) : null}

      </button>

      {/* 配图区放在开帖按钮外，避免嵌套 button 导致弹窗无法关闭 */}
      {imageSlots.length ? (
        <PostImageSlotGrid postId={post.id} slots={imageSlots} postContent={displayContent} />
      ) : null}

      {/* 位置：配图下方、互动栏上方 */}
      {post.locationLabel ? (
        <div className="mt-2.5 flex items-center gap-1 px-0.5 text-[11px] text-neutral-400">
          <MapPin className="size-3 shrink-0" strokeWidth={1.5} />
          <span>{post.locationLabel}</span>
        </div>
      ) : null}

      {visibilityLabel ? (
        <div className="mt-2 flex items-center gap-1 px-0.5 text-[11px] text-neutral-400">
          <Lock className="size-3 shrink-0" strokeWidth={1.5} />
          <span>{visibilityLabel}</span>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between px-1 text-neutral-400">
        <Pressable
          type="button"
          onClick={onRepost}
          className="flex items-center gap-1.5 text-[12px] tracking-wide"
          aria-label="转发"
        >
          <Repeat2 className="size-[16px]" strokeWidth={1.3} />
          <PulseNum>{post.repostCount ? formatPulseCount(post.repostCount) : ''}</PulseNum>
        </Pressable>
        <Pressable
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1.5 text-[12px] tracking-wide"
        >
          <MessageCircle className="size-[16px]" strokeWidth={1.3} />
          <PulseNum>{post.commentCount ? formatPulseCount(post.commentCount) : ''}</PulseNum>
        </Pressable>
        <Pressable type="button" onClick={onLike} className="flex items-center gap-1.5 text-[12px] tracking-wide">
          <motion.span
            key={liked ? 'on' : 'off'}
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={PULSE_LIKE_SPRING}
          >
            <Heart
              className="size-[16px]"
              strokeWidth={1.3}
              fill={liked ? PULSE_COLORS.dustyRose : 'none'}
              style={{ color: liked ? PULSE_COLORS.dustyRose : 'currentColor' }}
            />
          </motion.span>
          <PulseNum style={liked ? { color: PULSE_COLORS.dustyRose } : undefined}>
            {post.likeCount ? formatPulseCount(post.likeCount) : ''}
          </PulseNum>
        </Pressable>
      </div>
    </motion.article>
  )
}
