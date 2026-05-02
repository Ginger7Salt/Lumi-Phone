import { useCallback, useEffect, useRef, useState } from 'react'
import {
  formatRelativeTimeZh,
  formatReleaseAbsoluteZh,
  LUMI_APP_VERSION_LABEL,
  LUMI_LAST_RELEASE_TIME_MS,
} from '../constants/appRelease'

type Props = {
  visible: boolean
}

export function DesktopVersionBadge({ visible }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const toggle = useCallback(() => {
    setOpen((v) => !v)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      const el = rootRef.current
      if (!el || el.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc, true)
    return () => document.removeEventListener('pointerdown', onDoc, true)
  }, [open])

  useEffect(() => {
    if (!visible) setOpen(false)
  }, [visible])

  if (!visible) return null

  const relative = formatRelativeTimeZh(LUMI_LAST_RELEASE_TIME_MS)
  const absolute = formatReleaseAbsoluteZh(LUMI_LAST_RELEASE_TIME_MS)

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute right-2 z-[28] flex flex-col items-end gap-1"
      style={{
        bottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <button
        type="button"
        onClick={toggle}
        className="pointer-events-auto rounded-full border border-black/10 bg-white/55 px-2.5 py-1 text-[10px] font-medium tracking-wide text-black/55 shadow-sm backdrop-blur-md transition-colors active:bg-white/75"
        style={{ WebkitBackdropFilter: 'blur(12px)' }}
        aria-expanded={open}
        aria-label={`版本 ${LUMI_APP_VERSION_LABEL}，点击查看更新说明`}
      >
        {LUMI_APP_VERSION_LABEL}
      </button>

      {open ? (
        <div
          className="pointer-events-auto max-w-[220px] rounded-2xl border border-black/10 bg-white/88 px-3 py-2.5 text-[11px] leading-relaxed text-black/70 shadow-lg backdrop-blur-md"
          style={{ WebkitBackdropFilter: 'blur(14px)' }}
          role="dialog"
          aria-label="版本更新信息"
        >
          <p className="font-semibold text-black/80">最近更新</p>
          <p className="mt-1">
            距今约 <span className="tabular-nums font-medium text-black/85">{relative}</span>
          </p>
          <p className="mt-0.5 tabular-nums text-[10px] text-black/45">{absolute}</p>
        </div>
      ) : null}
    </div>
  )
}
