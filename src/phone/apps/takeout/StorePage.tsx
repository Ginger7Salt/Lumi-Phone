import { motion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { DEFAULT_PUBLIC_AVATAR_URL } from '../../types'
import { pickStableNetizenAvatarForChatHistoryNpc } from '../wechat/chatHistory/ephemeralNpcChatHistoryAvatar'
import { StoreMenu } from './StoreMenu'
import { TasteDeliveryIcon, TasteReviewIcon, TasteStarRating } from './tasteRating'
import { tasteNumStyle } from './tasteTypography'
import {
  getMergedStoreRating,
  getMergedStoreReviewCount,
  getMergedStoreReviews,
} from './tasteUserReviews'
import { useTasteWechatAccounts } from './useTasteWechatAccounts'
import { LUMI_TASTE_ORDER_UPDATED_EVENT } from './types'
import type { Store, StoreTab } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'

function reviewAvatarUrl(reviewId: string): string {
  return pickStableNetizenAvatarForChatHistoryNpc(reviewId) ?? DEFAULT_PUBLIC_AVATAR_URL
}

const TABS: { id: StoreTab; label: string }[] = [
  { id: 'menu', label: '点餐' },
  { id: 'reviews', label: '评价' },
  { id: 'merchant', label: '商家' },
]

function StoreCoverBlock({
  store,
  onHeightChange,
}: {
  store: Store
  onHeightChange: (height: number) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)

  const measure = useCallback(() => {
    const h = wrapRef.current?.offsetHeight ?? 0
    if (h > 0) onHeightChange(h)
  }, [onHeightChange])

  useLayoutEffect(() => {
    measure()
  }, [measure, store.coverImage])

  return (
    <div ref={wrapRef} className="relative shrink-0 bg-[#F3F4F6]">
      <img
        src={store.coverImage}
        alt=""
        className="block w-full h-auto"
        draggable={false}
        onLoad={measure}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/55" />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
        <p className="text-[10px] tracking-[0.12em] text-white/75 drop-shadow-sm">{store.category}</p>
        <h1
          className="mt-0.5 text-[20px] font-medium leading-tight text-white drop-shadow-sm"
          style={{ fontFamily: SERIF }}
        >
          {store.name}
        </h1>
      </div>
    </div>
  )
}

function StoreInfoBar({ store }: { store: Store }) {
  const { currentAccountId } = useTasteWechatAccounts()
  const rating = getMergedStoreRating(currentAccountId, store)
  const reviewCount = getMergedStoreReviewCount(currentAccountId, store)

  return (
    <div className="border-b border-gray-100/80 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <TasteStarRating value={rating} size={13} showValue />
        <span className="inline-flex items-center gap-1 text-[12px] text-neutral-500">
          <TasteReviewIcon className="text-neutral-400" />
          <span style={tasteNumStyle}>{reviewCount} 条评价</span>
        </span>
        <span className="inline-flex items-center gap-1 text-[12px] text-neutral-500">
          <TasteDeliveryIcon className="text-neutral-400" />
          <span style={tasteNumStyle}>{store.deliveryTime}</span>
        </span>
        <span className="text-[12px] text-neutral-500" style={tasteNumStyle}>
          起送 <span className="text-[#1C1C1E]">¥ {store.minOrder.toFixed(0)}</span>
        </span>
      </div>
    </div>
  )
}

function StoreReviewsPanel({ store }: { store: Store }) {
  const { currentAccountId } = useTasteWechatAccounts()
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const onUpdated = () => setRefreshKey((n) => n + 1)
    window.addEventListener(LUMI_TASTE_ORDER_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(LUMI_TASTE_ORDER_UPDATED_EVENT, onUpdated)
  }, [])

  const reviews = useMemo(
    () => getMergedStoreReviews(currentAccountId, store),
    [currentAccountId, store, refreshKey],
  )

  return (
    <>
      <div className="border-b border-gray-50/80 px-4 py-3">
        <p className="inline-flex items-center gap-1 text-[12px] text-neutral-500">
          <TasteReviewIcon size={13} className="text-neutral-400" />
          <span style={tasteNumStyle}>共 {reviews.length} 条评价</span>
        </p>
      </div>
      <ul className="divide-y divide-gray-50/80">
        {reviews.map((review) => (
          <li key={review.id} className="px-4 py-4">
            <div className="flex gap-3">
              <img
                src={reviewAvatarUrl(review.id)}
                alt=""
                className="size-9 shrink-0 rounded-full bg-gray-100 object-cover"
                draggable={false}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium text-[#1C1C1E]">{review.author}</p>
                  <p className="shrink-0 text-[11px] text-neutral-400" style={tasteNumStyle}>
                    {review.date}
                  </p>
                </div>
                <div className="mt-1">
                  <TasteStarRating value={review.rating} size={11} showValue />
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{review.text}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function StoreMerchantPanel({ store }: { store: Store }) {
  return (
    <>
      <div className="px-4 py-5">
        <h2 className="text-[14px] font-medium text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
          商家介绍
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-neutral-600">{store.intro}</p>
      </div>
      <div className="border-t border-gray-50 px-4 py-5">
        <h2 className="text-[14px] font-medium text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
          门店地址
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-neutral-600" style={tasteNumStyle}>
          {store.address}
        </p>
      </div>
      <div className="border-t border-gray-50 px-4 py-5">
        <h2 className="text-[14px] font-medium text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
          配送说明
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
          预计 <span style={tasteNumStyle}>{store.deliveryTime}</span> 送达 · 满{' '}
          <span style={tasteNumStyle}>¥ {store.minOrder.toFixed(0)}</span> 起送
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-neutral-400">
          本店为寻味虚拟商户，订单由平台模拟配送，支付后可在微信通知角色取餐。
        </p>
      </div>
    </>
  )
}

export function StorePage({ store }: { store: Store }) {
  const [tab, setTab] = useState<StoreTab>('menu')
  const pageScrollRef = useRef<HTMLDivElement>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const [heroHeight, setHeroHeight] = useState(0)
  const [tabBarHeight, setTabBarHeight] = useState(44)
  const [pinHero, setPinHero] = useState(false)

  const handleScroll = useCallback(() => {
    const el = pageScrollRef.current
    if (!el || heroHeight <= 0) return
    const top = el.scrollTop
    setPinHero(top > 4 && top < heroHeight - 8)
  }, [heroHeight])

  useLayoutEffect(() => {
    handleScroll()
  }, [handleScroll, heroHeight, tab])

  useLayoutEffect(() => {
    const el = tabBarRef.current
    if (!el) return

    const measure = () => {
      const h = el.offsetHeight
      if (h > 0) setTabBarHeight(h)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [tab, store.id])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-transparent">
      {/* 滚动过程中钉在顶部的背景图（滑过背景区后自动隐藏） */}
      {heroHeight > 0 && pinHero ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] overflow-hidden bg-[#F3F4F6]"
          style={{ height: heroHeight }}
        >
          <img
            src={store.coverImage}
            alt=""
            className="block h-full w-full object-contain object-top"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/55" />
        </div>
      ) : null}

      <div
        ref={pageScrollRef}
        className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-32"
        onScroll={handleScroll}
      >
        <StoreCoverBlock store={store} onHeightChange={setHeroHeight} />

        <div className="relative -mt-3 rounded-t-2xl border-t border-white/30 bg-white/94 shadow-[0_-10px_36px_rgba(0,0,0,0.07)] backdrop-blur-md">
          <StoreInfoBar store={store} />

          <div
            ref={tabBarRef}
            className="sticky top-0 z-20 flex shrink-0 border-b border-gray-100/90 bg-white/95 px-2 backdrop-blur-md"
          >
            {TABS.map(({ id, label }) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`relative flex-1 py-3 text-center text-[13px] transition-colors ${
                    active ? 'font-medium text-[#1C1C1E]' : 'text-neutral-400'
                  }`}
                >
                  {label}
                  {active ? (
                    <motion.span
                      layoutId={`store-tab-${store.id}`}
                      className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 bg-[#1C1C1E]"
                    />
                  ) : null}
                </button>
              )
            })}
          </div>

          {tab === 'menu' ? (
            <StoreMenu
              store={store}
              scrollRootRef={pageScrollRef as RefObject<HTMLDivElement>}
              stickyTop={tabBarHeight}
            />
          ) : null}
          {tab === 'reviews' ? <StoreReviewsPanel store={store} /> : null}
          {tab === 'merchant' ? <StoreMerchantPanel store={store} /> : null}
        </div>
      </div>
    </div>
  )
}
