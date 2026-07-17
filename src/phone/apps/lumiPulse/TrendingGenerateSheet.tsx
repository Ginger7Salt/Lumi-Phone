import { AnimatePresence, motion } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { PulseNumericText } from './components/PulseNum'
import { PULSE_COLORS, PULSE_SHEET_SPRING } from './constants'
import { resolvePulseAuthorAvatarUrl } from './pulseNetizenAvatar'

/** 热搜剧情参考可选角色（当前身份已绑定） */
export type TrendingRefCharacterOption = {
  characterId: string
  name: string
  avatarUrl?: string
  subtitle?: string
}

export const TRENDING_TOPIC_COUNT_MIN = 3
export const TRENDING_TOPIC_COUNT_MAX = 8
export const TRENDING_POSTS_PER_TOPIC_MIN = 1
export const TRENDING_POSTS_PER_TOPIC_MAX = 6
/** 每帖评论区互动总数（一级 + 二级） */
export const TRENDING_COMMENTS_PER_POST_MIN = 1
export const TRENDING_COMMENTS_PER_POST_MAX = 12
/** 参考轮数按 AI 回复计；0 = 不参考。含其间用户消息。 */
export const TRENDING_REF_ROUNDS_MIN = 0
export const TRENDING_REF_ROUNDS_MAX = 8
/** 参考近期微博条数（勾选后可调） */
export const TRENDING_PULSE_POST_REF_MIN = 1
export const TRENDING_PULSE_POST_REF_MAX = 8

/** @deprecated 保留兼容；面板已改用滑杆 */
export const TRENDING_TOPIC_COUNT_OPTIONS = [3, 4, 5, 6, 8] as const
/** @deprecated 保留兼容；面板已改用滑杆 */
export const TRENDING_POSTS_PER_TOPIC_OPTIONS = [1, 2, 3, 4, 5, 6] as const

export const TRENDING_POST_STYLES = [
  { id: 'mixed', label: '混杂舆论', hint: '吃瓜、通稿、粉黑混搭' },
  { id: 'gossip', label: '吃瓜吐槽', hint: '围观起哄、段子感' },
  { id: 'fandom', label: '纯粉夸夸', hint: '正向安利、零恶意' },
  { id: 'roast', label: '阴阳拉踩', hint: '阴阳怪气、带节奏' },
  { id: 'formal', label: '通稿风', hint: '营销号、官媒腔' },
  { id: 'calm', label: '理性讨论', hint: '克制、分析多' },
] as const

export type TrendingPostStyleId = (typeof TRENDING_POST_STYLES)[number]['id']

export const DEFAULT_TRENDING_POST_STYLES: TrendingPostStyleId[] = ['mixed']

/** 讨论帖媒体形态（生成面板可多选） */
export const TRENDING_POST_KINDS = [
  { id: 'text', label: '纯文字', hint: '无配图' },
  { id: 'text_image', label: '文字+图片', hint: '正文 + 1～9 图' },
  { id: 'image', label: '纯图片', hint: '几乎无正文' },
] as const

export type TrendingPostKindId = (typeof TRENDING_POST_KINDS)[number]['id']

export const DEFAULT_TRENDING_POST_KINDS: TrendingPostKindId[] = ['text', 'text_image', 'image']

export type TrendingGenerateSettings = {
  topicCount: number
  postsPerTopic: number
  /** 每帖评论区互动条数（一级评论 + 二级回复合计） */
  commentsPerPost: number
  /** 讨论风格（可多选；生成时混排） */
  styles: TrendingPostStyleId[]
  customRequirements: string
  /** 线上私聊参考：AI 回复轮数（含其间用户消息） */
  chatRefRounds: number
  /** 线下约会剧情参考：AI 剧情轮数（含其间玩家输入） */
  datingRefRounds: number
  /** 要拉取剧情参考的角色 id（多选） */
  refCharacterIds: string[]
  /** 允许的帖形态（多选；生成时在所选范围内混排） */
  postKinds: TrendingPostKindId[]
  /**
   * 是否纳入当前用户身份设定。
   * false：仅围绕所选角色生成，不注入用户身份、不写用户相关内容。
   */
  includePlayerIdentity: boolean
  /** 是否参考用户/角色已发布的微博动态 */
  refPulsePostsEnabled: boolean
  /** 参考用户最近几条微博（勾选后生效） */
  playerPulsePostRefCount: number
  /** 每位所选参考角色最近几条微博（勾选后生效） */
  charPulsePostRefCount: number
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

/** 热搜演化设置：条数滑杆 + 参考角色多选 + 风格 + 自定义要求 */
export function TrendingGenerateSheet({
  open,
  loading,
  onClose,
  onConfirm,
  refCharacterOptions,
  defaultRefCharacterId: _defaultRefCharacterId,
}: {
  open: boolean
  loading: boolean
  onClose: () => void
  onConfirm: (settings: TrendingGenerateSettings) => void
  refCharacterOptions: TrendingRefCharacterOption[]
  /** @deprecated 参考角色已改为可选，不再自动勾选默认项 */
  defaultRefCharacterId?: string
}) {
  const [topicCount, setTopicCount] = useState(4)
  const [postsPerTopic, setPostsPerTopic] = useState(3)
  const [commentsPerPost, setCommentsPerPost] = useState(4)
  const [styles, setStyles] = useState<TrendingPostStyleId[]>([...DEFAULT_TRENDING_POST_STYLES])
  const [customRequirements, setCustomRequirements] = useState('')
  const [chatRefRounds, setChatRefRounds] = useState(3)
  const [datingRefRounds, setDatingRefRounds] = useState(2)
  const [refCharacterIds, setRefCharacterIds] = useState<string[]>([])
  const [postKinds, setPostKinds] = useState<TrendingPostKindId[]>([...DEFAULT_TRENDING_POST_KINDS])
  const [includePlayerIdentity, setIncludePlayerIdentity] = useState(true)
  const [refPulsePostsEnabled, setRefPulsePostsEnabled] = useState(false)
  const [playerPulsePostRefCount, setPlayerPulsePostRefCount] = useState(3)
  const [charPulsePostRefCount, setCharPulsePostRefCount] = useState(3)

  const optionIds = useMemo(
    () => new Set(refCharacterOptions.map((o) => o.characterId.trim()).filter(Boolean)),
    [refCharacterOptions],
  )

  useEffect(() => {
    if (!open) return
    // 参考角色可选：打开时保留仍合法的勾选，不自动强制选择
    setRefCharacterIds((prev) => prev.filter((id) => optionIds.has(id)))
  }, [open, optionIds])

  const hasRefChars = refCharacterIds.length > 0
  const canStart = postKinds.length > 0 && styles.length > 0

  const toggleRefCharacter = (rawId: string) => {
    const id = rawId.trim()
    if (!id) return
    setRefCharacterIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const togglePostKind = (id: TrendingPostKindId) => {
    setPostKinds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }

  const toggleStyle = (id: TrendingPostStyleId) => {
    setStyles((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
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
                    Trending · Evolve
                  </p>
                  <h3 className="mt-1 font-serif text-[20px] tracking-tight text-[#1C1C1E]">演化热搜</h3>
                </div>
                <p className="mb-1 max-w-[11rem] text-right text-[11px] leading-snug text-neutral-400">
                  参考角色可选；再调话题、风格与自定义要求
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-4">
              <div className="space-y-3" data-pulse-coach="trending-sliders">
                <SliderRow
                  label="热搜话题数"
                  value={topicCount}
                  display={`${topicCount} 条`}
                  min={TRENDING_TOPIC_COUNT_MIN}
                  max={TRENDING_TOPIC_COUNT_MAX}
                  disabled={loading}
                  onChange={setTopicCount}
                />
                <SliderRow
                  label="每条热搜的讨论帖"
                  value={postsPerTopic}
                  display={`${postsPerTopic} 帖`}
                  min={TRENDING_POSTS_PER_TOPIC_MIN}
                  max={TRENDING_POSTS_PER_TOPIC_MAX}
                  disabled={loading}
                  onChange={setPostsPerTopic}
                />
                <SliderRow
                  label="每帖评论区互动"
                  value={commentsPerPost}
                  display={`${commentsPerPost} 条`}
                  min={TRENDING_COMMENTS_PER_POST_MIN}
                  max={TRENDING_COMMENTS_PER_POST_MAX}
                  disabled={loading}
                  hint="一级评论 + 二级回复合计条数"
                  onChange={setCommentsPerPost}
                />
              </div>

              <div data-pulse-coach="trending-refs">
              <p className="mt-5 text-[12px] font-medium text-[#1C1C1E]">参考角色与剧情（可选）</p>
              <p className="mt-1 text-[10px] leading-snug text-neutral-400">
                可不选。选中后注入其人设/世界书，并可参考其私聊与约会剧情。轮数按 AI 回复计（1 轮 = 用户 1 轮 + AI 1 轮）。
              </p>

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <p className="text-[11px] text-neutral-500">
                  参考角色{' '}
                  <PulseNumericText
                    text={`${refCharacterIds.length}`}
                    className="font-medium text-[#E5989B]"
                  />
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
                          <p className="truncate text-[10px] text-neutral-400">
                            {opt.subtitle?.trim() || '已绑定本身份'}
                          </p>
                        </div>
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                            active
                              ? 'border-[#E5989B] bg-[#E5989B] text-white'
                              : 'border-black/10 bg-white text-transparent'
                          }`}
                        >
                          <Check className="size-3" strokeWidth={2.2} />
                        </span>
                      </Pressable>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-2 rounded-2xl bg-[#F8F7F5] px-3.5 py-3 text-[12px] text-neutral-400">
                  暂无可用参考角色。可不选，直接按用户身份或自定义要求生成热搜；或先绑定当前身份下的通讯录角色。
                </p>
              )}

              <div className="mt-3 rounded-2xl bg-[#F8F7F5] px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-[#1C1C1E]">纳入用户身份设定</p>
                    <p className="mt-1 text-[10px] leading-snug text-neutral-400">
                      {includePlayerIdentity
                        ? '生成时注入绑定用户身份；可出现与用户相关的内容与艾特'
                        : hasRefChars
                          ? '关闭后仅围绕所选角色生成，不出现用户相关内容'
                          : '关闭且不选参考角色时，将按泛化舆论生成'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includePlayerIdentity}
                    aria-label="纳入用户身份设定"
                    disabled={loading}
                    onClick={() => setIncludePlayerIdentity((v) => !v)}
                    className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full p-0.5 transition-colors disabled:opacity-40 ${
                      includePlayerIdentity ? 'bg-[#E5989B]' : 'bg-black/15'
                    }`}
                  >
                    <span
                      className={`block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
                        includePlayerIdentity ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

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
                      ? '每位所选角色：参考微信私聊最近若干轮 AI 回复'
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
                      ? '每位所选角色：参考约会剧情最近若干轮 AI 正文'
                      : '需先选择参考角色后才可参考约会剧情'
                  }
                  onChange={setDatingRefRounds}
                />
              </div>

              <div className="mt-3 rounded-2xl bg-[#F8F7F5] px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-[#1C1C1E]">参考已发布微博</p>
                    <p className="mt-1 text-[10px] leading-snug text-neutral-400">
                      {refPulsePostsEnabled
                        ? '注入用户/角色近期公开发博，作热搜素材（与私聊分开）'
                        : '关闭时不读取广场动态；勾选后可分别调条数'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={refPulsePostsEnabled}
                    aria-label="参考已发布微博"
                    disabled={loading}
                    onClick={() => setRefPulsePostsEnabled((v) => !v)}
                    className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full p-0.5 transition-colors disabled:opacity-40 ${
                      refPulsePostsEnabled ? 'bg-[#E5989B]' : 'bg-black/15'
                    }`}
                  >
                    <span
                      className={`block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
                        refPulsePostsEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {refPulsePostsEnabled ? (
                <div className="mt-3 space-y-3">
                  <SliderRow
                    label="用户最近微博"
                    value={includePlayerIdentity ? playerPulsePostRefCount : 0}
                    display={
                      includePlayerIdentity
                        ? `${playerPulsePostRefCount} 条`
                        : '需纳入用户身份'
                    }
                    min={TRENDING_PULSE_POST_REF_MIN}
                    max={TRENDING_PULSE_POST_REF_MAX}
                    disabled={loading || !includePlayerIdentity}
                    hint={
                      includePlayerIdentity
                        ? '参考当前身份用户最近发布的广场动态'
                        : '请先打开「纳入用户身份设定」'
                    }
                    onChange={setPlayerPulsePostRefCount}
                  />
                  <SliderRow
                    label="角色最近微博"
                    value={hasRefChars ? charPulsePostRefCount : 0}
                    display={hasRefChars ? `${charPulsePostRefCount} 条` : '需选参考角色'}
                    min={TRENDING_PULSE_POST_REF_MIN}
                    max={TRENDING_PULSE_POST_REF_MAX}
                    disabled={loading || !hasRefChars}
                    hint={
                      hasRefChars
                        ? '每位所选参考角色：参考其最近发布的广场动态'
                        : '需先选择参考角色'
                    }
                    onChange={setCharPulsePostRefCount}
                  />
                </div>
              ) : null}
              </div>

              <div data-pulse-coach="trending-styles">
              <p className="mt-5 text-[12px] font-medium text-[#1C1C1E]">讨论帖类型（可多选）</p>
              <p className="mt-1 text-[10px] leading-snug text-neutral-400">
                有图帖默认显示文字描述占位，点图后再手动生图；每帖配图 1～9 张。
              </p>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {TRENDING_POST_KINDS.map((k) => {
                  const active = postKinds.includes(k.id)
                  return (
                    <Pressable
                      key={k.id}
                      type="button"
                      disabled={loading}
                      onClick={() => togglePostKind(k.id)}
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
                        {k.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-neutral-400">{k.hint}</span>
                    </Pressable>
                  )
                })}
              </div>

              <p className="mt-5 text-[12px] font-medium text-[#1C1C1E]">讨论风格（可多选）</p>
              <p className="mt-1 text-[10px] leading-snug text-neutral-400">
                多选时帖文会在所选风格间混排；至少保留一种。
              </p>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {TRENDING_POST_STYLES.map((s) => {
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
                      <span className="mt-0.5 block text-[10px] leading-snug text-neutral-400">{s.hint}</span>
                    </Pressable>
                  )
                })}
              </div>

              <p className="mt-5 text-[12px] font-medium text-[#1C1C1E]">自定义生成要求</p>
              <textarea
                value={customRequirements}
                disabled={loading}
                onChange={(e) => setCustomRequirements(e.target.value)}
                rows={3}
                maxLength={400}
                placeholder="可选：指定话题方向、角色关系、要避开的梗、口吻偏好…"
                className="mt-2.5 w-full resize-none rounded-2xl border border-black/[0.04] bg-[#F8F7F5] px-3.5 py-3 text-[13px] leading-relaxed text-[#1C1C1E] outline-none placeholder:text-neutral-400 focus:border-[#E5989B]/40 focus:bg-white disabled:opacity-50"
              />
              </div>
              <p className="mt-1.5 text-right text-[10px] tabular-nums text-neutral-300">
                <PulseNumericText text={`${customRequirements.length}/400`} />
              </p>

              <p className="mt-1 text-[11px] text-neutral-400">
                预计约生成{' '}
                <PulseNumericText
                  text={`${topicCount} 条热搜 · ${topicCount * postsPerTopic} 条讨论帖 · ${topicCount * postsPerTopic * commentsPerPost} 条评论互动`}
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
                    topicCount,
                    postsPerTopic,
                    commentsPerPost,
                    styles,
                    customRequirements: customRequirements.trim(),
                    chatRefRounds: hasRefChars ? chatRefRounds : 0,
                    datingRefRounds: hasRefChars ? datingRefRounds : 0,
                    refCharacterIds,
                    postKinds,
                    includePlayerIdentity,
                    refPulsePostsEnabled,
                    playerPulsePostRefCount:
                      refPulsePostsEnabled && includePlayerIdentity
                        ? playerPulsePostRefCount
                        : 0,
                    charPulsePostRefCount:
                      refPulsePostsEnabled && hasRefChars ? charPulsePostRefCount : 0,
                  })
                }
                className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-medium text-white shadow-[0_8px_24px_rgba(229,152,155,0.35)] disabled:opacity-50"
                style={{ backgroundColor: PULSE_COLORS.dustyRose }}
                data-pulse-coach="trending-start"
              >
                <Sparkles className="size-4" strokeWidth={1.4} />
                {loading ? '演化中…' : '开始演化'}
              </Pressable>
            </div>
          </motion.div>

          <AnimatePresence>
            {loading ? (
              <motion.div
                key="trending-generating-overlay"
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
                    Evolving
                  </p>
                  <h4 className="mt-1.5 font-serif text-[17px] tracking-tight text-[#1C1C1E]">
                    正在生成中
                  </h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
                    热搜、讨论帖与评论写入中，稍候片刻…
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: PULSE_COLORS.dustyRose }}
                        animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.1, 0.85] }}
                        transition={{
                          duration: 1.1,
                          repeat: Infinity,
                          delay: i * 0.18,
                          ease: 'easeInOut',
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </>
      ) : null}
    </AnimatePresence>
  )
}
