import { Eye, EyeOff, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MemoryModelIdText } from '../../wechat/memory/MemoryModelIdText'
import { InlineDropdown } from '../../wechat/newFriendsPersona/InlineDropdown'
import { apiTheme } from '../theme'
import { fetchModels, testConnectionSim } from '../apiSim'
import { formatModelPricingLabel } from '../modelPricingUtils'
import type { ApiConfig } from '../types'
import { TextField } from './TextField'

export function ApiConfigBlock({
  title,
  config,
  onChange,
  showTest = true,
  mode = 'full',
  footer,
}: {
  title: string
  config: ApiConfig
  onChange: (next: ApiConfig) => void
  showTest?: boolean
  mode?: 'full' | 'asr'
  footer?: ReactNode
}) {
  const [keyVisible, setKeyVisible] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [modelOpen, setModelOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const modelSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!config.modelList.length) setModelOpen(false)
  }, [config.modelList.length])

  useEffect(() => {
    if (!modelOpen) {
      setModelSearch('')
      return
    }
    const timer = window.setTimeout(() => modelSearchRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [modelOpen])

  const filteredModelList = useMemo(() => {
    const q = modelSearch.trim().toLowerCase()
    if (!q) return config.modelList
    return config.modelList.filter((m) => m.toLowerCase().includes(q))
  }, [config.modelList, modelSearch])

  const canPullModels = useMemo(() => !!config.apiUrl.trim() && !!config.apiKey.trim(), [config.apiKey, config.apiUrl])

  const pullModels = async () => {
    setTestMsg(null)
    setModelLoading(true)
    const res = await fetchModels(config)
    setModelLoading(false)
    if (!res.ok) {
      setTestMsg({ ok: false, text: res.error })
      return
    }
    const next = {
      ...config,
      modelList: res.models,
      modelPricingById: res.modelPricingById,
      modelId: config.modelId || res.models[0] || '',
    }
    onChange(next)
    const pricedCount = Object.keys(res.modelPricingById).length
    setTestMsg({
      ok: true,
      text: pricedCount > 0 ? `模型拉取成功（${pricedCount} 个含费率）` : '模型拉取成功（接口未返回费率，可在服务商官网查看）',
    })
  }

  const testConn = async () => {
    setTestMsg(null)
    setTestLoading(true)
    const res = await testConnectionSim(config)
    setTestLoading(false)
    if (!res.ok) {
      const next = { ...config, lastTest: { ok: false, message: res.error, at: Date.now() } }
      onChange(next)
      setTestMsg({ ok: false, text: res.error })
      return
    }
    const next = { ...config, lastTest: { ok: true, message: '连接成功', at: Date.now() } }
    onChange(next)
    setTestMsg({ ok: true, text: '连接成功' })
  }

  const asrMode = mode === 'asr'

  const selectedModelLabel = config.modelList.length
    ? (config.modelId || config.modelList[0] || '').trim() || '请选择'
    : '请先拉取模型'
  const selectedModelPricingLabel = formatModelPricingLabel(
    config.modelId.trim() ? config.modelPricingById?.[config.modelId.trim()] : undefined,
  )

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-white p-5" style={{ boxShadow: apiTheme.shadow }}>
      <p className="text-[16px] font-semibold" style={{ color: apiTheme.text }}>
        {title}
      </p>
      <div className="mt-4 space-y-4">
        {!asrMode ? (
          <TextField
            label="API URL"
            value={config.apiUrl}
            onChange={(v) => onChange({ ...config, apiUrl: v })}
            placeholder="https://api.example.com/v1"
          />
        ) : null}

        <TextField
          label="API Key"
          value={config.apiKey}
          onChange={(v) => onChange({ ...config, apiKey: v })}
          placeholder="sk-..."
          type={keyVisible ? 'text' : 'password'}
          right={
            <button
              type="button"
              className="rounded-lg p-2 transition-all duration-200 ease-out hover:opacity-80"
              onClick={() => setKeyVisible((v) => !v)}
              style={{ color: apiTheme.subText }}
              aria-label={keyVisible ? '隐藏 Key' : '显示 Key'}
            >
              {keyVisible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          }
        />

        {!asrMode ? (
          <>
            <button
              type="button"
              onClick={() => void pullModels()}
              disabled={!canPullModels || modelLoading}
              className="w-full rounded-xl px-5 py-3 text-[14px] font-medium text-white transition-all duration-200 ease-out disabled:opacity-60"
              style={{ background: '#8e8e8e' }}
            >
              {modelLoading ? '拉取中...' : '拉取模型'}
            </button>

            <label className="block">
              <span className="text-[12px]" style={{ color: apiTheme.subText }}>
                模型
              </span>
              <div className="mt-2">
                <InlineDropdown
                  label="选择模型"
                  valueText={
                    config.modelList.length ? (
                      <MemoryModelIdText text={selectedModelLabel} />
                    ) : (
                      selectedModelLabel
                    )
                  }
                  open={modelOpen}
                  disabled={!config.modelList.length}
                  onToggle={() => setModelOpen((v) => !v)}
                >
                  <div
                    className="sticky top-0 z-[1] border-b bg-white px-3 py-2.5"
                    style={{ borderColor: '#f0f0f0' }}
                  >
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                        style={{ color: apiTheme.subText }}
                      />
                      <input
                        ref={modelSearchRef}
                        type="search"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="搜索模型名称…"
                        className="w-full rounded-xl py-2.5 pl-9 pr-3 text-[13px] outline-none"
                        style={{
                          border: `1px solid ${apiTheme.border}`,
                          background: '#fafafa',
                          color: apiTheme.text,
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    {modelSearch.trim() ? (
                      <p className="mt-1.5 text-[11px]" style={{ color: apiTheme.subText }}>
                        匹配 {filteredModelList.length} / {config.modelList.length} 个模型
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 px-3 py-2">
                    {filteredModelList.length ? (
                      filteredModelList.map((m) => {
                      const active = m === config.modelId
                      const priceLabel = formatModelPricingLabel(config.modelPricingById?.[m])
                      return (
                        <button
                          key={m}
                          type="button"
                          className="w-full rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold transition-all duration-200 ease-out"
                          style={{
                            borderColor: '#e5e5e5',
                            background: active ? '#111827' : '#ffffff',
                            color: active ? '#ffffff' : '#000000',
                          }}
                          onClick={() => {
                            onChange({ ...config, modelId: m })
                            setModelOpen(false)
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <MemoryModelIdText text={m} className="min-w-0 flex-1 break-all" />
                            <span
                              className="shrink-0 text-[10px] font-normal leading-snug"
                              style={{ color: active ? 'rgba(255,255,255,0.75)' : apiTheme.subText }}
                            >
                              {priceLabel}
                            </span>
                          </div>
                        </button>
                      )
                    })
                    ) : (
                      <p className="py-8 text-center text-[13px]" style={{ color: apiTheme.subText }}>
                        没有匹配的模型
                      </p>
                    )}
                  </div>
                </InlineDropdown>
              </div>
              {config.modelId.trim() ? (
                <p className="mt-2 text-[11px] leading-relaxed" style={{ color: apiTheme.subText }}>
                  费率：{selectedModelPricingLabel}
                  {selectedModelPricingLabel === '价格未知' ? '（部分中转 /models 不返回定价，请以服务商控制台为准）' : '（每百万 token）'}
                </p>
              ) : null}
            </label>
          </>
        ) : (
          <div
            className="rounded-xl px-4 py-3 text-[13px]"
            style={{ border: `1px solid ${apiTheme.border}`, background: '#fff', color: apiTheme.subText }}
          >
            识别模型固定为 `FunAudioLLM/SenseVoiceSmall`，无需手动选择。
          </div>
        )}

        {showTest ? (
          <button
            type="button"
            onClick={() => void testConn()}
            disabled={testLoading}
            className="w-full rounded-xl px-5 py-3 text-[14px] font-medium text-white transition-all duration-200 ease-out disabled:opacity-60"
            style={{ background: apiTheme.accent }}
          >
            {testLoading ? '测试中...' : '测试连接'}
          </button>
        ) : null}

        {testMsg ? (
          <div
            className="rounded-xl px-4 py-3 text-[13px]"
            style={{
              border: `1px solid ${apiTheme.border}`,
              background: '#fff',
              color: testMsg.ok ? apiTheme.text : apiTheme.subText,
            }}
          >
            {testMsg.text}
          </div>
        ) : null}
        {footer ? <div>{footer}</div> : null}
      </div>
    </div>
  )
}

