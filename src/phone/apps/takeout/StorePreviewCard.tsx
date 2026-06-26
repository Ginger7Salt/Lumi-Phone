import { useMemo, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { getStoreHotItems } from './tasteCatalog'
import { TasteStarRating } from './tasteRating'
import { tasteNumStyle } from './tasteTypography'
import type { MenuItem, Store } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'

/** 预览卡礼券堆叠区与热卖图共用高度 */
const PREVIEW_MEDIA_H = 76

const PREVIEW_LABEL_CLASS = 'text-center text-[9px] leading-[13px] tracking-[0.14em]'

function MiniCouponTicket({ threshold, discount }: { threshold: number; discount: number }) {
  return (
    <div className="relative flex min-h-0 flex-1 w-full items-stretch overflow-hidden rounded-lg border border-gray-100/90 bg-white shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#D4AF37]/45" />
      <div className="flex w-[42%] items-center justify-center border-r border-dashed border-gray-100 bg-[#FDFCFA]">
        <span className="text-[11px] leading-none text-[#1C1C1E]" style={tasteNumStyle}>
          ¥{discount}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center leading-none">
        <span className="text-[7px] tracking-[0.08em] text-neutral-300">满减</span>
        <span className="mt-0.5 text-[8px] text-neutral-500" style={tasteNumStyle}>
          满{threshold}
        </span>
      </div>
      <span className="pointer-events-none absolute -left-[3px] top-1/2 size-[6px] -translate-y-1/2 rounded-full bg-white ring-1 ring-gray-100" />
      <span className="pointer-events-none absolute -right-[3px] top-1/2 size-[6px] -translate-y-1/2 rounded-full bg-white ring-1 ring-gray-100" />
    </div>
  )
}

function StoreCouponPanel({
  coupons,
  claimed,
  onClaim,
}: {
  coupons: Store['coupons']
  claimed: boolean
  onClaim: () => void
}) {
  return (
    <div className="flex w-[96px] shrink-0 flex-col border-r border-gray-50 px-2 py-2.5">
      <p className={`${PREVIEW_LABEL_CLASS} text-neutral-400`} style={{ fontFamily: SERIF }}>
        礼券
      </p>
      <div className="mt-2 flex flex-col gap-1" style={{ height: PREVIEW_MEDIA_H }}>
        {coupons.map((coupon) => (
          <MiniCouponTicket key={coupon.id} threshold={coupon.threshold} discount={coupon.discount} />
        ))}
      </div>
      <Pressable
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClaim()
        }}
        disabled={claimed}
        className="mt-2 rounded-full border border-[#1C1C1E]/12 bg-[#FAFAFA] py-1.5 text-center text-[9px] tracking-[0.06em] text-[#1C1C1E] transition-colors active:bg-gray-100 disabled:border-transparent disabled:bg-transparent disabled:text-neutral-300"
      >
        {claimed ? '已领取' : '领取全部'}
      </Pressable>
    </div>
  )
}

function formatMonthlySales(n: number): string {
  if (n >= 100) return `月售 ${Math.floor(n / 100) * 100}+`
  return `月售 ${n}+`
}

function HotItemCard({
  item,
  badge,
  onOpenStore,
}: {
  item: MenuItem
  badge?: string
  onOpenStore: () => void
}) {
  const listPrice = item.listPrice ?? Math.ceil(item.price * 1.15)

  return (
    <Pressable
      type="button"
      onClick={onOpenStore}
      className="relative w-[76px] shrink-0 text-left transition-opacity active:opacity-80"
      aria-label={`查看 ${item.name}`}
    >
      <div
        className="relative overflow-hidden rounded-xl bg-[#F9FAFB]"
        style={{ width: PREVIEW_MEDIA_H, height: PREVIEW_MEDIA_H }}
      >
        <img src={item.image} alt="" className="size-full object-cover" draggable={false} />
        {badge ? (
          <span className="absolute left-0 top-0 rounded-br-lg bg-[#1C1C1E]/88 px-1.5 py-0.5 text-[8px] tracking-[0.04em] text-white">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-[#1C1C1E]">{item.name}</p>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-[11px] text-[#1C1C1E]" style={tasteNumStyle}>
          ¥{item.price.toFixed(1)}
        </span>
        {listPrice > item.price ? (
          <span className="text-[9px] text-neutral-300 line-through" style={tasteNumStyle}>
            ¥{listPrice.toFixed(0)}
          </span>
        ) : null}
      </div>
    </Pressable>
  )
}

export function StorePreviewCard({
  store,
  onOpenStore,
}: {
  store: Store
  onOpenStore: (storeId: string) => void
}) {
  const [couponsClaimed, setCouponsClaimed] = useState(false)
  const hotItems = useMemo(() => getStoreHotItems(store), [store])

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
      <Pressable type="button" onClick={() => onOpenStore(store.id)} className="block w-full p-3.5 pb-3 text-left">
        <div className="flex gap-3">
          <img
            src={store.logoImage}
            alt=""
            className="size-[52px] shrink-0 rounded-xl border border-gray-100 object-cover"
            draggable={false}
          />
          <div className="min-w-0 flex-1">
            <h2
              className="truncate text-[15px] font-medium leading-snug text-[#1C1C1E]"
              style={{ fontFamily: SERIF }}
            >
              {store.name}
            </h2>
            <p className="mt-1 text-[10px] text-neutral-400" style={tasteNumStyle}>
              {formatMonthlySales(store.monthlySales)} · 起送 ¥{store.minOrder.toFixed(0)} · 配送约 ¥
              {store.deliveryFee.toFixed(1)}
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <TasteStarRating value={store.rating} size={10} showValue />
              <p className="shrink-0 text-[10px] text-neutral-400" style={tasteNumStyle}>
                {store.deliveryMinutes} 分钟 · {store.distanceKm.toFixed(1)} km
              </p>
            </div>
            {store.tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {store.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-gray-100 px-1.5 py-0.5 text-[9px] text-neutral-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </Pressable>

      <div className="flex border-t border-gray-50">
        <StoreCouponPanel
          coupons={store.coupons}
          claimed={couponsClaimed}
          onClaim={() => setCouponsClaimed(true)}
        />

        <div className="min-w-0 flex-1 flex flex-col px-2.5 py-2.5">
          <p className={`${PREVIEW_LABEL_CLASS} text-neutral-400`} style={{ fontFamily: SERIF }}>
            热卖
          </p>
          <div className="mt-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-2.5">
              {hotItems.map((item, i) => (
                <HotItemCard
                  key={item.id}
                  item={item}
                  badge={i === 0 ? '招牌' : i === 1 ? '热销' : undefined}
                  onOpenStore={() => onOpenStore(store.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
