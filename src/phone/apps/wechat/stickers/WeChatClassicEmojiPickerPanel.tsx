import { useMemo } from 'react'

import { Pressable } from '../../../components/Pressable'
import { buildWechatClassicStickerItems, wechatClassicEmojiToken } from './wechatClassicStickerPack'

type Props = {
  onInsert: (token: string) => void
}

export function WeChatClassicEmojiPickerPanel({ onInsert }: Props) {
  const items = useMemo(() => buildWechatClassicStickerItems(), [])

  if (!items.length) {
    return (
      <div className="rounded-[12px] border border-[#eee] bg-white px-3 py-3 text-center text-[12px] text-gray-500">
        经典表情加载失败
      </div>
    )
  }

  return (
    <div
      className="max-h-[min(42vh,288px)] overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
      role="list"
      aria-label="微信经典表情"
    >
      <div className="grid grid-cols-8 gap-1 pb-1">
        {items.map((item) => (
          <Pressable
            key={item.id}
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onInsert(wechatClassicEmojiToken(item.description))}
            className="flex h-9 w-full items-center justify-center rounded-[6px] active:bg-[#f0f0f0]"
            role="listitem"
            title={item.description}
          >
            <img
              src={item.url}
              alt={item.description}
              className="h-[26px] w-[26px] object-contain"
              draggable={false}
            />
          </Pressable>
        ))}
      </div>
    </div>
  )
}
