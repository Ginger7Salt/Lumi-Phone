import type { TasteChatThread } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'

export function TasteChatAvatar({
  thread,
  size = 'md',
}: {
  thread: Pick<TasteChatThread, 'kind' | 'title' | 'avatarUrl' | 'merchantAvatarUrl' | 'courierAvatarUrl'>
  size?: 'md' | 'sm'
}) {
  const box = size === 'md' ? 'size-11' : 'size-10'
  const merchantBox = size === 'md' ? 'size-9' : 'size-8'
  const courierBox = size === 'md' ? 'size-7' : 'size-6'

  if (thread.kind === 'group' && thread.merchantAvatarUrl && thread.courierAvatarUrl) {
    return (
      <div className={`relative ${box} shrink-0`}>
        <img
          src={thread.merchantAvatarUrl}
          alt=""
          className={`absolute left-0 top-1 ${merchantBox} rounded-xl border-2 border-white object-cover shadow-sm`}
          draggable={false}
        />
        <img
          src={thread.courierAvatarUrl}
          alt=""
          className={`absolute bottom-0 right-0 ${courierBox} rounded-lg border-2 border-white object-cover shadow-sm`}
          draggable={false}
        />
      </div>
    )
  }

  if (thread.avatarUrl) {
    return (
      <img
        src={thread.avatarUrl}
        alt=""
        className={`${box} shrink-0 rounded-xl object-cover`}
        draggable={false}
      />
    )
  }

  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-xl bg-[#F3F4F6] text-[14px] text-neutral-500`}
      style={{ fontFamily: SERIF }}
    >
      {thread.title.slice(0, 1)}
    </span>
  )
}
