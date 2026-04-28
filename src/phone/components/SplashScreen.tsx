import { motion, useAnimationControls } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

type SplashScreenProps = {
  onComplete?: () => void
  background?: '#FFFFFF' | '#F9FAFB' | string
  brandName?: string
}

const whispers = [
  '万幸相遇 愿这一路 一路放晴',
  '同频的人就像礼物',
  '希望片刻像永恒',
  '人在对的爱里 会闪闪发光',
  '我真诚且炙热的爱 仅你可见',
  '你出现时 心动便有了定义',
  '我们肩并肩 幸福在指尖',
  '这一帧只属于我们',
  '照片的意义在于把瞬间变成永恒',
  '不止玫瑰有爱意',
  '月亮是我抛到硬币 两面都有你',
  '我会毫不犹豫的奔向你 这次 每次 次次',
  '山野千里 你是我藏在星星的浪漫',
  '蓄谋已久 得偿所愿',
  '那就在一起黄昏与四季',
  '与你续写春时',
  '我本见万物波澜不惊 唯独见你方寸大乱',
  '晴天',
  '心跳比我先认识你',
  '你像阳光一样出现 涉悸 于是枯木逢春',
  '你的出现 胜过明媚的春',
  '幸福 放慢倍速',
  '遇到了我的常春树',
  '我知道爱是把倾斜的雨伞',
  '像是心跳听到了合奏',
  '是偏爱 是双向奔赴',
  '是镜头反转 对准相爱的我们',
  '爱会垫脚 也会弯腰',
  '人声鼎沸 我对你的爱意真诚鼎沸',
  '新鲜感确实很让人心动 但爱和真诚更胜一筹',
  '兜兜转转的重逢才是浪漫的开始',
  '恋爱花絮更新',
  '那一天 那一刻',
  '爱你是锦上添花',
  '日落黄昏往前 我和你往后',
  '总有些浪漫的际遇',
  '幸福的起点',
  '冬天的约定 我和你',
  '相逢的意义在于照亮彼此',
  '小概率双向事件',
  '以如常为喜 以如愿为安',
  '千万人中 万幸得以相逢',
] as const

/**
 * The Platinum Awakening
 * 全屏开屏动画：挂载即播放，结束后回调并自卸载。
 */
export function SplashScreen({
  onComplete,
  background = '#FFFFFF',
  brandName = 'L U M I',
}: SplashScreenProps) {
  const overlayControls = useAnimationControls()
  const lineControls = useAnimationControls()
  const textControls = useAnimationControls()
  const whisperControls = useAnimationControls()
  const glowControls = useAnimationControls()
  const [active, setActive] = useState(true)
  const whisper = useMemo(
    () => whispers[Math.floor(Math.random() * whispers.length)] ?? whispers[0],
    [],
  )

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    let cancelled = false

    const runSequence = async () => {
      // 初始状态
      await Promise.all([
        overlayControls.set({ opacity: 1, y: 0 }),
        lineControls.set({ width: 0, height: 1, opacity: 1 }),
        textControls.set({ opacity: 0, y: 5, scale: 1, filter: 'blur(4px)' }),
        whisperControls.set({ opacity: 0, y: 10, scale: 1, filter: 'blur(4px)' }),
        glowControls.set({ opacity: 0, scale: 0.96 }),
      ])

      // Stage 1: 线之凝结 (0.0 - 0.8s)
      await lineControls.start({
        width: 100,
        transition: { duration: 0.8, ease: 'easeInOut' },
      })
      if (cancelled) return

      // Stage 2: 品牌名显影 (0.8 - 1.6s)
      await Promise.all([
        lineControls.start({
          height: 6,
          opacity: 0,
          transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
        }),
        textControls.start({
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
        }),
      ])
      if (cancelled) return

      // Stage 3: 寄语浮现 (1.8 - 3.5s)
      await whisperControls.start({
        opacity: 0.8,
        y: 0,
        filter: 'blur(0px)',
        transition: { duration: 1.7, ease: [0.22, 1, 0.36, 1] },
      })
      if (cancelled) return

      // Stage 4: 晨雾揭幕 (3.5 - 4.5s)
      await Promise.all([
        textControls.start({
          scale: [1, 1.015, 0.98],
          opacity: [1, 1, 0],
          y: [0, 0, -4],
          filter: ['blur(0px)', 'blur(0px)', 'blur(4px)'],
          transition: { duration: 0.72, ease: [0.33, 1, 0.68, 1], times: [0, 0.38, 1] },
        }),
        whisperControls.start({
          scale: [1, 1.01, 0.98],
          opacity: [0.8, 0.8, 0],
          y: [0, 0, -2],
          filter: ['blur(0px)', 'blur(0px)', 'blur(4px)'],
          transition: { duration: 0.72, ease: [0.33, 1, 0.68, 1], times: [0, 0.38, 1] },
        }),
        glowControls.start({
          opacity: [0, 0.2, 0],
          scale: [0.96, 1.04, 1.08],
          transition: { duration: 0.72, ease: 'easeOut', times: [0, 0.38, 1] },
        }),
      ])
      if (cancelled) return

      await overlayControls.start({
        y: '-100%',
        opacity: 0,
        transition: {
          type: 'spring',
          damping: 42,
          stiffness: 220,
          mass: 1,
        },
      })
      if (cancelled) return

      document.body.style.overflow = previousOverflow
      setActive(false)
      onComplete?.()
    }

    runSequence().catch(() => {
      if (cancelled) return
      document.body.style.overflow = previousOverflow
      setActive(false)
      onComplete?.()
    })

    return () => {
      cancelled = true
      document.body.style.overflow = previousOverflow
    }
  }, [glowControls, lineControls, onComplete, overlayControls, textControls, whisperControls])

  if (!active) return null

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background,
        willChange: 'transform, opacity',
      }}
      initial={false}
      animate={overlayControls}
      aria-label="Splash Screen"
      role="status"
    >
      <div className="relative flex w-full max-w-[300px] flex-col items-center justify-center px-7 text-center">
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle, rgba(212,175,55,0.24) 0%, rgba(212,175,55,0.08) 38%, rgba(212,175,55,0) 70%)',
            filter: 'blur(24px)',
            willChange: 'opacity, transform',
          }}
          animate={glowControls}
        />

        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            background: '#D4AF37',
            boxShadow: '0 0 12px rgba(212, 175, 55, 0.22)',
            borderRadius: 999,
            willChange: 'width, opacity, height',
          }}
          animate={lineControls}
        />

        <motion.span
          className="relative select-none text-[14px] tracking-[0.5em] sm:text-[15px]"
          style={{
            color: '#1C1C1E',
            fontFamily: '"Didot", "Optima", "SF Pro Display", "Helvetica Neue", sans-serif',
            fontWeight: 400,
            textRendering: 'geometricPrecision',
            WebkitFontSmoothing: 'antialiased',
            letterSpacing: '0.5em',
            willChange: 'opacity, transform, filter',
          }}
          animate={textControls}
        >
          {brandName}
        </motion.span>

        <motion.p
          className="mt-5 select-none text-[10px] font-light leading-relaxed tracking-[0.3em] text-center sm:text-xs"
          style={{
            color: '#C5A880',
            fontFamily: '"Songti SC", "STSong", "SimSun", "Noto Serif SC", serif',
            WebkitFontSmoothing: 'antialiased',
            textRendering: 'geometricPrecision',
            willChange: 'opacity, transform, filter',
          }}
          animate={whisperControls}
        >
          {whisper}
        </motion.p>
      </div>
    </motion.div>
  )
}
