import type { MeetChatSwapCardPayload } from './meetTypes'

/** 互换成功：插入会话流的铂金边框卡片（无 Emoji） */
export function EncounterWeChatSwapCard({ payload }: { payload: MeetChatSwapCardPayload }) {
  return (
    <div className="flex w-full justify-center px-6 py-3">
      <div
        className="w-full max-w-[min(92vw,380px)] rounded-[14px] border border-[#D4AF37]/40 px-5 py-4 text-center shadow-[0_10px_40px_rgba(40,36,28,0.06)] backdrop-blur-[2px]"
        style={{
          background: 'color-mix(in oklab, white 88%, transparent)',
        }}
      >
        <p className="meet-caption-en font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
          CONNECTION ESTABLISHED
        </p>
        <p className="mt-1 text-[12px] font-light tracking-wide text-[#5c574f]">已建立深度联络</p>

        <div className="mt-5 grid grid-cols-2 gap-4 text-left font-mono text-[10px] leading-snug text-gray-600">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-gray-400">His ID</div>
            <div className="mt-0.5 break-all text-[11px] text-[#3d3a34]">{payload.charWechatId}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-gray-400">Your ID</div>
            <div className="mt-0.5 break-all text-[11px] text-[#3d3a34]">{payload.userWechatId}</div>
          </div>
        </div>

        <p
          className="mt-5 font-serif text-[13px] font-light italic leading-relaxed text-[#4a463f]"
          style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
        >
          {payload.note}
        </p>
      </div>
    </div>
  )
}
