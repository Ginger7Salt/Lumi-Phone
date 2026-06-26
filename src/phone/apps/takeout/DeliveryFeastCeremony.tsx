import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { DeliveryReviewSheet } from './DeliveryReviewSheet'
import { resolveOrderItemImage } from './tasteCatalog'
import { saveCollectedReceipt } from './tasteCollectedReceipts'
import { ThermalReceiptPrintScene } from './ThermalReceipt'
import { tasteNumStyle } from './tasteTypography'
import { isCharacterGiftOrder, type TasteOrderPayload } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'

const LUXE_SPRING = { type: 'spring' as const, stiffness: 150, damping: 25, mass: 0.8 }
/** 天地盖滑出：空气阻尼手感 */
const LID_SPRING = { type: 'spring' as const, stiffness: 200, damping: 30, mass: 0.9 }

type FeastStep = 'receipt' | 'unpack' | 'feast' | 'cleared' | 'review'
type LidPhase = 'closed' | 'hover' | 'exit'

const SAVOR_LINES = [
  '初尝：温热的香气渐渐包裹味蕾。',
  '细品：风味在唇齿间交融，手里的小票似乎还带着他的温度。',
  '回味：风味已尽，余韵绵长。',
] as const

function resolveSavorLine(index: number, isCharacterOrder: boolean): string {
  if (index === 1 && !isCharacterOrder) {
    return '细品：风味在唇齿间缓缓展开，时间也慢了下来。'
  }
  return SAVOR_LINES[index] ?? SAVOR_LINES[0]
}

function dishScaleForSavor(savorCount: number): number {
  if (savorCount >= 2) return 1.15
  if (savorCount >= 1) return 1.05
  return 1
}

function PlatinumParticles({ active }: { active: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 48,
        delay: 0.04 + Math.random() * 0.18,
        size: 2 + Math.random() * 2,
      })),
    [],
  )

  if (!active) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute left-1/2 top-1/2 rounded-full bg-[#D4AF37]"
          style={{ width: p.size, height: p.size, marginLeft: p.x }}
          initial={{ opacity: 0.75, y: 0, scale: 1 }}
          animate={{ opacity: 0, y: -50, scale: 0.4 }}
          transition={{ ...LUXE_SPRING, delay: p.delay }}
        />
      ))}
    </div>
  )
}

function TouchRipple({ pulseKey }: { pulseKey: number }) {
  if (pulseKey <= 0) return null
  return (
    <motion.span
      key={pulseKey}
      className="pointer-events-none absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35"
      initial={{ scale: 0.25, opacity: 0.55 }}
      animate={{ scale: 2.8, opacity: 0 }}
      transition={LUXE_SPRING}
      aria-hidden
    />
  )
}

function EmptyPlateRing() {
  return (
    <div className="relative flex size-[168px] items-center justify-center" aria-hidden>
      <div className="absolute inset-x-6 bottom-2 h-3 rounded-[100%] bg-black/[0.05] blur-[6px]" />
      <div className="flex size-[132px] items-center justify-center rounded-full border border-[#D4AF37]/20 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.06)]">
        <div className="size-[88px] rounded-full border border-neutral-100/90" />
      </div>
    </div>
  )
}

function GiftBoxRibbon({ dissolving }: { dissolving: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      <motion.div
        className="absolute h-[72%] w-px bg-[#D4AF37]/60"
        animate={
          dissolving
            ? { scale: 1.5, opacity: 0 }
            : { scale: 1.05, opacity: 1 }
        }
        initial={{ scale: 1.05, opacity: 1 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="absolute h-px w-[72%] bg-[#D4AF37]/60"
        animate={
          dissolving
            ? { scale: 1.5, opacity: 0 }
            : { scale: 1.05, opacity: 1 }
        }
        initial={{ scale: 1.05, opacity: 1 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="absolute size-3 rounded-full border border-[#D4AF37]/80 bg-white shadow-[0_0_12px_rgba(212,175,55,0.25)]"
        animate={
          dissolving
            ? { scale: 1.5, opacity: 0 }
            : { scale: 1.05, opacity: 1 }
        }
        initial={{ scale: 1.05, opacity: 1 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  )
}

function GiftBoxLid({
  phase,
  ribbonGone,
  unlocking,
  onUnbox,
}: {
  phase: LidPhase
  ribbonGone: boolean
  unlocking: boolean
  onUnbox: () => void
}) {
  const lidY = phase === 'closed' ? 0 : phase === 'hover' ? -50 : '-100vh'
  const lidOpacity = phase === 'exit' ? 0 : 1

  return (
    <motion.div
      className="absolute inset-0 z-30 h-64 w-64"
      animate={{ y: lidY, opacity: lidOpacity }}
      transition={LID_SPRING}
    >
      <motion.div
        className="h-full w-full"
        animate={unlocking ? { scale: [1, 0.98, 1] } : { scale: 1 }}
        transition={LUXE_SPRING}
      >
        <Pressable
          type="button"
          onClick={onUnbox}
          disabled={unlocking || phase !== 'closed'}
          className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)] disabled:pointer-events-none"
          aria-label="揭开礼盒"
        >
          <div className="pointer-events-none absolute inset-x-8 top-4 h-px bg-gradient-to-r from-transparent via-neutral-200/90 to-transparent" />
          <p
            className="pointer-events-none text-[9px] tracking-[0.32em] text-neutral-300"
            style={{ fontFamily: SERIF }}
          >
            LUMI
          </p>
          <GiftBoxRibbon dissolving={ribbonGone} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-neutral-100/60 to-transparent" />
        </Pressable>
      </motion.div>
    </motion.div>
  )
}

export function DeliveryFeastCeremony({
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
  const [step, setStep] = useState<FeastStep>('unpack')
  const [receiptPrinted, setReceiptPrinted] = useState(false)
  const [keepReceipt, setKeepReceipt] = useState(true)
  const [unboxing, setUnboxing] = useState(false)
  const [ribbonGone, setRibbonGone] = useState(false)
  const [lidPhase, setLidPhase] = useState<LidPhase>('closed')
  const [glowBloom, setGlowBloom] = useState(false)
  const [savorCount, setSavorCount] = useState(0)
  const [rippleKey, setRippleKey] = useState(0)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [irisClosing, setIrisClosing] = useState(false)

  const heroImage = resolveOrderItemImage(order.storeId, order.items[0] ?? { name: order.storeName })
  const isCharacterOrder = isCharacterGiftOrder(order)
  const savorCaption =
    savorCount > 0 && step === 'feast'
      ? resolveSavorLine(Math.min(savorCount - 1, 2), isCharacterOrder)
      : ''
  const dishScale = dishScaleForSavor(savorCount)
  const sceneBlur =
    step === 'receipt'
      ? 20
      : step === 'unpack'
        ? 24
        : savorCount === 0
          ? 24
          : savorCount === 1
            ? 32
            : 40
  const showLid = step === 'unpack'
  const showGiftScene = step === 'unpack' || step === 'feast' || step === 'cleared'

  useEffect(() => {
    if (!open) {
      setStep('unpack')
      setReceiptPrinted(false)
      setKeepReceipt(true)
      setUnboxing(false)
      setRibbonGone(false)
      setLidPhase('closed')
      setGlowBloom(false)
      setSavorCount(0)
      setRippleKey(0)
      setReviewOpen(false)
      setIrisClosing(false)
      return
    }
    setStep(isCharacterGiftOrder(order) ? 'receipt' : 'unpack')
    setReceiptPrinted(false)
    setKeepReceipt(true)
  }, [open, order])

  useEffect(() => {
    if (step !== 'cleared') return
    const t = window.setTimeout(() => {
      setStep('review')
      setReviewOpen(true)
    }, 800)
    return () => window.clearTimeout(t)
  }, [step])

  const handleReceiptContinue = useCallback(() => {
    if (step !== 'receipt' || !receiptPrinted) return
    if (keepReceipt) {
      saveCollectedReceipt(accountId, order)
    }
    setStep('unpack')
  }, [accountId, keepReceipt, order, receiptPrinted, step])

  const handleUnbox = useCallback(() => {
    if (step !== 'unpack' || unboxing) return
    setUnboxing(true)

    // Stage 1: 铂金绑带消散 + 解锁微震
    setRibbonGone(true)

    // Stage 2a: 盖子缓慢上浮（空气阻尼）
    window.setTimeout(() => setLidPhase('hover'), 220)

    // Stage 2b: 加速滑出屏幕
    window.setTimeout(() => setLidPhase('exit'), 680)

    // Stage 3: 铂金光晕 + 进入品尝
    window.setTimeout(() => setGlowBloom(true), 520)
    window.setTimeout(() => setStep('feast'), 1050)
  }, [step, unboxing])

  const handleSavor = useCallback(() => {
    if (step !== 'feast') return
    setRippleKey((k) => k + 1)
    const next = savorCount + 1
    if (next >= 3) {
      setSavorCount(3)
      setIrisClosing(true)
      window.setTimeout(() => setStep('cleared'), 880)
      return
    }
    setSavorCount(next)
  }, [savorCount, step])

  const handleReviewFinished = useCallback(() => {
    setReviewOpen(false)
    onFinished()
  }, [onFinished])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="delivery-feast-ceremony"
          className="absolute inset-0 z-[91] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={LUXE_SPRING}
        >
          <motion.div
            className="absolute inset-0 bg-black/40"
            style={{ WebkitBackdropFilter: `blur(${sceneBlur}px)` }}
            animate={{ backdropFilter: `blur(${sceneBlur}px)` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }}
          />

          <motion.div
            className="pointer-events-none absolute inset-0 z-[1]"
            animate={{
              opacity: step === 'feast' && savorCount >= 2 ? 1 : 0,
              background:
                'radial-gradient(ellipse 55% 48% at 50% 42%, transparent 0%, rgba(0,0,0,0.05) 72%, rgba(0,0,0,0.14) 100%)',
            }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden
          />

          <div className="relative z-10 flex h-full min-h-0 flex-col items-center justify-center px-6 py-10">
            <AnimatePresence mode="wait">
              {step === 'receipt' && isCharacterGiftOrder(order) ? (
                <motion.div
                  key="receipt-scene"
                  className="flex w-full max-w-md flex-col items-center"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16, scale: 0.98 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ThermalReceiptPrintScene
                    order={order}
                    active
                    onPrintComplete={() => setReceiptPrinted(true)}
                  />

                  {!receiptPrinted ? (
                    <motion.p
                      className="mt-8 text-center text-[10px] tracking-[0.14em] text-white/40"
                      style={{ fontFamily: SERIF }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      PRINTING · 正在打印订单凭证
                    </motion.p>
                  ) : (
                    <motion.div
                      className="mt-8 flex w-full max-w-xs flex-col items-center"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Pressable
                        type="button"
                        onClick={() => setKeepReceipt((v) => !v)}
                        className="mb-5 flex items-center gap-2.5 text-[11px] tracking-[0.06em] text-white/70"
                        aria-pressed={keepReceipt}
                      >
                        <span
                          className={`flex size-4 items-center justify-center rounded border transition-colors ${
                            keepReceipt
                              ? 'border-[#D4AF37] bg-[#D4AF37]/20'
                              : 'border-white/30 bg-transparent'
                          }`}
                        >
                          {keepReceipt ? (
                            <span className="size-2 rounded-sm bg-[#D4AF37]" aria-hidden />
                          ) : null}
                        </span>
                        保留这张小票
                      </Pressable>

                      <Pressable
                        type="button"
                        onClick={handleReceiptContinue}
                        className="min-w-[168px] border border-white/25 bg-white/10 px-8 py-3.5 text-[12px] tracking-[0.12em] text-white backdrop-blur-sm"
                      >
                        拆开外卖
                      </Pressable>
                      <p
                        className="mt-4 text-center text-[10px] tracking-[0.12em] text-white/45"
                        style={{ fontFamily: SERIF }}
                      >
                        {keepReceipt ? '小票将收入「我的」收藏' : '小票不会保存，仅本次展示'}
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              ) : showGiftScene ? (
                <motion.div
                  key="gift-scene"
                  className="flex w-full max-w-md flex-col items-center"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                <div className="relative w-full">
                  <div className="relative mx-auto size-64">
                    {step === 'unpack' ? (
                      <div
                        className="absolute -bottom-3 left-1/2 z-0 h-4 w-[88%] -translate-x-1/2 rounded-[100%] bg-black/20 blur-xl"
                        aria-hidden
                      />
                    ) : null}

                    {/* 底层：菜品（开箱前完全隐藏，盖子抽离后自然显露） */}
                    <motion.div
                      className="absolute inset-0 z-0 overflow-hidden rounded-2xl"
                      animate={{
                        opacity: step === 'unpack' && !glowBloom ? 0 : 1,
                        boxShadow: glowBloom
                          ? '0 0 40px rgba(212,175,55,0.15), 0 20px 50px rgba(0,0,0,0.12)'
                          : '0 20px 50px rgba(0,0,0,0.12)',
                        clipPath:
                          irisClosing || step === 'cleared'
                            ? 'circle(0% at 50% 50%)'
                            : 'circle(100% at 50% 50%)',
                      }}
                      transition={
                        irisClosing || step === 'cleared'
                          ? { duration: 0.88, ease: [0.22, 1, 0.36, 1] }
                          : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }
                      }
                    >
                      <motion.img
                        src={heroImage}
                        alt=""
                        className="size-full object-cover"
                        draggable={false}
                        animate={{ scale: step === 'feast' || step === 'cleared' ? dishScale : 1 }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      />

                      <motion.div
                        className="pointer-events-none absolute inset-0 rounded-2xl"
                        animate={{
                          opacity: savorCount >= 2 && step === 'feast' ? 1 : 0,
                          boxShadow:
                            'inset 0 0 48px rgba(0,0,0,0.22), inset 0 0 12px rgba(0,0,0,0.08)',
                        }}
                        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                        aria-hidden
                      />
                    </motion.div>

                    {/* 顶层：天地盖盒盖（开箱前必须完全遮住底层） */}
                    {showLid ? (
                      <GiftBoxLid
                        phase={lidPhase}
                        ribbonGone={ribbonGone}
                        unlocking={unboxing && lidPhase === 'closed'}
                        onUnbox={handleUnbox}
                      />
                    ) : null}

                    {/* 开箱前：底层兜底遮罩，防止菜品漏出 */}
                    {step === 'unpack' && !glowBloom ? (
                      <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-white" aria-hidden />
                    ) : null}

                    <PlatinumParticles active={step === 'cleared'} />
                  </div>
                </div>

                {step === 'unpack' && !unboxing ? (
                  <motion.p
                    className="mt-8 text-center text-[10px] tracking-[0.14em] text-white/55"
                    style={{ fontFamily: SERIF }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ ...LUXE_SPRING, delay: 0.2 }}
                  >
                    TAP TO UNBOX · 揭开属于你的心意
                  </motion.p>
                ) : null}

                <AnimatePresence mode="wait">
                  {step === 'cleared' ? (
                    <motion.div
                      key="cleared-plate"
                      className="mt-8 flex flex-col items-center"
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ ...LUXE_SPRING, delay: 0.12 }}
                    >
                      <EmptyPlateRing />
                      <p
                        className="mt-6 max-w-[18rem] text-center text-[14px] leading-relaxed text-white/88"
                        style={{ fontFamily: SERIF }}
                      >
                        {SAVOR_LINES[2]}
                      </p>
                    </motion.div>
                  ) : step === 'feast' ? (
                    <motion.div
                      key="feast-actions"
                      className="mt-8 flex w-full flex-col items-center"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={LUXE_SPRING}
                    >
                      <AnimatePresence mode="wait">
                        {savorCaption ? (
                          <motion.p
                            key={savorCaption}
                            className="mb-6 max-w-[18rem] text-center text-[14px] leading-relaxed text-white/85"
                            style={{ fontFamily: SERIF }}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={LUXE_SPRING}
                          >
                            {savorCaption}
                          </motion.p>
                        ) : (
                          <motion.p
                            key="feast-hint"
                            className="mb-6 text-[11px] tracking-[0.12em] text-white/45"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={LUXE_SPRING}
                          >
                            飨味 · 三道感官
                          </motion.p>
                        )}
                      </AnimatePresence>

                      <div className="relative">
                        <TouchRipple pulseKey={rippleKey} />
                        <Pressable
                          type="button"
                          onClick={handleSavor}
                          className="relative min-w-[168px] overflow-hidden bg-[#1C1C1E] px-8 py-3.5 text-[12px] tracking-[0.12em] text-white"
                        >
                          执起餐具 · Savor
                        </Pressable>
                      </div>
                      <p className="mt-4 text-[10px] text-white/35" style={tasteNumStyle}>
                        {Math.min(savorCount, 3)} / 3
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <DeliveryReviewSheet
            open={reviewOpen}
            order={order}
            accountId={accountId}
            authorName={authorName}
            onFinished={handleReviewFinished}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
