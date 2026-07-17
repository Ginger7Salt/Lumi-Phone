import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Sparkles, X } from 'lucide-react'

import { Pressable } from '../../components/Pressable'
import { PULSE_COLORS, PULSE_SHEET_SPRING } from './constants'
import {
  PULSE_COACH_HUB_TIP_SECTIONS,
  PULSE_COACH_TOPICS,
  type PulseCoachTopicId,
} from './pulseAppCoachSteps'

export type PulseAppCoachHubProps = {
  open: boolean
  onClose: () => void
  onPickTopic: (topicId: PulseCoachTopicId) => void
}

/** 「玩法」入口：选择指引主题 + 微信联动说明 */
export function PulseAppCoachHub({ open, onClose, onPickTopic }: PulseAppCoachHubProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="absolute inset-0 z-[1470] bg-black/35 backdrop-blur-[4px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-label="关闭玩法面板"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pulse-coach-hub-title"
            className="absolute inset-x-0 bottom-0 z-[1475] flex max-h-[86%] flex-col overflow-hidden rounded-t-[28px] bg-[#FDFCFA] shadow-[0_-16px_48px_rgba(22,18,14,0.18)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={PULSE_SHEET_SPRING}
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="shrink-0 px-5 pt-3">
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-black/10" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-400">Playbook</p>
                  <h2
                    id="pulse-coach-hub-title"
                    className="mt-1 font-serif text-[20px] text-[#1C1C1E]"
                  >
                    玩法指引
                  </h2>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">
                    选一项高亮演示；下方还有粉丝增长与微信联动说明。
                  </p>
                </div>
                <Pressable
                  type="button"
                  onClick={onClose}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04]"
                  aria-label="关闭"
                >
                  <X className="size-4 text-neutral-500" strokeWidth={1.5} />
                </Pressable>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-4">
              <div className="space-y-2.5">
                {PULSE_COACH_TOPICS.map((topic) => (
                  <Pressable
                    key={topic.id}
                    type="button"
                    onClick={() => onPickTopic(topic.id)}
                    className="flex w-full items-center gap-3 rounded-[18px] border border-black/[0.04] bg-white px-4 py-3.5 text-left shadow-sm"
                  >
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: 'rgba(229,152,155,0.12)' }}
                    >
                      <Sparkles
                        className="size-4"
                        strokeWidth={1.4}
                        style={{ color: PULSE_COLORS.dustyRose }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium text-[#1C1C1E]">{topic.title}</span>
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] tracking-wide text-neutral-500"
                          style={{ backgroundColor: 'rgba(212,175,55,0.12)' }}
                        >
                          {topic.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] leading-snug text-neutral-400">
                        {topic.subtitle}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-neutral-300" strokeWidth={1.5} />
                  </Pressable>
                ))}
              </div>

              {PULSE_COACH_HUB_TIP_SECTIONS.map((section) => (
                <div key={section.heading} className="mt-6 mb-2">
                  <p className="text-[11px] font-medium tracking-wide text-neutral-400">
                    {section.heading}
                  </p>
                  <div className="mt-2.5 space-y-2.5">
                    {section.tips.map((tip) => (
                      <div
                        key={tip.title}
                        className="rounded-[16px] border border-black/[0.04] bg-[#F8F7F5] px-3.5 py-3"
                      >
                        <p className="text-[13px] font-medium text-[#2D2422]">{tip.title}</p>
                        <p className="mt-1.5 text-[12px] leading-[1.7] text-neutral-500">{tip.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
