import { resolveMomentsContentBackgroundUrl } from '../../../components/moments/momentsCoverDefaults'

/** 寻味全局背景 · 与朋友圈内容区同款壁纸 */
export function TasteAppBackground() {
  const bgUrl = resolveMomentsContentBackgroundUrl()

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bgUrl})` }}
    />
  )
}
