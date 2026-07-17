import { motion } from 'framer-motion'
import { Check, Eye, Lock, X } from 'lucide-react'
import { useMemo } from 'react'

import { Pressable } from '../../../../components/Pressable'
import { PULSE_COLORS, PULSE_SHEET_SPRING } from '../../constants'
import type { PulseVisibilityCandidate } from '../../pulsePostVisibility'

function buildVisibilitySummary(
  mode: 'public' | 'partial',
  selectedPovIds: readonly string[],
  candidates: readonly PulseVisibilityCandidate[],
): string {
  if (mode !== 'partial' || !selectedPovIds.length) return '全部角色可见'
  const names = selectedPovIds
    .map((id) => candidates.find((c) => c.povId === id)?.name)
    .filter(Boolean) as string[]
  if (!names.length) return `部分可见 · ${selectedPovIds.length} 人`
  if (names.length <= 2) return `仅 ${names.join('、')} 可见`
  return `仅 ${names[0]} 等 ${names.length} 人可见`
}

export function PublishVisibilitySheet({
  mode,
  selectedPovIds,
  candidates,
  onChangeMode,
  onTogglePov,
  onClose,
}: {
  mode: 'public' | 'partial'
  selectedPovIds: readonly string[]
  candidates: readonly PulseVisibilityCandidate[]
  onChangeMode: (mode: 'public' | 'partial') => void
  onTogglePov: (povId: string) => void
  onClose: () => void
}) {
  const selected = useMemo(
    () => new Set(selectedPovIds.map((id) => id.trim()).filter(Boolean)),
    [selectedPovIds],
  )
  const summary = useMemo(
    () => buildVisibilitySummary(mode, selectedPovIds, candidates),
    [mode, selectedPovIds, candidates],
  )

  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1270] bg-black/20 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-label="关闭"
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-[1280] max-h-[72vh] overflow-hidden rounded-t-[28px] bg-white/95 shadow-[0_-12px_48px_rgba(0,0,0,0.08)] backdrop-blur-xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_SHEET_SPRING}
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[#1C1C1E]">谁可以看</p>
            <p className="mt-0.5 truncate text-[11px] text-neutral-400">{summary}</p>
          </div>
          <Pressable type="button" onClick={onClose} className="shrink-0 text-neutral-400" aria-label="关闭">
            <X className="size-5" strokeWidth={1.5} />
          </Pressable>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-4 pb-4">
          <div className="grid gap-2">
            <Pressable
              type="button"
              onClick={() => onChangeMode('public')}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left active:bg-[#F0F0EF] ${
                mode === 'public'
                  ? 'bg-[#FFF5F7] ring-1 ring-[#E5989B]/35'
                  : 'bg-[#FAFAFA]'
              }`}
            >
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(162,178,198,0.18)' }}
              >
                <Eye className="size-4 text-[#7C90A0]" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-[#1C1C1E]">全部角色可见</p>
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  绑定当前身份的角色都能看到
                </p>
              </div>
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  mode === 'public'
                    ? 'border-[#E5989B] bg-[#E5989B] text-white'
                    : 'border-black/15 bg-white text-transparent'
                }`}
              >
                <Check className="size-3" strokeWidth={2.5} />
              </span>
            </Pressable>

            <Pressable
              type="button"
              onClick={() => onChangeMode('partial')}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left active:bg-[#F0F0EF] ${
                mode === 'partial'
                  ? 'bg-[#FFF5F7] ring-1 ring-[#E5989B]/35'
                  : 'bg-[#FAFAFA]'
              }`}
            >
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(229,152,155,0.15)' }}
              >
                <Lock className="size-4" style={{ color: PULSE_COLORS.dustyRose }} strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-[#1C1C1E]">部分角色可见</p>
                <p className="mt-0.5 text-[11px] text-neutral-400">仅勾选的角色知道这条微博</p>
              </div>
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  mode === 'partial'
                    ? 'border-[#E5989B] bg-[#E5989B] text-white'
                    : 'border-black/15 bg-white text-transparent'
                }`}
              >
                <Check className="size-3" strokeWidth={2.5} />
              </span>
            </Pressable>
          </div>

          {mode === 'partial' ? (
            <div className="mt-4">
              <p className="mb-2 px-1 text-[11px] text-neutral-400">
                {candidates.length ? '勾选可见角色' : '暂无绑定角色，请先完成身份绑定'}
              </p>
              {candidates.length ? (
                <div className="grid gap-1">
                  {candidates.map((row) => {
                    const on = selected.has(row.povId)
                    return (
                      <Pressable
                        key={row.povId}
                        type="button"
                        onClick={() => onTogglePov(row.povId)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left active:bg-[#F5F5F4] ${
                          on ? 'bg-[#FFF5F7]' : ''
                        }`}
                      >
                        <div className="size-10 shrink-0 overflow-hidden rounded-full bg-[#F0F0EF]">
                          {row.avatarUrl ? (
                            <img
                              src={row.avatarUrl}
                              alt=""
                              className="size-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-[13px] text-neutral-400">
                              {(row.name || '?').slice(0, 1)}
                            </div>
                          )}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#1C1C1E]">
                          {row.name}
                        </span>
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                            on
                              ? 'border-[#E5989B] bg-[#E5989B] text-white'
                              : 'border-black/15 bg-white text-transparent'
                          }`}
                        >
                          <Check className="size-3" strokeWidth={2.5} />
                        </span>
                      </Pressable>
                    )
                  })}
                </div>
              ) : (
                <p className="rounded-2xl bg-[#FAFAFA] px-4 py-8 text-center text-[13px] text-neutral-400">
                  暂无可选角色
                </p>
              )}
            </div>
          ) : null}

          <p className="mt-4 px-1 text-[11px] leading-relaxed text-neutral-400">
            部分可见时，未勾选的角色不会看到你的微博，也不会参与互动。
          </p>
        </div>
      </motion.div>
    </>
  )
}
