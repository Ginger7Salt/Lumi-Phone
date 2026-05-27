import { useCallback, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Search } from 'lucide-react'
import { PLATINUM } from './constants'
import { runWeChatLocalDataHealthCheck, type WeChatLocalDataHealthReport } from '../wechat/wechatLocalDataHealth'
import { tryAutoRepairWeChatFromLocalDb } from '../wechat/wechatSessionRepair'

function scrollToImportRestore() {
  document.getElementById('data-archive-import-restore')?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
}

function statusTone(status: WeChatLocalDataHealthReport['status']): {
  border: string
  bg: string
  ink: string
} {
  if (status === 'ok') {
    return { border: 'rgba(34, 197, 94, 0.35)', bg: 'rgba(240, 253, 244, 0.85)', ink: '#166534' }
  }
  if (status === 'missing') {
    return { border: 'rgba(234, 88, 12, 0.4)', bg: 'rgba(255, 247, 237, 0.92)', ink: '#9a3412' }
  }
  if (status === 'cleared_by_user') {
    return { border: 'rgba(59, 130, 246, 0.35)', bg: 'rgba(239, 246, 255, 0.9)', ink: '#1e40af' }
  }
  return { border: PLATINUM.line, bg: 'rgba(255,255,255,0.5)', ink: PLATINUM.ink }
}

export function WeChatLocalDataCheckPanel() {
  const [busy, setBusy] = useState(false)
  const [repairBusy, setRepairBusy] = useState(false)
  const [report, setReport] = useState<WeChatLocalDataHealthReport | null>(null)
  const [repairNote, setRepairNote] = useState<string | null>(null)

  const runCheck = useCallback(async () => {
    setBusy(true)
    setRepairNote(null)
    try {
      const r = await runWeChatLocalDataHealthCheck()
      setReport(r)
    } catch {
      setReport({
        status: 'empty_idb',
        accountCount: 0,
        chatMessages: 0,
        characters: 0,
        bundleContactCount: 0,
        hadCoreDataBefore: false,
        summary: '检测失败',
        detail: '无法读取本地存储，请刷新页面后重试。',
      })
    } finally {
      setBusy(false)
    }
  }, [])

  const runAutoRepair = useCallback(async () => {
    setRepairBusy(true)
    setRepairNote(null)
    try {
      const r = await tryAutoRepairWeChatFromLocalDb()
      setRepairNote(r.message)
      if (r.ok) {
        const next = await runWeChatLocalDataHealthCheck()
        setReport(next)
      }
    } catch {
      setRepairNote('自动恢复失败，请刷新页面后重试。')
    } finally {
      setRepairBusy(false)
    }
  }, [])

  const tone = report ? statusTone(report.status) : null
  const canTryAutoRepair =
    report &&
    (report.characters > 0 || report.chatMessages > 0 || report.bundleContactCount > 0) &&
    report.status !== 'ok' &&
    report.status !== 'cleared_by_user'

  return (
    <div
      className="mt-5 rounded-[22px] border px-4 py-5 shadow-[0_12px_40px_rgba(28,28,30,0.05)]"
      style={{
        borderColor: PLATINUM.line,
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      <p className="text-center text-[13px] font-semibold">微信本地数据检测</p>
      <p className="mx-auto mt-1 max-w-[300px] text-center text-[11px] leading-relaxed" style={{ color: PLATINUM.ash }}>
        先检测；若本机 IndexedDB 里还有数据，可一键让代码从本地库自动对齐通讯录（无需选文件）。
      </p>

      <button
        type="button"
        disabled={busy || repairBusy}
        onClick={() => void runCheck()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border py-3.5 text-[14px] font-semibold transition-opacity disabled:opacity-50"
        style={{
          borderColor: PLATINUM.gold,
          color: PLATINUM.ink,
          background: 'rgba(255,255,255,0.55)',
          boxShadow: '0 6px 24px rgba(197,168,128,0.12)',
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" style={{ color: PLATINUM.gold }} /> : <Search className="size-4" style={{ color: PLATINUM.gold }} />}
        {busy ? '检测中…' : '检测本地微信数据'}
      </button>

      {report && tone ? (
        <div
          className="mt-4 rounded-xl border px-3 py-3 text-left"
          style={{ borderColor: tone.border, background: tone.bg }}
          role="status"
        >
          <div className="flex gap-2">
            {report.status === 'ok' ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" style={{ color: tone.ink }} aria-hidden />
            ) : report.status === 'cleared_by_user' ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" style={{ color: tone.ink }} aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 size-5 shrink-0" style={{ color: tone.ink }} aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold" style={{ color: tone.ink }}>
                {report.summary}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: tone.ink, opacity: 0.9 }}>
                {report.detail}
              </p>
              <p className="mt-2 font-mono text-[10px] leading-relaxed" style={{ color: PLATINUM.ash }}>
                账号 {report.accountCount} · 通讯录快照 {report.bundleContactCount} · 人设 {report.characters} · 聊天索引{' '}
                {report.chatMessages}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canTryAutoRepair ? (
                  <button
                    type="button"
                    disabled={repairBusy}
                    onClick={() => void runAutoRepair()}
                    className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
                    style={{ background: PLATINUM.ink }}
                  >
                    {repairBusy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    尝试自动恢复
                  </button>
                ) : null}
                {report.status === 'missing' ? (
                  <button
                    type="button"
                    onClick={scrollToImportRestore}
                    className="rounded-full border px-4 py-2 text-[13px] font-medium"
                    style={{ borderColor: PLATINUM.line, color: PLATINUM.ink }}
                  >
                    从 .lumi 备份导入
                  </button>
                ) : null}
              </div>
              {repairNote ? (
                <p className="mt-2 text-[12px] leading-relaxed" style={{ color: tone.ink }}>
                  {repairNote}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
