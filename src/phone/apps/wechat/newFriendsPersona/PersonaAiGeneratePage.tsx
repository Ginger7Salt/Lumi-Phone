import { motion } from 'framer-motion'
import { ArrowLeft, Download, Save, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ApiConfig } from '../../api/types'
import type { Character, PlayerIdentity } from './types'
import {
  generatePersonaWithAi,
  regeneratePersonaAiSelectedParts,
  repairPersonaAiWithAi,
  PersonaAiGenerateFailure,
  isPersonaAiAbortError,
  pickPersonaAiRepairIssues,
  type PersonaAiGenerateResult,
} from './personaAiGenerate'
import {
  emptyPersonaAiGenerateForm,
  type PersonaAiGenerateForm,
} from './personaAiGenerateTypes'
import {
  clearPersonaAiGenerateFormDraft,
  loadPersonaAiGenerateFormDraft,
  savePersonaAiGenerateFormDraft,
  shouldPersistPersonaAiGenerateForm,
} from './personaAiGenerateFormPersist'
import {
  exportPersonaAiGeneratePresetToFile,
  parsePersonaAiGeneratePresetImport,
} from './personaAiGeneratePresetIo'
import {
  PERSONA_AI_DOSSIER_TABS,
  PersonaAiGenerateDossierForm,
  type PersonaAiDossierTabId,
} from './PersonaAiGenerateDossierForm'
import { PersonaAiGeneratePreviewSheet } from './PersonaAiGeneratePreviewSheet'
import { WeChatThemePageBackdrop } from './WeChatThemePageBackdrop'

const PAGE_BG = '#FAFAFA'

function countFilledHints(form: PersonaAiGenerateForm): number {
  const keys: (keyof PersonaAiGenerateForm)[] = [
    'nameHint',
    'avatarUrl',
    'ageHint',
    'occupationHint',
    'appearanceHint',
    'hairColorHint',
    'hairStyleHint',
    'bodyShapeHint',
    'auraHint',
    'outfitHint',
    'mbtiHint',
    'personalityKeywords',
    'socialMaskHint',
    'backgroundHint',
    'hobbiesHint',
    'lifeHabitsHint',
    'painPointsHint',
    'socialFamilyHint',
    'socialFriendsHint',
    'socialWorkHint',
    'socialCircleHint',
    'gapMoeHint',
    'relationToUser',
    'relationDetailHint',
    'relationshipHistoryHint',
    'loveAttitudeHint',
    'loveBeforeHint',
    'loveAfterHint',
    'jealousyHint',
    'conflictHint',
    'loveContrastHint',
    'orientationHint',
    'nsfwHint',
    'speechStyleHint',
    'extraNotes',
  ]
  return keys.filter((k) => {
    if (k === 'nsfwHint' && !form.nsfwEnabled) return false
    // avoid double-count when split fields already filled
    if (k === 'socialCircleHint' && (form.socialFamilyHint || form.socialFriendsHint || form.socialWorkHint)) {
      return false
    }
    if (
      k === 'loveContrastHint' &&
      (form.loveBeforeHint || form.loveAfterHint || form.jealousyHint || form.conflictHint)
    ) {
      return false
    }
    return String(form[k] ?? '').trim().length > 0
  }).length
}

const TOTAL_HINT_SLOTS = 28

function formatSavedAt(ms: number): string {
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function PersonaAiGeneratePage({
  draft,
  playerIdentity,
  playerIdentityId,
  wechatAccountId,
  apiConfig,
  worldBackgroundPrompt,
  onBack,
  onGenerated,
}: {
  draft: Character
  playerIdentity: PlayerIdentity | null
  playerIdentityId: string
  wechatAccountId?: string | null
  apiConfig: ApiConfig | null
  worldBackgroundPrompt?: string
  onBack: () => void
  onGenerated: (character: Character) => void
}) {
  const [form, setForm] = useState<PersonaAiGenerateForm>(() => ({
    ...emptyPersonaAiGenerateForm(),
    gender: draft.gender ?? 'female',
    nameHint:
      draft.name?.trim() && draft.name !== '未命名' && draft.name !== '新角色'
        ? draft.name.trim()
        : '',
    avatarUrl: draft.avatarUrl?.trim() ?? '',
  }))
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openChapter, setOpenChapter] = useState<PersonaAiDossierTabId>('01')
  const [recoveryOffer, setRecoveryOffer] = useState<{
    result: PersonaAiGenerateResult
    fatalMessage?: string
    previousIssueCount?: number
  } | null>(null)
  const [recoveryBusy, setRecoveryBusy] = useState<'complete' | 'fix' | null>(null)
  const [previewOffer, setPreviewOffer] = useState<PersonaAiGenerateResult | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [presetExportBusy, setPresetExportBusy] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [draftDirty, setDraftDirty] = useState(false)
  const [formHydrated, setFormHydrated] = useState(false)
  const presetImportRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const formRef = useRef(form)
  formRef.current = form
  const wechatAccountIdRef = useRef(wechatAccountId)
  wechatAccountIdRef.current = wechatAccountId
  const playerIdentityIdRef = useRef(playerIdentityId)
  playerIdentityIdRef.current = playerIdentityId

  const stopGenerate = () => {
    abortRef.current?.abort()
    abortRef.current = null
  }

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const saved = await loadPersonaAiGenerateFormDraft(wechatAccountId, playerIdentityId)
        if (cancelled || !saved) return
        setForm(saved.form)
        setSavedAt(saved.savedAt)
        setDraftDirty(false)
      } finally {
        if (!cancelled) setFormHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [playerIdentityId, wechatAccountId])

  useEffect(() => {
    return () => {
      if (!formHydrated) return
      const f = formRef.current
      if (!shouldPersistPersonaAiGenerateForm(f)) return
      void savePersonaAiGenerateFormDraft(
        wechatAccountIdRef.current,
        playerIdentityIdRef.current,
        f,
      )
    }
  }, [formHydrated])

  const playerDisplayName = useMemo(() => {
    return playerIdentity?.name?.trim() || playerIdentity?.wechatNickname?.trim() || ''
  }, [playerIdentity])

  const filledCount = useMemo(() => countFilledHints(form), [form])
  const progressPct = Math.min(100, Math.round((filledCount / TOTAL_HINT_SLOTS) * 100))

  const patch = (partial: Partial<PersonaAiGenerateForm>) => {
    setDraftDirty(true)
    setForm((prev) => ({ ...prev, ...partial }))
  }

  const finishGenerated = (character: Character) => {
    void clearPersonaAiGenerateFormDraft(wechatAccountId, playerIdentityId)
    onGenerated(character)
  }

  const runSaveDraft = async () => {
    if (saveBusy || generating) return
    if (!shouldPersistPersonaAiGenerateForm(form)) {
      window.alert('当前没有可保存的填写内容')
      return
    }
    setSaveBusy(true)
    try {
      const at = await savePersonaAiGenerateFormDraft(wechatAccountId, playerIdentityId, form)
      setSavedAt(at)
      setDraftDirty(false)
    } catch {
      window.alert('保存失败，请稍后重试')
    } finally {
      setSaveBusy(false)
    }
  }

  const runExportPreset = async () => {
    if (generating || presetExportBusy || saveBusy) return
    setPresetExportBusy(true)
    try {
      await exportPersonaAiGeneratePresetToFile(form)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '导出预设失败')
    } finally {
      setPresetExportBusy(false)
    }
  }

  const onImportPresetFile = async (file: File | null) => {
    if (!file || generating) return
    try {
      const text = await file.text()
      const imported = parsePersonaAiGeneratePresetImport(text)
      if (!imported) {
        window.alert('无法识别预设文件：请导入本页导出的 JSON，或含 form 字段的填写草稿。')
        return
      }
      if (draftDirty && !window.confirm('导入将覆盖当前填写内容，是否继续？')) return
      setForm(imported)
      setDraftDirty(true)
      setSavedAt(null)
      setError(null)
      setRecoveryOffer(null)
    } catch {
      window.alert('读取预设文件失败，请检查文件是否损坏。')
    }
  }

  const runGenerate = async () => {
    if (!apiConfig?.apiUrl?.trim() || !apiConfig?.apiKey?.trim() || !apiConfig?.modelId?.trim()) {
      window.alert('请先在 API 设置中配置聊天模型')
      return
    }
    stopGenerate()
    const ac = new AbortController()
    abortRef.current = ac
    setGenerating(true)
    setError(null)
    setRecoveryOffer(null)
    setPreviewOffer(null)
    try {
      const result = await generatePersonaWithAi({
        apiConfig,
        form,
        draft,
        playerIdentity,
        playerDisplayName,
        worldBackgroundPrompt,
        signal: ac.signal,
      })
      if (result.issues.length === 0) {
        setPreviewOffer(result)
      } else {
        setRecoveryOffer({ result })
        setError(`生成不完整，有 ${result.issues.length} 项待补全或纠正`)
      }
    } catch (e) {
      if (isPersonaAiAbortError(e)) {
        setError('已停止生成，可调整种子后重试')
        return
      }
      if (e instanceof PersonaAiGenerateFailure) {
        const fallback: PersonaAiGenerateResult = {
          character: { ...draft, updatedAt: Date.now() },
          issues: [{ id: 'parse-fatal', kind: 'parse', label: '标记文本解析失败', detail: e.message }],
          rawText: e.rawText,
          parsedSnapshot: {},
          parseRecovered: false,
        }
        setRecoveryOffer({ result: fallback, fatalMessage: e.message })
        setError(e.message)
      } else {
        const msg = e instanceof Error ? e.message : '生成失败'
        setError(msg)
        window.alert(msg)
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null
      setGenerating(false)
    }
  }

  const runRepair = async (mode: 'complete' | 'fix') => {
    if (!apiConfig || !recoveryOffer) return
    stopGenerate()
    const ac = new AbortController()
    abortRef.current = ac
    setRecoveryBusy(mode)
    setGenerating(true)
    setError(null)
    const previousIssueCount = recoveryOffer.result.issues.length
    try {
      const next = await repairPersonaAiWithAi({
        apiConfig,
        form,
        draft,
        base: recoveryOffer.result,
        mode,
        playerDisplayName,
        playerIdentity,
        worldBackgroundPrompt,
        signal: ac.signal,
      })
      if (next.issues.length === 0) {
        setRecoveryOffer(null)
        setPreviewOffer(next)
      } else {
        setRecoveryOffer({ result: next, previousIssueCount })
        setError(`仍有 ${next.issues.length} 项待处理，可继续补全或纠正`)
      }
    } catch (e) {
      if (isPersonaAiAbortError(e)) {
        setError('已停止补全')
        return
      }
      const msg = e instanceof Error ? e.message : '补全失败'
      setError(msg)
      window.alert(msg)
    } finally {
      if (abortRef.current === ac) abortRef.current = null
      setRecoveryBusy(null)
      setGenerating(false)
    }
  }

  const adoptPartialDraft = () => {
    if (!recoveryOffer) return
    setPreviewOffer(recoveryOffer.result)
    setRecoveryOffer(null)
    setError(null)
  }

  const adoptPreview = () => {
    if (!previewOffer) return
    finishGenerated(previewOffer.character)
    setPreviewOffer(null)
    setError(null)
  }

  const runRegenerateSelected = async (selectedKeys: string[], guidance: string) => {
    if (!apiConfig || !previewOffer) return
    stopGenerate()
    const ac = new AbortController()
    abortRef.current = ac
    setPreviewBusy(true)
    setGenerating(true)
    setError(null)
    try {
      const next = await regeneratePersonaAiSelectedParts({
        apiConfig,
        form,
        draft,
        base: previewOffer,
        selectedNames: selectedKeys,
        guidance,
        playerDisplayName,
        playerIdentity,
        worldBackgroundPrompt,
        signal: ac.signal,
      })
      setPreviewOffer(next)
    } catch (e) {
      if (isPersonaAiAbortError(e)) {
        setError('已停止重写')
        return
      }
      const msg = e instanceof Error ? e.message : '重写失败'
      setError(msg)
      window.alert(msg)
    } finally {
      if (abortRef.current === ac) abortRef.current = null
      setPreviewBusy(false)
      setGenerating(false)
    }
  }

  const runRegenerateAllFromPreview = () => {
    if (!window.confirm('将丢弃当前预览，按现有种子整卷重新生成，是否继续？')) return
    setPreviewOffer(null)
    void runGenerate()
  }

  const completeIssues = useMemo(
    () => (recoveryOffer ? pickPersonaAiRepairIssues(recoveryOffer.result.issues, 'complete') : []),
    [recoveryOffer],
  )
  const fixIssues = useMemo(
    () => (recoveryOffer ? pickPersonaAiRepairIssues(recoveryOffer.result.issues, 'fix') : []),
    [recoveryOffer],
  )

  return (
    <div className="relative flex h-full min-h-0 flex-col" style={{ background: PAGE_BG }}>
      <WeChatThemePageBackdrop />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-20 shrink-0 border-b border-neutral-100/90 bg-[#FAFAFA]/90 backdrop-blur-xl"
          style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-0.5 px-2 py-2">
            <button
              type="button"
              onClick={onBack}
              disabled={generating}
              className="rounded-xl p-2.5 text-neutral-800 transition-colors hover:bg-neutral-200/40 disabled:opacity-40"
              aria-label="返回"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="min-w-0 flex-1 px-1">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
                Persona Dossier
              </p>
              <p className="truncate text-[16px] font-semibold tracking-tight text-neutral-900">
                出厂参数设定卷宗
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => void runSaveDraft()}
                disabled={generating || saveBusy}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-200/40 disabled:opacity-40"
                title="封存草稿"
              >
                <Save className="size-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">{saveBusy ? '写入中' : '封存草稿'}</span>
              </button>
              <button
                type="button"
                onClick={() => presetImportRef.current?.click()}
                disabled={generating || presetExportBusy}
                className="rounded-xl p-2.5 text-neutral-600 transition-colors hover:bg-neutral-200/40 disabled:opacity-40"
                aria-label="导入预设"
                title="导入预设"
              >
                <Upload className="size-4.5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => void runExportPreset()}
                disabled={generating || presetExportBusy || saveBusy}
                className="rounded-xl p-2.5 text-neutral-600 transition-colors hover:bg-neutral-200/40 disabled:opacity-40"
                aria-label="导出预设"
                title="导出预设"
              >
                <Download className="size-4.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
          <input
            ref={presetImportRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              void onImportPresetFile(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          <div className="flex items-center gap-2.5 px-4 pb-2">
            <div className="h-[2px] min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-200/70">
              <motion.div
                className="h-full rounded-full bg-neutral-900"
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-neutral-400">
              {filledCount}/{TOTAL_HINT_SLOTS}
            </span>
          </div>

          <div
            className="flex gap-0.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="卷宗章节"
          >
            {PERSONA_AI_DOSSIER_TABS.map((tab) => {
              const active = openChapter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setOpenChapter(tab.id)}
                  className={`relative shrink-0 rounded-xl px-3 py-2 text-center transition-colors ${
                    active ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  <span className="block font-mono text-[9px] tracking-[0.12em] opacity-70">{tab.en}</span>
                  <span className="mt-0.5 block text-[13px] font-semibold tracking-tight">{tab.zh}</span>
                  {active ? (
                    <span className="absolute bottom-1 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-neutral-900" />
                  ) : null}
                </button>
              )
            })}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="mx-auto max-w-lg space-y-4 pb-6">
            <PersonaAiGenerateDossierForm form={form} patch={patch} activeTab={openChapter} />

            {error ? (
              <p className="rounded-xl border border-red-200/70 bg-red-50/80 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-700">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="shrink-0 border-t border-neutral-100 bg-white/80 px-4 pt-3 backdrop-blur-xl"
          style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="mx-auto w-full max-w-lg">
            <button
              type="button"
              disabled={generating}
              onClick={() => void runGenerate()}
              className="flex w-full items-center justify-center rounded-2xl px-4 py-4 text-[15px] font-semibold tracking-wide text-white transition-all duration-200 active:scale-[0.99] disabled:opacity-50"
              style={{
                background: '#171717',
                boxShadow: '0 10px 28px rgba(23,23,23,0.16)',
              }}
            >
              {generating ? '正在注入法则…' : '注入法则并生成灵魂'}
            </button>
            <p className="mt-2 px-0.5 text-center text-[11px] text-neutral-400">
              {saveBusy
                ? '正在写入本地草稿…'
                : savedAt && !draftDirty
                  ? `已封存 · ${formatSavedAt(savedAt)}`
                  : draftDirty
                    ? '有未封存修改；可点右上角「封存草稿」'
                    : '填写后可封存草稿；生成成功后自动清除'}
            </p>
          </div>
        </div>
      </div>

      {generating ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center overflow-hidden">
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(255,255,255,0.95) 0%, rgba(250,250,250,0.88) 45%, rgba(0,0,0,0.18) 100%)',
            }}
          />
          <motion.div
            className="absolute size-[min(90vw,420px)] rounded-full"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: [0.35, 0.55, 0.35], scale: [0.92, 1.04, 0.92] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background:
                'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(228,228,231,0.35) 50%, transparent 70%)',
              filter: 'blur(8px)',
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-[1] px-8 text-center"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
              Initializing
            </p>
            <p className="mt-2 text-[17px] font-semibold tracking-tight text-neutral-900">
              正在撰写世界书卷宗
            </p>
            <div className="mt-5 flex justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full bg-neutral-800"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={stopGenerate}
              className="mt-8 rounded-full border border-neutral-300/80 bg-white/90 px-5 py-2.5 text-[13px] font-medium text-neutral-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
            >
              停止生成
            </button>
            <p className="mt-2 text-[11px] text-neutral-400">停止后可调整种子再试</p>
          </motion.div>
        </div>
      ) : null}

      {previewOffer && !generating ? (
        <PersonaAiGeneratePreviewSheet
          result={previewOffer}
          busy={previewBusy}
          onClose={() => {
            setPreviewOffer(null)
            setError(null)
          }}
          onAdopt={adoptPreview}
          onRegenerateAll={runRegenerateAllFromPreview}
          onRegenerateSelected={(keys, guidance) => void runRegenerateSelected(keys, guidance)}
        />
      ) : null}

      {recoveryOffer && !generating ? (
        <div className="fixed inset-0 z-[1350] flex items-end justify-center bg-black/40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-8 backdrop-blur-[2px] sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-h-[min(78dvh,560px)] w-full max-w-md overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
          >
            <div className="border-b border-neutral-100 px-5 py-4">
              <p className="text-[17px] font-semibold text-neutral-900">
                {recoveryOffer.fatalMessage ? '生成中断' : '生成未完整'}
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">
                补全只写空白缺失项；纠正只改过短/占位项。两者都是增量补丁，不会整卷重生成。
              </p>
            </div>
            <div className="max-h-[220px] overflow-y-auto px-5 py-3">
              <ul className="space-y-1.5 text-[12px] leading-relaxed text-neutral-500">
                {recoveryOffer.result.issues.slice(0, 12).map((issue) => (
                  <li key={issue.id} className="flex gap-2">
                    <span className="shrink-0 text-neutral-300">·</span>
                    <span>
                      <span className="font-medium text-neutral-700">{issue.label}</span>
                      {issue.detail ? <span className="text-neutral-400"> — {issue.detail}</span> : null}
                      <span className="ml-1 text-[11px] text-neutral-400">
                        {issue.kind === 'placeholder_field'
                          ? '（纠正）'
                          : issue.kind === 'missing_epilogue' || issue.kind === 'missing_top_field'
                            ? '（补全）'
                            : '（两者均可）'}
                      </span>
                    </span>
                  </li>
                ))}
                {recoveryOffer.result.issues.length > 12 ? (
                  <li className="text-neutral-400">…还有 {recoveryOffer.result.issues.length - 12} 项</li>
                ) : null}
              </ul>
            </div>
            <div className="space-y-2 border-t border-neutral-100 px-4 py-4">
              <button
                type="button"
                disabled={!!recoveryBusy || completeIssues.length === 0}
                onClick={() => void runRepair('complete')}
                className="flex w-full flex-col items-center justify-center rounded-xl bg-neutral-900 px-4 py-3 text-white disabled:opacity-40"
              >
                <span className="text-[14px] font-semibold">
                  {recoveryBusy === 'complete' ? '正在补全…' : '继续补全剩余条目'}
                </span>
                <span className="mt-0.5 text-[11px] font-normal text-white/70">
                  {completeIssues.length > 0
                    ? `仅写 ${completeIssues.length} 项空白缺失`
                    : '当前没有空白缺失项'}
                </span>
              </button>
              <button
                type="button"
                disabled={!!recoveryBusy || fixIssues.length === 0}
                onClick={() => void runRepair('fix')}
                className="flex w-full flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 disabled:opacity-40"
              >
                <span className="text-[14px] font-semibold">
                  {recoveryBusy === 'fix' ? '正在纠正…' : '纠正出错内容'}
                </span>
                <span className="mt-0.5 text-[11px] font-normal text-neutral-400">
                  {fixIssues.length > 0
                    ? `仅改 ${fixIssues.length} 项过短/占位`
                    : '当前没有过短/占位项'}
                </span>
              </button>
              {!recoveryOffer.fatalMessage ? (
                <button
                  type="button"
                  disabled={!!recoveryBusy}
                  onClick={adoptPartialDraft}
                  className="w-full py-2 text-[13px] font-medium text-neutral-500 disabled:opacity-50"
                >
                  先预览当前草稿
                </button>
              ) : null}
              <button
                type="button"
                disabled={!!recoveryBusy}
                onClick={() => {
                  setRecoveryOffer(null)
                  setError(null)
                }}
                className="w-full py-2 text-[13px] text-neutral-400"
              >
                关闭
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  )
}
