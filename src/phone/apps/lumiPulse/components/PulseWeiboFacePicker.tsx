import { Smile } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { Pressable } from '../../../components/Pressable'
import { PULSE_COLORS } from '../constants'
import { getWeiboFaceUrl, PULSE_WEIBO_FACE_PICKER } from '../pulseWeiboFace'

/** 8 列 × 32px + 7 × 4px gap + 左右内边距，保证一行完整显示 */
const PANEL_WIDTH_CLASS = 'w-[min(312px,calc(100vw-2rem))]'

/** 微博专属表情选择器（插入 [名称] 占位符） */
export function PulseWeiboFacePicker({
  onPick,
  panelPlacement = 'above',
  variant = 'default',
  /** page：固定在页面水平居中（评论底栏等左侧按钮用）；anchor：相对按钮定位 */
  panelMode = 'anchor',
}: {
  onPick: (token: string) => void
  /** above：面板在按钮上方（底栏）；below：面板在按钮下方（顶栏） */
  panelPlacement?: 'above' | 'below'
  variant?: 'default' | 'luxury'
  panelMode?: 'anchor' | 'page'
}) {
  const [open, setOpen] = useState(false)

  const faces = useMemo(
    () =>
      PULSE_WEIBO_FACE_PICKER.map((name) => ({
        name,
        url: getWeiboFaceUrl(name),
      })).filter((f) => f.url),
    [],
  )

  const panelBody = (
    <div className={`${PANEL_WIDTH_CLASS} rounded-2xl bg-white/95 p-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.1)] backdrop-blur-xl`}>
      <p className="px-1 pb-1.5 text-[10px] tracking-wide text-neutral-400">微博表情</p>
      <div className="grid max-h-[176px] grid-cols-8 gap-1 overflow-y-auto">
        {faces.map((face) => (
          <Pressable
            key={face.name}
            type="button"
            title={`[${face.name}]`}
            onClick={() => {
              onPick(`[${face.name}]`)
              setOpen(false)
            }}
            className="flex aspect-square w-full items-center justify-center rounded-lg hover:bg-[#F5F5F4]"
          >
            <img src={face.url} alt={face.name} className="size-[22px] object-contain" draggable={false} />
          </Pressable>
        ))}
      </div>
    </div>
  )

  return (
    <div className="relative shrink-0">
      <Pressable
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center rounded-full text-neutral-500 ${
          variant === 'luxury' ? 'size-9' : 'size-8'
        }`}
        aria-label="微博表情"
        aria-expanded={open}
      >
        <Smile
          className="size-[18px]"
          strokeWidth={1.35}
          style={{ color: PULSE_COLORS.mistBlue }}
        />
      </Pressable>

      {open
        ? panelMode === 'page'
          ? createPortal(
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[1400] bg-black/10"
                  aria-label="关闭表情面板"
                  onClick={() => setOpen(false)}
                />
                <div
                  className={`pointer-events-auto fixed left-1/2 z-[1410] -translate-x-1/2 ${
                    panelPlacement === 'below'
                      ? 'top-[max(4.5rem,env(safe-area-inset-top,0px)+3.5rem)]'
                      : 'bottom-[max(5.75rem,calc(env(safe-area-inset-bottom,0px)+4.75rem))]'
                  }`}
                  role="dialog"
                  aria-label="微博表情"
                >
                  {panelBody}
                </div>
              </>,
              document.body,
            )
          : (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[10]"
                  aria-label="关闭表情面板"
                  onClick={() => setOpen(false)}
                />
                <div
                  className={`absolute z-[20] ${
                    variant === 'luxury' ? 'left-1/2 -translate-x-1/2' : 'right-0'
                  } ${panelPlacement === 'below' ? 'top-full mt-2' : 'bottom-full mb-2'}`}
                >
                  {panelBody}
                </div>
              </>
            )
        : null}
    </div>
  )
}
