import { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EncounterNPC } from './meetTypes'
import { expandMeetPersonaPlaintext } from './meetPersonaPreview'
import { useLumiMeetStore } from './LumiMeetStore'
import { EncounterChatRoom } from './EncounterChatRoom'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'

export function EncounterChats() {
  const { state } = useLumiMeetStore()
  const [open, setOpen] = useState<EncounterNPC | null>(null)
  const meetPortalEl = getLumiMeetPortalTarget()

  const inboxPersonaPreview = useCallback(
    (n: EncounterNPC) => {
      const line = expandMeetPersonaPlaintext(n.persona, n.nickname, state.meetProfile)
      return line.length > 52 ? `${line.slice(0, 52)}…` : line
    },
    [state.meetProfile],
  )

  const matched = useMemo(() => {
    const list = state.npcs.filter((n) => n.status === 'matched' || n.status === 'wechat_added')
    return [...list].sort((a, b) => {
      const msgsA = state.chatThreads[a.id] ?? []
      const msgsB = state.chatThreads[b.id] ?? []
      const ta = msgsA.length ? Math.max(...msgsA.map((m) => m.ts)) : a.lastEncounterTime
      const tb = msgsB.length ? Math.max(...msgsB.map((m) => m.ts)) : b.lastEncounterTime
      return tb - ta
    })
  }, [state.chatThreads, state.npcs])

  return (
    <>
    <div className="meet-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-28 pt-2">
      <h2 className="font-elegant-serif text-[1.35rem] font-medium tracking-[0.08em] text-[#2c2a26]">消息</h2>
      <p className="meet-caption-en mt-0.5 text-[10px] uppercase tracking-[0.35em] text-[#b8b5ad]">
        Inbox · 临时会话
      </p>

      {matched.length === 0 ? (
        <p className="mt-8 text-center font-elegant-serif text-[14px] leading-relaxed text-[#8a8680]">
          暂无匹配对象。去「遇见」点一次心动，让命运先响一声。
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {matched.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => setOpen(n)}
                className="flex w-full items-center gap-3 rounded-[16px] border border-black/[0.04] bg-white p-3 text-left shadow-[0_8px_32px_rgba(40,36,30,0.04)] transition active:scale-[0.99]"
              >
                <img src={n.avatarUrl} alt="" className="size-12 shrink-0 rounded-2xl object-cover ring-1 ring-black/[0.05]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-medium text-[#3d3a34]">{n.nickname}</span>
                    {n.status === 'wechat_added' ? (
                      <span className="meet-caption-en shrink-0 text-[9px] text-[#b8a994]">WECHAT</span>
                    ) : null}
                  </div>
                  <p className="truncate text-[12px] font-light text-[#9a9590]">{inboxPersonaPreview(n)}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
    {open && meetPortalEl
      ? createPortal(
          <div className="fixed inset-0 z-[290] flex min-h-0 flex-col bg-[#ededed]">
            <EncounterChatRoom npc={open} onBack={() => setOpen(null)} />
          </div>,
          meetPortalEl,
        )
      : null}
    </>
  )
}
