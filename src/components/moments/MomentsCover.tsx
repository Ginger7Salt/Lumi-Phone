import { useEffect, useState } from 'react'

import { defaultMomentsCoverDisplayUrl, MOMENTS_COVER_ASPECT } from './momentsCoverDefaults'
import { formatMomentsCoverSignature } from './momentsCoverSignature'

type MomentsCoverProps = {
  coverUrl: string
  nickname: string
  avatarUrl: string
  signature?: string
  onCoverClick?: () => void
  onAvatarClick?: () => void
}

export function MomentsCover({
  coverUrl,
  nickname,
  avatarUrl,
  signature,
  onCoverClick,
  onAvatarClick,
}: MomentsCoverProps) {
  const signatureDisplay = formatMomentsCoverSignature(signature)
  const fallbackCoverUrl = defaultMomentsCoverDisplayUrl()
  const [resolvedCoverUrl, setResolvedCoverUrl] = useState(coverUrl || fallbackCoverUrl)

  useEffect(() => {
    setResolvedCoverUrl(coverUrl || fallbackCoverUrl)
  }, [coverUrl, fallbackCoverUrl])

  return (
    <header
      className="relative z-10 w-full overflow-visible"
      style={{ aspectRatio: `${MOMENTS_COVER_ASPECT} / 1` }}
    >
      <button
        type="button"
        aria-label="更换朋友圈背景"
        onClick={onCoverClick}
        disabled={!onCoverClick}
        className={`absolute inset-0 z-0 block w-full border-0 bg-transparent p-0 ${onCoverClick ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <img
          src={resolvedCoverUrl}
          alt="Moments cover"
          className="h-full w-full object-cover"
          onError={() => {
            if (resolvedCoverUrl !== fallbackCoverUrl) setResolvedCoverUrl(fallbackCoverUrl)
          }}
        />
      </button>
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/46 via-black/12 to-transparent" />
      <div
        className="pointer-events-none absolute bottom-2 right-[88px] z-[1] text-right text-[20px] font-semibold tracking-[0.01em] text-white"
        style={{ textShadow: '0 2px 10px rgba(0,0,0,0.35)' }}
      >
        {nickname}
      </div>
      {onAvatarClick ? (
        <button
          type="button"
          onClick={onAvatarClick}
          className="absolute -bottom-5 right-4 z-30 rounded-2xl transition-opacity hover:opacity-90 focus:outline-none"
          aria-label={`查看 ${nickname} 资料`}
        >
          <img
            src={avatarUrl}
            alt={nickname}
            className="h-16 w-16 rounded-2xl border border-white/80 object-cover shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
          />
        </button>
      ) : (
        <img
          src={avatarUrl}
          alt={nickname}
          className="pointer-events-none absolute -bottom-5 right-4 z-30 h-16 w-16 rounded-2xl border border-white/80 object-cover shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
        />
      )}
      {signatureDisplay.text ? (
        <p
          className={`pointer-events-none absolute right-4 z-30 max-w-[min(280px,calc(100%-2rem))] text-right text-[13px] leading-[1.35] text-[#6B7280] ${
            signatureDisplay.multiline ? 'whitespace-pre-line line-clamp-2' : 'truncate whitespace-nowrap'
          }`}
          style={{ top: 'calc(100% + 2.125rem)' }}
        >
          {signatureDisplay.text}
        </p>
      ) : null}
    </header>
  )
}
