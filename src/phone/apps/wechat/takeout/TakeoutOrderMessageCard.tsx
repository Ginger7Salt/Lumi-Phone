import { motion } from 'framer-motion'

import { Pressable } from '../../../components/Pressable'
import { tasteNumStyle } from '../../takeout/tasteTypography'
import type { WeChatTakeoutOrderPayload } from '../newFriendsPersona/types'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
}

type Props = {
  data: WeChatTakeoutOrderPayload
  onOpen?: () => void
  compact?: boolean
}

export function TakeoutOrderMessageCard({ data, onOpen, compact = false }: Props) {
  const names = data.items.map((item) =>
    item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name,
  )
  const visibleNames = names.slice(0, 3)
  const moreCount = names.length - visibleNames.length

  const body = (
    <motion.div
      className={`overflow-hidden rounded-[12px] border-[0.5px] border-gray-200 bg-white text-left shadow-[0_2px_15px_rgba(0,0,0,0.03)] ${
        compact ? 'w-full' : 'w-[min(280px,calc(100vw-120px))]'
      }`}
      {...CARD_MOTION}
    >
      <div className="flex items-center gap-3 border-b border-gray-100 px-3.5 py-3">
        <div className="size-11 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-[#FAFAFA]">
          {data.storeLogoUrl ? (
            <img src={data.storeLogoUrl} alt="" className="size-full object-cover" draggable={false} />
          ) : (
            <div className="flex size-full items-center justify-center text-[11px] text-neutral-400">店</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-[#1C1C1E]">{data.storeName}</p>
          <p className="mt-0.5 text-[10px] tracking-[0.08em] text-neutral-400">
            {data.characterName} 为你点的外卖
          </p>
        </div>
      </div>

      <div className="space-y-1.5 px-3.5 py-3">
        {visibleNames.map((name) => (
          <p key={name} className="truncate text-[12px] text-neutral-600">
            {name}
          </p>
        ))}
        {moreCount > 0 ? (
          <p className="text-[11px] text-neutral-400">等 {moreCount} 件菜品</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-dashed border-gray-100 px-3.5 py-2.5">
        <span className="text-[10px] tracking-[0.12em] text-neutral-400">合计</span>
        <span className="text-[14px] text-[#1C1C1E]" style={tasteNumStyle}>
          ¥ {data.total.toFixed(2)}
        </span>
      </div>

      <div className="border-t border-gray-50 bg-[#FAFAFA] px-3.5 py-2 text-center">
        <p className="text-[10px] tracking-[0.1em] text-[#8B7355]">查看配送进度</p>
      </div>
    </motion.div>
  )

  if (!onOpen) return body

  return (
    <Pressable type="button" onClick={onOpen} className="block text-left">
      {body}
    </Pressable>
  )
}
