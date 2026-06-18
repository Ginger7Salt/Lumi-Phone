import { motion } from 'framer-motion'
import { Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { FavoriteItem } from './favoriteItemTypes'
import {
  formatFavoriteRelativeTime,
  formatVoiceDuration,
  truncateTranscriptPreview,
} from './mapFavoriteToItem'
import {
  getFavoriteAudioPlayingId,
  playFavoriteAudio,
  subscribeFavoriteAudio,
} from './favoriteAudioController'
import { FavoriteCardFooter, FavoriteCardSource } from './FavoritesDiscoveryHeader'

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
  },
}

function WaveBars({ playing }: { playing: boolean }) {
  return (
    <div className="flex h-4 flex-1 items-center justify-center gap-[3px] px-2">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <motion.span
          key={i}
          className="w-[2px] rounded-full bg-gray-400"
          animate={
            playing
              ? { height: [4, 14, 6, 16, 5, 12, 4], opacity: [0.45, 1, 0.6, 1, 0.5, 0.9, 0.45] }
              : { height: 4, opacity: 0.35 }
          }
          transition={
            playing
              ? { duration: 1.1, repeat: Infinity, delay: i * 0.08, ease: 'easeInOut' }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  )
}

function TextQuoteCard({
  item,
  onShare,
  onOpenActions,
  variant,
}: {
  item: Extract<FavoriteItem, { type: 'text' }>
  onShare: () => void
  onOpenActions?: () => void
  variant: 'page' | 'picker'
}) {
  return (
    <>
      <FavoriteCardSource name={item.sourceName} avatarUrl={item.sourceAvatarUrl} />
      <div className="relative">
        <span
          className="pointer-events-none absolute -left-1 -top-3 select-none font-serif text-[88px] leading-none text-gray-900/[0.05]"
          aria-hidden
        >
          “
        </span>
        <p
          className="relative font-serif text-[16px] leading-loose text-gray-900"
          style={{ fontFamily: 'var(--wx-font, "Noto Serif SC", serif)' }}
        >
          {item.content}
        </p>
      </div>
      <FavoriteCardFooter
        timestamp={item.timestamp}
        savedAt={item.savedAt}
        tags={item.tags}
        onShare={onShare}
        onOpenActions={onOpenActions}
        shareAriaLabel={variant === 'picker' ? '发送到当前聊天' : '分享'}
        showMoreActions={variant === 'page'}
      />
    </>
  )
}

function VoiceCard({
  item,
  onShare,
  onOpenActions,
  variant,
}: {
  item: Extract<FavoriteItem, { type: 'voice' }>
  onShare: () => void
  onOpenActions?: () => void
  variant: 'page' | 'picker'
}) {
  const [playingId, setPlayingId] = useState<string | null>(() => getFavoriteAudioPlayingId())
  const playing = playingId === item.id

  useEffect(() => subscribeFavoriteAudio(() => setPlayingId(getFavoriteAudioPlayingId())), [])

  const preview = truncateTranscriptPreview(item.transcript)

  return (
    <>
      <FavoriteCardSource name={item.sourceName} avatarUrl={item.sourceAvatarUrl} />
      <button
        type="button"
        disabled={!item.audioUrl}
        onClick={() => {
          if (item.audioUrl) playFavoriteAudio(item.id, item.audioUrl)
        }}
        className="flex w-full items-center rounded-full bg-gray-50 px-4 py-3 text-left disabled:opacity-45"
      >
        <span className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-gray-800 shadow-sm">
          {playing ? (
            <Pause className="size-3.5" strokeWidth={2} fill="currentColor" />
          ) : (
            <Play className="ml-0.5 size-3.5" strokeWidth={2} fill="currentColor" />
          )}
        </span>
        <WaveBars playing={playing} />
        <span className="ml-2 shrink-0 text-[12px] tracking-wider text-gray-600">
          <ListenNumericText text={`[ ${formatVoiceDuration(item.duration)} ]`} />
        </span>
      </button>
      {preview ? (
        <p className="mt-2 text-[11px] italic leading-relaxed text-gray-400">{preview}</p>
      ) : null}
      <FavoriteCardFooter
        timestamp={item.timestamp}
        savedAt={item.savedAt}
        tags={item.tags}
        onShare={onShare}
        onOpenActions={onOpenActions}
        shareAriaLabel={variant === 'picker' ? '发送到当前聊天' : '分享'}
        showMoreActions={variant === 'page'}
      />
    </>
  )
}

function ImageCard({
  item,
  onShare,
  onOpenActions,
  variant,
}: {
  item: Extract<FavoriteItem, { type: 'image' }>
  onShare: () => void
  onOpenActions?: () => void
  variant: 'page' | 'picker'
}) {
  const urls = item.imageUrls
  const multi = urls.length > 1

  return (
    <>
      <FavoriteCardSource name={item.sourceName} avatarUrl={item.sourceAvatarUrl} />
      <div
        className={
          multi
            ? 'grid grid-cols-2 gap-1 overflow-hidden rounded-2xl'
            : 'overflow-hidden rounded-2xl shadow-[inset_0_0_24px_rgba(0,0,0,0.06)]'
        }
      >
        {urls.slice(0, 4).map((url, idx) => (
          <div
            key={`${item.id}-${idx}`}
            className={`relative overflow-hidden bg-gray-100 ${
              multi ? 'aspect-square shadow-[inset_0_0_18px_rgba(0,0,0,0.05)]' : 'aspect-[4/5]'
            }`}
          >
            <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>
      <FavoriteCardFooter
        timestamp={item.timestamp}
        savedAt={item.savedAt}
        tags={item.tags}
        onShare={onShare}
        onOpenActions={onOpenActions}
        shareAriaLabel={variant === 'picker' ? '发送到当前聊天' : '分享'}
        showMoreActions={variant === 'page'}
      />
    </>
  )
}

function FavoriteCard({
  item,
  onShare,
  onOpenActions,
  variant,
}: {
  item: FavoriteItem
  onShare: () => void
  onOpenActions?: () => void
  variant: 'page' | 'picker'
}) {
  return (
    <motion.article
      variants={cardVariants}
      className="mb-4 rounded-[24px] bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
    >
      {item.type === 'text' ? (
        <TextQuoteCard item={item} onShare={onShare} onOpenActions={onOpenActions} variant={variant} />
      ) : item.type === 'voice' ? (
        <VoiceCard item={item} onShare={onShare} onOpenActions={onOpenActions} variant={variant} />
      ) : (
        <ImageCard item={item} onShare={onShare} onOpenActions={onOpenActions} variant={variant} />
      )}
    </motion.article>
  )
}

export function FavoritesStream({
  items,
  onShare,
  onOpenActions,
  variant = 'page',
}: {
  items: FavoriteItem[]
  onShare: (item: FavoriteItem) => void
  onOpenActions?: (item: FavoriteItem) => void
  variant?: 'page' | 'picker'
}) {
  if (!items.length) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="font-serif text-[15px] text-gray-400">暂无收藏切片</p>
        <p className="mt-2 text-[12px] text-gray-300">在聊天中长按消息即可收藏</p>
      </div>
    )
  }

  return (
    <motion.div
      className="px-4 pb-10 pt-1"
      variants={listVariants}
      initial="hidden"
      animate="show"
    >
      {items.map((item) => (
        <FavoriteCard
          key={item.id}
          item={item}
          variant={variant}
          onShare={() => onShare(item)}
          onOpenActions={onOpenActions ? () => onOpenActions(item) : undefined}
        />
      ))}
    </motion.div>
  )
}

export { formatFavoriteRelativeTime }
