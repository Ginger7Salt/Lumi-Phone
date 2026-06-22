import type { Artist } from '../types'

export function ArtistAvatar({
  artist,
  size = 'md',
  selected,
  className = '',
}: {
  artist: Artist
  size?: 'md' | 'lg'
  selected?: boolean
  className?: string
}) {
  const dim = size === 'lg' ? 'h-[72px] w-[72px] text-[22px]' : 'h-14 w-14 text-[18px]'
  const label = artist.avatar ? null : artist.name.slice(0, 1)

  return (
    <div
      className={`sm-artist-avatar flex shrink-0 items-center justify-center rounded-full font-semibold transition-shadow ${dim} ${
        selected ? 'ring-2 ring-rose-400 ring-offset-2 ring-offset-[#FFFBFB]' : ''
      } ${className}`}
      title={artist.name}
    >
      {artist.avatar ? (
        <img src={artist.avatar} alt={artist.name} className="h-full w-full rounded-full object-cover" />
      ) : (
        label
      )}
    </div>
  )
}
