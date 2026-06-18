import { CircleHelp, X } from 'lucide-react'

export function DirectorModeHelpButton(props: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label="导演模式说明"
      title="导演模式说明"
      onClick={props.onClick}
      className={
        props.className ??
        'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[#a3a3a3] transition-colors hover:bg-stone-100 hover:text-[#525252]'
      }
    >
      <CircleHelp className="size-3.5" strokeWidth={1.75} />
    </button>
  )
}

export function DirectorModeHelpPanel(props: { open: boolean; onClose: () => void }) {
  if (!props.open) return null
  return (
    <div
      className="absolute inset-0 z-[70] flex items-end justify-center bg-black/35 p-4 sm:items-center"
      onClick={props.onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl border border-stone-200 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <p className="text-[14px] font-semibold text-stone-900">导演模式</p>
          <button
            type="button"
            className="rounded-lg p-1 text-stone-500 hover:bg-stone-50 hover:text-stone-700"
            aria-label="关闭"
            onClick={props.onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4 text-[13px] leading-relaxed text-[#525252]">
          <p>
            <strong className="font-medium text-[#262626]">开启</strong>
            ：你输入的是<strong className="font-medium text-[#262626]">下一段剧情的生成指引</strong>
            ，事件尚未发生。AI 会从当前场面起笔，当场演出过程，不会默认已经写完结果。
          </p>
          <p>
            <strong className="font-medium text-[#262626]">关闭</strong>
            ：你输入视为<strong className="font-medium text-[#262626]">已经发生</strong>
            的言行或场面，AI 从他人感知与反应续写后续。
          </p>
          <p className="text-[12px] text-[#8e8e8e]">
            普通模式可用弯引号 / 英文引号标对白，** 标内心 OS；VN 模式仍须使用【旁白】/【对白】/【内心】标签。
          </p>
        </div>
        <div className="border-t border-stone-100 px-4 py-3">
          <button
            type="button"
            className="w-full rounded-xl bg-neutral-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-neutral-800"
            onClick={props.onClose}
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  )
}
