import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiConfig } from '../../../api/types'
import { Pressable } from '../../../../components/Pressable'
import { SimNum, SimNumText } from '../components/SimNum'
import type { Artist, ChatMessage } from '../types'
import { useSimulatorStore } from '../useSimulatorStore'

const EMPTY_THREAD: ChatMessage[] = []

export function ProducerChatRoom({
  artist,
  mainApi,
  onBack,
}: {
  artist: Artist
  mainApi: ApiConfig | null
  onBack: () => void
}) {
  const threadRaw = useSimulatorStore((s) => s.chatThreads[artist.id])
  const thread = threadRaw ?? EMPTY_THREAD
  const sendChatMessage = useSimulatorStore((s) => s.sendChatMessage)
  const liveArtist = useSimulatorStore((s) => s.artists.find((a) => a.id === artist.id))
  const live = liveArtist ?? artist
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread.length, sending])

  const handleSend = useCallback(async () => {
    const t = draft.trim()
    if (!t || sending) return
    setSending(true)
    setDraft('')
    try {
      await sendChatMessage(artist.id, t, mainApi)
    } finally {
      setSending(false)
    }
  }, [artist.id, draft, mainApi, sendChatMessage, sending])

  return (
    <motion.div
      className="absolute inset-0 z-[110] flex h-full min-h-0 w-full flex-col bg-[#ededed]"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-black/5 bg-[#f7f7f7] px-3 pb-2 pt-[max(10px,env(safe-area-inset-top,0px))]">
        <Pressable onClick={onBack} className="flex h-9 w-9 items-center justify-center" aria-label="返回">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-[16px] font-medium text-stone-800">{live.name}</h1>
          <p className="text-[11px] text-stone-500">
            好感 <SimNum className="text-rose-500">{live.affection}</SimNum>
          </p>
        </div>
        <div className="w-9" />
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto py-3">
        {thread.length === 0 && (
          <p className="px-6 py-8 text-center text-[13px] text-stone-500">发一条消息，开启专属对话。</p>
        )}
        <div className="flex flex-col gap-3 px-5">
          {thread.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2.5 text-[15px] leading-relaxed ${
                  m.role === 'user'
                    ? 'rounded-[18px] rounded-br-[4px] bg-rose-300 text-white'
                    : 'rounded-[18px] rounded-bl-[4px] bg-white text-stone-800 shadow-sm'
                }`}
              >
                <SimNumText text={m.content} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-black/5 bg-[#f7f7f7] px-3 py-2 pb-[max(10px,env(safe-area-inset-bottom,0px))]">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="说点什么…"
          rows={1}
          disabled={sending}
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[15px] outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
        />
        <Pressable
          onClick={() => void handleSend()}
          disabled={sending || !draft.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-400 text-white disabled:opacity-40"
        >
          ↑
        </Pressable>
      </div>
    </motion.div>
  )
}
