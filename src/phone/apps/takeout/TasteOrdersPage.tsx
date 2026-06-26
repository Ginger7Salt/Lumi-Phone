import { useMemo } from 'react'

import { Pressable } from '../../components/Pressable'
import { getStoreById, resolveOrderItemImage } from './tasteCatalog'
import {
  formatTasteOrderTime,
  isTasteOrderEvaluated,
  needsTasteFeastCeremony,
  tasteOrderStatus,
  useTasteOrders,
} from './tasteOrderBridge'
import {
  resolveOrderRealRecipientName,
  resolveOrderRecipientNickname,
} from './tasteDeliveryRecipient'
import { TasteRecipientLabelWithRealName } from './TasteRecipientDisplay'
import { formatOrderItemLine } from './tasteItemSpecs'
import { tasteNumStyle } from './tasteTypography'
import { useTasteWechatAccounts } from './useTasteWechatAccounts'
import type { TasteOrderPayload } from './types'
import { isUserGiftToCharacterOrder } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'

function OrderCard({
  order,
  onOpenTracking,
  onStartFeast,
}: {
  order: TasteOrderPayload
  onOpenTracking: (order: TasteOrderPayload) => void
  onStartFeast: (orderId: string) => void
}) {
  const status = tasteOrderStatus(order)
  const evaluated = isTasteOrderEvaluated(order)
  const pendingFeast = needsTasteFeastCeremony(order)
  const userGiftToCharacter = isUserGiftToCharacterOrder(order)
  const store = getStoreById(order.storeId)
  const itemPreview = order.items
    .slice(0, 2)
    .map((i) => formatOrderItemLine(i))
    .join(' · ')
  const more = order.items.length > 2 ? ` 等${order.itemCount}件` : ''

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white/92 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
      <button
        type="button"
        onClick={() => onOpenTracking(order)}
        className="block w-full text-left transition-[opacity,background-color] duration-150 active:bg-gray-50/80 active:opacity-95"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-50 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-medium text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
            {order.storeName}
          </h2>
          <p className="mt-1 text-[10px] text-neutral-400" style={tasteNumStyle}>
            {formatTasteOrderTime(order.placedAt)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] tracking-[0.04em] ${
            status === 'delivering'
              ? 'bg-[#1C1C1E] text-white'
              : pendingFeast
                ? 'border border-[#D4AF37]/40 bg-[#FFFBF2] text-[#9A7B1A]'
                : evaluated
                  ? 'border border-gray-100 bg-[#FAFAFA] text-neutral-500'
                  : 'border border-gray-100 bg-[#FAFAFA] text-neutral-400'
          }`}
        >
          {status === 'delivering'
            ? '配送中'
            : pendingFeast
              ? '待评价'
              : userGiftToCharacter && status === 'done'
                ? '角色已收餐'
                : evaluated
                  ? '已评价'
                  : '已完成'}
        </span>
      </div>

      <div className="px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {order.items.map((item, i) => (
            <img
              key={`${item.id ?? item.name}-${i}`}
              src={resolveOrderItemImage(order.storeId, item)}
              alt=""
              className="size-11 shrink-0 rounded-lg object-cover"
              draggable={false}
            />
          ))}
        </div>
        <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-neutral-500">
          {itemPreview}
          {more}
        </p>
        <div className="mt-3 flex items-end justify-between gap-2">
          <p className="text-[11px] text-neutral-400">
            送至{' '}
            <TasteRecipientLabelWithRealName
              nickname={resolveOrderRecipientNickname(order)}
              realName={resolveOrderRealRecipientName(order)}
              nicknameClassName="text-neutral-400"
              realNameClassName="text-neutral-300"
            />
          </p>
          <p className="text-[14px] text-[#1C1C1E]" style={tasteNumStyle}>
            ¥ {order.total.toFixed(2)}
          </p>
        </div>
        {status === 'delivering' && store ? (
          <p className="mt-2 text-[10px] text-neutral-400" style={tasteNumStyle}>
            预计 {store.deliveryMinutes} 分钟送达 · 点击查看进度
          </p>
        ) : !pendingFeast ? (
          <p className="mt-2 text-[10px] text-neutral-300">点击查看详情</p>
        ) : null}
      </div>
      </button>

      {pendingFeast ? (
        <div className="border-t border-gray-50 px-4 py-3">
          <Pressable
            type="button"
            onClick={() => onStartFeast(order.orderId)}
            className="w-full border border-[#1C1C1E] bg-[#1C1C1E] py-2 text-[11px] tracking-[0.1em] text-white"
          >
            开启飨味仪式
          </Pressable>
        </div>
      ) : null}
    </div>
  )
}

export function TasteOrdersPage({
  onOpenTracking,
  onStartFeast,
}: {
  onOpenTracking: (order: TasteOrderPayload) => void
  onStartFeast: (orderId: string) => void
}) {
  const { currentAccountId } = useTasteWechatAccounts()
  const orders = useTasteOrders(currentAccountId)
  const activeCount = useMemo(
    () => orders.filter((o) => tasteOrderStatus(o) === 'delivering').length,
    [orders],
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-transparent pb-6">
      <header className="px-6 pb-5 pt-5 text-center">
        <div className="mx-auto h-px w-16 bg-gray-100" />
        <p className="mt-4 text-[11px] tracking-[0.12em] text-neutral-400">
          {activeCount > 0 ? (
            <>
              <span style={tasteNumStyle}>{activeCount}</span> 单配送中
            </>
          ) : (
            '订单追踪'
          )}
        </p>
      </header>

      {orders.length === 0 ? (
        <div className="px-8 pt-12 text-center">
          <p className="text-[13px] text-neutral-400">暂无订单</p>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-300">
            在点单页选购后，订单会出现在这里
          </p>
        </div>
      ) : (
        <div className="space-y-3 px-4">
          {orders.map((order) => (
            <OrderCard
              key={order.orderId}
              order={order}
              onOpenTracking={onOpenTracking}
              onStartFeast={onStartFeast}
            />
          ))}
        </div>
      )}
    </div>
  )
}
