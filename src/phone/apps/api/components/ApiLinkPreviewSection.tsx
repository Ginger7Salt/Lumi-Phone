import { useEffect, useRef, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'

import type { LinkPreviewSettings } from '../types'
import { apiTheme } from '../theme'
import { TextField } from './TextField'
import { ToggleSwitch } from './ToggleSwitch'
import {
  clearLinkPreviewQuotaStore,
  getLinkPreviewQuotaSnapshot,
  type LinkPreviewQuotaSnapshot,
} from '../linkPreviewQuota'
import { formatQuotaLineDisplay } from '../apizeroBilling'
import { LINK_PREVIEW_QUOTA_UPDATED_EVENT } from '../linkPreviewQuotaEvents'
import {
  APIZERO_CONTENT_EXTRACT_URL,
  APIZERO_KEY_ACQUIRE_URL,
  APIZERO_OFFICIAL_URL,
  APIZERO_VIDEO_PARSE_URL,
  refreshLinkPreviewQuotaFromServer,
  testLinkPreviewConnection,
} from '../linkPreviewSettingsUtils'
import { ApiLinkPreviewParsePanel } from './ApiLinkPreviewParsePanel'
import {
  LINK_PREVIEW_FEATURE_TITLE,
  LINK_PREVIEW_PROVIDER_LABEL,
} from '../linkPreviewDisplayLabels'

type Props = {
  settings: LinkPreviewSettings
  onChange: (next: LinkPreviewSettings) => void
  /** page=独立全屏页（顶栏已有标题）；section=内嵌卡片 */
  layout?: 'page' | 'section'
}

function SectionCard({
  title,
  action,
  children,
  className = '',
}: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`mx-4 rounded-2xl bg-white p-5 ${className}`}
      style={{ boxShadow: apiTheme.shadow }}
    >
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? (
            <p className="text-[15px] font-semibold" style={{ color: apiTheme.text }}>
              {title}
            </p>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function ApiLinkPreviewSection({ settings, onChange, layout = 'section' }: Props) {
  const [testing, setTesting] = useState<'web' | 'video' | null>(null)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [quota, setQuota] = useState<LinkPreviewQuotaSnapshot>(() =>
    getLinkPreviewQuotaSnapshot(settings.apiKey),
  )
  const [quotaRefreshing, setQuotaRefreshing] = useState(false)
  const [quotaRefreshMsg, setQuotaRefreshMsg] = useState<string | null>(null)
  const prevApiKeyRef = useRef(settings.apiKey)

  const patch = (partial: Partial<LinkPreviewSettings>) => onChange({ ...settings, ...partial })
  const sectionGap = layout === 'page' ? 'mt-3' : 'mt-4'

  useEffect(() => {
    if (prevApiKeyRef.current.trim() !== settings.apiKey.trim()) {
      clearLinkPreviewQuotaStore()
      prevApiKeyRef.current = settings.apiKey
    }
    setQuota(getLinkPreviewQuotaSnapshot(settings.apiKey))
  }, [settings.apiKey])

  useEffect(() => {
    const refresh = () => setQuota(getLinkPreviewQuotaSnapshot(settings.apiKey))
    window.addEventListener(LINK_PREVIEW_QUOTA_UPDATED_EVENT, refresh as EventListener)
    return () => window.removeEventListener(LINK_PREVIEW_QUOTA_UPDATED_EVENT, refresh as EventListener)
  }, [settings.apiKey])

  const refreshQuota = async () => {
    if (quotaRefreshing || testing !== null) return
    setQuotaRefreshing(true)
    setQuotaRefreshMsg(null)
    const res = await refreshLinkPreviewQuotaFromServer(settings.apiKey)
    setQuota(res.snapshot)
    setQuotaRefreshing(false)
    setQuotaRefreshMsg(res.message)
    window.setTimeout(() => setQuotaRefreshMsg(null), 2800)
  }

  const runTest = async (kind: 'web' | 'video') => {
    setTesting(kind)
    setTestMsg(null)
    const endpoint = kind === 'video' ? APIZERO_VIDEO_PARSE_URL : APIZERO_CONTENT_EXTRACT_URL
    const res = await testLinkPreviewConnection(endpoint, settings.apiKey)
    setTesting(null)
    setTestMsg({ ok: res.ok, text: res.message })
    setQuota(getLinkPreviewQuotaSnapshot(settings.apiKey))
    if (kind === 'web') {
      onChange({
        ...settings,
        lastTest: { ok: res.ok, message: res.message, at: Date.now() },
      })
    }
  }

  return (
    <div className={layout === 'page' ? 'pt-3' : ''}>
      <SectionCard className={layout === 'page' ? '' : sectionGap}>
        {layout === 'section' ? (
          <p className="mb-4 text-[16px] font-semibold" style={{ color: apiTheme.text }}>
            {LINK_PREVIEW_FEATURE_TITLE}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[15px] font-medium" style={{ color: apiTheme.text }}>
              启用功能
            </p>
            <p className="mt-1 text-[12px]" style={{ color: apiTheme.subText, fontWeight: 300 }}>
              聊天发链时自动识别 · {LINK_PREVIEW_PROVIDER_LABEL}
            </p>
          </div>
          <ToggleSwitch checked={settings.enabled} onChange={(enabled) => patch({ enabled })} />
        </div>
      </SectionCard>

      <SectionCard title="API Key" className={sectionGap}>
        <TextField
          label=""
          value={settings.apiKey}
          onChange={(apiKey) => patch({ apiKey })}
          placeholder="可选，填写后享更高额度"
          type="password"
        />
        <a
          href={APIZERO_KEY_ACQUIRE_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium"
          style={{ color: apiTheme.accent }}
        >
          在 {LINK_PREVIEW_PROVIDER_LABEL} 获取 Key
          <ExternalLink className="size-3" />
        </a>
      </SectionCard>

      <SectionCard
        title="额度"
        className={sectionGap}
        action={
          <button
            type="button"
            disabled={quotaRefreshing || testing !== null}
            onClick={() => void refreshQuota()}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-opacity disabled:opacity-40"
            style={{ color: apiTheme.subText }}
            aria-label="刷新额度"
          >
            <RefreshCw className={`size-3.5 ${quotaRefreshing ? 'animate-spin' : ''}`} />
            {quotaRefreshing ? '同步中' : '刷新'}
          </button>
        }
      >
        <p className="mb-3 text-[12px]" style={{ color: apiTheme.subText }}>
          {quota.planLabel}
          {quota.planKind === 'pay_per_use' ? ' · ¥0.001/次' : ''}
          <span className="mx-1.5">·</span>
          {quota.mode === 'key' ? '已填 Key' : '匿名'}
        </p>
        <div className="space-y-3">
          {quota.lines.map((line) => {
            const display = formatQuotaLineDisplay(line, quota.planKind)
            const low =
              line.period !== 'pay_per_use' &&
              quota.planKind !== 'pay_per_use' &&
              line.remaining <= Math.max(1, Math.floor((line.dailyLimit ?? line.limit) * 0.1))
            const warn =
              display.statusText.includes('已用完') || line.remaining <= 0
            return (
              <div key={line.kind}>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span style={{ color: apiTheme.text }}>{line.label}</span>
                  <span style={{ color: warn ? '#b91c1c' : low ? '#b45309' : apiTheme.subText }}>
                    {display.statusText}
                  </span>
                </div>
                {display.showBar ? (
                  <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: '#e7e5e4' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${display.barPercent}%`,
                        background: warn ? '#ef4444' : low ? '#f59e0b' : apiTheme.accent,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        {quotaRefreshMsg ? (
          <p
            className="mt-3 text-[12px]"
            style={{
              color:
                quotaRefreshMsg.includes('失败') || quotaRefreshMsg.includes('超时') ? '#b45309' : '#059669',
            }}
          >
            {quotaRefreshMsg}
          </p>
        ) : null}
      </SectionCard>

      <div className={sectionGap}>
        <ApiLinkPreviewParsePanel
          disabled={!settings.enabled || testing !== null}
          onParsed={() => setQuota(getLinkPreviewQuotaSnapshot(settings.apiKey))}
        />
      </div>

      <SectionCard title="连通测试" className={sectionGap}>
        <p className="-mt-1 mb-3 text-[12px] leading-relaxed" style={{ color: '#b45309' }}>
          每次测试会真实请求接口，成功后将扣除 1 次额度（网页与短视频分别计费）
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={testing !== null}
            onClick={() => void runTest('web')}
            className="flex-1 rounded-xl px-3 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
            style={{ background: apiTheme.accent }}
          >
            {testing === 'web' ? '测试中…' : '网页（扣 1 次）'}
          </button>
          <button
            type="button"
            disabled={testing !== null}
            onClick={() => void runTest('video')}
            className="flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-opacity disabled:opacity-40"
            style={{ borderColor: apiTheme.border, color: apiTheme.text }}
          >
            {testing === 'video' ? '测试中…' : '短视频（扣 1 次）'}
          </button>
        </div>
        {testMsg ? (
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: testMsg.ok ? '#059669' : '#b45309' }}>
            {testMsg.text}
          </p>
        ) : settings.lastTest && !testMsg ? (
          <p className="mt-3 text-[12px]" style={{ color: settings.lastTest.ok ? '#059669' : apiTheme.subText }}>
            上次网页测试：{settings.lastTest.ok ? '成功' : '失败'}
          </p>
        ) : null}
        <a
          href={APIZERO_OFFICIAL_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-[12px]"
          style={{ color: apiTheme.subText }}
        >
          {LINK_PREVIEW_PROVIDER_LABEL} 控制台
          <ExternalLink className="size-3" />
        </a>
      </SectionCard>
    </div>
  )
}
