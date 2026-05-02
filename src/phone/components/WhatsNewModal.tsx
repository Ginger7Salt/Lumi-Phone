import { ChangelogLatestOnly } from '../releaseNotes/ChangelogList'
import { WHATS_NEW_STORAGE_KEY, formatVersionLabel, getLatestChangelog } from '../releaseNotes/changelog'

type Props = {
  open: boolean
  onDismiss: () => void
}

/** 发版后首次进入桌面：提示本次更新要点 */
export function WhatsNewModal({ open, onDismiss }: Props) {
  if (!open) return null

  const latest = getLatestChangelog()

  return (
    <div
      className="fixed inset-0 z-[6000] flex items-center justify-center px-4 py-8"
      style={{
        background: 'rgba(28,28,30,0.38)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-[320px] rounded-2xl border px-4 py-5 shadow-xl"
        style={{
          borderColor: 'rgba(28,28,30,0.1)',
          background: 'rgba(255,255,255,0.96)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p id="whats-new-title" className="text-[16px] font-semibold text-[#1C1C1E]">
          发现新版本
        </p>
        <p className="mt-1 text-[13px] text-[#636366]">
          当前版本 <span className="font-semibold tabular-nums text-[#1C1C1E]">{formatVersionLabel(latest.version)}</span>
          ，更新内容如下：
        </p>
        <div className="mt-3">
          <ChangelogLatestOnly />
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-xl py-2.5 text-[14px] font-semibold text-white"
          style={{ background: '#1C1C1E' }}
          onClick={() => {
            try {
              window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, latest.version)
            } catch {
              /* ignore */
            }
            onDismiss()
          }}
        >
          知道了
        </button>
      </div>
    </div>
  )
}
