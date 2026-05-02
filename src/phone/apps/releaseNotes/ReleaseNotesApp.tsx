import { ChevronLeft } from 'lucide-react'
import { ChangelogFullList } from '../../releaseNotes/ChangelogList'
import { formatVersionLabel, getLatestChangelog } from '../../releaseNotes/changelog'

type Props = {
  onBack: () => void
}

/** 居中卡片弹窗样式，非整页栈深度路由外观 */
export function ReleaseNotesApp({ onBack }: Props) {
  const latest = getLatestChangelog()

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      style={{
        background: 'linear-gradient(165deg, rgba(28,28,30,0.42) 0%, rgba(28,28,30,0.52) 100%)',
      }}
    >
      <header
        className="flex shrink-0 items-center gap-2 px-3 pb-2"
        style={{
          paddingTop: 'max(0.35rem, env(safe-area-inset-top, 0px))',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-md transition-opacity active:opacity-75"
          aria-label="返回桌面"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/65">Release Notes</p>
          <h1 className="truncate text-[17px] font-semibold text-white">更新日志</h1>
        </div>
        <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white/90">
          {formatVersionLabel(latest.version)}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-3 pb-3 pt-1">
        <div
          className="flex max-h-[min(78vh,560px)] w-full max-w-[340px] flex-col overflow-hidden rounded-[22px] border shadow-2xl"
          style={{
            borderColor: 'rgba(255,255,255,0.22)',
            background: 'rgba(255,255,255,0.94)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
          }}
        >
          <div className="shrink-0 border-b border-black/[0.06] px-4 py-3">
            <p className="text-[13px] font-semibold text-[#1C1C1E]">全部版本</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#8E8E93]">
              列表在本地执行 <span className="font-mono text-[10px]">npm run dev</span> /{' '}
              <span className="font-mono text-[10px]">npm run build</span> 时由{' '}
              <span className="font-mono text-[10px]">git log</span> 自动生成：每条对应一次提交的标题，与命令行里{' '}
              <span className="font-mono text-[10px]">git commit -m</span> 所写一致。
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 [scrollbar-width:thin]">
            <ChangelogFullList />
          </div>
        </div>
      </div>
    </div>
  )
}
