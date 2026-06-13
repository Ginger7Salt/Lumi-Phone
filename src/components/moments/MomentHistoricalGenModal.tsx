import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'

import {
  clampInstantGenTextLength,
  clampHistoricalTextLengthRange,
  formatHistoricalTextLengthRangeLabel,
  HISTORICAL_GEN_TEXT_LENGTH_MAX_DEFAULT,
  HISTORICAL_GEN_TEXT_LENGTH_MIN_DEFAULT,
  HISTORICAL_GEN_TEXT_LENGTH_PRESETS,
  INSTANT_GEN_TEXT_LENGTH_MAX,
  INSTANT_GEN_TEXT_LENGTH_MIN,
} from './momentContentLimits'
import {
  clampInstantGenCustomContentDirection,
  INSTANT_GEN_CONTENT_TYPE_OPTIONS,
  INSTANT_GEN_CUSTOM_CONTENT_DIRECTION_MAX,
  type InstantGenContentTypeChoice,
} from './momentInstantGenContentTypes'
import type { InstantGenPostTypeChoice } from './momentInstantGenTypes'
import { instantGenPostTypeIncludesText } from './momentInstantGenTypes'
import type { MomentItemModel } from './mockMoments'
import {
  isMomentsChatApiConfigured,
  MOMENTS_CHAT_API_NOT_CONFIGURED_MESSAGE,
} from './momentsChatApiReady'
import { isMomentsImageGenConfigured } from './momentsImageGenAvailability'
import { MomentGeneratingOverlay } from './MomentGeneratingOverlay'
import {
  publishHistoricalCharacterMoments,
  type HistoricalGenPublishStage,
} from './momentHistoricalGenService'
import {
  buildHistoricalTimeSpanFromPreset,
  clampHistoricalGenCount,
  clampHistoricalPinnedCount,
  HISTORICAL_GEN_COUNT_DEFAULT,
  HISTORICAL_GEN_COUNT_MAX,
  HISTORICAL_GEN_COUNT_MIN,
  HISTORICAL_PINNED_COUNT_DEFAULT,
  HISTORICAL_PINNED_COUNT_MAX,
  HISTORICAL_TIME_SPAN_PRESETS,
  type HistoricalGenConfig,
  type HistoricalTimeSpanPresetId,
} from './momentHistoricalGenTypes'
import type { MomentContactRef } from './newMomentTypes'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

type Props = {
  open: boolean
  onClose: () => void
  wechatCtx: AnonymousQaWechatContext | null
  characterId: string
  characterName: string
  momentContacts: MomentContactRef[]
  blockedCharacterIds?: Set<string>
  imageGenSettings: MomentsImageGenSettings
  onPublished: (items: MomentItemModel[]) => void | Promise<void>
}

const POST_TYPE_OPTIONS: { id: InstantGenPostTypeChoice; label: string }[] = [
  { id: 'text', label: '纯文字' },
  { id: 'mixed', label: '图文' },
  { id: 'image', label: '纯图片' },
]

const STAGE_LABEL: Record<HistoricalGenPublishStage, string> = {
  writing: '正在撰写历史动态…',
  imaging: '正在显影配图…',
  saving: '正在写入时间轴…',
  done: '生成完成',
}

const HORIZONTAL_SCROLL_ROW =
  'flex w-full gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

const VERTICAL_SCROLL_BODY =
  'max-h-[min(58vh,520px)] space-y-6 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

const CONTENT_TYPE_OPTIONS = INSTANT_GEN_CONTENT_TYPE_OPTIONS.filter((o) => o.id !== 'auto')

function togglePoolItem<T extends string>(pool: Set<T>, id: T): Set<T> {
  const next = new Set(pool)
  if (next.has(id)) {
    if (next.size <= 1) return next
    next.delete(id)
  } else {
    next.add(id)
  }
  return next
}

function msToDateInputValue(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateInputValueToEndMs(value: string): number {
  const t = value.trim()
  if (!t) return Date.now()
  const d = new Date(`${t}T23:59:59`)
  return Number.isFinite(d.getTime()) ? d.getTime() : Date.now()
}

function dateInputValueToStartMs(value: string): number {
  const t = value.trim()
  if (!t) return Date.now() - 30 * 24 * 60 * 60 * 1000
  const d = new Date(`${t}T00:00:00`)
  return Number.isFinite(d.getTime()) ? d.getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000
}

export function MomentHistoricalGenModal({
  open,
  onClose,
  wechatCtx,
  characterId,
  characterName,
  momentContacts,
  blockedCharacterIds,
  imageGenSettings,
  onPublished,
}: Props) {
  const [postTypes, setPostTypes] = useState<Set<InstantGenPostTypeChoice>>(
    () => new Set(['mixed', 'text']),
  )
  const [contentTypes, setContentTypes] = useState<Set<InstantGenContentTypeChoice>>(
    () => new Set<InstantGenContentTypeChoice>(['daily_vent', 'celebration']),
  )
  const [customContentDirection, setCustomContentDirection] = useState('')
  const [textLengthMin, setTextLengthMin] = useState(HISTORICAL_GEN_TEXT_LENGTH_MIN_DEFAULT)
  const [textLengthMax, setTextLengthMax] = useState(HISTORICAL_GEN_TEXT_LENGTH_MAX_DEFAULT)
  const [count, setCount] = useState(HISTORICAL_GEN_COUNT_DEFAULT)
  const [pinnedCount, setPinnedCount] = useState(HISTORICAL_PINNED_COUNT_DEFAULT)
  const [timePreset, setTimePreset] = useState<HistoricalTimeSpanPresetId>('month')
  const [customStartDate, setCustomStartDate] = useState(() =>
    msToDateInputValue(Date.now() - 30 * 24 * 60 * 60 * 1000),
  )
  const [customEndDate, setCustomEndDate] = useState(() => msToDateInputValue(Date.now()))
  const [stage, setStage] = useState<HistoricalGenPublishStage | 'idle'>('idle')
  const [batchIndex, setBatchIndex] = useState(0)
  const [batchTotal, setBatchTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const prevOpenRef = useRef(false)

  const imageGenReady = useMemo(
    () => isMomentsImageGenConfigured(imageGenSettings),
    [imageGenSettings],
  )

  const postTypeOptions = useMemo(
    () => (imageGenReady ? POST_TYPE_OPTIONS : POST_TYPE_OPTIONS.filter((o) => o.id === 'text')),
    [imageGenReady],
  )

  const textLengthRange = useMemo(
    () => clampHistoricalTextLengthRange(textLengthMin, textLengthMax),
    [textLengthMax, textLengthMin],
  )

  const includesTextPostType = useMemo(
    () => [...postTypes].some((p) => instantGenPostTypeIncludesText(p)),
    [postTypes],
  )

  const trimmedCustomDirection = useMemo(
    () => clampInstantGenCustomContentDirection(customContentDirection),
    [customContentDirection],
  )

  const timeSpan = useMemo(() => {
    if (timePreset === 'custom') {
      return {
        preset: 'custom' as const,
        startMs: dateInputValueToStartMs(customStartDate),
        endMs: dateInputValueToEndMs(customEndDate),
      }
    }
    return buildHistoricalTimeSpanFromPreset(timePreset)
  }, [customEndDate, customStartDate, timePreset])

  const maxPinnedCount = Math.min(HISTORICAL_PINNED_COUNT_MAX, clampHistoricalGenCount(count))

  useEffect(() => {
    setPinnedCount((prev) => clampHistoricalPinnedCount(prev, count))
  }, [count])

  useEffect(() => {
    const justOpened = open && !prevOpenRef.current
    prevOpenRef.current = open
    if (!open) {
      setStage('idle')
      setBatchIndex(0)
      setBatchTotal(0)
      return
    }
    if (!justOpened) return
    setError(null)
    setStage('idle')
    if (!imageGenReady) {
      setPostTypes(new Set(['text']))
    }
  }, [imageGenReady, open])

  const busy = stage !== 'idle'
  const chatApiReady = isMomentsChatApiConfigured(wechatCtx?.apiConfig)
  const needsCustomDirection = contentTypes.has('custom')
  const canGenerate =
    !!wechatCtx &&
    !!characterId.trim() &&
    chatApiReady &&
    !busy &&
    postTypes.size > 0 &&
    contentTypes.size > 0 &&
    timeSpan.endMs > timeSpan.startMs &&
    (!needsCustomDirection || trimmedCustomDirection.length > 0)

  const characterContact = useMemo(
    () =>
      momentContacts.find((c) => c.characterId?.trim() === characterId.trim()) ?? {
        id: characterId,
        name: characterName,
        characterId,
      },
    [characterId, characterName, momentContacts],
  )

  const handleGenerate = useCallback(async () => {
    if (!wechatCtx || !canGenerate || busy) return
    if (!isMomentsChatApiConfigured(wechatCtx.apiConfig)) {
      setError(MOMENTS_CHAT_API_NOT_CONFIGURED_MESSAGE)
      return
    }

    const config: HistoricalGenConfig = {
      targetCharacterId: characterId.trim(),
      postTypes: [...postTypes],
      contentTypes: [...contentTypes],
      ...(needsCustomDirection && trimmedCustomDirection
        ? { customContentDirection: trimmedCustomDirection }
        : {}),
      textLengthMin: textLengthRange.min,
      textLengthMax: textLengthRange.max,
      count: clampHistoricalGenCount(count),
      pinnedCount: clampHistoricalPinnedCount(pinnedCount, count),
      timeSpan,
    }

    setError(null)
    setBatchTotal(config.count)
    setBatchIndex(1)
    setStage('writing')

    try {
      const result = await publishHistoricalCharacterMoments({
        wechatCtx,
        characterId: characterId.trim(),
        characterContact,
        momentContacts,
        blockedCharacterIds,
        imageGenSettings,
        config,
        onProgress: (nextStage, index, total) => {
          setStage(nextStage)
          setBatchIndex(index)
          setBatchTotal(total)
        },
      })

      if (!result.items.length) {
        setError(result.failures.join('\n') || '未能生成任何动态')
        setStage('idle')
        setBatchIndex(0)
        setBatchTotal(0)
        return
      }

      setStage('saving')
      await onPublished(result.items)

      if (result.failures.length) {
        setError(`已生成 ${result.items.length} 条，部分失败：\n${result.failures.join('\n')}`)
        setStage('idle')
        setBatchIndex(0)
        setBatchTotal(0)
        return
      }

      setStage('done')
      await new Promise((resolve) => window.setTimeout(resolve, 480))
      setStage('idle')
      setBatchIndex(0)
      setBatchTotal(0)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
      setStage('idle')
      setBatchIndex(0)
      setBatchTotal(0)
    }
  }, [
    blockedCharacterIds,
    busy,
    canGenerate,
    characterContact,
    characterId,
    contentTypes,
    count,
    pinnedCount,
    imageGenSettings,
    momentContacts,
    needsCustomDirection,
    onClose,
    onPublished,
    postTypes,
    textLengthRange.max,
    textLengthRange.min,
    timeSpan,
    trimmedCustomDirection,
    wechatCtx,
  ])

  const showGenerating = busy
  const stageLabel = busy ? STAGE_LABEL[stage as HistoricalGenPublishStage] : ''

  return (
    <>
      <MomentGeneratingOverlay
        open={showGenerating}
        stageLabel={stageLabel}
        characterName={characterName}
        batchIndex={batchIndex}
        batchTotal={batchTotal}
      />
      <AnimatePresence>
        {open && !showGenerating ? (
          <motion.div
            className="fixed inset-0 z-[440] flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <motion.button
              type="button"
              aria-label="关闭"
              className="absolute inset-0 bg-black/30 backdrop-blur-[2px] focus:outline-none"
              onClick={onClose}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="historical-gen-title"
              className="relative w-full max-w-[560px] overflow-hidden rounded-t-[20px] border-t border-black/[0.06] bg-white px-5 pb-[max(20px,env(safe-area-inset-bottom,0px))] pt-5 shadow-[0_-12px_48px_rgba(0,0,0,0.06)]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 42 }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#E5E7EB]" aria-hidden />

              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#9CA3AF]">
                Timeline Backfill
              </p>
              <h2
                id="historical-gen-title"
                className="mt-1 text-[18px] font-semibold tracking-[0.01em] text-[#111827]"
              >
                历史朋友圈补全
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-[#9CA3AF]">
                为 <span className="font-medium text-[#374151]">{characterName}</span>{' '}
                按时间跨度批量生成过去的朋友圈，写入个人相册时间轴。
              </p>

              <div className={`mt-6 ${VERTICAL_SCROLL_BODY}`}>
                <section>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                    朋友圈类型（多选）
                  </p>
                  <div className={`mt-3 ${HORIZONTAL_SCROLL_ROW}`}>
                    {postTypeOptions.map((opt) => {
                      const active = postTypes.has(opt.id)
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPostTypes((prev) => togglePoolItem(prev, opt.id))}
                          className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] transition-colors ${
                            active
                              ? 'bg-[#111827] text-white'
                              : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                    朋友圈风格（多选）
                  </p>
                  <div className={`mt-3 flex flex-wrap gap-2`}>
                    {CONTENT_TYPE_OPTIONS.map((opt) => {
                      const active = contentTypes.has(opt.id)
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setContentTypes((prev) => togglePoolItem(prev, opt.id))}
                          className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                            active
                              ? 'bg-[#111827] text-white'
                              : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
                          }`}
                          title={opt.hint}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                  {needsCustomDirection ? (
                    <textarea
                      value={customContentDirection}
                      onChange={(e) => setCustomContentDirection(e.target.value)}
                      placeholder="描述你希望角色历史朋友圈的内容偏向、情绪或剧情意图…"
                      maxLength={INSTANT_GEN_CUSTOM_CONTENT_DIRECTION_MAX}
                      rows={3}
                      className="mt-3 w-full resize-none rounded-xl border border-black/[0.08] bg-[#FAFAFA] px-3 py-2.5 text-[13px] leading-relaxed text-[#111827] outline-none focus:border-black/20"
                    />
                  ) : null}
                </section>

                {includesTextPostType ? (
                  <section>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                        正文字数范围
                      </p>
                      <p className="text-[11px] text-[#9CA3AF]">
                        {formatHistoricalTextLengthRangeLabel(
                          textLengthRange.min,
                          textLengthRange.max,
                        )}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
                      每条动态会在范围内随机抽取目标字数，避免条条一样长。
                    </p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="mb-1.5 text-[11px] text-[#6B7280]">
                          最短 · {textLengthRange.min} 字
                        </p>
                        <input
                          type="range"
                          min={INSTANT_GEN_TEXT_LENGTH_MIN}
                          max={INSTANT_GEN_TEXT_LENGTH_MAX}
                          value={textLengthRange.min}
                          onChange={(e) =>
                            setTextLengthMin(clampInstantGenTextLength(Number(e.target.value)))
                          }
                          className="w-full accent-[#111827]"
                        />
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] text-[#6B7280]">
                          最长 · {textLengthRange.max} 字
                        </p>
                        <input
                          type="range"
                          min={INSTANT_GEN_TEXT_LENGTH_MIN}
                          max={INSTANT_GEN_TEXT_LENGTH_MAX}
                          value={textLengthRange.max}
                          onChange={(e) =>
                            setTextLengthMax(clampInstantGenTextLength(Number(e.target.value)))
                          }
                          className="w-full accent-[#111827]"
                        />
                      </div>
                    </div>
                    <div className={`mt-2 ${HORIZONTAL_SCROLL_ROW}`}>
                      {HISTORICAL_GEN_TEXT_LENGTH_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setTextLengthMin(preset.min)
                            setTextLengthMax(preset.max)
                          }}
                          className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] ${
                            textLengthRange.min === preset.min && textLengthRange.max === preset.max
                              ? 'bg-[#111827] text-white'
                              : 'bg-[#F3F4F6] text-[#6B7280]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                      生成条数
                    </p>
                    <p className="text-[11px] tabular-nums text-[#9CA3AF]">{count} 条</p>
                  </div>
                  <input
                    type="range"
                    min={HISTORICAL_GEN_COUNT_MIN}
                    max={HISTORICAL_GEN_COUNT_MAX}
                    value={clampHistoricalGenCount(count)}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="mt-3 w-full accent-[#111827]"
                  />
                </section>

                <section>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                      其中置顶
                    </p>
                    <p className="text-[11px] tabular-nums text-[#9CA3AF]">
                      {clampHistoricalPinnedCount(pinnedCount, count)} 条
                    </p>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxPinnedCount}
                    value={clampHistoricalPinnedCount(pinnedCount, count)}
                    onChange={(e) => setPinnedCount(Number(e.target.value))}
                    className="mt-3 w-full accent-[#111827]"
                  />
                  <p className="mt-2 text-[11px] leading-relaxed text-[#9CA3AF]">
                    置顶动态会分布在时间跨度内，并出现在个人相册置顶栏。
                  </p>
                </section>

                <section>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                    时间跨度
                  </p>
                  <div className={`mt-3 ${HORIZONTAL_SCROLL_ROW}`}>
                    {HISTORICAL_TIME_SPAN_PRESETS.map((preset) => {
                      const active = timePreset === preset.id
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setTimePreset(preset.id)}
                          className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] transition-colors ${
                            active
                              ? 'bg-[#111827] text-white'
                              : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      )
                    })}
                  </div>
                  {timePreset === 'custom' ? (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="block text-[12px] text-[#6B7280]">
                        起始日期
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-black/[0.08] bg-[#FAFAFA] px-3 py-2 text-[13px] text-[#111827] outline-none focus:border-black/20"
                        />
                      </label>
                      <label className="block text-[12px] text-[#6B7280]">
                        结束日期
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-black/[0.08] bg-[#FAFAFA] px-3 py-2 text-[13px] text-[#111827] outline-none focus:border-black/20"
                        />
                      </label>
                    </div>
                  ) : null}
                  {timeSpan.endMs <= timeSpan.startMs ? (
                    <p className="mt-2 text-[12px] text-[#DC2626]">结束日期须晚于起始日期</p>
                  ) : null}
                </section>
              </div>

              {error ? (
                <p className="mt-4 whitespace-pre-wrap text-[12px] leading-relaxed text-[#DC2626]">
                  {error}
                </p>
              ) : null}

              {!chatApiReady ? (
                <p className="mt-4 text-[12px] text-[#9CA3AF]">{MOMENTS_CHAT_API_NOT_CONFIGURED_MESSAGE}</p>
              ) : null}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-black/[0.08] py-3 text-[14px] font-medium text-[#374151]"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={!canGenerate}
                  onClick={() => void handleGenerate()}
                  className="flex-1 rounded-xl bg-[#111827] py-3 text-[14px] font-medium text-white transition-opacity disabled:opacity-40"
                >
                  开始生成
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
