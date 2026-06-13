import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Props = {
  open: boolean
  targetLabel?: string
  canElicit: boolean
  busy?: boolean
  onClose: () => void
  onPost: (text: string) => void | Promise<void>
  onElicit: (text: string) => void | Promise<void>
}

export function FloatingInput({
  open,
  targetLabel,
  canElicit,
  busy = false,
  onClose,
  onPost,
  onElicit,
}: Props) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [eliciting, setEliciting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!open) {
      setDraft('')
      setFocused(false)
      setEliciting(false)
      return
    }
    const t = window.setTimeout(() => textareaRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [open])

  if (!open) return null

  const trimmed = draft.trim()
  const postDisabled = busy || eliciting || !trimmed
  const canTriggerElicit = (canElicit || !!trimmed) && !busy && !eliciting

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[450]"
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 24, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 40 }}
    >
      <div className="pointer-events-auto border-t border-gray-100 bg-white/85 px-4 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-[560px]">
          <div className="mb-2 flex items-center justify-between gap-2">
            {targetLabel ? (
              <p className="truncate text-[11px] text-gray-400">{targetLabel}</p>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={busy || eliciting}
              className="shrink-0 text-gray-400 transition-colors hover:text-gray-600 focus:outline-none disabled:opacity-40"
              aria-label="关闭"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white px-3 py-2">
            <textarea
              ref={textareaRef}
              value={draft}
              disabled={busy || eliciting}
              rows={2}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="留白或追问... (Leave a trace)"
              className={`w-full resize-none border-b bg-transparent pb-1.5 text-[13px] leading-relaxed text-[#111827] outline-none transition-colors placeholder:text-gray-400 disabled:opacity-50 ${
                focused ? 'border-gray-400' : 'border-gray-200'
              }`}
            />

            <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
              {canElicit && !trimmed && !busy && !eliciting ? (
                <p className="mr-auto text-[11px] text-[#9CA3AF]">评论已发出，可点唤起回应</p>
              ) : busy || eliciting ? (
                <p className="mr-auto text-[11px] text-[#9CA3AF]">正在唤起回应…</p>
              ) : null}
              <button
                type="button"
                disabled={postDisabled}
                onClick={() => {
                  if (!trimmed) return
                  void (async () => {
                    await onPost(trimmed)
                    setDraft('')
                  })()
                }}
                className="rounded-full bg-[#111827] px-4 py-1.5 text-[12px] font-medium text-white transition-opacity outline-none disabled:opacity-35"
              >
                发布
              </button>
              <button
                type="button"
                disabled={busy || eliciting || !canTriggerElicit}
                onClick={() => {
                  if (busy || eliciting || !canTriggerElicit) return
                  void (async () => {
                    setEliciting(true)
                    try {
                      await onElicit(trimmed)
                    } finally {
                      setEliciting(false)
                    }
                  })()
                }}
                className="rounded-full border border-[#D4AF37]/40 px-4 py-1.5 text-[12px] font-medium text-gray-600 transition-opacity outline-none disabled:opacity-35"
              >
                唤起回应
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
