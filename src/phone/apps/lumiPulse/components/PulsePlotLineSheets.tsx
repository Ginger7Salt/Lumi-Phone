import { motion } from 'framer-motion'
import { Check, Settings2 } from 'lucide-react'

import { Pressable } from '../../../components/Pressable'
import { PULSE_COLORS, PULSE_MODAL_SPRING } from '../constants'

export type PlotLineOption = {
  povId: string
  name: string
  /** 是否已生成该线社交数据 */
  hasSocial: boolean
  subtitle?: string
  verifyLabel?: string
  followers?: number
}

/** 切换当前身份的角色剧情线 */
export function PulsePlotLineSwitchSheet({
  options,
  activePovId,
  onSelect,
  onClose,
  onRequestGenerate,
}: {
  options: PlotLineOption[]
  activePovId: string | null
  onSelect: (povId: string) => void
  onClose: () => void
  /** 选中尚未生成社交的线时回调（弹层可先关） */
  onRequestGenerate: (povId: string) => void
}) {
  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1300] bg-black/20 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-label="关闭"
      />
      <div className="pointer-events-none fixed inset-0 z-[1310] flex items-end justify-center px-0 sm:items-center sm:px-5">
        <motion.div
          className="pointer-events-auto flex max-h-[min(72vh,520px)] w-full max-w-sm flex-col overflow-hidden rounded-t-[24px] bg-white/95 shadow-[0_-12px_48px_rgba(0,0,0,0.1)] backdrop-blur-2xl sm:rounded-[24px]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={PULSE_MODAL_SPRING}
        >
          <div className="shrink-0 px-5 pt-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-400">Plot Line</p>
            <h3 className="mt-1 font-serif text-[18px] text-[#1C1C1E]">当前角色剧情线</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
              粉丝数、认证与粉丝口吻跟当前单选的角色剧情线走。已补过用户社交的线可直接切换；未补过的会去「生成社交」——只写你本人在该线的量级，角色账号保持不动。
            </p>
          </div>
          <div className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-5 pb-5">
            {options.map((opt) => {
              const active = opt.povId === activePovId
              return (
                <Pressable
                  key={opt.povId}
                  type="button"
                  onClick={() => {
                    if (!opt.hasSocial) {
                      onRequestGenerate(opt.povId)
                      return
                    }
                    onSelect(opt.povId)
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left ${
                    active
                      ? 'border-[#1C1C1E]/20 bg-[#F4F4F5]'
                      : 'border-transparent bg-[#F8F7F5] hover:bg-[#F4F4F5]'
                  }`}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? 'border-[#1C1C1E] bg-[#1C1C1E] text-white'
                        : 'border-neutral-300 bg-white text-transparent'
                    }`}
                  >
                    <Check className="size-3" strokeWidth={2.4} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-[#1C1C1E]">{opt.name}</span>
                      {!opt.hasSocial ? (
                        <span className="shrink-0 rounded-full bg-[#F0EDE8] px-1.5 py-px text-[10px] text-neutral-500">
                          未生成
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-neutral-400">
                      {opt.hasSocial
                        ? [opt.verifyLabel, opt.followers != null ? `粉丝 ${opt.followers}` : '']
                            .filter(Boolean)
                            .join(' · ') || opt.subtitle || '已生成社交'
                        : '需先补齐该线用户社交才能切换'}
                    </span>
                  </span>
                </Pressable>
              )
            })}
          </div>
        </motion.div>
      </div>
    </>
  )
}

/** 个人页设置：融合模式等 */
export function PulseProfileSettingsSheet({
  fusionMode,
  onToggleFusion,
  onClose,
}: {
  fusionMode: boolean
  onToggleFusion: (next: boolean) => void
  onClose: () => void
}) {
  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1300] bg-black/20 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-label="关闭"
      />
      <div className="pointer-events-none fixed inset-0 z-[1310] flex items-end justify-center sm:items-center sm:px-5">
        <motion.div
          className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-t-[24px] bg-white/95 px-5 pb-8 pt-5 shadow-[0_-12px_48px_rgba(0,0,0,0.1)] backdrop-blur-2xl sm:rounded-[24px]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={PULSE_MODAL_SPRING}
        >
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-neutral-400" strokeWidth={1.5} />
            <h3 className="font-serif text-[17px] text-[#1C1C1E]">剧情线设置</h3>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
            默认只有「当前剧情线」上的角色会下场互动。开启融合后，同身份下其他已生成社交的绑定角色也会看到你的帖——他们仍按自己那条线里认识的你来反应，容易出现抓马反差。
          </p>

          <Pressable
            type="button"
            onClick={() => onToggleFusion(!fusionMode)}
            className="mt-4 flex w-full items-center justify-between rounded-2xl bg-[#F8F7F5] px-4 py-3.5 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-[#1C1C1E]">融合模式</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-neutral-400">
                例：艺人线发跑通告，小透明线角色会疑惑吐槽
              </span>
            </span>
            <span
              className={`relative ml-3 h-7 w-12 shrink-0 rounded-full transition-colors ${
                fusionMode ? 'bg-[#1C1C1E]' : 'bg-neutral-300'
              }`}
            >
              <span
                className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform ${
                  fusionMode ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </Pressable>

          <Pressable
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-2xl py-3 text-center text-[13px] font-medium text-white"
            style={{ backgroundColor: PULSE_COLORS.dustyRose }}
          >
            完成
          </Pressable>
        </motion.div>
      </div>
    </>
  )
}
