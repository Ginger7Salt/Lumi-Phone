/** 个人相册时间轴 / 置顶栏：单图与多图共用同一外框尺寸 */
export const MOMENT_ARCHIVE_THUMB_OUTER_CLASS = 'size-[88px] shrink-0'
export const MOMENT_ARCHIVE_THUMB_BAR_CLASS = 'size-[72px] shrink-0'

function gridColsForCount(count: number): number {
  if (count <= 1) return 1
  if (count <= 4) return 2
  return 3
}

type MomentArchiveThumbnailProps = {
  images?: string[]
  /** 时间轴与置顶列表用标准尺寸；置顶栏预览略小 */
  variant?: 'timeline' | 'pinnedBar'
  className?: string
}

export function MomentArchiveThumbnail({
  images,
  variant = 'timeline',
  className = '',
}: MomentArchiveThumbnailProps) {
  const imgs = (images ?? []).slice(0, 9)
  const outer = variant === 'pinnedBar' ? MOMENT_ARCHIVE_THUMB_BAR_CLASS : MOMENT_ARCHIVE_THUMB_OUTER_CLASS

  if (!imgs.length) return null

  if (imgs.length === 1) {
    return (
      <div className={`${outer} overflow-hidden rounded-lg ${className}`.trim()}>
        <img src={imgs[0]} alt="" className="size-full object-cover" />
      </div>
    )
  }

  if (imgs.length === 3) {
    return (
      <div
        className={`${outer} grid grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-lg bg-[#E5E7EB] ${className}`.trim()}
      >
        <img src={imgs[0]} alt="" className="row-span-2 size-full object-cover" />
        <img src={imgs[1]} alt="" className="size-full object-cover" />
        <img src={imgs[2]} alt="" className="size-full object-cover" />
      </div>
    )
  }

  const cols = gridColsForCount(imgs.length)
  return (
    <div
      className={`${outer} grid gap-px overflow-hidden rounded-lg bg-[#E5E7EB] ${className}`.trim()}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {imgs.map((src) => (
        <img key={src} src={src} alt="" className="aspect-square size-full object-cover" />
      ))}
    </div>
  )
}
