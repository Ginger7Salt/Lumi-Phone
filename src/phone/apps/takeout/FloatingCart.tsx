import { AnimatePresence, motion } from 'framer-motion'
import { useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { Pressable } from '../../components/Pressable'
import { CartFlyParticle } from './tasteCartFly'
import { useTasteCart } from './TasteCartContext'
import { tasteNumStyle } from './tasteTypography'
import { formatSpecSummary } from './tasteItemSpecs'
import type { CartItem } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'

function CartThumbStack({ items, flyTargetRef }: { items: CartItem[]; flyTargetRef?: RefObject<HTMLDivElement | null> }) {
  const shown = items.slice(0, 2)
  if (!shown.length) return null

  return (
    <div ref={flyTargetRef} className="relative h-9 w-10 shrink-0">
      {shown.map((item, i) => (
        <img
          key={item.lineKey}
          src={item.image}
          alt=""
          className="absolute size-8 rounded-lg border-2 border-white object-cover shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          style={{ left: i * 8, zIndex: shown.length - i }}
          draggable={false}
        />
      ))}
    </div>
  )
}

function CartLine({
  item,
  onChange,
}: {
  item: CartItem
  onChange: (lineKey: string, qty: number) => void
}) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-50 py-3.5 last:border-0">
      <img
        src={item.image}
        alt=""
        className="size-[52px] shrink-0 rounded-xl object-cover"
        draggable={false}
      />
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[14px] font-medium leading-snug text-[#1C1C1E]"
          style={{ fontFamily: SERIF }}
        >
          {item.name}
        </p>
        <p className="mt-0.5 text-[12px] text-neutral-400" style={tasteNumStyle}>
          ¥ {(item.unitPrice * item.quantity).toFixed(2)}
        </p>
        {item.specs.length ? (
          <p className="mt-0.5 text-[10px] text-neutral-400">{formatSpecSummary(item.specs)}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2.5">
        <Pressable
          type="button"
          onClick={() => onChange(item.lineKey, item.quantity - 1)}
          className="flex size-7 items-center justify-center rounded-full border border-gray-200 text-[15px] leading-none text-neutral-400 transition-colors active:bg-gray-50"
        >
          −
        </Pressable>
        <span className="w-4 text-center text-[12px] text-[#1C1C1E]" style={tasteNumStyle}>
          {item.quantity}
        </span>
        <Pressable
          type="button"
          onClick={() => onChange(item.lineKey, item.quantity + 1)}
          className="flex size-7 items-center justify-center rounded-full border border-[#1C1C1E] text-[15px] leading-none text-[#1C1C1E] transition-colors active:bg-gray-50"
        >
          +
        </Pressable>
      </div>
    </div>
  )
}

function ChevronUp({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={`shrink-0 text-neutral-300 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FloatingCart({
  onCheckout,
  minOrder,
  tabBarInset = false,
}: {
  onCheckout: () => void
  minOrder: number
  /** 为底部 Tab 栏留出空间 */
  tabBarInset?: boolean
}) {
  const { items, subtotal, itemCount, updateQuantity, cartBounceSignal, flyAnimation, triggerCartBounce } =
    useTasteCart()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const flyTargetRef = useRef<HTMLDivElement>(null)

  if (itemCount === 0) return null

  const meetsMin = subtotal >= minOrder
  const flyFrom = flyAnimation?.fromRect
  const shortfall = Math.max(0, minOrder - subtotal)

  return (
    <>
      {flyFrom && flyAnimation
        ? createPortal(
            <CartFlyParticle
              key={`fly-${flyAnimation.id}`}
              image={flyAnimation.image}
              fromRect={flyFrom}
              targetRef={flyTargetRef}
              onComplete={triggerCartBounce}
            />,
            document.body,
          )
        : null}

      <AnimatePresence>
        {drawerOpen ? (
          <motion.div
            className="absolute inset-0 z-[60] bg-black/[0.06] backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        className={`pointer-events-none absolute inset-x-0 z-[70] ${tabBarInset ? 'bottom-[58px]' : 'bottom-0'}`}
        animate={cartBounceSignal ? { y: [0, -4, 0] } : { y: 0 }}
        transition={{ duration: 0.32 }}
      >
        <div className="pointer-events-auto border-t border-gray-100/70 bg-white/78 shadow-[0_-12px_40px_rgba(0,0,0,0.06)] backdrop-blur-xl">
          <AnimatePresence initial={false}>
            {drawerOpen ? (
              <motion.div
                key="drawer"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                className="overflow-hidden border-b border-gray-50"
              >
                <div className="max-h-[42vh] overflow-y-auto px-5 pb-2 pt-4">
                  <div className="mx-auto mb-4 h-0.5 w-8 rounded-full bg-gray-200" />
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <p className="text-[15px] font-medium text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
                      订单明细
                    </p>
                    <p className="text-[11px] text-neutral-400" style={tasteNumStyle}>
                      {itemCount} 件 · ¥ {subtotal.toFixed(2)}
                    </p>
                  </div>
                  {items.map((item) => (
                    <CartLine key={item.id} item={item} onChange={updateQuantity} />
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
          >
            <Pressable
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-[#F9FAFB] px-3.5 py-2.5 transition-colors active:bg-gray-100"
            >
              <CartThumbStack items={items} flyTargetRef={flyTargetRef} />
              <div className="min-w-0 flex-1">
                <p className="text-[17px] leading-none text-[#1C1C1E]" style={tasteNumStyle}>
                  ¥ {subtotal.toFixed(2)}
                </p>
                <p className="mt-1 text-[10px] text-neutral-400">
                  {!meetsMin ? (
                    <span style={tasteNumStyle}>
                      还差 ¥ {shortfall.toFixed(1)} 起送
                    </span>
                  ) : drawerOpen ? (
                    '收起明细'
                  ) : (
                    <>
                      已选 <span style={tasteNumStyle}>{itemCount}</span> 件 · 查看明细
                    </>
                  )}
                </p>
              </div>
              <ChevronUp open={drawerOpen} />
            </Pressable>

            <Pressable
              type="button"
              disabled={!meetsMin}
              onClick={onCheckout}
              className="flex h-[52px] shrink-0 items-center justify-center rounded-2xl px-6 text-[13px] tracking-[0.08em] text-white transition-colors bg-[#1C1C1E] disabled:bg-neutral-100 disabled:text-neutral-300"
            >
              结算
            </Pressable>
          </div>
        </div>
      </motion.div>
    </>
  )
}
