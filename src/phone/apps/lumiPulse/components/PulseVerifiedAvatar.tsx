import { PULSE_COLORS } from '../constants'
import { resolvePulseAuthorAvatarUrl } from '../pulseNetizenAvatar'

/** 微博认证头像框：金环 + 右下角 V；未认证则白边圆头像 */
export function PulseVerifiedAvatar({
  src,
  verified,
  sizeClass = 'size-20',
  borderClass = 'border-4 border-white',
  className = '',
  alt = '',
}: {
  src?: string
  verified?: boolean
  /** 头像外框尺寸，如 size-20 / size-12 */
  sizeClass?: string
  /** 未认证时的边框；认证态改用金环，此项忽略 */
  borderClass?: string
  className?: string
  alt?: string
}) {
  const url = resolvePulseAuthorAvatarUrl(src)
  const vBadgeSize =
    sizeClass.includes('size-20') || sizeClass.includes('size-[88px]') || sizeClass.includes('size-22')
      ? 'size-5 text-[10px]'
      : sizeClass.includes('size-12') || sizeClass.includes('size-11')
        ? 'size-3.5 text-[8px]'
        : 'size-4 text-[9px]'

  return (
    <div className={`relative shrink-0 ${sizeClass} ${className}`.trim()}>
      {verified ? (
        <>
          <div
            className="absolute -inset-[3px] rounded-full p-[2.5px]"
            style={{
              background: `linear-gradient(145deg, #F8E9A8 0%, ${PULSE_COLORS.lightGold} 42%, #A67C00 100%)`,
              boxShadow: '0 2px 10px rgba(212,175,55,0.35)',
            }}
            aria-hidden
          >
            <div className="size-full rounded-full bg-white p-[2px]">
              <div className="size-full overflow-hidden rounded-full bg-[#F5F5F4]">
                {url ? (
                  <img src={url} alt={alt} className="size-full object-cover" draggable={false} />
                ) : null}
              </div>
            </div>
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 z-[1] flex ${vBadgeSize} items-center justify-center rounded-full font-bold leading-none text-white ring-2 ring-white`}
            style={{
              background: `linear-gradient(145deg, #F0D56A, ${PULSE_COLORS.lightGold} 55%, #9A7209)`,
            }}
            title="已认证"
            aria-label="已认证"
          >
            V
          </span>
        </>
      ) : url ? (
        <img
          src={url}
          alt={alt}
          className={`size-full rounded-full object-cover ${borderClass}`}
          draggable={false}
        />
      ) : (
        <div className={`size-full rounded-full bg-[#F5F5F4] ${borderClass}`} />
      )}
    </div>
  )
}
