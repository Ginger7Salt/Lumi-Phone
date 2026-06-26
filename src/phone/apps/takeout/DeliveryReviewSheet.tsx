import { AnimatePresence, motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { submitTasteOrderReview } from './tasteOrderBridge'
import type { TasteOrderPayload } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'
const EASE = [0.22, 1, 0.36, 1] as const

function InteractiveStarRow({
  label,
  sublabel,
  value,
  onChange,
  activeColor,
}: {
  label: string
  sublabel: string
  value: number
  onChange: (next: number) => void
  activeColor: string
}) {
  const [hover, setHover] = useState(0)
  const display = hover || value

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
          {label}
        </p>
        <p className="text-[10px] tracking-[0.08em] text-neutral-400">{sublabel}</p>
      </div>
      <div
        className="mt-3 flex gap-1.5"
        onPointerLeave={() => setHover(0)}
        role="radiogroup"
        aria-label={label}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const star = i + 1
          const lit = star <= display
          return (
            <Pressable
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} 星`}
              className="flex size-9 items-center justify-center rounded-full transition-colors active:bg-black/[0.04]"
              onPointerEnter={() => setHover(star)}
              onClick={() => onChange(star)}
            >
              <Star
                size={22}
                strokeWidth={1.25}
                className="transition-colors duration-150"
                fill={lit ? activeColor : 'transparent'}
                stroke={lit ? activeColor : '#C4C4C4'}
              />
            </Pressable>
          )
        })}
      </div>
    </div>
  )
}

export function DeliveryReviewSheet({
  open,
  order,
  accountId,
  authorName,
  onFinished,
}: {
  open: boolean
  order: TasteOrderPayload
  accountId: string
  authorName: string
  onFinished: () => void
}) {
  const [storeRating, setStoreRating] = useState(0)
  const [riderRating, setRiderRating] = useState(0)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = storeRating > 0 && riderRating > 0 && !submitting

  const submit = useCallback(() => {
    if (!canSubmit) return
    setSubmitting(true)
    submitTasteOrderReview(
      accountId,
      order.orderId,
      { storeRating, riderRating, text: text.trim() },
      authorName,
    )
    window.setTimeout(() => {
      setSubmitting(false)
      onFinished()
    }, 420)
  }, [accountId, authorName, canSubmit, onFinished, order.orderId, riderRating, storeRating, text])

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="absolute inset-0 z-[92] bg-black/25 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            aria-hidden
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 z-[93] flex max-h-[min(88vh,640px)] flex-col overflow-hidden rounded-t-[20px] border border-white/60 bg-white/88 shadow-[0_-12px_48px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 36 }}
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-neutral-200/90" aria-hidden />
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-5">
              <p className="text-center text-[10px] tracking-[0.22em] text-[#D4AF37]">SERVICE EVALUATION</p>
              <h2
                className="mt-2 text-center text-[20px] font-medium text-[#1C1C1E]"
                style={{ fontFamily: SERIF }}
              >
                飨味评价
              </h2>
              <p className="mt-2 text-center text-[11px] text-neutral-400">{order.storeName}</p>

              <div className="mt-8 space-y-7">
                <InteractiveStarRow
                  label="主厨与风味"
                  sublabel="Store"
                  value={storeRating}
                  onChange={setStoreRating}
                  activeColor="#1C1C1E"
                />
                <InteractiveStarRow
                  label="配送专员服务"
                  sublabel="Rider"
                  value={riderRating}
                  onChange={setRiderRating}
                  activeColor="#D4AF37"
                />
              </div>

              <div className="mt-8">
                <p className="text-[10px] tracking-[0.12em] text-neutral-400">品鉴随笔</p>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="写下你的品鉴体验..."
                  rows={3}
                  className="mt-3 w-full resize-none border-0 border-b border-dashed border-gray-200 bg-transparent py-2 text-[14px] leading-relaxed text-[#1C1C1E] outline-none placeholder:text-neutral-300"
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-100/80 px-6 py-4">
              <Pressable
                type="button"
                disabled={!canSubmit}
                onClick={submit}
                className="flex h-12 w-full items-center justify-center bg-[#1C1C1E] text-[12px] tracking-[0.1em] text-white disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                封存评价并同步
              </Pressable>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
