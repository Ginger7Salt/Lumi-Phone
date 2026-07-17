import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Pressable } from '../../components/Pressable'
import { PULSE_COLORS } from './constants'
import {
  pulseAppCoachScopedTargetSelector,
  pulseAppCoachTargetSelector,
  type PulseAppCoachStep,
  type PulseAppCoachTargetId,
} from './pulseAppCoachSteps'

const SCOPE_ROOT = 'pulse-app'
const PAD = 10
const RADIUS = 16
const CARD_MAX_W = 332
const CARD_EST_H = 250
/** 须高于发布页 portal（z-1250）与各类 sheet，否则发帖指引会被盖住 */
const COACH_Z = 1600

type HoleRect = { top: number; left: number; width: number; height: number }

function findCoachTargetNode(target: PulseAppCoachTargetId): Element | null {
  // 发布页等 portal 到 body，不在 pulse-app 根下，需全局回退
  return (
    document.querySelector(pulseAppCoachScopedTargetSelector(SCOPE_ROOT, target)) ||
    document.querySelector(pulseAppCoachTargetSelector(target))
  )
}

function measureTargetInOverlay(target: PulseAppCoachTargetId, overlayEl: HTMLElement): HoleRect | null {
  const node = findCoachTargetNode(target)
  if (!node) return null
  const er = node.getBoundingClientRect()
  const or = overlayEl.getBoundingClientRect()
  if (er.width < 2 || er.height < 2) return null
  const maxW = or.width - 16
  return {
    top: Math.max(8, er.top - or.top - PAD),
    left: Math.max(8, er.left - or.left - PAD),
    width: Math.min(maxW, er.width + PAD * 2),
    height: er.height + PAD * 2,
  }
}

function layoutTooltipCard(
  hole: HoleRect,
  overlayW: number,
  overlayH: number,
): { top: number; left: number; width: number } {
  const margin = 14
  const width = Math.min(CARD_MAX_W, overlayW - margin * 2)
  let left = hole.left + hole.width / 2 - width / 2
  left = Math.max(margin, Math.min(left, overlayW - width - margin))
  let top = hole.top + hole.height + 12
  if (top + CARD_EST_H > overlayH - margin) {
    top = Math.max(margin, hole.top - 12 - CARD_EST_H)
  }
  return { top, left, width }
}

function scheduleCoachRemeasure(run: () => void, extraDelaysMs: number[] = []) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      run()
      window.setTimeout(run, 120)
      window.setTimeout(run, 280)
      for (const ms of extraDelaysMs) window.setTimeout(run, ms)
    })
  })
}

function CoachCardBody({
  stepIndex,
  total,
  step,
  isFirst,
  isLast,
  onSkip,
  onStepChange,
  onComplete,
}: {
  stepIndex: number
  total: number
  step: PulseAppCoachStep
  isFirst: boolean
  isLast: boolean
  onSkip: () => void
  onStepChange: (index: number) => void
  onComplete: () => void
}) {
  return (
    <>
      <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-400">
        玩法指引 {stepIndex + 1} / {total}
      </p>
      <p id="pulse-app-coach-step-title" className="mt-2 font-serif text-[17px] text-[#1C1C1E]">
        {step.title}
      </p>
      <p className="mt-2 text-[13px] leading-[1.75] text-neutral-600">{step.body}</p>
      <div className="mt-5 flex flex-col gap-2">
        {step.isOutro ? (
          <Pressable
            type="button"
            onClick={onComplete}
            className="w-full rounded-full py-3 text-center text-[13px] font-medium text-white"
            style={{ backgroundColor: PULSE_COLORS.ink }}
          >
            开始使用
          </Pressable>
        ) : (
          <>
            <div className="flex gap-2">
              <Pressable
                type="button"
                onClick={onSkip}
                className="flex-1 rounded-full border border-black/10 py-3 text-center text-[13px] text-neutral-600"
              >
                跳过
              </Pressable>
              <Pressable
                type="button"
                onClick={() => {
                  if (isLast) onComplete()
                  else onStepChange(stepIndex + 1)
                }}
                className="min-w-0 flex-[1.4] rounded-full py-3 text-center text-[13px] font-medium text-white"
                style={{ backgroundColor: PULSE_COLORS.dustyRose }}
              >
                {isLast ? '完成' : '下一步'}
              </Pressable>
            </div>
            {!isFirst ? (
              <Pressable
                type="button"
                onClick={() => onStepChange(stepIndex - 1)}
                className="w-full py-1 text-center text-[12px] text-neutral-400"
              >
                上一步
              </Pressable>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}

export type PulseAppCoachProps = {
  open: boolean
  steps: PulseAppCoachStep[]
  stepIndex: number
  onStepChange: (index: number) => void
  onSkip: () => void
  onComplete: () => void
  onBeforeStep?: (step: PulseAppCoachStep, index: number) => void
  layoutEpoch?: string | number
}

export function PulseAppCoach({
  open,
  steps,
  stepIndex,
  onStepChange,
  onSkip,
  onComplete,
  onBeforeStep,
  layoutEpoch,
}: PulseAppCoachProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const step = steps[stepIndex]
  const total = steps.length
  const [hole, setHole] = useState<HoleRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; width: number } | null>(
    null,
  )

  const remeasure = useCallback(() => {
    const overlay = overlayRef.current
    if (!open || !step || !overlay) {
      setHole(null)
      setTooltipPos(null)
      return
    }
    if (step.centered) {
      setHole(null)
      setTooltipPos(null)
      return
    }
    if (step.target) {
      findCoachTargetNode(step.target)?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'instant',
      })
    }
    const extraDelays =
      step.openSocialSheet ||
      step.openTrendingSheet ||
      step.openPublishEditor ||
      step.openDmSheet ||
      step.openDmList
        ? [180, 360, 520, 720, 1000]
        : []
    const measure = () => {
      const o = overlayRef.current
      if (!o || !step.target) {
        setHole(null)
        setTooltipPos(null)
        return
      }
      const nextHole = measureTargetInOverlay(step.target, o)
      const or = o.getBoundingClientRect()
      setHole(nextHole)
      setTooltipPos(nextHole ? layoutTooltipCard(nextHole, or.width, or.height) : null)
    }
    scheduleCoachRemeasure(measure, extraDelays)
  }, [open, step])

  useLayoutEffect(() => {
    if (open && step) onBeforeStep?.(step, stepIndex)
  }, [open, step, stepIndex, onBeforeStep])

  useEffect(() => {
    if (!open || !step) return
    remeasure()
  }, [open, step, stepIndex, layoutEpoch, remeasure])

  useEffect(() => {
    if (!open) return
    const onResize = () => remeasure()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open, remeasure])

  if (!step) return null
  if (typeof document === 'undefined') return null

  const isFirst = stepIndex === 0
  const isLast = stepIndex >= total - 1
  const showHole = open && !!hole && !step.centered

  const cardProps = {
    stepIndex,
    total,
    step,
    isFirst,
    isLast,
    onSkip,
    onStepChange,
    onComplete,
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={overlayRef}
          key="pulse-app-coach"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pulse-app-coach-step-title"
          className="fixed inset-0 overflow-hidden"
          style={{ zIndex: COACH_Z }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Pressable
            type="button"
            className="absolute inset-0 h-full w-full cursor-default border-0 bg-transparent p-0"
            aria-label="跳过引导"
            onClick={onSkip}
          >
            <span className="sr-only">跳过引导</span>
          </Pressable>

          {showHole && hole ? (
            <motion.div
              className="pointer-events-none absolute border-2"
              style={{
                top: hole.top,
                left: hole.left,
                width: hole.width,
                height: hole.height,
                borderRadius: RADIUS,
                borderColor: PULSE_COLORS.lightGold,
                boxShadow: `0 0 0 9999px rgba(0,0,0,0.55), 0 0 28px ${PULSE_COLORS.lightGold}55`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.22 }}
              aria-hidden
            />
          ) : (
            <motion.div className="pointer-events-none absolute inset-0 bg-black/55" aria-hidden />
          )}

          {step.centered ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-5">
              <motion.div
                className="pointer-events-auto w-full max-w-[min(340px,calc(100%-24px))]"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="rounded-[18px] border border-black/5 bg-[#FDFCFA] p-5 shadow-[0_20px_60px_rgba(22,18,14,0.2)]">
                  <CoachCardBody {...cardProps} />
                </div>
              </motion.div>
            </div>
          ) : tooltipPos ? (
            <motion.div
              className="pointer-events-auto absolute z-10 rounded-[18px] border border-black/5 bg-[#FDFCFA] p-5 shadow-[0_20px_60px_rgba(22,18,14,0.2)]"
              style={{
                top: tooltipPos.top,
                left: tooltipPos.left,
                width: tooltipPos.width,
                maxWidth: 'calc(100% - 28px)',
              }}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <CoachCardBody {...cardProps} />
            </motion.div>
          ) : (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-5">
              <motion.div
                className="pointer-events-auto w-full max-w-[min(340px,calc(100%-24px))]"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="rounded-[18px] border border-black/5 bg-[#FDFCFA] p-5 shadow-[0_20px_60px_rgba(22,18,14,0.2)]">
                  <CoachCardBody {...cardProps} />
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
