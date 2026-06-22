import { Construction } from 'lucide-react'

/** 听一听 Tab 内「开发中」占位（保留底部导航） */
export function ListenTogetherTabUnderDev({
  title,
  hint,
  className = '',
}: {
  title: string
  hint: string
  className?: string
}) {
  return (
    <div
      className={`flex min-h-[min(72vh,640px)] flex-col items-center justify-center px-6 py-12 ${className}`}
    >
      <div className="w-full max-w-[320px] rounded-3xl border border-stone-100/80 bg-white/90 px-6 py-10 text-center shadow-[0_4px_24px_-6px_rgba(0,0,0,0.06)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-300">
          <Construction className="size-7" strokeWidth={1.5} aria-hidden />
        </div>
        <p className="mt-5 text-[17px] font-semibold text-stone-800">{title}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-stone-500">{hint}</p>
        <p className="mt-4 text-[13px] text-stone-400">敬请期待</p>
      </div>
    </div>
  )
}
