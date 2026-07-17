import { motion } from 'framer-motion'
import { MapPin, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Pressable } from '../../../../components/Pressable'
import { PULSE_SHEET_SPRING } from '../../constants'

const MAX_LOCATION_LEN = 48

export function PublishLocationSheet({
  selected,
  onPick,
  onClear,
  onClose,
}: {
  selected?: string
  onPick: (label: string) => void
  onClear: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(() => selected?.trim() || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [])

  const trimmed = draft.trim()
  const canConfirm = trimmed.length > 0

  const confirm = () => {
    if (!canConfirm) return
    onPick(trimmed.slice(0, MAX_LOCATION_LEN))
  }

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
        className="fixed inset-x-0 bottom-0 z-[1280] overflow-hidden rounded-t-[28px] bg-white/95 shadow-[0_-12px_48px_rgba(0,0,0,0.08)] backdrop-blur-xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_SHEET_SPRING}
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <p className="text-[13px] font-medium text-[#1C1C1E]">添加位置</p>
          <Pressable type="button" onClick={onClose} className="text-neutral-400" aria-label="关闭">
            <X className="size-5" strokeWidth={1.5} />
          </Pressable>
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 rounded-2xl bg-[#F7F6F5] px-3.5 py-3">
            <MapPin className="size-4 shrink-0 text-neutral-400" strokeWidth={1.5} />
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LOCATION_LEN))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  confirm()
                }
              }}
              maxLength={MAX_LOCATION_LEN}
              placeholder="输入地点，如：自家阳台 / 咖啡店角落"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-[#1C1C1E] outline-none placeholder:text-neutral-300"
            />
          </div>
          <p className="mt-2 px-1 text-[11px] text-neutral-400">
            可写任意地点名，最多 {MAX_LOCATION_LEN} 字
          </p>

          <div className="mt-4 flex gap-2">
            {selected ? (
              <Pressable
                type="button"
                onClick={onClear}
                className="flex-1 rounded-full bg-[#F5F5F4] py-2.5 text-[13px] text-neutral-600"
              >
                清除位置
              </Pressable>
            ) : null}
            <Pressable
              type="button"
              disabled={!canConfirm}
              onClick={confirm}
              className="flex-[1.4] rounded-full bg-[#1C1C1E] py-2.5 text-[13px] text-white disabled:opacity-35"
            >
              确认
            </Pressable>
          </div>
        </div>
      </motion.div>
    </>
  )
}
