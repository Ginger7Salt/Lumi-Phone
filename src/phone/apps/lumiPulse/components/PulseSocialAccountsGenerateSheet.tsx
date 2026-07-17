import { motion } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { PulseNum } from './PulseNum'
import { PULSE_COLORS, PULSE_MODAL_SPRING } from '../constants'

export type SocialPlotAnchorOption = {
  povId: string
  name: string
  /** 身份/关系副标题 */
  subtitle?: string
  /** 该角色本人是否已有微博社交账号（昵称/粉丝） */
  charHasSocial?: boolean
}

export type SocialAccountsGenerateOptions = {
  /** 要覆盖重生成的角色 pov（char:） */
  overwriteCharPovIds: string[]
}

function pulseCharHasSocialAccount(stats: {
  weiboNickname?: string
  followers?: number
  followersSyncedAt?: number
} | undefined): boolean {
  if (!stats) return false
  if (stats.weiboNickname?.trim()) return true
  if ((stats.followers ?? 0) > 0 && stats.followersSyncedAt) return true
  return false
}

export { pulseCharHasSocialAccount }

/** 个人页：生成用户本人 + 通讯录好友的社交账号数据（无帖子）— 居中弹层 */
export function PulseSocialAccountsGenerateSheet({
  playerName,
  friendCount,
  plotAnchors,
  selectedPlotPovId,
  onSelectPlot,
  generating,
  onClose,
  onGenerate,
  /** 已有角色社交时：默认只补用户；可勾选覆盖角色 */
  playerPlotOnly = false,
  /** 所选剧情线是否已有用户社交（无覆盖角色时将切线而非重生成） */
  selectedPlotAlreadyGenerated = false,
  /** 玩法引导：强制展示「覆盖角色」区（即使尚未生成过） */
  coachDemoOverwrite = false,
}: {
  playerName: string
  friendCount: number
  /** 当前身份已绑定的角色：选一个作为剧情量级锚点 */
  plotAnchors: SocialPlotAnchorOption[]
  selectedPlotPovId: string | null
  onSelectPlot: (povId: string) => void
  generating: boolean
  onClose: () => void
  onGenerate: (opts: SocialAccountsGenerateOptions) => void
  playerPlotOnly?: boolean
  selectedPlotAlreadyGenerated?: boolean
  coachDemoOverwrite?: boolean
}) {
  const [overwriteEnabled, setOverwriteEnabled] = useState(false)
  const [overwriteCharPovIds, setOverwriteCharPovIds] = useState<string[]>([])

  const anchorIds = useMemo(
    () => new Set(plotAnchors.map((a) => a.povId.trim()).filter(Boolean)),
    [plotAnchors],
  )

  const selectedAnchor = useMemo(
    () => plotAnchors.find((a) => a.povId === selectedPlotPovId) ?? null,
    [plotAnchors, selectedPlotPovId],
  )

  /** 补新剧情线用户社交，且参考角色本人也还没账号 → 建议一并生成 */
  const suggestGenSelectedChar =
    (playerPlotOnly || coachDemoOverwrite) &&
    Boolean(selectedPlotPovId) &&
    !selectedPlotAlreadyGenerated &&
    selectedAnchor != null &&
    selectedAnchor.charHasSocial !== true

  const selectedCharIncluded =
    Boolean(selectedPlotPovId) &&
    overwriteEnabled &&
    overwriteCharPovIds.includes(selectedPlotPovId!)

  useEffect(() => {
    // 打开弹层 / 角色列表变化时，清掉失效勾选；首次全量生成不需要覆盖开关
    if (!playerPlotOnly && !coachDemoOverwrite) {
      setOverwriteEnabled(false)
      setOverwriteCharPovIds([])
      return
    }
    setOverwriteCharPovIds((prev) => prev.filter((id) => anchorIds.has(id)))
  }, [anchorIds, coachDemoOverwrite, playerPlotOnly])

  useEffect(() => {
    if (coachDemoOverwrite) setOverwriteEnabled(true)
  }, [coachDemoOverwrite])

  const showOverwrite = playerPlotOnly || coachDemoOverwrite
  const overwriteCount = overwriteEnabled ? overwriteCharPovIds.length : 0
  const switchOnly = selectedPlotAlreadyGenerated && overwriteCount === 0
  const canGenerate = Boolean(selectedPlotPovId) && plotAnchors.length > 0 && !generating
  const selectedName = selectedAnchor?.name?.trim() || '所选角色'

  const writeCount = (() => {
    if (switchOnly) return 0
    if (!playerPlotOnly && !coachDemoOverwrite) return friendCount + 1
    // 补用户线（若该线尚未有）+ 覆盖角色
    const userSlot = selectedPlotAlreadyGenerated ? 0 : 1
    return userSlot + overwriteCount
  })()

  const toggleOverwriteChar = (povId: string) => {
    const id = povId.trim()
    if (!id) return
    setOverwriteCharPovIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const includeSelectedCharForGenerate = () => {
    const id = selectedPlotPovId?.trim()
    if (!id) return
    setOverwriteEnabled(true)
    setOverwriteCharPovIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  const handleGenerateClick = () => {
    if (!canGenerate || !selectedPlotPovId) return
    const nextOverwrite = overwriteEnabled ? overwriteCharPovIds : []
    if (
      suggestGenSelectedChar &&
      !nextOverwrite.includes(selectedPlotPovId) &&
      !window.confirm(
        `参考角色「${selectedName}」的社交账号还没有生成。\n\n建议打开「覆盖角色社交」并勾选该角色，与用户本线一起生成；否则角色主页仍会没有账号数据。\n\n仍只补用户社交？`,
      )
    ) {
      // 取消「仍只补用户」→ 帮用户勾上该角色，方便再点一次生成
      includeSelectedCharForGenerate()
      return
    }
    onGenerate({ overwriteCharPovIds: nextOverwrite })
  }

  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1300] bg-black/20 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !generating && onClose()}
        aria-label="关闭"
      />
      <div className="pointer-events-none fixed inset-0 z-[1310] flex items-center justify-center px-5">
        <motion.div
          className="pointer-events-auto flex max-h-[min(78vh,560px)] w-full max-w-sm flex-col overflow-hidden rounded-[24px] bg-white/95 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={PULSE_MODAL_SPRING}
        >
          <div className="shrink-0 px-5 pt-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-400">Social Graph</p>
            <h3 className="mt-1 font-serif text-[18px] text-[#1C1C1E]">生成社交账号</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
              {playerPlotOnly || coachDemoOverwrite ? (
                <>
                  默认只为 <strong className="font-medium text-[#1C1C1E]">{playerName}</strong>{' '}
                  补所选剧情线的粉丝与认证。若要重刷角色账号，可勾选「覆盖角色社交」并多选角色。
                </>
              ) : (
                <>
                  首次生成：为 <strong className="font-medium text-[#1C1C1E]">{playerName}</strong> 与当前身份下通讯录{' '}
                  <PulseNum>{friendCount}</PulseNum> 位角色一并写入社交账号；并
                  <strong className="font-medium text-[#1C1C1E]">单选</strong>
                  一条角色剧情作参考，定你的粉丝与认证。
                </>
              )}
            </p>
            {suggestGenSelectedChar ? (
              <div className="mt-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-3">
                <p className="text-[12px] leading-relaxed text-amber-900/90">
                  参考角色「
                  <strong className="font-medium">{selectedName}</strong>
                  」的社交账号也还没生成。建议一并勾选该角色一起生成，否则切到这条剧情线后，角色主页仍会是空账号。
                </p>
                {!selectedCharIncluded ? (
                  <Pressable
                    type="button"
                    disabled={generating}
                    onClick={includeSelectedCharForGenerate}
                    className="mt-2.5 w-full rounded-xl bg-[#1C1C1E] px-3 py-2 text-center text-[12px] font-medium text-white disabled:opacity-50"
                  >
                    勾选「{selectedName}」并一起生成
                  </Pressable>
                ) : (
                  <p className="mt-2 text-[11px] text-amber-800/70">
                    已勾选该角色，生成时会一并写入其社交账号。
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-5" data-pulse-coach="social-plot-list">
            <p className="text-[11px] font-medium tracking-wide text-[#1C1C1E]">
              {playerPlotOnly || coachDemoOverwrite ? '单选要补的剧情线' : '单选剧情参考（并生成角色社交）'}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
              {playerPlotOnly
                ? '只选一个角色作用户量级锚点；角色账号默认不动。'
                : '请选一个绑定角色作参考；本次会生成身份下全部角色的社交，并按该线定你的粉丝与认证。'}
            </p>
            {plotAnchors.length ? (
              <div className="mt-2.5 space-y-1.5 pb-1">
                {plotAnchors.map((anchor) => {
                  const active = anchor.povId === selectedPlotPovId
                  const subParts: string[] = []
                  if (anchor.charHasSocial === false) subParts.push('角色账号未生成')
                  else if (anchor.charHasSocial === true) subParts.push('角色账号已有')
                  if (anchor.subtitle?.trim()) subParts.push(anchor.subtitle.trim())
                  return (
                    <Pressable
                      key={anchor.povId}
                      type="button"
                      disabled={generating}
                      onClick={() => onSelectPlot(anchor.povId)}
                      className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                        active
                          ? 'border-[#1C1C1E]/20 bg-[#F4F4F5]'
                          : 'border-transparent bg-[#F8F7F5] hover:bg-[#F4F4F5]'
                      }`}
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                          active
                            ? 'border-[#1C1C1E] bg-[#1C1C1E] text-white'
                            : 'border-neutral-300 bg-white text-transparent'
                        }`}
                      >
                        <Check className="size-3" strokeWidth={2.4} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-[#1C1C1E]">
                          {anchor.name}
                        </span>
                        {subParts.length ? (
                          <span
                            className={`mt-0.5 block truncate text-[11px] ${
                              anchor.charHasSocial === false
                                ? 'text-amber-700/80'
                                : 'text-neutral-400'
                            }`}
                          >
                            {subParts.join(' · ')}
                          </span>
                        ) : null}
                      </span>
                    </Pressable>
                  )
                })}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl bg-[#F8F7F5] px-3 py-3 text-[12px] leading-relaxed text-neutral-500">
                当前身份还没有绑定角色。请先在通讯录/人设里把角色关联到本身份，再生成社交数据。
              </p>
            )}

            {showOverwrite && plotAnchors.length ? (
              <>
                <div
                  className="mt-4 rounded-2xl bg-[#F8F7F5] px-3.5 py-3"
                  data-pulse-coach="social-overwrite"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-[#1C1C1E]">覆盖角色社交账号</p>
                      <p className="mt-1 text-[10px] leading-snug text-neutral-400">
                        {coachDemoOverwrite && !playerPlotOnly
                          ? '演示：首次生成后会出现此开关；打开并勾选角色即可重刷其社交'
                          : overwriteEnabled
                            ? '勾选下方角色后，将重新生成其微博昵称/粉丝/关注等'
                            : '默认不改角色账号；需要重刷时再打开'}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={overwriteEnabled}
                      aria-label="覆盖角色社交账号"
                      disabled={generating}
                      onClick={() => {
                        setOverwriteEnabled((v) => {
                          if (v) setOverwriteCharPovIds([])
                          return !v
                        })
                      }}
                      className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full p-0.5 transition-colors disabled:opacity-40 ${
                        overwriteEnabled ? 'bg-[#1C1C1E]' : 'bg-black/15'
                      }`}
                    >
                      <span
                        className={`block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
                          overwriteEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {overwriteEnabled ? (
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium tracking-wide text-[#1C1C1E]">
                        多选要覆盖的角色
                      </p>
                      <div className="flex gap-2">
                        <Pressable
                          type="button"
                          disabled={generating}
                          onClick={() =>
                            setOverwriteCharPovIds(
                              plotAnchors.map((a) => a.povId.trim()).filter(Boolean),
                            )
                          }
                          className="text-[11px] text-neutral-500 disabled:opacity-40"
                        >
                          全选
                        </Pressable>
                        <Pressable
                          type="button"
                          disabled={generating}
                          onClick={() => setOverwriteCharPovIds([])}
                          className="text-[11px] text-neutral-500 disabled:opacity-40"
                        >
                          清空
                        </Pressable>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {plotAnchors.map((anchor) => {
                        const active = overwriteCharPovIds.includes(anchor.povId)
                        return (
                          <Pressable
                            key={`ow-${anchor.povId}`}
                            type="button"
                            disabled={generating}
                            onClick={() => toggleOverwriteChar(anchor.povId)}
                            className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition-colors disabled:opacity-50 ${
                              active
                                ? 'border-[#1C1C1E]/20 bg-[#F4F4F5]'
                                : 'border-transparent bg-[#F8F7F5] hover:bg-[#F4F4F5]'
                            }`}
                          >
                            <span
                              className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                                active
                                  ? 'border-[#1C1C1E] bg-[#1C1C1E] text-white'
                                  : 'border-neutral-300 bg-white text-transparent'
                              }`}
                            >
                              <Check className="size-2.5" strokeWidth={2.6} />
                            </span>
                            <span className="min-w-0 truncate text-[12px] font-medium text-[#1C1C1E]">
                              {anchor.name}
                              {anchor.charHasSocial === false ? (
                                <span className="font-normal text-amber-700/80"> ·未生成</span>
                              ) : null}
                            </span>
                          </Pressable>
                        )
                      })}
                    </div>
                    {overwriteCount === 0 ? (
                      <p className="mt-2 text-[11px] text-amber-700/80">
                        已打开覆盖，请至少勾选一位角色；否则仍只处理用户社交。
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-black/[0.04] px-5 py-4">
            <p className="text-[12px] text-neutral-400">
              {switchOnly ? (
                <>该剧情线用户社交已有，将直接切换；未勾选覆盖角色</>
              ) : (
                <>
                  本次将写入 <PulseNum>{writeCount}</PulseNum> 个账号
                  {selectedPlotPovId ? <>；用户量级锚定「{selectedName}」剧情</> : null}
                  {overwriteCount > 0 ? (
                    <>
                      ；覆盖 <PulseNum>{overwriteCount}</PulseNum> 位角色
                    </>
                  ) : playerPlotOnly ? (
                    <>（仅用户）</>
                  ) : null}
                </>
              )}
            </p>
            <Pressable
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerateClick}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: PULSE_COLORS.dustyRose }}
              data-pulse-coach="social-generate-btn"
            >
              <Sparkles className="size-4" strokeWidth={1.4} />
              {generating
                ? '生成中…'
                : !plotAnchors.length
                  ? '暂无可用角色'
                  : !selectedPlotPovId
                    ? '请先选择剧情锚点'
                    : switchOnly
                      ? '切换到该剧情线'
                      : overwriteCount > 0
                        ? selectedPlotAlreadyGenerated
                          ? '覆盖所选角色社交'
                          : '补用户并覆盖角色'
                        : playerPlotOnly
                          ? '补齐本线用户社交'
                          : '开始生成'}
            </Pressable>
          </div>
        </motion.div>
      </div>
    </>
  )
}
