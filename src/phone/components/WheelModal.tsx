import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pressable } from './Pressable'
import { WheelEditor } from './WheelEditor'
import type { PhoneTheme } from '../types'

const SEGMENT_COUNT = 8
const SEGMENT_DEG = 360 / SEGMENT_COUNT

type Props = {
  open: boolean
  options: string[]
  theme: PhoneTheme
  onClose: () => void
  onChangeOptions: (options: string[]) => void
}

function normalizeAngle(angle: number) {
  let next = angle % 360
  if (next < 0) next += 360
  return next
}

function shortestAngleDelta(from: number, to: number) {
  let delta = to - from
  while (delta > 180) delta -= 360
  while (delta < -180) delta += 360
  return delta
}

function polar(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + Math.cos(rad) * radius,
    y: cy + Math.sin(rad) * radius,
  }
}

function sectorPath(cx: number, cy: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  const outerStart = polar(cx, cy, outerRadius, startAngle)
  const outerEnd = polar(cx, cy, outerRadius, endAngle)
  const innerEnd = polar(cx, cy, innerRadius, endAngle)
  const innerStart = polar(cx, cy, innerRadius, startAngle)

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

function arcTextPath(id: string, cx: number, cy: number, radius: number, startAngle: number, endAngle: number, index: number) {
  const mid = normalizeAngle((startAngle + endAngle) / 2)
  const invert = mid > 90 && mid < 270
  const from = invert ? endAngle : startAngle
  const to = invert ? startAngle : endAngle
  const arcStart = polar(cx, cy, radius, from)
  const arcEnd = polar(cx, cy, radius, to)
  const largeArc = Math.abs(to - from) > 180 ? 1 : 0
  const sweep = invert ? 0 : 1

  return (
    <path
      id={id}
      key={`wheel-text-path-${index}`}
      d={`M ${arcStart.x} ${arcStart.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${arcEnd.x} ${arcEnd.y}`}
      fill="none"
    />
  )
}

function resolveSelectedIndex(rotation: number) {
  const normalized = normalizeAngle(rotation)
  const index = Math.round(normalized / SEGMENT_DEG) % SEGMENT_COUNT
  return ((SEGMENT_COUNT - index) % SEGMENT_COUNT + SEGMENT_COUNT) % SEGMENT_COUNT
}

export function WheelModal({ open, options, theme, onClose, onChangeOptions }: Props) {
  const wheelRef = useRef<HTMLDivElement | null>(null)
  const rotation = useMotionValue(0)
  const scale = useMotionValue(1)
  const inertiaRef = useRef<ReturnType<typeof animate> | null>(null)
  const draggingRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const startAngleRef = useRef(0)
  const startRotationRef = useRef(0)
  const lastAngleRef = useRef(0)
  const lastTimeRef = useRef(0)
  const velocityRef = useRef(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [editorOpen, setEditorOpen] = useState(false)
  const pathId = useId()

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setEditorOpen(false)
      return
    }
    setSelectedIndex(resolveSelectedIndex(rotation.get()))
  }, [open, rotation])

  const stopCurrentAnimation = useCallback(() => {
    inertiaRef.current?.stop()
    inertiaRef.current = null
  }, [])

  const computePointerAngle = useCallback((clientX: number, clientY: number) => {
    const rect = wheelRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI
  }, [])

  const settleSelection = useCallback((rotationValue: number) => {
    const index = resolveSelectedIndex(rotationValue)
    setSelectedIndex(index)
    animate(scale, 1.02, {
      duration: 0.12,
      ease: 'easeOut',
      onComplete: () => {
        animate(scale, 1, { type: 'spring', stiffness: 360, damping: 26 })
      },
    })
  }, [scale])

  const startInertia = useCallback(() => {
    stopCurrentAnimation()
    const current = rotation.get()
    const flingVelocity = Math.max(-1440, Math.min(1440, velocityRef.current * 1.28))
    const rawTarget = current + flingVelocity * 0.9
    const snapped = Math.round(rawTarget / SEGMENT_DEG) * SEGMENT_DEG
    inertiaRef.current = animate(rotation, snapped, {
      type: 'inertia',
      velocity: flingVelocity,
      power: 0.5,
      timeConstant: 560,
      restDelta: 0.3,
      modifyTarget: () => snapped,
      onComplete: () => {
        settleSelection(rotation.get())
      },
    })
  }, [rotation, settleSelection, stopCurrentAnimation])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    stopCurrentAnimation()
    draggingRef.current = true
    pointerIdRef.current = event.pointerId
    startAngleRef.current = computePointerAngle(event.clientX, event.clientY)
    startRotationRef.current = rotation.get()
    lastAngleRef.current = startAngleRef.current
    lastTimeRef.current = performance.now()
    velocityRef.current = 0
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [computePointerAngle, rotation, stopCurrentAnimation])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return
    event.preventDefault()
    const nextAngle = computePointerAngle(event.clientX, event.clientY)
    const delta = shortestAngleDelta(startAngleRef.current, nextAngle)
    const nextRotation = startRotationRef.current + delta * 1.12
    rotation.set(nextRotation)

    const now = performance.now()
    const dt = Math.max(1, now - lastTimeRef.current)
    const deltaAngle = shortestAngleDelta(lastAngleRef.current, nextAngle)
    const instantVelocity = ((deltaAngle * 1.12) / dt) * 1000
    velocityRef.current = velocityRef.current * 0.35 + instantVelocity * 0.65
    lastAngleRef.current = nextAngle
    lastTimeRef.current = now
  }, [computePointerAngle, rotation])

  const handlePointerUp = useCallback((event?: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    if (event) event.preventDefault()
    draggingRef.current = false
    pointerIdRef.current = null
    startInertia()
  }, [startInertia])

  const updateOption = useCallback((index: number, value: string) => {
    const next = [...options]
    next[index] = value
    onChangeOptions(next)
  }, [onChangeOptions, options])

  const modalContent = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[85] flex items-center justify-center px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={onClose}
          style={{
            background: 'rgba(245,246,248,0.4)',
            backdropFilter: 'blur(24px) saturate(1.1)',
          }}
        >
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.2, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            style={{ background: '#ffffff' }}
          />
          <motion.div
            className="relative w-full max-w-[380px] overflow-hidden rounded-[34px] border px-5 pb-5 pt-6 shadow-[0_26px_60px_rgba(15,23,42,0.16)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(event) => event.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.88), rgba(250,250,252,0.8))',
              borderColor: 'rgba(255,255,255,0.72)',
            }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.34em]"
                  style={{ color: theme.textMuted }}
                >
                  Destiny Compass
                </p>
                <p className="mt-1 text-[18px]" style={{ color: theme.text }}>
                  决策罗盘
                </p>
              </div>
              <Pressable
                onClick={onClose}
                className="ml-auto rounded-full border px-3 py-1.5 text-[11px]"
                style={{
                  borderColor: theme.border,
                  background: 'rgba(255,255,255,0.7)',
                  color: theme.textMuted,
                }}
              >
                关闭
              </Pressable>
            </div>

            <div className="relative flex justify-center pb-3 pt-2">
              {!editorOpen ? (
                <div
                  className="pointer-events-none absolute left-1/2 top-0 z-20 h-0 w-0 -translate-x-1/2"
                  style={{
                    borderLeft: '12px solid transparent',
                    borderRight: '12px solid transparent',
                    borderTop: '20px solid #D4AF37',
                    filter: 'drop-shadow(0 6px 10px rgba(212,175,55,0.25))',
                  }}
                />
              ) : null}

              <motion.div
                ref={wheelRef}
                className="relative aspect-square w-full max-w-[320px] touch-none select-none"
                style={{ rotate: rotation, scale }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onContextMenu={(event) => event.preventDefault()}
                role="presentation"
              >
                <svg viewBox="0 0 1000 1000" className="h-full w-full">
                  <defs>
                    {options.map((_, index) => {
                      const center = -90 + index * SEGMENT_DEG
                      return arcTextPath(
                        `${pathId}-${index}`,
                        500,
                        500,
                        312,
                        center - 15,
                        center + 15,
                        index,
                      )
                    })}
                  </defs>

                  <circle cx="500" cy="500" r="458" fill="rgba(255,255,255,0.72)" stroke="rgba(255,255,255,0.9)" strokeWidth="8" />
                  <circle cx="500" cy="500" r="425" fill="rgba(247,247,249,0.92)" stroke="#E5E7EB" strokeWidth="3" />

                  {options.map((option, index) => {
                    const center = -90 + index * SEGMENT_DEG
                    const start = center - SEGMENT_DEG / 2
                    const end = center + SEGMENT_DEG / 2
                    const active = selectedIndex === index
                    return (
                      <g key={`wheel-segment-${index}`}>
                        <path
                          d={sectorPath(500, 500, 170, 410, start, end)}
                          fill={active ? 'rgba(212,175,55,0.12)' : index % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(245,246,248,0.92)'}
                          stroke="#E5E7EB"
                          strokeWidth="2"
                        />
                        <text
                          fill={active ? '#D4AF37' : '#1C1C1E'}
                          fontSize="34"
                          letterSpacing="2"
                          fontFamily={theme.fontFamily}
                        >
                          <textPath href={`#${pathId}-${index}`} startOffset="50%" textAnchor="middle">
                            {(option || `选项 ${index + 1}`).slice(0, 12)}
                          </textPath>
                        </text>
                      </g>
                    )
                  })}

                  <circle cx="500" cy="500" r="138" fill="rgba(255,255,255,0.92)" stroke="#E5E7EB" strokeWidth="3" />
                  <circle cx="500" cy="500" r="36" fill="rgba(212,175,55,0.14)" stroke="rgba(212,175,55,0.45)" strokeWidth="2" />
                </svg>
              </motion.div>
            </div>

            <div className="mt-2 flex items-center gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.26em]" style={{ color: theme.textMuted }}>
                  Current Outcome
                </p>
                <p className="mt-1 truncate text-[16px]" style={{ color: '#1C1C1E' }}>
                  {options[selectedIndex] || `选项 ${selectedIndex + 1}`}
                </p>
              </div>
              <Pressable
                onClick={() => setEditorOpen(true)}
                className="ml-auto rounded-full border px-4 py-2 text-[12px]"
                style={{
                  borderColor: theme.border,
                  background: 'rgba(255,255,255,0.76)',
                  color: theme.text,
                }}
              >
                编辑选项
              </Pressable>
            </div>
          </motion.div>

          <AnimatePresence>
            {editorOpen ? (
              <motion.div
                className="absolute inset-0 z-[2] flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(event) => event.stopPropagation()}
                style={{
                  background: 'rgba(245,246,248,0.32)',
                  backdropFilter: 'blur(18px)',
                }}
              >
                <motion.div
                  className="relative w-full max-w-[400px] overflow-hidden rounded-[34px] border px-5 pb-5 pt-6 shadow-[0_26px_60px_rgba(15,23,42,0.16)]"
                  initial={{ y: 22, scale: 0.98 }}
                  animate={{ y: 0, scale: 1 }}
                  exit={{ y: 18, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(250,250,252,0.86))',
                    borderColor: 'rgba(255,255,255,0.8)',
                  }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div>
                      <p
                        className="text-[10px] uppercase tracking-[0.34em]"
                        style={{ color: theme.textMuted }}
                      >
                        Edit Options
                      </p>
                      <p className="mt-1 text-[18px]" style={{ color: theme.text }}>
                        罗盘选项编辑
                      </p>
                    </div>
                    <Pressable
                      onClick={() => setEditorOpen(false)}
                      className="ml-auto rounded-full border px-3 py-1.5 text-[11px]"
                      style={{
                        borderColor: theme.border,
                        background: 'rgba(255,255,255,0.7)',
                        color: theme.textMuted,
                      }}
                    >
                      返回罗盘
                    </Pressable>
                  </div>

                  <div
                    className="rounded-[22px] border px-4 py-4"
                    style={{
                      borderColor: theme.border,
                      background: 'rgba(255,255,255,0.58)',
                    }}
                  >
                    <WheelEditor options={options} theme={theme} onChangeOption={updateOption} />
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )

  if (typeof document === 'undefined') return modalContent
  return createPortal(modalContent, document.body)
}
