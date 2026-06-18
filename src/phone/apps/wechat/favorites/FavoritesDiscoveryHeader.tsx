import { Forward, MoreHorizontal, Search } from 'lucide-react'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { FavoriteFilterId } from './favoriteItemTypes'
import { FAVORITE_FILTER_OPTIONS } from './favoriteItemTypes'
import { formatFavoriteRelativeTime, formatFavoriteSavedAt } from './mapFavoriteToItem'
import { DEFAULT_PUBLIC_AVATAR_URL } from '../../../types'
import { resolveCharacterAvatarUrl } from '../../../utils/characterAvatarUrl'

export function FavoritesDiscoveryHeader({
  search,
  onSearchChange,
  filter,
  onFilterChange,
}: {
  search: string
  onSearchChange: (v: string) => void
  filter: FavoriteFilterId
  onFilterChange: (id: FavoriteFilterId) => void
}) {
  return (
    <div className="sticky top-0 z-10 bg-[#F9FAFB] px-4 pb-3 pt-2">
      <label className="relative block">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-400"
          strokeWidth={1.5}
          aria-hidden
        />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索记忆切片 (Search archives)..."
          className="w-full rounded-2xl bg-white py-3 pl-11 pr-4 text-[14px] text-gray-900 shadow-sm outline-none placeholder:italic placeholder:text-gray-400"
          spellCheck={false}
        />
      </label>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {FAVORITE_FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onFilterChange(opt.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-medium tracking-wide transition-colors ${
                active ? 'bg-gray-900 text-white' : 'bg-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {opt.label}
              <span className="ml-1 text-[10px] font-normal opacity-70">({opt.en})</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function FavoriteCardSource({
  name,
  avatarUrl,
}: {
  name: string
  avatarUrl?: string
}) {
  const src =
    resolveCharacterAvatarUrl({ avatarUrl }) || DEFAULT_PUBLIC_AVATAR_URL

  return (
    <div className="mb-3 flex items-center gap-2.5">
      <img
        src={src}
        alt=""
        className="size-8 shrink-0 rounded-full bg-gray-100 object-cover ring-1 ring-gray-100"
        loading="lazy"
      />
      <span className="truncate text-[13px] font-medium tracking-wide text-gray-800">{name}</span>
    </div>
  )
}

export function FavoriteCardFooter({
  timestamp,
  savedAt,
  tags,
  onShare,
  onOpenActions,
  shareAriaLabel = '分享',
  showMoreActions = true,
}: {
  timestamp: number
  savedAt: number
  tags?: string[]
  onShare: () => void
  onOpenActions?: () => void
  shareAriaLabel?: string
  showMoreActions?: boolean
}) {
  return (
    <div className="mt-3 flex items-end justify-between border-t border-dashed border-gray-100 pt-3">
      <div className="min-w-0 flex flex-col gap-0.5">
        <span className="text-[11px] text-gray-500">
          收藏 · <ListenNumericText text={formatFavoriteSavedAt(savedAt)} />
        </span>
        <span className="text-[10px] text-gray-300">
          对话 · <ListenNumericText text={formatFavoriteRelativeTime(timestamp)} />
        </span>
      </div>
      <div className="flex items-center gap-2">
        {tags?.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-gray-50 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-gray-500"
          >
            {tag}
          </span>
        ))}
        <button
          type="button"
          aria-label={shareAriaLabel}
          onClick={onShare}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <Forward className="size-3.5" strokeWidth={1.5} />
        </button>
        {showMoreActions && onOpenActions ? (
          <button
            type="button"
            aria-label="更多操作"
            onClick={onOpenActions}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <MoreHorizontal className="size-4" strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
