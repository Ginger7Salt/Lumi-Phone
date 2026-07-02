import { useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { useStickerStore } from './stickerStore'
import { WECHAT_CLASSIC_GROUP_ID } from './wechatClassicStickerPack'
import { WeChatClassicEmojiPickerPanel } from './WeChatClassicEmojiPickerPanel'

const CLASSIC_TAB_ID = '__wechat_classic_emoji__'

type Props = {
  onInsertClassicEmoji: (token: string) => void
  onPickSticker: (payload: { url: string; description: string }) => void
}

export function ChatEmojiPickerPanel({ onInsertClassicEmoji, onPickSticker }: Props) {
  const { groups } = useStickerStore()
  const stickerGroups = useMemo(
    () => groups.filter((g) => g.id !== WECHAT_CLASSIC_GROUP_ID),
    [groups],
  )
  const [activeTabId, setActiveTabId] = useState<string>(CLASSIC_TAB_ID)
  const activeSticker = useMemo(
    () => stickerGroups.find((g) => g.id === activeTabId) ?? null,
    [stickerGroups, activeTabId],
  )
  const showClassic = activeTabId === CLASSIC_TAB_ID

  return (
    <div className="mt-2 rounded-[12px] border border-[#eee] bg-white p-2 shadow-sm">
      <div className="mb-2 flex shrink-0 gap-2 overflow-x-auto">
        <Pressable
          type="button"
          onClick={() => setActiveTabId(CLASSIC_TAB_ID)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] ${showClassic ? 'border-black bg-black text-white' : 'border-[#eee] bg-white text-gray-700'}`}
        >
          经典表情
        </Pressable>
        {stickerGroups.map((g) => (
          <Pressable
            key={g.id}
            type="button"
            onClick={() => setActiveTabId(g.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] ${activeTabId === g.id ? 'border-black bg-black text-white' : 'border-[#eee] bg-white text-gray-700'}`}
          >
            {g.name}
          </Pressable>
        ))}
      </div>

      {showClassic ? (
        <WeChatClassicEmojiPickerPanel onInsert={onInsertClassicEmoji} />
      ) : activeSticker ? (
        <div
          className="max-h-[min(42vh,288px)] overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
          role="list"
          aria-label="表情包列表"
        >
          <div className="grid grid-cols-4 gap-2 pb-1">
            {activeSticker.items.map((item) => (
              <Pressable
                key={item.id}
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onPickSticker({ url: item.url, description: item.description })}
                className="overflow-hidden rounded-[10px] border border-[#eee] bg-[#fafafa]"
                role="listitem"
              >
                <div className="aspect-square">
                  <img src={item.url} alt="" className="h-full w-full object-contain" draggable={false} />
                </div>
              </Pressable>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-3 py-3 text-center text-[12px] text-gray-500">
          还没有表情包。请先去「我-表情」创建分组并上传表情。
        </div>
      )}
    </div>
  )
}
