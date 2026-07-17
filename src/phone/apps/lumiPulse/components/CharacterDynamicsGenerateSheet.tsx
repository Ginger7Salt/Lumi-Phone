import { AnimatePresence, motion } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { PulseNumericText } from './PulseNum'
import { PULSE_COLORS, PULSE_SHEET_SPRING } from '../constants'
import {
  CHARACTER_DYNAMICS_TIME_AMOUNT_MIN,
  CHARACTER_DYNAMICS_TIME_AMOUNT_MAX_BY_UNIT,
  CHARACTER_DYNAMICS_TIME_UNITS,
  DEFAULT_CHARACTER_DYNAMICS_TIME_SPAN,
  clampCharacterDynamicsTimeSpan,
  formatCharacterDynamicsTimeSpan,
  type CharacterDynamicsTimeSpan,
  type CharacterDynamicsTimeUnit,
} from '../characterDynamicsTime'
import {
  DEFAULT_TRENDING_POST_KINDS,
  TRENDING_POST_KINDS,
  TRENDING_POST_STYLES,
  TRENDING_REF_ROUNDS_MAX,
  TRENDING_REF_ROUNDS_MIN,
  type TrendingPostKindId,
  type TrendingPostStyleId,
} from '../TrendingGenerateSheet'

/** 角色本人发帖口吻（可多选） */
export const CHARACTER_POST_STYLES = [
  { id: 'daily', label: '日常碎碎念', hint: '生活、学习、路上见闻' },
  { id: 'literary', label: '克制文艺', hint: '短句、隐喻、少灌水' },
  { id: 'witty', label: '俏皮玩梗', hint: '轻松自嘲、网络语感' },
  { id: 'formal', label: '正式公告', hint: '职务/公开人设腔' },
  { id: 'emotional', label: '情绪向', hint: '感慨、心事、温情' },
  { id: 'showcase', label: '晒物安利', hint: '餐食、风景、作品' },
] as const

export type CharacterPostStyleId = (typeof CHARACTER_POST_STYLES)[number]['id']

export type { CharacterDynamicsTimeSpan, CharacterDynamicsTimeUnit }
export {
  CHARACTER_DYNAMICS_TIME_UNITS,
  DEFAULT_CHARACTER_DYNAMICS_TIME_SPAN,
  clampCharacterDynamicsTimeSpan,
}

export const CHARACTER_DYNAMICS_COUNT_MIN = 1
export const CHARACTER_DYNAMICS_COUNT_MAX = 8
export const CHARACTER_DYNAMICS_COMMENTS_MIN = 2
export const CHARACTER_DYNAMICS_COMMENTS_MAX = 10
/** 正文字数（汉字计）可调范围 */
export const CHARACTER_DYNAMICS_CONTENT_LEN_ABS_MIN = 10
export const CHARACTER_DYNAMICS_CONTENT_LEN_ABS_MAX = 800
export const DEFAULT_CHARACTER_DYNAMICS_CONTENT_LEN_MIN = 40
export const DEFAULT_CHARACTER_DYNAMICS_CONTENT_LEN_MAX = 280

export function clampCharacterDynamicsContentLenRange(
  minRaw: number,
  maxRaw: number,
): { contentLenMin: number; contentLenMax: number } {
  let min = Math.floor(Number(minRaw))
  let max = Math.floor(Number(maxRaw))
  if (!Number.isFinite(min)) min = DEFAULT_CHARACTER_DYNAMICS_CONTENT_LEN_MIN
  if (!Number.isFinite(max)) max = DEFAULT_CHARACTER_DYNAMICS_CONTENT_LEN_MAX
  min = Math.min(
    CHARACTER_DYNAMICS_CONTENT_LEN_ABS_MAX,
    Math.max(CHARACTER_DYNAMICS_CONTENT_LEN_ABS_MIN, min),
  )
  max = Math.min(
    CHARACTER_DYNAMICS_CONTENT_LEN_ABS_MAX,
    Math.max(CHARACTER_DYNAMICS_CONTENT_LEN_ABS_MIN, max),
  )
  if (min > max) [min, max] = [max, min]
  return { contentLenMin: min, contentLenMax: max }
}

export type CharacterDynamicsGenerateSettings = {
  postCount: number
  commentsPerPost: number
  postKinds: TrendingPostKindId[]
  /** 角色本人发帖风格（多选混排） */
  postStyles: CharacterPostStyleId[]
  /** 帖子风格自定义补充（追加到多选风格后，不是单选替换） */
  postStyleCustom: string
  /** 评论区网友风格（多选混排） */
  commentStyles: TrendingPostStyleId[]
  /** 评论风格自定义补充（追加到多选风格后，不是单选替换） */
  commentStyleCustom: string
  /** 是否包含角色本人二级回复 */
  includeAuthorReplies: boolean
  /** 线上私聊参考：AI 回复轮数（0 = 不参考） */
  chatRefRounds: number
  /** 线下约会剧情参考：AI 剧情轮数（0 = 不参考） */
  datingRefRounds: number
  /** 动态/评论是否可提到用户本人 */
  includeUserMention: boolean
  /** 多条动态的发布时间跨度（数量 + 单位） */
  timeSpan: CharacterDynamicsTimeSpan
  /** 正文字数下限（汉字计） */
  contentLenMin: number
  /** 正文字数上限（汉字计） */
  contentLenMax: number
  /** 其它自定义生成要求 */
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

function MultiChipRow<T extends string>({
  title,
  hint,
  options,
  selected,
  disabled,
  onToggle,
}: {
  title: string
  hint?: string
  options: ReadonlyArray<{ id: T; label: string; hint?: string }>
  selected: T[]
  disabled?: boolean
  onToggle: (id: T) => void
}) {
  return (
    <div>
      <p className="text-[12px] font-medium text-[#1C1C1E]">{title}</p>
      {hint ? <p className="mt-1 text-[10px] leading-snug text-neutral-400">{hint}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt.id)
          return (
            <Pressable
              key={opt.id}
              type="button"
              disabled={disabled}
              title={opt.hint}
              onClick={() => onToggle(opt.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition-colors disabled:opacity-40 ${
                active
                  ? 'bg-[#FFF5F5] font-medium text-[#C97B7E] ring-1 ring-[#E5989B]/55'
                  : 'bg-[#F8F7F5] text-neutral-600'
              }`}
            >
              {active ? <Check className="size-3" strokeWidth={2.2} /> : null}
              {opt.label}
            </Pressable>
          )
        })}
      </div>
    </div>
  )
}

function formatRefRoundsDisplay(n: number): string {
  return n <= 0 ? '不参考' : `${n} 轮`
}

/** 角色微博主页：生成动态设置面板 */
export function CharacterDynamicsGenerateSheet({
  open,
  characterName,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean
  characterName: string
  loading: boolean
  onClose: () => void
  onConfirm: (settings: CharacterDynamicsGenerateSettings) => void
}) {
  const [postCount, setPostCount] = useState(3)
  const [commentsPerPost, setCommentsPerPost] = useState(4)
  const [postKinds, setPostKinds] = useState<TrendingPostKindId[]>([...DEFAULT_TRENDING_POST_KINDS])
  const [postStyles, setPostStyles] = useState<CharacterPostStyleId[]>(['daily', 'literary'])
  const [postStyleCustomOpen, setPostStyleCustomOpen] = useState(false)
  const [postStyleCustom, setPostStyleCustom] = useState('')
  const [commentStyles, setCommentStyles] = useState<TrendingPostStyleId[]>(['mixed', 'fandom'])
  const [commentStyleCustomOpen, setCommentStyleCustomOpen] = useState(false)
  const [commentStyleCustom, setCommentStyleCustom] = useState('')
  const [includeAuthorReplies, setIncludeAuthorReplies] = useState(true)
  const [chatRefRounds, setChatRefRounds] = useState(2)
  const [datingRefRounds, setDatingRefRounds] = useState(1)
  const [includeUserMention, setIncludeUserMention] = useState(false)
  const [timeAmountText, setTimeAmountText] = useState(
    String(DEFAULT_CHARACTER_DYNAMICS_TIME_SPAN.amount),
  )
  const [timeUnit, setTimeUnit] = useState<CharacterDynamicsTimeUnit>(
    DEFAULT_CHARACTER_DYNAMICS_TIME_SPAN.unit,
  )
  const [contentLenMinText, setContentLenMinText] = useState(
    String(DEFAULT_CHARACTER_DYNAMICS_CONTENT_LEN_MIN),
  )
  const [contentLenMaxText, setContentLenMaxText] = useState(
    String(DEFAULT_CHARACTER_DYNAMICS_CONTENT_LEN_MAX),
  )
  const [customRequirements, setCustomRequirements] = useState('')

  const parseDraftInt = (raw: string): number | null => {
    const t = raw.trim()
    if (!t) return null
    const n = Number(t)
    if (!Number.isFinite(n)) return null
    return Math.floor(n)
  }

  const timeSpan = clampCharacterDynamicsTimeSpan({
    amount: parseDraftInt(timeAmountText) ?? DEFAULT_CHARACTER_DYNAMICS_TIME_SPAN.amount,
    unit: timeUnit,
  })
  const contentLen = clampCharacterDynamicsContentLenRange(
    parseDraftInt(contentLenMinText) ?? DEFAULT_CHARACTER_DYNAMICS_CONTENT_LEN_MIN,
    parseDraftInt(contentLenMaxText) ?? DEFAULT_CHARACTER_DYNAMICS_CONTENT_LEN_MAX,
  )

  const commitContentLenDrafts = () => {
    const next = clampCharacterDynamicsContentLenRange(
      parseDraftInt(contentLenMinText) ?? CHARACTER_DYNAMICS_CONTENT_LEN_ABS_MIN,
      parseDraftInt(contentLenMaxText) ?? DEFAULT_CHARACTER_DYNAMICS_CONTENT_LEN_MAX,
    )
    setContentLenMinText(String(next.contentLenMin))
    setContentLenMaxText(String(next.contentLenMax))
  }

  const commitTimeAmountDraft = () => {
    const next = clampCharacterDynamicsTimeSpan({
      amount: parseDraftInt(timeAmountText) ?? CHARACTER_DYNAMICS_TIME_AMOUNT_MIN,
      unit: timeUnit,
    })
    setTimeAmountText(String(next.amount))
  }

  const setTimeUnitAndClamp = (unit: CharacterDynamicsTimeUnit) => {
    setTimeUnit(unit)
    const max = CHARACTER_DYNAMICS_TIME_AMOUNT_MAX_BY_UNIT[unit]
    const cur = parseDraftInt(timeAmountText) ?? CHARACTER_DYNAMICS_TIME_AMOUNT_MIN
    setTimeAmountText(String(Math.min(max, Math.max(CHARACTER_DYNAMICS_TIME_AMOUNT_MIN, cur))))
  }

  const onDraftDigitsChange = (raw: string, setText: (v: string) => void) => {
    // 允许清空以便改写个位数；仅接受非负整数字符
    if (raw === '' || /^\d+$/.test(raw)) setText(raw)
  }

  const canStart =
    postKinds.length > 0 &&
    (commentStyles.length > 0 || Boolean(commentStyleCustom.trim())) &&
    (postStyles.length > 0 || Boolean(postStyleCustom.trim()))

  const toggleKind = (id: TrendingPostKindId) => {
    setPostKinds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }

  const togglePostStyle = (id: CharacterPostStyleId) => {
    setPostStyles((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }

  const toggleCommentStyle = (id: TrendingPostStyleId) => {
    setCommentStyles((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1 && !commentStyleCustom.trim()) return prev
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
                    Profile · Posts
                  </p>
                  <h3 className="mt-1 font-serif text-[20px] tracking-tight text-[#1C1C1E]">
                    生成动态
                  </h3>
                </div>
                <p className="mb-1 max-w-[11rem] text-right text-[11px] leading-snug text-neutral-400">
                  按 {characterName} 人设写微博，互动数据贴合粉丝量级
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-4">
              <div className="space-y-3">
                <SliderRow
                  label="生成条数"
                  value={postCount}
                  display={`${postCount} 条`}
                  min={CHARACTER_DYNAMICS_COUNT_MIN}
                  max={CHARACTER_DYNAMICS_COUNT_MAX}
                  disabled={loading}
                  onChange={setPostCount}
                />
                <SliderRow
                  label="每帖评论区互动"
                  value={commentsPerPost}
                  display={`${commentsPerPost} 条`}
                  min={CHARACTER_DYNAMICS_COMMENTS_MIN}
                  max={CHARACTER_DYNAMICS_COMMENTS_MAX}
                  disabled={loading}
                  hint="一级评论 + 二级回复合计"
                  onChange={setCommentsPerPost}
                />
              </div>

              <div className="mt-3 rounded-2xl bg-[#F8F7F5] px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[12px] font-medium text-[#1C1C1E]">正文字数范围</p>
                  <PulseNumericText
                    text={`${contentLen.contentLenMin}～${contentLen.contentLenMax} 字`}
                    className="font-serif text-[15px] tabular-nums text-[#E5989B]"
                  />
                </div>
                <p className="mt-1 text-[10px] leading-snug text-neutral-400">
                  {postCount >= 2
                    ? `多帖时必含一篇约 ${contentLen.contentLenMin} 字、一篇约 ${contentLen.contentLenMax} 字，其余落在区间内`
                    : `单帖正文落在 ${contentLen.contentLenMin}～${contentLen.contentLenMax} 字之间`}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <label className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[10px] text-neutral-400">最低</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={contentLenMinText}
                      disabled={loading}
                      aria-label="最低字数"
                      onChange={(e) => onDraftDigitsChange(e.target.value, setContentLenMinText)}
                      onBlur={commitContentLenDrafts}
                      className="w-full rounded-2xl border border-black/[0.04] bg-white px-3 py-2 text-center font-serif text-[15px] tabular-nums text-[#E5989B] outline-none focus:border-[#E5989B]/40 disabled:opacity-50"
                    />
                  </label>
                  <span className="mt-4 shrink-0 text-[12px] text-neutral-300">—</span>
                  <label className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[10px] text-neutral-400">最高</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={contentLenMaxText}
                      disabled={loading}
                      aria-label="最高字数"
                      onChange={(e) => onDraftDigitsChange(e.target.value, setContentLenMaxText)}
                      onBlur={commitContentLenDrafts}
                      className="w-full rounded-2xl border border-black/[0.04] bg-white px-3 py-2 text-center font-serif text-[15px] tabular-nums text-[#E5989B] outline-none focus:border-[#E5989B]/40 disabled:opacity-50"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-5">
                <MultiChipRow
                  title="帖子类型（可多选）"
                  hint="生成时在所选范围内混排"
                  options={TRENDING_POST_KINDS}
                  selected={postKinds}
                  disabled={loading}
                  onToggle={toggleKind}
                />
              </div>

              <div className="mt-5">
                <MultiChipRow
                  title="帖子风格（可多选）"
                  hint="角色本人发帖口吻；自定义为追加，不替换已选项"
                  options={CHARACTER_POST_STYLES}
                  selected={postStyles}
                  disabled={loading}
                  onToggle={togglePostStyle}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pressable
                    type="button"
                    disabled={loading}
                    onClick={() => setPostStyleCustomOpen((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition-colors disabled:opacity-40 ${
                      postStyleCustomOpen || postStyleCustom.trim()
                        ? 'bg-[#FFF5F5] font-medium text-[#C97B7E] ring-1 ring-[#E5989B]/55'
                        : 'bg-[#F8F7F5] text-neutral-600'
                    }`}
                  >
                    {postStyleCustomOpen || postStyleCustom.trim() ? (
                      <Check className="size-3" strokeWidth={2.2} />
                    ) : null}
                    自定义
                  </Pressable>
                </div>
                {postStyleCustomOpen || postStyleCustom.trim() ? (
                  <>
                    <textarea
                      value={postStyleCustom}
                      disabled={loading}
                      onChange={(e) => setPostStyleCustom(e.target.value)}
                      rows={2}
                      maxLength={120}
                      placeholder="追加口吻，例如：学生会语感、口癖「哈」、偏冷淡…"
                      className="mt-2.5 w-full resize-none rounded-2xl border border-black/[0.04] bg-[#F8F7F5] px-3.5 py-3 text-[13px] leading-relaxed text-[#1C1C1E] outline-none placeholder:text-neutral-400 focus:border-[#E5989B]/40 focus:bg-white disabled:opacity-50"
                    />
                    <p className="mt-1 text-right text-[10px] tabular-nums text-neutral-300">
                      <PulseNumericText text={`${postStyleCustom.length}/120`} />
                    </p>
                  </>
                ) : null}
              </div>

              <div className="mt-5">
                <MultiChipRow
                  title="评论风格（可多选）"
                  hint="网友评论区口吻；自定义为追加，不替换已选项"
                  options={TRENDING_POST_STYLES}
                  selected={commentStyles}
                  disabled={loading}
                  onToggle={toggleCommentStyle}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pressable
                    type="button"
                    disabled={loading}
                    onClick={() => setCommentStyleCustomOpen((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition-colors disabled:opacity-40 ${
                      commentStyleCustomOpen || commentStyleCustom.trim()
                        ? 'bg-[#FFF5F5] font-medium text-[#C97B7E] ring-1 ring-[#E5989B]/55'
                        : 'bg-[#F8F7F5] text-neutral-600'
                    }`}
                  >
                    {commentStyleCustomOpen || commentStyleCustom.trim() ? (
                      <Check className="size-3" strokeWidth={2.2} />
                    ) : null}
                    自定义
                  </Pressable>
                </div>
                {commentStyleCustomOpen || commentStyleCustom.trim() ? (
                  <>
                    <textarea
                      value={commentStyleCustom}
                      disabled={loading}
                      onChange={(e) => setCommentStyleCustom(e.target.value)}
                      rows={2}
                      maxLength={120}
                      placeholder="追加评论区口吻，例如：更戏谑、偏赶时髦黑话、少用梗…"
                      className="mt-2.5 w-full resize-none rounded-2xl border border-black/[0.04] bg-[#F8F7F5] px-3.5 py-3 text-[13px] leading-relaxed text-[#1C1C1E] outline-none placeholder:text-neutral-400 focus:border-[#E5989B]/40 focus:bg-white disabled:opacity-50"
                    />
                    <p className="mt-1 text-right text-[10px] tabular-nums text-neutral-300">
                      <PulseNumericText text={`${commentStyleCustom.length}/120`} />
                    </p>
                  </>
                ) : null}
              </div>

              <div className="mt-5">
                <p className="text-[12px] font-medium text-[#1C1C1E]">发布时间跨度</p>
                <p className="mt-1 text-[10px] leading-snug text-neutral-400">
                  输入数字并选择单位；多条动态在近{' '}
                  <span className="text-neutral-500">{formatCharacterDynamicsTimeSpan(timeSpan)}</span>{' '}
                  错开，避免挤在同一天几小时内
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={timeAmountText}
                    disabled={loading}
                    aria-label="时间跨度数值"
                    onChange={(e) => onDraftDigitsChange(e.target.value, setTimeAmountText)}
                    onBlur={commitTimeAmountDraft}
                    className="w-[4.5rem] shrink-0 rounded-2xl border border-black/[0.04] bg-[#F8F7F5] px-3 py-2 text-center font-serif text-[15px] tabular-nums text-[#E5989B] outline-none focus:border-[#E5989B]/40 focus:bg-white disabled:opacity-50"
                  />
                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    {CHARACTER_DYNAMICS_TIME_UNITS.map((opt) => {
                      const active = timeUnit === opt.id
                      return (
                        <Pressable
                          key={opt.id}
                          type="button"
                          disabled={loading}
                          title={opt.hint}
                          onClick={() => setTimeUnitAndClamp(opt.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition-colors disabled:opacity-40 ${
                            active
                              ? 'bg-[#FFF5F5] font-medium text-[#C97B7E] ring-1 ring-[#E5989B]/55'
                              : 'bg-[#F8F7F5] text-neutral-600'
                          }`}
                        >
                          {active ? <Check className="size-3" strokeWidth={2.2} /> : null}
                          {opt.label}
                        </Pressable>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <p className="text-[12px] font-medium text-[#1C1C1E]">剧情参考</p>
                <p className="text-[10px] leading-snug text-neutral-400">
                  轮数按 AI 回复计（1 轮 = 用户 1 轮 + AI 1 轮）；0 = 不注入近期剧情
                </p>
                <SliderRow
                  label="线上聊天消息"
                  value={chatRefRounds}
                  display={formatRefRoundsDisplay(chatRefRounds)}
                  min={TRENDING_REF_ROUNDS_MIN}
                  max={TRENDING_REF_ROUNDS_MAX}
                  disabled={loading}
                  hint={`参考与 ${characterName} 的微信私聊最近若干轮`}
                  onChange={setChatRefRounds}
                />
                <SliderRow
                  label="线下约会剧情"
                  value={datingRefRounds}
                  display={formatRefRoundsDisplay(datingRefRounds)}
                  min={TRENDING_REF_ROUNDS_MIN}
                  max={TRENDING_REF_ROUNDS_MAX}
                  disabled={loading}
                  hint={`参考与 ${characterName} 的约会剧情最近若干轮`}
                  onChange={setDatingRefRounds}
                />
              </div>

              <div className="mt-5 rounded-2xl bg-[#F8F7F5] px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-[#1C1C1E]">角色本人二级回复</p>
                    <p className="mt-1 text-[10px] leading-snug text-neutral-400">
                      {includeAuthorReplies
                        ? '部分楼中会有博主下场回复粉丝'
                        : '评论区仅网友互评，不出现本人回评'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includeAuthorReplies}
                    aria-label="角色本人二级回复"
                    disabled={loading}
                    onClick={() => setIncludeAuthorReplies((v) => !v)}
                    className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full p-0.5 transition-colors disabled:opacity-40 ${
                      includeAuthorReplies ? 'bg-[#E5989B]' : 'bg-black/15'
                    }`}
                  >
                    <span
                      className={`block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
                        includeAuthorReplies ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-2xl bg-[#F8F7F5] px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-[#1C1C1E]">提到用户本人</p>
                    <p className="mt-1 text-[10px] leading-snug text-neutral-400">
                      {includeUserMention
                        ? '帖文/评论内容可提到或 @ 用户；评论作者仍只有网友与（若勾选）角色本人'
                        : '禁止出现用户本人、玩家称呼或 @用户'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includeUserMention}
                    aria-label="提到用户本人"
                    disabled={loading}
                    onClick={() => setIncludeUserMention((v) => !v)}
                    className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full p-0.5 transition-colors disabled:opacity-40 ${
                      includeUserMention ? 'bg-[#E5989B]' : 'bg-black/15'
                    }`}
                  >
                    <span
                      className={`block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
                        includeUserMention ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <p className="mt-5 text-[12px] font-medium text-[#1C1C1E]">其他自定义要求</p>
              <textarea
                value={customRequirements}
                disabled={loading}
                onChange={(e) => setCustomRequirements(e.target.value)}
                rows={3}
                maxLength={400}
                placeholder="可选：指定话题方向、要避开的梗、时效事件…"
                className="mt-2.5 w-full resize-none rounded-2xl border border-black/[0.04] bg-[#F8F7F5] px-3.5 py-3 text-[13px] leading-relaxed text-[#1C1C1E] outline-none placeholder:text-neutral-400 focus:border-[#E5989B]/40 focus:bg-white disabled:opacity-50"
              />
              <p className="mt-1.5 text-right text-[10px] tabular-nums text-neutral-300">
                <PulseNumericText text={`${customRequirements.length}/400`} />
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
                位置标注与朋友圈相同：多数动态不带；若附带则用人设/世界书中的地名（市·区·地标），不会编造字母占位城市。
              </p>
            </div>

            <div className="shrink-0 px-5 pt-3">
              <p className="mb-2 text-center text-[11px] text-neutral-400">
                <PulseNumericText
                  text={`${postCount} 条动态 · ${contentLen.contentLenMin}～${contentLen.contentLenMax} 字 · 每帖约 ${commentsPerPost} 条评论`}
                  className="font-medium text-neutral-500"
                />
              </p>
              <Pressable
                type="button"
                disabled={loading || !canStart}
                onClick={() => {
                  const len = clampCharacterDynamicsContentLenRange(
                    parseDraftInt(contentLenMinText) ?? CHARACTER_DYNAMICS_CONTENT_LEN_ABS_MIN,
                    parseDraftInt(contentLenMaxText) ?? DEFAULT_CHARACTER_DYNAMICS_CONTENT_LEN_MAX,
                  )
                  setContentLenMinText(String(len.contentLenMin))
                  setContentLenMaxText(String(len.contentLenMax))
                  const span = clampCharacterDynamicsTimeSpan({
                    amount: parseDraftInt(timeAmountText) ?? CHARACTER_DYNAMICS_TIME_AMOUNT_MIN,
                    unit: timeUnit,
                  })
                  setTimeAmountText(String(span.amount))
                  onConfirm({
                    postCount,
                    commentsPerPost,
                    postKinds,
                    postStyles,
                    postStyleCustom: postStyleCustom.trim(),
                    commentStyles,
                    commentStyleCustom: commentStyleCustom.trim(),
                    includeAuthorReplies,
                    chatRefRounds,
                    datingRefRounds,
                    includeUserMention,
                    timeSpan: span,
                    contentLenMin: len.contentLenMin,
                    contentLenMax: len.contentLenMax,
                    customRequirements: customRequirements.trim(),
                  })
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-medium text-white shadow-[0_8px_24px_rgba(229,152,155,0.35)] disabled:opacity-50"
                style={{ backgroundColor: PULSE_COLORS.dustyRose }}
              >
                <Sparkles className="size-4" strokeWidth={1.4} />
                {loading ? '生成中…' : '开始生成'}
              </Pressable>
            </div>

            <AnimatePresence>
              {loading ? (
                <motion.div
                  key="char-dyn-generating"
                  className="pointer-events-auto fixed inset-0 z-[1320] flex items-center justify-center px-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="absolute inset-0 bg-black/25 backdrop-blur-[8px]" aria-hidden />
                  <motion.div
                    role="status"
                    className="relative w-full max-w-[280px] rounded-[24px] bg-white/95 px-6 py-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.14)]"
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
                      Generating
                    </p>
                    <h4 className="mt-1.5 font-serif text-[17px] tracking-tight text-[#1C1C1E]">
                      正在生成中
                    </h4>
                    <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
                      正在按人设写动态与评论区…
                    </p>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
