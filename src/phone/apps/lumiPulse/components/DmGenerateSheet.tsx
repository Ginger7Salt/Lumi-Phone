import { AnimatePresence, motion } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { PulseNumericText } from './PulseNum'
import { PULSE_COLORS, PULSE_SHEET_SPRING } from '../constants'
import { resolvePulseAuthorAvatarUrl } from '../pulseNetizenAvatar'
import {
  TRENDING_REF_ROUNDS_MAX,
  TRENDING_REF_ROUNDS_MIN,
  type TrendingRefCharacterOption,
} from '../TrendingGenerateSheet'

export const DM_THREAD_COUNT_MIN = 2
export const DM_THREAD_COUNT_MAX = 12
export const DM_MESSAGES_PER_THREAD_MIN = 2
export const DM_MESSAGES_PER_THREAD_MAX = 8

export const DM_STYLES = [
  { id: 'mixed', label: '混杂', hint: '表白提问安利都有' },
  { id: 'fandom', label: '纯粉夸夸', hint: '正向安利零恶意' },
  { id: 'curious', label: '好奇提问', hint: '问你近况与八卦' },
  { id: 'roast', label: '阴阳质疑', hint: '拉踩带节奏' },
  { id: 'confession', label: '感情表白', hint: '暧昧单恋碎碎念' },
  { id: 'casual', label: '路人闲聊', hint: '短碎随手发' },
] as const

export type DmStyleId = (typeof DM_STYLES)[number]['id']

export type DmGenerateSettings = {
  threadCount: number
  messagesPerThread: number
  styles: DmStyleId[]
  styleCustom: string
  chatRefRounds: number
  datingRefRounds: number
  refCharacterIds: string[]
  customRequirements: string
}

const SLIDER_CLASS =
  'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#E8E6E3] accent-[#E5989B] disabled:opacity-40 ' +
  '[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full ' +
  '[&::-webkit-slider-thumb]:bg-[#E5989B] [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(229,152,155,0.45)] ' +
  '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#E5989B]'

function SliderRow({
  label,
  value,
  display,
  min,
  max,
  disabled,
  hint,
  onChange,
}: {
  label: string
  value: number
  display: string
  min: number
  max: number
  disabled?: boolean
  hint?: string
  onChange: (n: number) => void
}) {
  return (
    <div className="rounded-2xl bg-[#F8F7F5] px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12px] font-medium text-[#1C1C1E]">{label}</p>
        <PulseNumericText text={display} className="font-serif text-[15px] tabular-nums text-[#E5989B]" />
      </div>
      {hint ? <p className="mt-1 text-[10px] leading-snug text-neutral-400">{hint}</p> : null}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`mt-3 ${SLIDER_CLASS}`}
      />
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-neutral-400">
        <PulseNumericText text={`${min}`} />
        <PulseNumericText text={`${max}`} />
      </div>
    </div>
  )
}

function formatRefRoundsDisplay(n: number): string {
  return n <= 0 ? '不参考' : `${n} 轮`
}

/** 消息页：生成网友私信设置面板 */
export function DmGenerateSheet({
  open,
  loading,
  onClose,
  onConfirm,
  refCharacterOptions,
  defaultRefCharacterId: _defaultRefCharacterId,
  playerRealName,
}: {
  open: boolean
  loading: boolean
  onClose: () => void
  onConfirm: (settings: DmGenerateSettings) => void
  refCharacterOptions: TrendingRefCharacterOption[]
  /** @deprecated 参考角色已改为可选，不再自动勾选默认项 */
  defaultRefCharacterId?: string
  /** 用户身份真实姓名（称呼专用；始终注入用户身份） */
  playerRealName: string
}) {
  const [threadCount, setThreadCount] = useState(4)
  const [messagesPerThread, setMessagesPerThread] = useState(4)
  const [styles, setStyles] = useState<DmStyleId[]>(['mixed', 'fandom'])
  const [styleCustom, setStyleCustom] = useState('')
  const [customRequirements, setCustomRequirements] = useState('')
  const [chatRefRounds, setChatRefRounds] = useState(3)
  const [datingRefRounds, setDatingRefRounds] = useState(2)
  const [refCharacterIds, setRefCharacterIds] = useState<string[]>([])

  const optionIds = useMemo(
    () => new Set(refCharacterOptions.map((o) => o.characterId.trim()).filter(Boolean)),
    [refCharacterOptions],
  )

  useEffect(() => {
    if (!open) return
    // 参考角色可选：打开时保留仍合法的勾选，不自动强制选择
    setRefCharacterIds((prev) => prev.filter((id) => optionIds.has(id)))
  }, [open, optionIds])

  const canStart = styles.length > 0 || Boolean(styleCustom.trim())
  const hasRefChars = refCharacterIds.length > 0

  const toggleRefCharacter = (rawId: string) => {
    const id = rawId.trim()
    if (!id) return
    setRefCharacterIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleStyle = (id: DmStyleId) => {
    setStyles((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1 && !styleCustom.trim()) return prev
        return prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-[1300] bg-black/20 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !loading && onClose()}
            aria-label="关闭"
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[1310] flex max-h-[88vh] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-12px_40px_rgba(28,28,30,0.08)]"
            data-pulse-coach="dm-sheet-body"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={PULSE_SHEET_SPRING}
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="shrink-0 px-5 pt-3">
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-black/10" />
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p
                    className="text-[10px] uppercase tracking-[0.32em]"
                    style={{ color: PULSE_COLORS.dustyRose }}
                  >
                    Inbox · Fan Mail
                  </p>
                  <h3 className="mt-1 font-serif text-[20px] tracking-tight text-[#1C1C1E]">
                    生成网友私信
                  </h3>
                </div>
                <p className="mb-1 max-w-[11rem] text-right text-[11px] leading-snug text-neutral-400">
                  知姓名「{playerRealName}」，可喊小顾/顾老公等衍生；禁艾特与微博昵称
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-4">
              <div className="space-y-3">
                <SliderRow
                  label="私信会话数"
                  value={threadCount}
                  display={`${threadCount} 组`}
                  min={DM_THREAD_COUNT_MIN}
                  max={DM_THREAD_COUNT_MAX}
                  disabled={loading}
                  hint="一共生成多少个不同网友会话"
                  onChange={setThreadCount}
                />
                <SliderRow
                  label="每组消息条数"
                  value={messagesPerThread}
                  display={`${messagesPerThread} 条`}
                  min={DM_MESSAGES_PER_THREAD_MIN}
                  max={DM_MESSAGES_PER_THREAD_MAX}
                  disabled={loading}
                  hint="每个会话里网友连发几条"
                  onChange={setMessagesPerThread}
                />
              </div>

              <p className="mt-5 text-[12px] font-medium text-[#1C1C1E]">参考角色与剧情（可选）</p>
              <p className="mt-1 text-[10px] leading-snug text-neutral-400">
                不选角色：只针对用户本人生成网友私信。选了角色：会带上与该角色相关的人设/剧情，写成「网友跟你聊 TA」的内容。
              </p>

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <p className="text-[11px] text-neutral-500">
                  参考角色{' '}
                  <PulseNumericText
                    text={`${refCharacterIds.length}`}
                    className="font-medium text-[#E5989B]"
                  />
                  <span className="text-neutral-400"> · 可不选</span>
                </p>
                <div className="flex gap-2">
                  <Pressable
                    type="button"
                    disabled={loading || !refCharacterOptions.length}
                    onClick={() =>
                      setRefCharacterIds(
                        refCharacterOptions.map((o) => o.characterId.trim()).filter(Boolean),
                      )
                    }
                    className="text-[11px] text-neutral-500 disabled:opacity-40"
                  >
                    全选
                  </Pressable>
                  <Pressable
                    type="button"
                    disabled={loading}
                    onClick={() => setRefCharacterIds([])}
                    className="text-[11px] text-neutral-500 disabled:opacity-40"
                  >
                    清空
                  </Pressable>
                </div>
              </div>

              {refCharacterOptions.length ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {refCharacterOptions.map((opt) => {
                    const id = opt.characterId.trim()
                    const active = refCharacterIds.includes(id)
                    const avatarSrc = resolvePulseAuthorAvatarUrl(opt.avatarUrl)
                    return (
                      <Pressable
                        key={id}
                        type="button"
                        disabled={loading}
                        onClick={() => toggleRefCharacter(id)}
                        className={`flex items-center gap-2.5 rounded-2xl border px-2.5 py-2 text-left transition-colors ${
                          active
                            ? 'border-[#E5989B]/55 bg-[#FDF6F6]'
                            : 'border-transparent bg-[#F8F7F5]'
                        }`}
                      >
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt=""
                            className="size-9 shrink-0 rounded-full object-cover ring-1 ring-black/[0.04]"
                          />
                        ) : (
                          <div className="size-9 shrink-0 rounded-full bg-[#E8E6E3]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-[12px] font-medium ${
                              active ? 'text-[#C97B7E]' : 'text-[#1C1C1E]'
                            }`}
                          >
                            {opt.name}
                          </p>
                          {opt.subtitle ? (
                            <p className="truncate text-[10px] text-neutral-400">{opt.subtitle}</p>
                          ) : null}
                        </div>
                        {active ? (
                          <Check className="size-3.5 shrink-0 text-[#E5989B]" strokeWidth={2.2} />
                        ) : null}
                      </Pressable>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-2 rounded-2xl bg-[#F8F7F5] px-3.5 py-3 text-[11px] text-neutral-400">
                  暂无可用参考角色。可不选，直接按用户本人生成私信；或先绑定当前身份下的通讯录角色。
                </p>
              )}

              <div className="mt-3 space-y-3">
                <SliderRow
                  label="线上聊天消息"
                  value={hasRefChars ? chatRefRounds : 0}
                  display={formatRefRoundsDisplay(hasRefChars ? chatRefRounds : 0)}
                  min={TRENDING_REF_ROUNDS_MIN}
                  max={TRENDING_REF_ROUNDS_MAX}
                  disabled={loading || !hasRefChars}
                  hint={
                    hasRefChars
                      ? '参考所选角色微信私聊最近若干轮'
                      : '需先选择参考角色后才可参考近期私聊'
                  }
                  onChange={setChatRefRounds}
                />
                <SliderRow
                  label="线下约会剧情"
                  value={hasRefChars ? datingRefRounds : 0}
                  display={formatRefRoundsDisplay(hasRefChars ? datingRefRounds : 0)}
                  min={TRENDING_REF_ROUNDS_MIN}
                  max={TRENDING_REF_ROUNDS_MAX}
                  disabled={loading || !hasRefChars}
                  hint={
                    hasRefChars
                      ? '参考所选角色约会剧情最近若干轮'
                      : '需先选择参考角色后才可参考约会剧情'
                  }
                  onChange={setDatingRefRounds}
                />
              </div>

              <p className="mt-5 text-[12px] font-medium text-[#1C1C1E]">私信风格（可多选）</p>
              <p className="mt-1 text-[10px] leading-snug text-neutral-400">
                多选时不同会话会轮换风格；自定义为追加微调。
              </p>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {DM_STYLES.map((s) => {
                  const active = styles.includes(s.id)
                  return (
                    <Pressable
                      key={s.id}
                      type="button"
                      disabled={loading}
                      onClick={() => toggleStyle(s.id)}
                      className={`rounded-2xl border px-2.5 py-2.5 text-left transition-colors ${
                        active
                          ? 'border-[#E5989B]/55 bg-[#FDF6F6]'
                          : 'border-transparent bg-[#F8F7F5]'
                      }`}
                    >
                      <span
                        className={`flex items-center gap-1 text-[12px] font-medium ${
                          active ? 'text-[#C97B7E]' : 'text-[#1C1C1E]'
                        }`}
                      >
                        {active ? <Check className="size-3 shrink-0" strokeWidth={2.2} /> : null}
                        {s.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-neutral-400">
                        {s.hint}
                      </span>
                    </Pressable>
                  )
                })}
              </div>
              <textarea
                value={styleCustom}
                disabled={loading}
                onChange={(e) => setStyleCustom(e.target.value)}
                rows={2}
                maxLength={120}
                placeholder="可选：追加口吻，例如更戏谑、少黑粉话…"
                className="mt-2.5 w-full resize-none rounded-2xl border border-black/[0.04] bg-[#F8F7F5] px-3.5 py-3 text-[13px] leading-relaxed text-[#1C1C1E] outline-none placeholder:text-neutral-400 focus:border-[#E5989B]/40 focus:bg-white disabled:opacity-50"
              />

              <p className="mt-5 text-[12px] font-medium text-[#1C1C1E]">自定义生成要求</p>
              <textarea
                value={customRequirements}
                disabled={loading}
                onChange={(e) => setCustomRequirements(e.target.value)}
                rows={3}
                maxLength={400}
                placeholder="可选：指定要问的剧情点、避开的梗、某类粉丝占比…"
                className="mt-2.5 w-full resize-none rounded-2xl border border-black/[0.04] bg-[#F8F7F5] px-3.5 py-3 text-[13px] leading-relaxed text-[#1C1C1E] outline-none placeholder:text-neutral-400 focus:border-[#E5989B]/40 focus:bg-white disabled:opacity-50"
              />
              <p className="mt-1.5 text-right text-[10px] tabular-nums text-neutral-300">
                <PulseNumericText text={`${customRequirements.length}/400`} />
              </p>

              <p className="mt-1 text-[11px] text-neutral-400">
                预计约{' '}
                <PulseNumericText
                  text={`${threadCount} 组会话 · ${threadCount * messagesPerThread} 条私信`}
                  className="font-medium text-neutral-500"
                />
              </p>
            </div>

            <div className="shrink-0 px-5 pt-3">
              <Pressable
                type="button"
                disabled={loading || !canStart}
                onClick={() =>
                  onConfirm({
                    threadCount,
                    messagesPerThread,
                    styles,
                    styleCustom: styleCustom.trim(),
                    chatRefRounds: hasRefChars ? chatRefRounds : 0,
                    datingRefRounds: hasRefChars ? datingRefRounds : 0,
                    refCharacterIds,
                    customRequirements: customRequirements.trim(),
                  })
                }
                className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-medium text-white shadow-[0_8px_24px_rgba(229,152,155,0.35)] disabled:opacity-50"
                style={{ backgroundColor: PULSE_COLORS.dustyRose }}
              >
                <Sparkles className="size-4" strokeWidth={1.4} />
                {loading ? '生成中…' : '开始生成'}
              </Pressable>
            </div>
          </motion.div>

          <AnimatePresence>
            {loading ? (
              <motion.div
                key="dm-generating-overlay"
                className="pointer-events-auto fixed inset-0 z-[1320] flex items-center justify-center px-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="absolute inset-0 bg-black/25 backdrop-blur-[8px]" aria-hidden />
                <motion.div
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                  className="relative w-full max-w-[280px] rounded-[24px] bg-white/95 px-6 py-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.14)] backdrop-blur-2xl"
                  initial={{ opacity: 0, scale: 0.92, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 6 }}
                  transition={PULSE_SHEET_SPRING}
                >
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#FFF5F5]">
                    <motion.span
                      className="inline-flex"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2.4, ease: 'linear', repeat: Infinity }}
                    >
                      <Sparkles
                        className="size-5"
                        strokeWidth={1.5}
                        style={{ color: PULSE_COLORS.dustyRose }}
                      />
                    </motion.span>
                  </div>
                  <p
                    className="mt-4 text-[10px] uppercase tracking-[0.28em]"
                    style={{ color: PULSE_COLORS.dustyRose }}
                  >
                    Fan Mail
                  </p>
                  <h4 className="mt-1.5 font-serif text-[17px] tracking-tight text-[#1C1C1E]">
                    正在生成中
                  </h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
                    {hasRefChars
                      ? '按用户身份与所选角色起草网友私信…'
                      : '按用户本人身份起草网友私信…'}
                  </p>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </>
      ) : null}
    </AnimatePresence>
  )
}
