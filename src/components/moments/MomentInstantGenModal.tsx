import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { resolveCharacterAvatarUrl } from '../../phone/utils/characterAvatarUrl'

import { filterPublishableCharacterContacts } from './momentFeedVisibility'
import {
  publishInstantCharacterMoment,
  type InstantGenPublishStage,
} from './momentInstantGenService'
import {
  clampInstantGenTextLength,
  formatInstantGenTextLengthLabel,
  INSTANT_GEN_TEXT_LENGTH_DEFAULT,
  INSTANT_GEN_TEXT_LENGTH_MAX,
  INSTANT_GEN_TEXT_LENGTH_MIN,
  INSTANT_GEN_TEXT_LENGTH_PRESETS,
} from './momentContentLimits'
import type { InstantGenConfig, InstantGenPostTypeChoice } from './momentInstantGenTypes'
import { instantGenPostTypeIncludesText } from './momentInstantGenTypes'
import {
  clampInstantGenCustomContentDirection,
  INSTANT_GEN_CONTENT_TYPE_OPTIONS,
  INSTANT_GEN_CUSTOM_CONTENT_DIRECTION_MAX,
  type InstantGenContentTypeChoice,
} from './momentInstantGenContentTypes'
import type { MomentItemModel } from './mockMoments'
import {
  isMomentsChatApiConfigured,
  MOMENTS_CHAT_API_NOT_CONFIGURED_MESSAGE,
} from './momentsChatApiReady'
import { isMomentsImageGenConfigured } from './momentsImageGenAvailability'
import { MomentGeneratingOverlay } from './MomentGeneratingOverlay'
import type { MomentContactRef } from './newMomentTypes'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

type Props = {
  open: boolean
  onClose: () => void
  wechatCtx: AnonymousQaWechatContext | null
  momentContacts: MomentContactRef[]
  imageGenSettings: MomentsImageGenSettings
  onPublished: (item: MomentItemModel) => void | Promise<void>
}

const POST_TYPE_OPTIONS: { id: InstantGenPostTypeChoice; label: string }[] = [
  { id: 'text', label: '纯文字' },
  { id: 'mixed', label: '图文' },
  { id: 'image', label: '纯图片' },
]

const STAGE_LABEL: Record<InstantGenPublishStage, string> = {
  context: '正在提取关联记忆…',
  writing: '正在推演朋友圈与社交生态…',
  imaging: '正在显影配图…',
  saving: '正在写入朋友圈…',
  done: '生成完成，即将返回朋友圈',
}

/** 面板内横向滑动的选项条（与外层纵向滚动互不抢手势） */
const HORIZONTAL_SCROLL_ROW =
  'flex w-full gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

const VERTICAL_SCROLL_BODY =
  'max-h-[min(52vh,480px)] space-y-6 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

function MinimalCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-xl border border-black/[0.06] bg-white px-3 py-2.5 text-left transition-colors hover:border-black/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-black/15"
    >
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded border ${
          checked ? 'border-[#111827] bg-[#111827]' : 'border-[#D1D5DB] bg-white'
        }`}
        aria-hidden
      >
        {checked ? (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : null}
      </span>
      <span className="text-[13px] text-[#374151]">{label}</span>
    </button>
  )
}

export function MomentInstantGenModal({
  open,
  onClose,
  wechatCtx,
  momentContacts,
  imageGenSettings,
  onPublished,
}: Props) {
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [postType, setPostType] = useState<InstantGenPostTypeChoice>('mixed')
  const [contentType, setContentType] = useState<InstantGenContentTypeChoice>('auto')
  const [customContentDirection, setCustomContentDirection] = useState('')
  const [textLengthTarget, setTextLengthTarget] = useState(INSTANT_GEN_TEXT_LENGTH_DEFAULT)
  const [includeRecentChat, setIncludeRecentChat] = useState(true)
  const [includeOfflinePlots, setIncludeOfflinePlots] = useState(true)
  const [stage, setStage] = useState<InstantGenPublishStage | 'idle'>('idle')
  const [batchIndex, setBatchIndex] = useState(0)
  const [batchTotal, setBatchTotal] = useState(0)
  const [activeName, setActiveName] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const prevOpenRef = useRef(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const next = new Set<string>()
      for (const c of momentContacts) {
        const charId = c.characterId?.trim()
        if (!charId) continue
        try {
          const character = await personaDb.getCharacter(charId)
          if (character?.momentsPermission?.blocked) next.add(charId)
        } catch {
          // ignore
        }
      }
      if (!cancelled) setBlockedIds(next)
    })()
    return () => {
      cancelled = true
    }
  }, [open, momentContacts])

  const publishable = useMemo(
    () => filterPublishableCharacterContacts(momentContacts, blockedIds),
    [momentContacts, blockedIds],
  )

  const imageGenReady = useMemo(
    () => isMomentsImageGenConfigured(imageGenSettings),
    [imageGenSettings],
  )

  const postTypeOptions = useMemo(
    () => (imageGenReady ? POST_TYPE_OPTIONS : POST_TYPE_OPTIONS.filter((o) => o.id === 'text')),
    [imageGenReady],
  )

  const postTypeIncludesText = instantGenPostTypeIncludesText(postType)

  const activeContentTypeHint = useMemo(() => {
    if (contentType === 'custom') {
      return (
        INSTANT_GEN_CONTENT_TYPE_OPTIONS.find((o) => o.id === 'custom')?.hint ??
        '描述你希望角色发什么气质、什么剧情意图的朋友圈。'
      )
    }
    return INSTANT_GEN_CONTENT_TYPE_OPTIONS.find((o) => o.id === contentType)?.hint ?? ''
  }, [contentType])

  const trimmedCustomDirection = useMemo(
    () => clampInstantGenCustomContentDirection(customContentDirection),
    [customContentDirection],
  )

  useEffect(() => {
    const justOpened = open && !prevOpenRef.current
    prevOpenRef.current = open

    if (!open) {
      setStage('idle')
      setBatchIndex(0)
      setBatchTotal(0)
      setActiveName(undefined)
      return
    }

    if (!justOpened) return

    setError(null)
    setStage('idle')
    setBatchIndex(0)
    setBatchTotal(0)
    setActiveName(undefined)
    setCustomContentDirection('')
    if (!imageGenReady) setPostType('text')
  }, [open, imageGenReady])

  useEffect(() => {
    if (!open || stage !== 'idle') return
    if (!publishable.length) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds((prev) => {
      const valid = publishable.map((c) => c.characterId!).filter((id) => prev.has(id))
      if (valid.length) return new Set(valid)
      return new Set([publishable[0]!.characterId!])
    })
  }, [open, publishable, stage])

  const selectedContacts = useMemo(
    () => publishable.filter((c) => c.characterId && selectedIds.has(c.characterId)),
    [publishable, selectedIds],
  )

  const busy = stage !== 'idle'
  const chatApiReady = isMomentsChatApiConfigured(wechatCtx?.apiConfig)
  const canPublish =
    !!wechatCtx &&
    selectedContacts.length > 0 &&
    chatApiReady &&
    !busy &&
    (contentType !== 'custom' || trimmedCustomDirection.length > 0)

  const toggleCharacter = (charId: string) => {
    if (busy) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(charId)) {
        if (next.size <= 1) return next
        next.delete(charId)
      } else {
        next.add(charId)
      }
      return next
    })
  }

  const handlePublish = useCallback(async () => {
    if (!wechatCtx || !selectedContacts.length || busy) return
    if (!isMomentsChatApiConfigured(wechatCtx.apiConfig)) {
      setError(MOMENTS_CHAT_API_NOT_CONFIGURED_MESSAGE)
      return
    }

    setError(null)
    setStage('context')
    setBatchTotal(selectedContacts.length)
    setBatchIndex(1)
    setActiveName(selectedContacts[0]?.name)

    const failures: string[] = []
    let successCount = 0

    for (let i = 0; i < selectedContacts.length; i++) {
      const contact = selectedContacts[i]!
      const charId = contact.characterId!
      setBatchIndex(i + 1)
      setActiveName(contact.name)
      setStage('context')

      const config: InstantGenConfig = {
        targetCharacterId: charId,
        postType,
        contentType,
        ...(contentType === 'custom' && trimmedCustomDirection
          ? { customContentDirection: trimmedCustomDirection }
          : {}),
        textLengthTarget: clampInstantGenTextLength(textLengthTarget),
        includeRecentChat,
        includeOfflinePlots,
      }

      try {
        const item = await publishInstantCharacterMoment({
          wechatCtx,
          config,
          characterContact: contact,
          momentContacts,
          blockedCharacterIds: blockedIds,
          imageGenSettings,
          onProgress: setStage,
        })
        setStage('saving')
        await onPublished(item)
        successCount += 1
      } catch (e) {
        const msg = e instanceof Error ? e.message : '显影失败'
        failures.push(`${contact.name}：${msg}`)
      }
    }

    if (successCount > 0 && failures.length === 0) {
      setStage('done')
      await new Promise((resolve) => window.setTimeout(resolve, 480))
    }

    setStage('idle')
    setBatchIndex(0)
    setBatchTotal(0)
    setActiveName(undefined)

    if (failures.length === selectedContacts.length) {
      setError(failures.join('\n'))
      return
    }
    if (failures.length) {
      setError(`部分角色生成失败：\n${failures.join('\n')}`)
      return
    }
    onClose()
  }, [
    blockedIds,
    busy,
    contentType,
    imageGenSettings,
    includeOfflinePlots,
    includeRecentChat,
    momentContacts,
    onClose,
    onPublished,
    postType,
    selectedContacts,
    textLengthTarget,
    trimmedCustomDirection,
    wechatCtx,
  ])

  const showGenerating = busy
  const stageLabel = busy ? STAGE_LABEL[stage as InstantGenPublishStage] : ''

  return (
    <>
      <MomentGeneratingOverlay
        open={showGenerating}
        stageLabel={stageLabel}
        characterName={activeName}
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="instant-gen-title"
              className="relative w-full max-w-[560px] overflow-hidden rounded-t-[20px] border-t border-black/[0.06] bg-white px-5 pb-[max(20px,env(safe-area-inset-bottom,0px))] pt-5 shadow-[0_-12px_48px_rgba(0,0,0,0.06)] focus:outline-none"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 42 }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#E5E7EB]" aria-hidden />

              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#9CA3AF]">
                Instant Manifest
              </p>
              <h2 id="instant-gen-title" className="mt-1 text-[18px] font-semibold tracking-[0.01em] text-[#111827]">
                瞬时降临
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-[#9CA3AF]">
                指定角色（可多选），结合最新上下文，立刻生成朋友圈与有**人脉绑定**的其他角色的延时互动。
              </p>

              {!publishable.length ? (
                <p className="mt-6 text-[13px] text-[#9CA3AF]">暂无可选角色。</p>
              ) : (
                <>
                  <section className="mt-6">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                        Target Persona
                      </p>
                      <p className="text-[11px] text-[#9CA3AF]">已选 {selectedIds.size} 人</p>
                    </div>
                    <div className={`-mx-1 mt-3 ${HORIZONTAL_SCROLL_ROW} gap-3 px-1 pb-1`}>
                      {publishable.map((c) => {
                        const charId = c.characterId!
                        const active = selectedIds.has(charId)
                        const avatar = resolveCharacterAvatarUrl({ avatarUrl: c.avatarUrl })
                        return (
                          <button
                            key={charId}
                            type="button"
                            onClick={() => toggleCharacter(charId)}
                            className="relative flex w-[72px] shrink-0 flex-col items-center gap-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-black/20"
                          >
                            <span
                              className={`relative block size-14 overflow-hidden rounded-full ${
                                active ? 'ring-2 ring-[#111827]' : 'ring-1 ring-black/[0.08]'
                              }`}
                            >
                              {avatar ? (
                                <img src={avatar} alt="" className="size-full object-cover" draggable={false} />
                              ) : (
                                <span className="flex size-full items-center justify-center bg-[#F3F4F6] text-[14px] text-[#6B7280]">
                                  {c.name.slice(0, 1)}
                                </span>
                              )}
                              {active ? (
                                <span className="absolute bottom-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-[#111827]">
                                  <svg width="8" height="6" viewBox="0 0 10 8" fill="none" aria-hidden>
                                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                                  </svg>
                                </span>
                              ) : null}
                            </span>
                            <span
                              className={`max-w-[72px] truncate text-[11px] ${
                                active ? 'font-medium text-[#111827]' : 'text-[#9CA3AF]'
                              }`}
                            >
                              {c.name}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>

                  <div className={`mt-5 ${VERTICAL_SCROLL_BODY}`}>
                  <section>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                      Post Type
                    </p>
                    <p className="mt-1 text-[11px] text-[#9CA3AF]">载体形式</p>
                    {!imageGenReady ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-[#9CA3AF]">
                        未配置生图 API，仅支持纯文字朋友圈。可在朋友圈设置中配置 AI 配图引擎。
                      </p>
                    ) : null}
                    <div className={`mt-3 ${HORIZONTAL_SCROLL_ROW}`}>
                      {postTypeOptions.map((opt) => {
                        const active = postType === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPostType(opt.id)}
                            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-black/15 ${
                              active
                                ? 'bg-[#111827] text-white'
                                : 'border border-black/[0.08] bg-white text-[#6B7280]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </section>

                  {postTypeIncludesText ? (
                    <section>
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                            Text Length
                          </p>
                          <p className="mt-1 text-[11px] text-[#9CA3AF]">正文字数</p>
                        </div>
                        <p className="text-[12px] font-medium tabular-nums text-[#111827]">
                          {formatInstantGenTextLengthLabel(textLengthTarget)}
                        </p>
                      </div>
                      <div className="mt-3 rounded-xl border border-black/[0.06] bg-[#FAFAFA] px-3 py-3">
                        <input
                          type="range"
                          min={INSTANT_GEN_TEXT_LENGTH_MIN}
                          max={INSTANT_GEN_TEXT_LENGTH_MAX}
                          step={1}
                          value={textLengthTarget}
                          disabled={busy}
                          onChange={(e) =>
                            setTextLengthTarget(clampInstantGenTextLength(Number(e.target.value)))
                          }
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#E5E7EB] accent-[#111827] disabled:opacity-40 [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#111827]"
                          aria-label="正文字数"
                        />
                        <div className="mt-2 flex justify-between text-[10px] text-[#9CA3AF]">
                          <span>一字</span>
                          <span>小作文</span>
                        </div>
                        <div className={`mt-3 ${HORIZONTAL_SCROLL_ROW} gap-1.5`}>
                          {INSTANT_GEN_TEXT_LENGTH_PRESETS.map((preset) => {
                            const active = textLengthTarget === preset.value
                            return (
                              <button
                                key={preset.value}
                                type="button"
                                disabled={busy}
                                onClick={() => setTextLengthTarget(preset.value)}
                                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-black/15 disabled:opacity-40 ${
                                  active
                                    ? 'bg-[#111827] text-white'
                                    : 'border border-black/[0.08] bg-white text-[#6B7280]'
                                }`}
                              >
                                {preset.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </section>
                  ) : null}

                  <section>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                      Content Mood
                    </p>
                    <p className="mt-1 text-[11px] text-[#9CA3AF]">内容类型</p>
                    <div className={`mt-3 ${HORIZONTAL_SCROLL_ROW}`}>
                      {INSTANT_GEN_CONTENT_TYPE_OPTIONS.map((opt) => {
                        const active = contentType === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setContentType(opt.id)}
                            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-black/15 ${
                              active
                                ? 'bg-[#111827] text-white'
                                : 'border border-black/[0.08] bg-white text-[#6B7280]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                    {activeContentTypeHint ? (
                      <p className="mt-2.5 rounded-xl border border-black/[0.06] bg-[#FAFAFA] px-3 py-2.5 text-[11px] leading-relaxed text-[#6B7280]">
                        {activeContentTypeHint}
                      </p>
                    ) : null}
                    {contentType === 'custom' ? (
                      <div className="mt-3">
                        <label className="block text-[11px] text-[#6B7280]">内容偏向</label>
                        <textarea
                          value={customContentDirection}
                          onChange={(event) =>
                            setCustomContentDirection(
                              event.target.value.slice(0, INSTANT_GEN_CUSTOM_CONTENT_DIRECTION_MAX),
                            )
                          }
                          disabled={busy}
                          rows={3}
                          placeholder="例如：刚和用户冷战，发一条看似无所谓、实则想让对方主动来哄的钓鱼动态…"
                          className="mt-1.5 w-full resize-none rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#111827] placeholder:text-[#9CA3AF] focus:border-black/20 focus:outline-none disabled:opacity-50"
                        />
                        <p className="mt-1 text-right text-[10px] text-[#9CA3AF]">
                          {trimmedCustomDirection.length}/{INSTANT_GEN_CUSTOM_CONTENT_DIRECTION_MAX}
                        </p>
                      </div>
                    ) : null}
                  </section>

                  <section>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                      Context Sync
                    </p>
                    <div className="mt-3 space-y-2">
                      <MinimalCheckbox
                        checked={includeRecentChat}
                        onChange={setIncludeRecentChat}
                        label="提取最近 20 条对话记忆"
                      />
                      <MinimalCheckbox
                        checked={includeOfflinePlots}
                        onChange={setIncludeOfflinePlots}
                        label="提取未总结的线下剧情"
                      />
                    </div>
                  </section>

                  {!chatApiReady ? (
                    <p className="rounded-xl border border-black/[0.08] bg-[#FAFAFA] px-3 py-2.5 text-[12px] leading-relaxed text-[#374151]">
                      {MOMENTS_CHAT_API_NOT_CONFIGURED_MESSAGE}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    disabled={!canPublish}
                    onClick={() => void handlePublish()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] px-4 py-3.5 text-[14px] font-medium tracking-[0.04em] text-white transition-opacity focus:outline-none focus-visible:ring-1 focus-visible:ring-black/20 disabled:bg-[#9CA3AF] disabled:opacity-100"
                  >
                    强制显影{selectedIds.size > 1 ? `（${selectedIds.size} 人）` : ''}
                  </button>

                  {error ? (
                    <p className="whitespace-pre-wrap text-center text-[12px] text-red-600">{error}</p>
                  ) : null}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
