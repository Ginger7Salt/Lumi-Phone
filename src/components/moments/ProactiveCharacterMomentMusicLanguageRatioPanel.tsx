import { useEffect, useState } from 'react'

import { MomentsMinimalSwitch } from './MomentsMinimalSwitch'
import { MomentsSerifNumericText } from './ArchiveTimelineDateColumn'
import { SettingsMechanismAccordion } from './SettingsMechanismAccordion'
import {
  DEFAULT_PROACTIVE_MOMENT_MUSIC_LANGUAGE_RATIO,
  formatProactiveMomentMusicLanguageRatioSummary,
  PROACTIVE_MOMENT_MUSIC_LANGUAGE_OPTIONS,
  resolveProactiveMomentMusicLanguageRatio,
  type ProactiveMomentMusicLanguageId,
  type ProactiveMomentMusicLanguageRatioSettings,
} from './proactiveCharacterMomentMusicLanguageRatio'
import {
  collectUserMusicTasteProfile,
  formatUserMusicTastePreview,
  type ProactiveMomentFollowUserMusicTasteSettings,
} from './proactiveCharacterMomentUserMusicTaste'

const MUSIC_LANGUAGE_SLIDER_CLASS =
  'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#E5E7EB] accent-[#111827] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#111827]'

type Props = {
  accountId?: string | null
  ratio: ProactiveMomentMusicLanguageRatioSettings
  followUserMusicTaste: ProactiveMomentFollowUserMusicTasteSettings
  onRatioChange: (next: ProactiveMomentMusicLanguageRatioSettings) => void
  onFollowUserMusicTasteChange: (next: ProactiveMomentFollowUserMusicTasteSettings) => void
}

export function ProactiveCharacterMomentMusicLanguageRatioPanel({
  accountId,
  ratio,
  followUserMusicTaste,
  onRatioChange,
  onFollowUserMusicTasteChange,
}: Props) {
  const resolved = resolveProactiveMomentMusicLanguageRatio(ratio)
  const summary = formatProactiveMomentMusicLanguageRatioSummary(ratio)
  const [tastePreview, setTastePreview] = useState('读取中…')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const profile = await collectUserMusicTasteProfile(accountId)
      if (!cancelled) setTastePreview(formatUserMusicTastePreview(profile))
    })()
    return () => {
      cancelled = true
    }
  }, [accountId])

  const patchWeight = (id: ProactiveMomentMusicLanguageId, weight: number) => {
    onRatioChange({
      ...ratio,
      [id]: weight,
    })
  }

  const resetDefaults = () => {
    onRatioChange({ ...DEFAULT_PROACTIVE_MOMENT_MUSIC_LANGUAGE_RATIO })
  }

  const patchFollowUserMusicTaste = (
    patch: Partial<ProactiveMomentFollowUserMusicTasteSettings>,
  ) => {
    onFollowUserMusicTasteChange({
      ...followUserMusicTaste,
      ...patch,
    })
  }

  return (
    <section className="rounded-3xl bg-white px-5 py-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#9CA3AF]">
            MUSIC
          </p>
          <h2 className="mt-1 text-[16px] font-semibold text-[#111827]">分享歌曲语种占比</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-[#9CA3AF]">
            角色主动发布时若选择分享歌曲，会按下方权重倾向选语种。拖动滑块调整各语种权重，系统会自动归一化为
            100% 生效。
          </p>
        </div>
        <button
          type="button"
          onClick={resetDefaults}
          className="shrink-0 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1.5 text-[11px] text-[#6B7280] transition-colors hover:border-[#D1D5DB] hover:text-[#374151]"
        >
          恢复默认
        </button>
      </div>

      <SettingsMechanismAccordion
        triggerLabel="点击阅读底层原理 (View Mechanism)"
        body={
          '仅影响「主动发布」调度生成的歌曲朋友圈；私聊里「帮我发个朋友圈」、生成面板手动发圈仍走默认华语优先规则。' +
          '占比写入生成 prompt，模型在 postType=music 时按长期分布选歌；近期私聊/一起听明确提到的具体歌曲仍可破例。'
        }
      />

      <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-3">
        <p className="text-[11px] font-medium text-[#374151]">生效占比预览</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#6B7280]">
          <MomentsSerifNumericText text={summary || '华语 100%'} />
        </p>
      </div>

      <div className="mt-4 space-y-4">
        {PROACTIVE_MOMENT_MUSIC_LANGUAGE_OPTIONS.map((opt) => {
          const resolvedRow = resolved.find((row) => row.id === opt.id)
          const weight = ratio[opt.id]
          return (
            <div key={opt.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <label
                    htmlFor={`proactive-moment-music-lang-${opt.id}`}
                    className="text-[12px] font-medium text-[#374151]"
                  >
                    {opt.label}
                  </label>
                  {opt.hint ? (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[#9CA3AF]">{opt.hint}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[12px] font-medium tabular-nums text-[#111827]">
                  <MomentsSerifNumericText
                    text={`权重 ${weight} · 生效 ${resolvedRow?.percent ?? 0}%`}
                  />
                </span>
              </div>
              <div className="mt-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-[#9CA3AF]">
                  <span>少</span>
                  <span>多</span>
                </div>
                <input
                  id={`proactive-moment-music-lang-${opt.id}`}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={weight}
                  onChange={(e) => patchWeight(opt.id, Number(e.target.value))}
                  className={MUSIC_LANGUAGE_SLIDER_CLASS}
                />
                <p className="mt-2 text-[11px] leading-relaxed text-[#6B7280]">参考：{opt.examples}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 border-t border-[#F3F4F6] pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-[#111827]">向用户喜好靠拢</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-[#9CA3AF]">
              开启后，角色分享歌曲时会参考你在听一听的播放记录、红心歌单，以及你自己分享到朋友圈的单曲。
            </p>
          </div>
          <MomentsMinimalSwitch
            checked={followUserMusicTaste.enabled}
            onChange={(enabled) => patchFollowUserMusicTaste({ enabled })}
            label="根据用户喜好偏向发布歌曲"
          />
        </div>

        <div className="mt-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-3">
          <p className="text-[11px] font-medium text-[#374151]">当前口味快照</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#6B7280]">{tastePreview}</p>
        </div>

        {followUserMusicTaste.enabled ? (
          <div className="mt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <label
                  htmlFor="proactive-moment-user-music-taste-weight"
                  className="text-[12px] font-medium text-[#374151]"
                >
                  靠拢强度
                </label>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#9CA3AF]">
                  100% 会强烈对齐你的常听歌手/近期曲目；50% 仅作参考，仍保留角色自身选歌空间
                </p>
              </div>
              <span className="shrink-0 text-[12px] font-medium tabular-nums text-[#111827]">
                <MomentsSerifNumericText text={`${followUserMusicTaste.weight}%`} />
              </span>
            </div>
            <div className="mt-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-[#9CA3AF]">
                <span>弱</span>
                <span>强</span>
              </div>
              <input
                id="proactive-moment-user-music-taste-weight"
                type="range"
                min={0}
                max={100}
                step={5}
                value={followUserMusicTaste.weight}
                onChange={(e) =>
                  patchFollowUserMusicTaste({ weight: Number(e.target.value) })
                }
                className={MUSIC_LANGUAGE_SLIDER_CLASS}
              />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[12px] leading-relaxed text-[#9CA3AF]">
            关闭时仅按上方语种占比选歌，不读取你的听歌偏好。
          </p>
        )}
      </div>
    </section>
  )
}
