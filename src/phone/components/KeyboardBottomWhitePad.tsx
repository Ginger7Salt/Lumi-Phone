/** 键盘弹起时在视口底部铺纯白底，避免 Android WebView 透明区露出黑底 */
export function KeyboardBottomWhitePad({
  insetPx,
  zIndex = 40,
}: {
  insetPx: number
  zIndex?: number
}) {
  if (insetPx <= 0) return null
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 bg-white"
      style={{ height: insetPx, zIndex }}
      aria-hidden
    />
  )
}

/** 滚动容器末尾留白，便于把输入区滚到键盘上方 */
export function KeyboardScrollWhiteSpacer({ insetPx }: { insetPx: number }) {
  if (insetPx <= 0) return null
  return <div className="shrink-0" style={{ height: insetPx }} aria-hidden />
}
