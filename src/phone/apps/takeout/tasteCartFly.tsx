import { motion } from 'framer-motion'
import { useLayoutEffect, useMemo, useState, type RefObject } from 'react'

const FLY_SIZE = 40
export const CART_FLY_DURATION_MS = 640

function quadBezier(t: number, a: number, b: number, c: number) {
  const u = 1 - t
  return u * u * a + 2 * u * t * b + t * t * c
}

function buildArcKeyframes(
  from: DOMRect,
  toCenter: { x: number; y: number },
  steps = 28,
) {
  const x0 = from.left + from.width / 2
  const y0 = from.top + from.height / 2
  const x1 = toCenter.x
  const y1 = toCenter.y

  const cx = x0 + (x1 - x0) * 0.55
  const arcHeight = Math.min(180, Math.max(64, Math.abs(y1 - y0) * 0.38 + 48))
  const cy = Math.min(y0, y1) - arcHeight

  const xs: number[] = []
  const ys: number[] = []
  const scales: number[] = []
  const opacities: number[] = []
  const rotates: number[] = []

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2

    xs.push(quadBezier(eased, x0, cx, x1) - FLY_SIZE / 2)
    ys.push(quadBezier(eased, y0, cy, y1) - FLY_SIZE / 2)
    scales.push(1 + Math.sin(Math.PI * t) * 0.08 - t ** 1.6 * 0.68)
    opacities.push(t < 0.88 ? 1 : 1 - (t - 0.88) / 0.12)
    rotates.push((t - 0.5) * 16)
  }

  return { xs, ys, scales, opacities, rotates }
}

function fallbackTarget(): { x: number; y: number } {
  return {
    x: 52,
    y: window.innerHeight - 56,
  }
}

export function CartFlyParticle({
  image,
  fromRect,
  targetRef,
  onComplete,
}: {
  image: string
  fromRect: DOMRect
  targetRef: RefObject<HTMLElement | null>
  onComplete?: () => void
}) {
  const [targetCenter, setTargetCenter] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const el = targetRef.current
      if (el) {
        const r = el.getBoundingClientRect()
        setTargetCenter({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
        return
      }
      setTargetCenter(fallbackTarget())
    }

    measure()
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [targetRef, fromRect.left, fromRect.top, fromRect.width, fromRect.height])

  const keyframes = useMemo(() => {
    if (!targetCenter) return null
    return buildArcKeyframes(fromRect, targetCenter)
  }, [fromRect, targetCenter])

  if (!keyframes) return null

  const times = keyframes.xs.map((_, i) => i / (keyframes.xs.length - 1))

  return (
    <motion.img
      src={image}
      alt=""
      className="pointer-events-none fixed z-[90] rounded-xl object-cover shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
      style={{ width: FLY_SIZE, height: FLY_SIZE, left: 0, top: 0, willChange: 'transform, opacity' }}
      initial={{
        x: keyframes.xs[0],
        y: keyframes.ys[0],
        scale: keyframes.scales[0],
        opacity: keyframes.opacities[0],
        rotate: keyframes.rotates[0],
      }}
      animate={{
        x: keyframes.xs,
        y: keyframes.ys,
        scale: keyframes.scales,
        opacity: keyframes.opacities,
        rotate: keyframes.rotates,
      }}
      transition={{
        duration: CART_FLY_DURATION_MS / 1000,
        times,
        ease: 'linear',
      }}
      onAnimationComplete={onComplete}
      draggable={false}
    />
  )
}
