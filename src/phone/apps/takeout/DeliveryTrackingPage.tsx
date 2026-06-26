import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight, Gift, Lock, MessageCircle, Sparkles, UserRound, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { getStoreById, resolveOrderItemImage } from './tasteCatalog'
import {
  buildDeliveryTimeline,
  deliveryProgress,
  etaHeadline,
  isCharacterCourierChatUnlocked,
  pickCourierName,
} from './tasteDeliveryTracking'
import { tasteOrderStatus } from './tasteOrderBridge'
import { resolveOrderRealRecipientName, resolveOrderRecipientNickname } from './tasteDeliveryRecipient'
import { TasteRecipientLabelWithRealName } from './TasteRecipientDisplay'
import { formatOrderItemLine } from './tasteItemSpecs'
import { tasteNumStyle } from './tasteTypography'
import type { TasteChatKind, TasteOrderPayload } from './types'
import { isCharacterGiftOrder, isUserGiftToCharacterOrder } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'

type DeliveryInfoBadgeVariant = 'self' | 'character-gift' | 'user-gift'

function DeliveryInfoBadge({ variant }: { variant: DeliveryInfoBadgeVariant }) {
  const styles: Record<DeliveryInfoBadgeVariant, string> = {
    'character-gift': 'border-[#D4AF37]/30 bg-[#FFFBF2] text-[#9A7B1A]',
    'user-gift': 'border-violet-200/70 bg-violet-50/90 text-violet-800',
    self: 'border-gray-100 bg-[#FAFAFA] text-neutral-500',
  }
  const labels: Record<DeliveryInfoBadgeVariant, string> = {
    'character-gift': '角色赠礼',
    'user-gift': '赠予角色',
    self: '本人收取',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] tracking-[0.06em] ${styles[variant]}`}
    >
      {variant === 'character-gift' ? (
        <Gift size={10} strokeWidth={1.5} className="opacity-80" />
      ) : variant === 'user-gift' ? (
        <Sparkles size={10} strokeWidth={1.5} className="opacity-75" />
      ) : (
        <UserRound size={10} strokeWidth={1.5} className="opacity-70" />
      )}
      {labels[variant]}
    </span>
  )
}

function DeliveryInfoSection({
  order,
  isCharacterOrder,
  isUserGiftToCharacter,
  courier,
  isDone,
  onOpenChat,
}: {
  order: TasteOrderPayload
  isCharacterOrder: boolean
  isUserGiftToCharacter: boolean
  courier: string
  isDone: boolean
  onOpenChat: () => void
}) {
  const nickname = resolveOrderRecipientNickname(order)
  const realName = resolveOrderRealRecipientName(order)
  const badgeVariant: DeliveryInfoBadgeVariant = isCharacterOrder
    ? 'character-gift'
    : isUserGiftToCharacter
      ? 'user-gift'
      : 'self'
  const recipientInitial = (nickname || realName || '收').slice(0, 1)

  return (
    <section className="mx-4 mt-3 overflow-hidden rounded-2xl border border-[#D4AF37]/15 bg-gradient-to-br from-white via-white to-[#FFFBF5]/90 shadow-[0_8px_36px_rgba(212,175,55,0.07)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#D4AF37]/10 px-4 py-2.5">
        <p className="text-[10px] tracking-[0.22em] text-[#8B7355]">配送信息</p>
        <DeliveryInfoBadge variant={badgeVariant} />
      </div>

      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#FFFBF2] to-white text-[17px] text-[#8B7355] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
            style={{ fontFamily: SERIF }}
          >
            {recipientInitial}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[10px] tracking-[0.12em] text-neutral-400">收货人</p>
            <p className="mt-1 text-[15px] leading-snug text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
              <TasteRecipientLabelWithRealName
                nickname={nickname}
                realName={realName}
                nicknameClassName="text-[#1C1C1E]"
                realNameClassName="text-neutral-400"
              />
            </p>
            {isCharacterOrder && order.orderSourceCharacterName ? (
              <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[#9A7B1A]/90">
                <Gift size={11} strokeWidth={1.35} className="shrink-0 opacity-70" />
                <span>{order.orderSourceCharacterName} 为你点的外卖</span>
              </p>
            ) : isUserGiftToCharacter ? (
              <p className="mt-1.5 text-[11px] leading-relaxed text-violet-700/85">
                你点的外卖，由角色收餐
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-neutral-400">餐品将按此收货名送达</p>
            )}
          </div>
        </div>
      </div>

      {!isCharacterOrder ? (
        <div className="border-t border-[#D4AF37]/8 bg-[#FAFAFA]/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-100 bg-white shadow-sm">
              <span
                className="text-[13px] text-neutral-600"
                style={{ fontFamily: SERIF }}
              >
                {courier.slice(0, 1)}
              </span>
              {!isDone ? (
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-[#D4AF37]" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] tracking-[0.1em] text-neutral-400">配送专员</p>
              <p className="mt-0.5 text-[13px] text-[#1C1C1E]">
                <span style={{ fontFamily: SERIF }}>{courier}</span>
                <span className="ml-2 text-[10px] font-normal text-neutral-400">
                  {isDone ? '已送达' : '配送中'}
                </span>
              </p>
            </div>
            <Pressable
              type="button"
              onClick={onOpenChat}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#1C1C1E]/10 bg-white text-[#1C1C1E] shadow-sm transition-colors active:bg-gray-50"
              aria-label={`联系${courier}`}
            >
              <MessageCircle size={16} strokeWidth={1.35} />
            </Pressable>
          </div>
        </div>
      ) : null}
    </section>
  )
}

const timelineContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.12 },
  },
}

const timelineItem = {
  hidden: { opacity: 0, y: -10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const } },
}

function ContactChip({
  label,
  sublabel,
  onClick,
  icon,
}: {
  label: string
  sublabel: string
  onClick: () => void
  icon: 'merchant' | 'courier' | 'group'
}) {
  return (
    <Pressable
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-1 flex-col items-center rounded-xl border border-gray-100 bg-[#FAFAFA] px-2 py-3 transition-colors active:bg-gray-100"
    >
      <span className="flex size-8 items-center justify-center rounded-full border border-gray-100 bg-white text-[#1C1C1E]">
        {icon === 'group' ? (
          <Users size={15} strokeWidth={1.35} />
        ) : (
          <MessageCircle size={15} strokeWidth={1.35} />
        )}
      </span>
      <p className="mt-2 w-full truncate text-center text-[11px] text-[#1C1C1E]">{label}</p>
      <p className="mt-0.5 w-full truncate text-center text-[9px] text-neutral-400">{sublabel}</p>
    </Pressable>
  )
}

function CharacterChatRecordRow({
  label,
  sublabel,
  locked,
  onClick,
}: {
  label: string
  sublabel: string
  locked?: boolean
  onClick: () => void
}) {
  return (
    <Pressable
      type="button"
      onClick={() => {
        if (locked) return
        onClick()
      }}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
        locked
          ? 'cursor-not-allowed border-gray-100 bg-[#FAFAFA]/80 opacity-70'
          : 'border-gray-100 bg-[#FAFAFA] active:bg-gray-100'
      }`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${
          locked ? 'border-gray-100 bg-white text-neutral-300' : 'border-gray-100 bg-white text-[#1C1C1E]'
        }`}
      >
        {locked ? <Lock size={14} strokeWidth={1.35} /> : <MessageCircle size={15} strokeWidth={1.35} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] text-[#1C1C1E]">{label}</p>
        <p className="mt-0.5 truncate text-[10px] text-neutral-400">{sublabel}</p>
      </div>
      {!locked ? <ChevronRight size={16} className="shrink-0 text-neutral-300" strokeWidth={1.35} /> : null}
    </Pressable>
  )
}

function TimelineNode({ step, isLast }: { step: ReturnType<typeof buildDeliveryTimeline>[number]; isLast: boolean }) {
  const isDone = step.state === 'done'
  const isActive = step.state === 'active'

  return (
    <motion.li variants={timelineItem} className="relative flex gap-3.5 pb-6 last:pb-0">
      {!isLast ? (
        <span
          className="absolute left-[5px] top-[14px] w-px"
          style={{
            height: 'calc(100% - 6px)',
            background: isDone ? '#1C1C1E' : 'rgba(229,231,235,0.95)',
          }}
        />
      ) : null}

      <div className="relative z-[1] shrink-0 pt-0.5">
        {isActive ? (
          <span className="relative flex size-3 items-center justify-center">
            <span className="absolute size-3 animate-pulse rounded-full bg-[#D4AF37]/25" />
            <span className="relative size-2.5 rounded-full bg-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.55)]" />
          </span>
        ) : isDone ? (
          <span className="block size-2.5 rounded-full bg-[#1C1C1E]" />
        ) : (
          <span className="block size-2.5 rounded-full border border-gray-200 bg-white" />
        )}
      </div>

      <div className="min-w-0 flex-1 pt-px">
        <div className="flex items-baseline justify-between gap-3">
          <p
            className={`text-[13px] leading-snug ${
              isActive
                ? 'font-medium text-[#1C1C1E]'
                : isDone
                  ? 'text-[#1C1C1E]'
                  : 'text-neutral-300'
            }`}
            style={{ fontFamily: SERIF }}
          >
            {step.label}
          </p>
          <span
            className={`shrink-0 text-[10px] ${isDone || isActive ? 'text-neutral-400' : 'text-neutral-300'}`}
            style={tasteNumStyle}
          >
            {step.timeLabel}
          </span>
        </div>
      </div>
    </motion.li>
  )
}

export function DeliveryTrackingPage({
  order,
  onOpenChat,
  onStartFeast,
  canStartFeast = false,
  suppressAutoFeastOnMount = false,
  onToast,
}: {
  order: TasteOrderPayload
  onToast?: (msg: string) => void
  onOpenChat: (kind: TasteChatKind) => void
  onStartFeast?: (seed?: TasteOrderPayload) => void
  canStartFeast?: boolean
  /** 进入追踪页时不自动弹出拆封仪式（用户可先查看配送进度） */
  suppressAutoFeastOnMount?: boolean
}) {
  const [now, setNow] = useState(() => Date.now())
  const [detailsOpen, setDetailsOpen] = useState(false)
  const prevDoneRef = useRef(tasteOrderStatus(order) === 'done')
  const mountFeastTriggeredRef = useRef(false)

  useEffect(() => {
    if (tasteOrderStatus(order) === 'done') return
    const id = window.setInterval(() => setNow(Date.now()), 12_000)
    return () => window.clearInterval(id)
  }, [order])

  const store = getStoreById(order.storeId)
  const deliveryMinutes = store?.deliveryMinutes ?? 35
  const timeline = useMemo(
    () => buildDeliveryTimeline(order, deliveryMinutes, now),
    [order, deliveryMinutes, now],
  )
  const eta = useMemo(() => etaHeadline(order, deliveryMinutes, now), [order, deliveryMinutes, now])
  const progress = useMemo(() => deliveryProgress(order, deliveryMinutes, now), [order, deliveryMinutes, now])
  const courier = useMemo(() => pickCourierName(order.orderId), [order.orderId])
  const isDone = tasteOrderStatus(order, now) === 'done'
  const isCharacterOrder = isCharacterGiftOrder(order)
  const isUserGiftToCharacter = isUserGiftToCharacterOrder(order)
  const characterName = order.orderSourceCharacterName?.trim() || 'TA'
  const courierChatUnlocked = isCharacterCourierChatUnlocked(order, deliveryMinutes, now)
  const itemsPreviewLine = useMemo(
    () => order.items.slice(0, 2).map((i) => formatOrderItemLine(i)).join(' · '),
    [order.items],
  )
  const itemsPreviewMore = order.items.length > 2 ? ` 等${order.itemCount}件` : ''

  useEffect(() => {
    if (suppressAutoFeastOnMount) return
    if (mountFeastTriggeredRef.current) return
    if (isDone && canStartFeast) {
      mountFeastTriggeredRef.current = true
      onStartFeast?.()
    }
  }, [canStartFeast, isDone, onStartFeast, suppressAutoFeastOnMount])

  useEffect(() => {
    if (isDone && !prevDoneRef.current && canStartFeast) {
      onStartFeast?.()
    }
    prevDoneRef.current = isDone
  }, [canStartFeast, isDone, onStartFeast])
  const activeStep = useMemo(() => {
    const active = timeline.find((s) => s.state === 'active')
    if (active) return active
    return timeline[timeline.length - 1]!
  }, [timeline])

  return (
    <div className="h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-transparent pb-8">
      {canStartFeast ? (
        <section className="mx-4 mt-3 overflow-hidden rounded-2xl border border-[#D4AF37]/25 bg-white/95 shadow-[0_8px_32px_rgba(212,175,55,0.08)]">
          <div className="px-4 py-4 text-center">
            <p className="text-[10px] tracking-[0.18em] text-[#D4AF37]">FLAVOUR ARRIVED</p>
            <p className="mt-2 text-[15px] text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
              风味已至，待您拆封飨味
            </p>
            <Pressable
              type="button"
              onClick={() => onStartFeast?.()}
              className="mt-4 bg-[#1C1C1E] px-6 py-2.5 text-[11px] tracking-[0.12em] text-white"
            >
              开启拆封仪式
            </Pressable>
          </div>
        </section>
      ) : isUserGiftToCharacter && isDone ? (
        <section className="mx-4 mt-3 overflow-hidden rounded-2xl border border-gray-100/90 bg-white/95 px-4 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <p className="text-center text-[10px] tracking-[0.16em] text-neutral-400">DELIVERED</p>
          <p className="mt-2 text-center text-[14px] leading-relaxed text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
            餐品已送达，由角色收餐
          </p>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-neutral-400">
            角色收到后会在微信私聊里告诉你
          </p>
        </section>
      ) : null}

      <DeliveryInfoSection
        order={order}
        isCharacterOrder={isCharacterOrder}
        isUserGiftToCharacter={isUserGiftToCharacter}
        courier={courier}
        isDone={isDone}
        onOpenChat={() => onOpenChat('courier')}
      />

      <section className="mx-4 mt-4 overflow-hidden rounded-2xl border border-gray-100/90 bg-white shadow-[0_6px_28px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 border-b border-gray-50 px-4 py-3">
          <div className="size-11 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-[#FAFAFA]">
            {store?.logoImage ? (
              <img
                src={store.logoImage}
                alt=""
                className="size-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-[11px] text-neutral-400">店</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
              {order.storeName}
            </p>
            {order.orderSource === 'character' && order.orderSourceCharacterName ? (
              <p className="mt-0.5 truncate text-[10px] text-neutral-400">
                {order.orderSourceCharacterName} 为你点的外卖
              </p>
            ) : store?.category ? (
              <p className="mt-0.5 truncate text-[10px] text-neutral-400">{store.category}</p>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] tracking-[0.04em] ${
              isDone
                ? 'border border-gray-100 bg-[#FAFAFA] text-neutral-400'
                : 'bg-[#1C1C1E] text-white'
            }`}
          >
            {isDone ? '已送达' : '配送中'}
          </span>
        </div>

        <div className="flex items-start justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.18em] text-neutral-400">{eta.caption}</p>
            <p className="mt-1 text-[24px] leading-none text-[#1C1C1E]" style={tasteNumStyle}>
              {eta.hour}
              <span className="mx-0.5 text-[18px] text-neutral-300">:</span>
              {eta.minute}
            </p>
            <p className="mt-2 text-[11px] text-neutral-400" style={tasteNumStyle}>
              约 {deliveryMinutes} 分钟 · {order.itemCount} 件
            </p>
          </div>

          <div className="shrink-0 max-w-[9rem] text-right">
            <p className="text-[10px] tracking-[0.08em] text-neutral-400">当前状态</p>
            <p className="mt-2 text-[13px] leading-snug text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
              {activeStep.label}
            </p>
          </div>
        </div>

        <div className="px-4 pb-3.5">
          <div className="h-px overflow-hidden rounded-full bg-gray-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#1C1C1E] to-[#D4AF37]/80"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </section>

      <section className="mx-4 mt-4 rounded-2xl border border-gray-100/90 bg-white/90 px-4 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <p className="mb-4 text-[10px] tracking-[0.16em] text-neutral-400">配送进度</p>
        <motion.ol
          className="relative list-none"
          variants={timelineContainer}
          initial="hidden"
          animate="show"
        >
          {timeline.map((step, index) => (
            <TimelineNode key={step.id} step={step} isLast={index === timeline.length - 1} />
          ))}
        </motion.ol>
      </section>

      {isCharacterOrder ? (
        <section className="mx-4 mt-4 rounded-2xl border border-[#D4AF37]/15 bg-white/90 p-4 shadow-[0_4px_20px_rgba(212,175,55,0.06)]">
          <p className="mb-3 text-[10px] tracking-[0.16em] text-[#8B7355]">角色沟通记录</p>
          <div className="space-y-2">
            <CharacterChatRecordRow
              label={`${characterName} 与商家`}
              sublabel={`${order.storeName} · 下单后确认`}
              onClick={() => onOpenChat('character-merchant')}
            />
            <CharacterChatRecordRow
              label={`${characterName} 与骑手`}
              sublabel={courierChatUnlocked ? `${courier} · 配送沟通` : '骑手开始配送或送达后解锁'}
              locked={!courierChatUnlocked}
              onClick={() => {
                if (!courierChatUnlocked) {
                  onToast?.('骑手开始配送或送达后可查看')
                  return
                }
                onOpenChat('character-courier')
              }}
            />
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-neutral-400">
            仅供查看 {characterName} 与商家/骑手的沟通，点击记录后手动 AI 生成
          </p>
        </section>
      ) : null}

      {!isCharacterOrder ? (
        <section className="mx-4 mt-4 rounded-2xl border border-gray-100/90 bg-white/90 px-4 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <p className="mb-3 text-[10px] tracking-[0.16em] text-neutral-400">在线沟通</p>
          <div className="flex gap-2">
            <ContactChip
              label="联系商家"
              sublabel={order.storeName}
              icon="merchant"
              onClick={() => onOpenChat('merchant')}
            />
            <ContactChip
              label="配送群"
              sublabel="商家与专员"
              icon="group"
              onClick={() => onOpenChat('group')}
            />
          </div>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-neutral-400">
            也可在上方直接联系配送专员
          </p>
        </section>
      ) : null}

      <section className="mx-4 mt-4 overflow-hidden rounded-2xl border border-gray-100/90 bg-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <Pressable
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left"
          aria-expanded={detailsOpen}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex -space-x-2">
              {order.items.slice(0, 3).map((item, i) => (
                <img
                  key={`${item.id ?? item.name}-${i}`}
                  src={resolveOrderItemImage(order.storeId, item)}
                  alt=""
                  className="size-9 rounded-lg border-2 border-white object-cover shadow-sm"
                  draggable={false}
                />
              ))}
            </div>
            <div className="min-w-0">
              <span className="text-[13px] tracking-[0.06em] text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
                订单明细
              </span>
              <p className="mt-0.5 text-[10px] text-neutral-400" style={tasteNumStyle}>
                {order.itemCount} 件 · ¥ {order.total.toFixed(2)}
              </p>
              {!detailsOpen && itemsPreviewLine ? (
                <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-neutral-500">
                  {itemsPreviewLine}
                  {itemsPreviewMore}
                </p>
              ) : null}
            </div>
          </div>
          <motion.span animate={{ rotate: detailsOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown size={16} className="text-neutral-400" strokeWidth={1.35} />
          </motion.span>
        </Pressable>

        <AnimatePresence initial={false}>
          {detailsOpen ? (
            <motion.div
              key="details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-gray-50"
            >
              <ul className="space-y-3 px-4 pb-4 pt-3">
                {order.items.map((item, i) => (
                  <li key={`${item.id ?? item.name}-${i}`} className="flex items-center gap-3">
                    <img
                      src={resolveOrderItemImage(order.storeId, item)}
                      alt=""
                      className="size-[52px] shrink-0 rounded-xl object-cover"
                      draggable={false}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] leading-snug text-[#1C1C1E]">{item.name}</p>
                      {item.specSummary ? (
                        <p className="mt-0.5 truncate text-[10px] text-neutral-400">{item.specSummary}</p>
                      ) : null}
                      {item.quantity > 1 ? (
                        <p className="mt-0.5 text-[10px] text-neutral-400" style={tasteNumStyle}>
                          ×{item.quantity}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-[12px] text-[#1C1C1E]" style={tasteNumStyle}>
                      ¥ {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </li>
                ))}
                <li className="flex items-center justify-between border-t border-gray-50 pt-3">
                  <span className="text-[11px] text-neutral-400">合计</span>
                  <span className="text-[14px] text-[#1C1C1E]" style={tasteNumStyle}>
                    ¥ {order.total.toFixed(2)}
                  </span>
                </li>
              </ul>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
    </div>
  )
}
