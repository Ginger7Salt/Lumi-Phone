import { Play } from 'lucide-react'
import { useState } from 'react'

import { MOMENT_MUSIC_DEFAULT_COVER, type MomentAttachedMusic } from './momentAttachedMusic'

type MomentMusicCapsuleProps = {
  music: MomentAttachedMusic
  onPlay?: () => void
  className?: string
}

export function MomentMusicCapsule({ music, onPlay, className = '' }: MomentMusicCapsuleProps) {
  const [coverSrc, setCoverSrc] = useState(music.cover || MOMENT_MUSIC_DEFAULT_COVER)

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-stone-100 bg-stone-50/80 p-2.5 ${className}`}
    >
      <div className="relative h-12 w-12 shrink-0">
        <div className="h-12 w-12 overflow-hidden rounded-lg shadow-sm ring-1 ring-stone-200/60">
          <img
            src={coverSrc}
            alt=""
            className="h-full w-full object-cover"
            onError={() => {
              if (coverSrc !== MOMENT_MUSIC_DEFAULT_COVER) {
                setCoverSrc(MOMENT_MUSIC_DEFAULT_COVER)
              }
            }}
          />
        </div>
        <div
          className="pointer-events-none absolute -right-0.5 top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-sm bg-stone-300/90 shadow-sm"
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-stone-800">{music.title}</p>
        <p className="truncate text-[11px] font-normal text-stone-400">{music.artist}</p>
      </div>
      {onPlay ? (
        <button
          type="button"
          aria-label={`播放 ${music.title}`}
          onClick={(e) => {
            e.stopPropagation()
            onPlay()
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-400 shadow-sm ring-1 ring-rose-100/80 transition-colors hover:bg-rose-100 active:scale-95"
        >
          <Play className="size-4 fill-current pl-0.5" strokeWidth={0} />
        </button>
      ) : null}
    </div>
  )
}
