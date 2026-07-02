import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { PulseNumericText } from './PulseNum'
import { PULSE_COLORS, PULSE_SHEET_SPRING } from '../constants'

const POST_COUNT_OPTIONS = [1, 2, 3, 5, 8] as const

/** 个人主页 AI 生成：选择动态条数并开始生成 */
export function PulseProfileGenerateSheet({
  characterName,
  worldName,
  generating,
  onClose,
  onGenerate,
}: {
  characterName: string
  worldName: string
  generating: boolean
  onClose: () => void
  onGenerate: (postCount: number) => void
}) {
  const [postCount, setPostCount] = useState<number>(3)

  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1300] bg-black/15 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !generating && onClose()}
        aria-label="关闭"
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-[1310] rounded-t-[24px] bg-white/95 px-5 pb-8 pt-4 backdrop-blur-2xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_SHEET_SPRING}
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/10" />
        <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-400">Profile Generate</p>
        <h3 className="mt-1 font-serif text-[18px] text-[#1C1C1E]">按人设生成主页</h3>
        <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
          为 <strong className="font-medium text-[#1C1C1E]">{characterName}</strong>（{worldName}）
          生成关注/粉丝/获赞数据，以及 TA 发布的微博动态，每条含点赞、评论、转发与消息通知。
        </p>

        <p className="mt-5 text-[11px] tracking-wide text-neutral-400">生成动态条数</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {POST_COUNT_OPTIONS.map((n) => {
            const active = postCount === n
            return (
              <Pressable
                key={n}
                type="button"
                disabled={generating}
                onClick={() => setPostCount(n)}
                className={`min-w-[44px] rounded-full px-4 py-2 text-[13px] ${
                  active
                    ? 'bg-[#1C1C1E] font-medium text-white'
                    : 'bg-[#F5F5F4] text-neutral-600'
                }`}
              >
                <PulseNumericText text={`${n} 条`} />
              </Pressable>
            )
          })}
        </div>

        <Pressable
          type="button"
          disabled={generating}
          onClick={() => onGenerate(postCount)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: PULSE_COLORS.dustyRose }}
        >
          <Sparkles className="size-4" strokeWidth={1.4} />
          {generating ? '生成中…' : '开始生成'}
        </Pressable>
      </motion.div>
    </>
  )
}
