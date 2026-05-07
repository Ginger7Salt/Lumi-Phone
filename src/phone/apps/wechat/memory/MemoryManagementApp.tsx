import { ArrowLeft, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { Pressable } from '../../../components/Pressable'
import { fetchModels } from '../../api/apiSim'
import type { ApiConfig } from '../../api/types'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { InlineDropdown } from '../newFriendsPersona/InlineDropdown'
import { DEFAULT_MEMORY_EMBEDDING_MODEL, resolveEmbeddingApiCredentials, testMemoryEmbeddingConnection } from './memoryEmbeddingApi'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemoryTriggerMode } from '../newFriendsPersona/types'
import { MemoryDashboard } from './MemoryDashboard'

const COLORS = {
  bg: '#f5f5f5',
  card: '#ffffff',
  text: '#000000',
  sub: '#666666',
  faint: '#999999',
  border: '#e5e5e5',
} as const

/** 从 /v1/models 全量中优先筛出常见 embedding 类 id；若筛完为空则退回全量 */
function pickEmbeddingModelCandidates(allModels: string[]): string[] {
  const uniq = Array.from(new Set(allModels)).sort((a, b) => a.localeCompare(b))
  const embedLike = uniq.filter((m) =>
    /embed|embedding|text-embedding|bge-|m3e|e5-|ada|voyage|nomic|mxbai|snowflake|qwen.*embed|doubao-embedding|baai\/bge/i.test(
      m,
    ),
  )
  return embedLike.length ? embedLike : uniq
}

function WxSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200"
      style={{ backgroundColor: on ? '#000000' : '#cccccc' }}
    >
      <span
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out"
        style={{ left: on ? 26 : 4 }}
        aria-hidden
      />
    </button>
  )
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div
      className="sticky top-0 z-30 shrink-0 border-b"
      style={{
        borderColor: COLORS.border,
        background: COLORS.card,
        paddingTop: 'max(10px, env(safe-area-inset-top,0px))',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex items-center px-4 py-3">
        <Pressable
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-[12px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
          aria-label="返回"
        >
          <ArrowLeft className="size-5" color={COLORS.text} strokeWidth={1.75} />
        </Pressable>
        <p className="flex-1 text-center text-[18px] font-bold" style={{ color: COLORS.text }}>
          {title}
        </p>
        <div className="h-10 w-10 shrink-0" aria-hidden />
      </div>
    </div>
  )
}

export function MemoryManagementApp({
  contacts,
  playerIdentityId,
  playerDisplayName,
  onBack,
}: {
  /** 与微信通讯录 `WeChatContactsInstagram` 相同的合并列表（人设同步联系人等） */
  contacts: WeChatContactRow[]
  playerIdentityId: string | null
  playerDisplayName: string
  onBack: () => void
}) {
  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(true)
  const [autoSummaryDefaultTrigger, setAutoSummaryDefaultTrigger] =
    useState<CharacterMemoryTriggerMode>('keyword')
  const [intervalN, setIntervalN] = useState(10)
  const [linkedMemoryAutoSummaryEnabled, setLinkedMemoryAutoSummaryEnabled] = useState(true)
  const [datingAutoSummaryEnabled, setDatingAutoSummaryEnabled] = useState(true)
  const [linkedMemExplainExpanded, setLinkedMemExplainExpanded] = useState(false)
  const [vectorRecallEnabled, setVectorRecallEnabled] = useState(true)
  const [embeddingModelDraft, setEmbeddingModelDraft] = useState('')
  const [embeddingApiUrlDraft, setEmbeddingApiUrlDraft] = useState('')
  const [embeddingApiKeyDraft, setEmbeddingApiKeyDraft] = useState('')
  const [hasSavedEmbeddingKey, setHasSavedEmbeddingKey] = useState(false)
  const [embedTestMsg, setEmbedTestMsg] = useState<string | null>(null)
  const [embedTestBusy, setEmbedTestBusy] = useState(false)
  const [embeddingModelList, setEmbeddingModelList] = useState<string[]>([])
  const [embeddingModelDropdownOpen, setEmbeddingModelDropdownOpen] = useState(false)
  const [embeddingModelsLoading, setEmbeddingModelsLoading] = useState(false)
  const [modelsPullMsg, setModelsPullMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'config' | 'memories'>('config')
  /** 向量开关开启时，详细配置区是否展开（与开关分离，便于折叠长表单） */
  const [vectorConfigExpanded, setVectorConfigExpanded] = useState(true)

  const chatApiConfig = useCurrentApiConfig('chatCard')

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) setLoading(true)
    try {
      const settings = await personaDb.getMemorySettings()
      setAutoSummaryEnabled(settings.autoSummaryEnabled !== false)
      setAutoSummaryDefaultTrigger(
        settings.autoSummaryDefaultMemoryTriggerMode === 'always' ? 'always' : 'keyword',
      )
      setIntervalN(settings.autoSummaryInterval)
      setLinkedMemoryAutoSummaryEnabled(settings.linkedMemoryAutoSummaryEnabled !== false)
      setDatingAutoSummaryEnabled(settings.datingAutoSummaryEnabled !== false)
      setVectorRecallEnabled(settings.memoryVectorRecallEnabled !== false)
      setEmbeddingModelDraft(settings.memoryEmbeddingModelId?.trim() || '')
      setEmbeddingApiUrlDraft(settings.memoryEmbeddingApiUrl?.trim() || '')
      setEmbeddingApiKeyDraft('')
      setHasSavedEmbeddingKey(Boolean(settings.memoryEmbeddingApiKey?.trim()))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const onEvt = () => {
      void reload({ silent: true })
    }
    window.addEventListener('wechat-storage-changed', onEvt)
    return () => window.removeEventListener('wechat-storage-changed', onEvt)
  }, [reload])

  useEffect(() => {
    if (!embeddingModelList.length) setEmbeddingModelDropdownOpen(false)
  }, [embeddingModelList.length])

  useEffect(() => {
    if (!vectorConfigExpanded) setEmbeddingModelDropdownOpen(false)
  }, [vectorConfigExpanded])

  const commitInterval = async (raw: number) => {
    const n = Math.max(1, Math.min(100, Math.floor(Number.isFinite(raw) ? raw : 10)))
    setIntervalN(n)
    await personaDb.putMemorySettings({ autoSummaryInterval: n })
  }

  const toggleAutoSummary = async () => {
    const next = !autoSummaryEnabled
    setAutoSummaryEnabled(next)
    await personaDb.putMemorySettings({ autoSummaryEnabled: next })
  }

  const toggleLinkedMemoryAutoSummary = async () => {
    const next = !linkedMemoryAutoSummaryEnabled
    setLinkedMemoryAutoSummaryEnabled(next)
    await personaDb.putMemorySettings({ linkedMemoryAutoSummaryEnabled: next })
  }

  const toggleDatingAutoSummary = async () => {
    const next = !datingAutoSummaryEnabled
    setDatingAutoSummaryEnabled(next)
    await personaDb.putMemorySettings({ datingAutoSummaryEnabled: next })
  }

  const commitAutoSummaryDefaultTrigger = async (mode: CharacterMemoryTriggerMode) => {
    setAutoSummaryDefaultTrigger(mode)
    await personaDb.putMemorySettings({ autoSummaryDefaultMemoryTriggerMode: mode })
  }

  const toggleVectorRecall = async () => {
    const next = !vectorRecallEnabled
    setVectorRecallEnabled(next)
    setEmbeddingModelDropdownOpen(false)
    setVectorConfigExpanded(next)
    await personaDb.putMemorySettings({ memoryVectorRecallEnabled: next })
  }

  const commitEmbeddingModelId = async (modelId?: string) => {
    const raw = (modelId ?? embeddingModelDraft).trim()
    await personaDb.putMemorySettings({
      memoryEmbeddingModelId: raw ? raw.slice(0, 120) : undefined,
    })
  }

  const pullEmbeddingModels = async () => {
    setModelsPullMsg(null)
    setEmbeddingModelsLoading(true)
    try {
      const s = await personaDb.getMemorySettings()
      const url =
        embeddingApiUrlDraft.trim() ||
        s.memoryEmbeddingApiUrl?.trim() ||
        chatApiConfig?.apiUrl?.trim() ||
        ''
      const key =
        embeddingApiKeyDraft.trim() ||
        s.memoryEmbeddingApiKey?.trim() ||
        chatApiConfig?.apiKey?.trim() ||
        ''
      if (!url.trim() || !key.trim()) {
        setModelsPullMsg({ ok: false, text: '请先填写向量专用 API，或在全局配置聊天 API（url + key）。' })
        return
      }
      const cfg: ApiConfig = { apiUrl: url, apiKey: key, modelId: '', modelList: [] }
      const res = await fetchModels(cfg)
      if (!res.ok) {
        setModelsPullMsg({ ok: false, text: res.error })
        return
      }
      const picked = pickEmbeddingModelCandidates(res.models)
      setEmbeddingModelList(picked)
      const saved = (await personaDb.getMemorySettings()).memoryEmbeddingModelId?.trim() || ''
      const draft = embeddingModelDraft.trim()
      const preferred = draft || saved
      let nextId = preferred && picked.includes(preferred) ? preferred : ''
      if (!nextId && picked.includes(DEFAULT_MEMORY_EMBEDDING_MODEL)) nextId = DEFAULT_MEMORY_EMBEDDING_MODEL
      if (!nextId && picked.length) nextId = picked[0] || ''
      if (nextId) {
        setEmbeddingModelDraft(nextId)
        await personaDb.putMemorySettings({ memoryEmbeddingModelId: nextId })
      }
      setModelsPullMsg({ ok: true, text: `已拉取 ${picked.length} 个模型（已优先筛选 embedding 相关）` })
    } finally {
      setEmbeddingModelsLoading(false)
    }
  }

  const commitEmbeddingApiUrl = async () => {
    const raw = embeddingApiUrlDraft.trim()
    await personaDb.putMemorySettings({
      memoryEmbeddingApiUrl: raw ? raw.slice(0, 512) : undefined,
    })
  }

  const commitEmbeddingApiKeyIfTyped = async () => {
    const raw = embeddingApiKeyDraft.trim()
    if (!raw) return
    await personaDb.putMemorySettings({ memoryEmbeddingApiKey: raw.slice(0, 2048) })
    setEmbeddingApiKeyDraft('')
    setHasSavedEmbeddingKey(true)
    await reload({ silent: true })
  }

  const clearStandaloneEmbeddingCredentials = async () => {
    await personaDb.putMemorySettings({
      memoryEmbeddingApiUrl: undefined,
      memoryEmbeddingApiKey: undefined,
    })
    setEmbeddingApiUrlDraft('')
    setEmbeddingApiKeyDraft('')
    setHasSavedEmbeddingKey(false)
    setEmbeddingModelList([])
    setModelsPullMsg(null)
    await reload({ silent: true })
  }

  /** 将本页当前表单一次性写入 IndexedDB `memorySettings`（与逐项失焦保存互为补充） */
  const saveAllMemorySettings = async () => {
    setSaveMsg(null)
    setSaveBusy(true)
    try {
      const n = Math.max(1, Math.min(100, Math.floor(Number.isFinite(intervalN) ? intervalN : 10)))
      const url = embeddingApiUrlDraft.trim()
      const model = embeddingModelDraft.trim()
      const keyTyped = embeddingApiKeyDraft.trim()
      await personaDb.putMemorySettings({
        autoSummaryEnabled,
        autoSummaryInterval: n,
        autoSummaryDefaultMemoryTriggerMode: autoSummaryDefaultTrigger,
        linkedMemoryAutoSummaryEnabled,
        datingAutoSummaryEnabled,
        memoryVectorRecallEnabled: vectorRecallEnabled,
        memoryEmbeddingModelId: model ? model.slice(0, 120) : undefined,
        memoryEmbeddingApiUrl: url ? url.slice(0, 512) : undefined,
        ...(keyTyped ? { memoryEmbeddingApiKey: keyTyped.slice(0, 2048) } : {}),
      })
      setIntervalN(n)
      if (keyTyped) {
        setEmbeddingApiKeyDraft('')
        setHasSavedEmbeddingKey(true)
      }
      await reload({ silent: true })
      setSaveMsg({ ok: true, text: '已保存到本机（IndexedDB · memorySettings）' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSaveMsg({ ok: false, text: msg })
    } finally {
      setSaveBusy(false)
    }
  }

  const runEmbeddingConnectionTest = async () => {
    setEmbedTestBusy(true)
    setEmbedTestMsg(null)
    try {
      const s = await personaDb.getMemorySettings()
      const model =
        embeddingModelDraft.trim() ||
        s.memoryEmbeddingModelId?.trim() ||
        DEFAULT_MEMORY_EMBEDDING_MODEL
      const cred = resolveEmbeddingApiCredentials(
        {
          ...s,
          memoryEmbeddingApiUrl: embeddingApiUrlDraft.trim() ? embeddingApiUrlDraft.trim() : s.memoryEmbeddingApiUrl,
          memoryEmbeddingApiKey: embeddingApiKeyDraft.trim() ? embeddingApiKeyDraft.trim() : s.memoryEmbeddingApiKey,
        },
        chatApiConfig?.apiUrl?.trim() && chatApiConfig?.apiKey?.trim() ? chatApiConfig : null,
      )
      if (!cred) {
        setEmbedTestMsg('缺少可用的 API 地址与 Key：请在下方填写向量专用配置，或先在全局配置好聊天 API。')
        return
      }
      const r = await testMemoryEmbeddingConnection(cred, model)
      setEmbedTestMsg(r.ok ? `接口可用，向量维度 ${r.dimensions}` : `不可用：${r.message}`)
    } finally {
      setEmbedTestBusy(false)
    }
  }

  const pid = playerIdentityId?.trim() ?? ''

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-neutral-950">
      <TopBar title="记忆档案馆" onBack={onBack} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-neutral-100 bg-neutral-50/80 px-4 pb-2 pt-2">
          <div className="mx-auto flex max-w-xl gap-1 rounded-[11px] bg-neutral-200/80 p-1">
            <Pressable
              type="button"
              role="tab"
              aria-selected={activeTab === 'config'}
              onClick={() => setActiveTab('config')}
              className={`min-h-[44px] flex-1 rounded-[9px] py-2.5 text-center text-[14px] font-semibold transition-colors ${
                activeTab === 'config'
                  ? 'bg-white text-neutral-950 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              配置
            </Pressable>
            <Pressable
              type="button"
              role="tab"
              aria-selected={activeTab === 'memories'}
              onClick={() => setActiveTab('memories')}
              className={`min-h-[44px] flex-1 rounded-[9px] py-2.5 text-center text-[14px] font-semibold transition-colors ${
                activeTab === 'memories'
                  ? 'bg-white text-neutral-950 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              记忆管理
            </Pressable>
          </div>
        </div>
        <div
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom,0px))' }}
        >
          {activeTab === 'config' ? (
            <div className="shrink-0 border-b border-neutral-100 bg-neutral-50/80 px-4 pb-3 pt-2">
              <div className="mx-auto max-w-xl rounded-[12px] border border-neutral-100 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
              <span className="text-[15px]" style={{ color: COLORS.text }}>
                自动总结
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div role="radiogroup" aria-label="自动总结新记忆默认触发方式" className="flex gap-1.5">
                  <Pressable
                    type="button"
                    role="radio"
                    aria-checked={autoSummaryDefaultTrigger === 'keyword'}
                    onClick={() => void commitAutoSummaryDefaultTrigger('keyword')}
                    className={`rounded-[8px] border px-2.5 py-2 text-[12px] font-medium transition-colors ${
                      autoSummaryDefaultTrigger === 'keyword'
                        ? 'border-black bg-black text-white'
                        : 'border-black bg-white text-black hover:bg-neutral-100'
                    }`}
                  >
                    关键词
                  </Pressable>
                  <Pressable
                    type="button"
                    role="radio"
                    aria-checked={autoSummaryDefaultTrigger === 'always'}
                    onClick={() => void commitAutoSummaryDefaultTrigger('always')}
                    className={`rounded-[8px] border px-2.5 py-2 text-[12px] font-medium transition-colors ${
                      autoSummaryDefaultTrigger === 'always'
                        ? 'border-black bg-black text-white'
                        : 'border-black bg-white text-black hover:bg-neutral-100'
                    }`}
                  >
                    始终
                  </Pressable>
                </div>
                <WxSwitch on={autoSummaryEnabled} onToggle={() => void toggleAutoSummary()} />
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
              新记忆默认选「始终」或「关键词」；每次自动总结仍会在后台写入模型提炼的触发词（含合并备份），之后改为「关键词」不会丢词。
            </p>
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px]" style={{ color: COLORS.text }}>
                  关联记忆总结
                </span>
                <WxSwitch on={linkedMemoryAutoSummaryEnabled} onToggle={() => void toggleLinkedMemoryAutoSummary()} />
              </div>
              <Pressable
                type="button"
                onClick={() => setLinkedMemExplainExpanded((v) => !v)}
                className="mt-2 flex w-full items-center justify-between gap-2 rounded-[10px] border border-neutral-200 bg-white px-3 py-2.5 text-left text-[13px] font-medium text-neutral-800 transition-colors hover:bg-neutral-50"
                aria-expanded={linkedMemExplainExpanded}
              >
                <span>{linkedMemExplainExpanded ? '收起' : '这是啥？点我看看'}</span>
                <ChevronDown
                  className={`size-4 shrink-0 text-neutral-500 transition-transform duration-200 ${
                    linkedMemExplainExpanded ? 'rotate-180' : 'rotate-0'
                  }`}
                  aria-hidden
                />
              </Pressable>
              {linkedMemExplainExpanded ? (
                <div className="mt-2 space-y-2 rounded-[10px] border border-neutral-100 bg-[#fafafa] px-3 py-2.5 text-[11px] leading-relaxed text-neutral-600">
                  <p>
                    你在主角的约会里推进剧情时，系统有时会顺手给通讯录里「沾边」的配角也记一小条，方便他们之后私聊能接上话。这个就是「关联记忆」。
                  </p>
                  <p>
                    关掉：配角那边不会再自动记这种小纸条；你跟主角微信聊几句才总结一次，那个照旧，不受影响。
                  </p>
                  <p>
                    约会每写出一段新剧情，会顺带处理一次（所以感觉上「跟得很紧」）；微信这边还是看你下面设的「隔几轮」才总结，两码事。
                  </p>
                  <p>
                    放心，不会为了配角再多问一遍模型——跟写这段约会剧情是同一次问完的，不多收你一轮对话钱。
                  </p>
                </div>
              ) : null}
            </div>
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-semibold" style={{ color: COLORS.text }}>
                  向量语义召回
                </span>
                <WxSwitch on={vectorRecallEnabled} onToggle={() => void toggleVectorRecall()} />
              </div>
              {vectorRecallEnabled ? (
                <>
                  <Pressable
                    type="button"
                    onClick={() => setVectorConfigExpanded((v) => !v)}
                    className="mt-2 flex w-full items-center justify-between gap-2 rounded-[10px] border border-neutral-200 bg-white px-3 py-2.5 text-left text-[13px] font-medium text-neutral-800 transition-colors hover:bg-neutral-50"
                    aria-expanded={vectorConfigExpanded}
                  >
                    <span>{vectorConfigExpanded ? '收起详细配置' : '展开详细配置'}</span>
                    <ChevronDown
                      className={`size-4 shrink-0 text-neutral-500 transition-transform duration-200 ${
                        vectorConfigExpanded ? 'rotate-180' : 'rotate-0'
                      }`}
                      aria-hidden
                    />
                  </Pressable>
                  {vectorConfigExpanded ? (
                <div className="mt-3 space-y-3 rounded-[12px] border border-neutral-100 bg-[#fafafa] px-3 py-3">
                  <div className="space-y-2 text-[11px] leading-relaxed text-neutral-500">
                    <p>
                      <span className="font-medium text-neutral-600">做什么：</span>
                      在「触发关键词」之外，按<strong className="font-medium text-neutral-600">当前聊天在说什么</strong>
                      ，从长期记忆里再挑出几条<strong className="font-medium text-neutral-600">意思相近</strong>
                      的内容给 AI 参考。适合记忆里的说法和聊天用词不完全相同、但其实是同一件事的情况。
                    </p>
                    <p>
                      <span className="font-medium text-neutral-600">注意：</span>
                      向量用的是专门的「把文字变成向量」的服务（接口里常见 <span className="font-mono text-[10px]">/v1/embeddings</span>
                      ）。它和<strong className="font-medium text-neutral-600">平时对话用的聊天模型不是同一种</strong>
                      ，不能把对话里的模型名（例如某些 Gemini 聊天模型）当成向量模型。请先点「拉取向量模型」，在列表里选名称里常带{' '}
                      <span className="font-mono text-[10px]">embed</span> / embedding 的模型；若列表里没有这类模型，说明当前线路可能未开放向量能力，需要换支持
                      Embeddings 的网关，或在下面单独填写「向量专用」地址。
                    </p>
                    <p>
                      <span className="font-medium text-neutral-600">地址与密钥：</span>
                      可只在下面单独填向量专用项；<strong className="font-medium text-neutral-600">任一项留空</strong>
                      时，会自动使用全局「聊天 / chatCard」里已填好的 API 地址和密钥（两者都要先有）。
                    </p>
                    <p>
                      <span className="font-medium text-neutral-600">建议你这样用：</span>
                      填好（或沿用聊天）地址与密钥 → 拉取向量模型并选一个 → 点「测试向量接口」看到成功即可。之后在对话里，当用来匹配的上下文足够长时，系统会自动尝试语义召回。
                      <span className="text-neutral-400">（会产生额外接口调用。）</span>
                    </p>
                  </div>
                  <label className="block text-[11px] text-neutral-500">
                    向量专用 API 根地址（留空则用聊天 apiUrl）
                    <input
                      value={embeddingApiUrlDraft}
                      onChange={(e) => setEmbeddingApiUrlDraft(e.target.value)}
                      onBlur={() => void commitEmbeddingApiUrl()}
                      placeholder={chatApiConfig?.apiUrl?.trim() || 'https://…'}
                      className="mt-1 w-full rounded-[8px] border px-2 py-1.5 text-[13px] outline-none transition-all duration-200 ease-out focus:border-black"
                      style={{ borderColor: COLORS.border, background: COLORS.card, color: COLORS.text }}
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                    />
                  </label>
                  <label className="block text-[11px] text-neutral-500">
                    向量专用 API Key（留空则用聊天 apiKey
                    {hasSavedEmbeddingKey ? '；已保存过独立密钥，输入新值可覆盖' : ''}）
                    <input
                      type="password"
                      value={embeddingApiKeyDraft}
                      onChange={(e) => setEmbeddingApiKeyDraft(e.target.value)}
                      onBlur={() => void commitEmbeddingApiKeyIfTyped()}
                      placeholder={hasSavedEmbeddingKey ? '••••••（已保存，留空不改）' : '与聊天共用可不填'}
                      className="mt-1 w-full rounded-[8px] border px-2 py-1.5 text-[13px] outline-none transition-all duration-200 ease-out focus:border-black"
                      style={{ borderColor: COLORS.border, background: COLORS.card, color: COLORS.text }}
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                    />
                  </label>
                  <Pressable
                    type="button"
                    disabled={embeddingModelsLoading}
                    onClick={() => void pullEmbeddingModels()}
                    className="w-full rounded-[10px] border border-neutral-300 bg-white px-3 py-2.5 text-[13px] font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {embeddingModelsLoading ? '拉取中…' : '拉取向量模型'}
                  </Pressable>
                  {modelsPullMsg ? (
                    <p
                      className={`text-[11px] leading-relaxed ${modelsPullMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}
                      role="status"
                    >
                      {modelsPullMsg.text}
                    </p>
                  ) : null}
                  <label className="block text-[11px] text-neutral-500">
                    向量模型（先拉取再选；留空则使用默认 {DEFAULT_MEMORY_EMBEDDING_MODEL}）
                    <div className="mt-2">
                      <InlineDropdown
                        label="选择 Embedding 模型"
                        valueText={
                          embeddingModelList.length
                            ? embeddingModelDraft.trim() || embeddingModelList[0] || '请选择'
                            : '请先拉取模型'
                        }
                        open={embeddingModelDropdownOpen}
                        disabled={!embeddingModelList.length}
                        onToggle={() => setEmbeddingModelDropdownOpen((v) => !v)}
                      >
                        <div className="flex flex-col gap-2 px-3 py-2">
                          {embeddingModelList.map((m) => {
                            const active =
                              m === (embeddingModelDraft.trim() || embeddingModelList[0] || '')
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
                                  setEmbeddingModelDraft(m)
                                  setEmbeddingModelDropdownOpen(false)
                                  void commitEmbeddingModelId(m)
                                }}
                              >
                                <span className="break-all">{m}</span>
                              </button>
                            )
                          })}
                        </div>
                      </InlineDropdown>
                    </div>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pressable
                      type="button"
                      disabled={embedTestBusy}
                      onClick={() => void runEmbeddingConnectionTest()}
                      className="rounded-[8px] border border-black bg-white px-3 py-2 text-[12px] font-medium text-black transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {embedTestBusy ? '测试中…' : '测试向量接口'}
                    </Pressable>
                    {(embeddingApiUrlDraft.trim() || hasSavedEmbeddingKey) && (
                      <Pressable
                        type="button"
                        onClick={() => void clearStandaloneEmbeddingCredentials()}
                        className="rounded-[8px] border border-neutral-300 px-3 py-2 text-[12px] text-neutral-600 transition-colors hover:bg-neutral-50"
                      >
                        清除专用地址/密钥
                      </Pressable>
                    )}
                  </div>
                  {embedTestMsg ? (
                    <p className="text-[11px] leading-relaxed text-neutral-600" role="status">
                      {embedTestMsg}
                    </p>
                  ) : null}
                </div>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
              <span className="text-[15px]" style={{ color: COLORS.text }}>
                间隔轮数
              </span>
              <input
                type="number"
                min={1}
                max={100}
                value={intervalN}
                onChange={(e) => setIntervalN(Number(e.target.value))}
                onBlur={() => {
                  void commitInterval(intervalN)
                }}
                disabled={!autoSummaryEnabled}
                className="w-[72px] shrink-0 rounded-[8px] border px-2 py-1.5 text-center text-[15px] outline-none transition-all duration-200 ease-out focus:border-black disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderColor: COLORS.border,
                  background: COLORS.card,
                  color: COLORS.text,
                }}
                aria-label="自动总结间隔轮数"
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
              这个数字只管<strong className="font-medium text-neutral-600">微信里你俩聊了几轮 AI</strong>才总结一次。如果你在「约会」里推剧情，那边是<strong className="font-medium text-neutral-600">另有一条线</strong>，默认每写一段就可能总结，和这里几轮不是同一个计数。
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
              <div className="min-w-0 flex-1 pr-2">
                <span className="text-[15px]" style={{ color: COLORS.text }}>
                  约会推剧情时也自动记记忆
                </span>
                <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
                  关掉后：只有微信聊满上面的间隔轮数才会跑合并总结（含线下未总结片段）；约会里怎么写都不会自动往长期记忆里塞。
                </p>
              </div>
              <WxSwitch
                on={datingAutoSummaryEnabled && autoSummaryEnabled}
                onToggle={() => {
                  if (!autoSummaryEnabled) return
                  void toggleDatingAutoSummary()
                }}
              />
            </div>
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <Pressable
                type="button"
                disabled={saveBusy || loading}
                onClick={() => void saveAllMemorySettings()}
                className="flex w-full items-center justify-center rounded-[10px] bg-black px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveBusy ? '保存中…' : '保存设置'}
              </Pressable>
              {saveMsg ? (
                <p
                  className={`mt-2 text-center text-[11px] leading-relaxed ${saveMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}
                  role="status"
                >
                  {saveMsg.text}
                </p>
              ) : null}
              <p className="mt-1.5 text-center text-[10px] leading-relaxed text-neutral-400">
                数据保存在浏览器 IndexedDB，与本页自动总结、向量召回选项一致。
              </p>
            </div>
              </div>
            </div>
          ) : loading ? (
            <div className="flex min-h-[40vh] w-full items-center justify-center text-[13px] text-neutral-400">
              加载中…
            </div>
          ) : (
            <MemoryDashboard
              contacts={contacts}
              playerIdentityId={pid || '__none__'}
              playerDisplayName={playerDisplayName.trim() || '我'}
            />
          )}
        </div>
      </div>
    </div>
  )
}
