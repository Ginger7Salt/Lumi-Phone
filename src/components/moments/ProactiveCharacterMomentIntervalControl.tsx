import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  formatProactiveCharacterMomentIntervalLabel,
  momentPickDisplayUnitForSeconds,
  momentSecondsToUnitValue,
  momentUnitInputMinMax,
  momentUnitValueToSeconds,
  PROACTIVE_CHARACTER_MOMENT_PRESETS,
  PROACTIVE_MESSAGE_INTERVAL_UNITS,
  PROACTIVE_MESSAGE_NUMBER_FONT,
  resolveProactiveCharacterMomentIntervalSeconds,
} from './proactiveCharacterMomentTypes'
import type { ProactiveMessageIntervalUnit } from '../../phone/apps/wechat/proactivePrivateMessageTypes'

const numStyle = { fontFamily: PROACTIVE_MESSAGE_NUMBER_FONT } as const

export function ProactiveCharacterMomentIntervalControl({
  savedIntervalSeconds,
  scheduleSaved,
  onSave,
  saving = false,
}: {
  savedIntervalSeconds: number
  scheduleSaved: boolean
  onSave: (seconds: number) => void | Promise<void>
  saving?: boolean
}) {
  const storedSeconds = resolveProactiveCharacterMomentIntervalSeconds({
    intervalSeconds: savedIntervalSeconds,
  })

  const [draftSeconds, setDraftSeconds] = useState(storedSeconds)
  const [unit, setUnit] = useState<ProactiveMessageIntervalUnit>(() =>
    momentPickDisplayUnitForSeconds(storedSeconds),
  )
  const [draftValue, setDraftValue] = useState(() =>
    momentSecondsToUnitValue(storedSeconds, momentPickDisplayUnitForSeconds(storedSeconds)),
  )

  useEffect(() => {
    setDraftSeconds(storedSeconds)
    const nextUnit = momentPickDisplayUnitForSeconds(storedSeconds)
    setUnit(nextUnit)
    setDraftValue(momentSecondsToUnitValue(storedSeconds, nextUnit))
  }, [storedSeconds])

  const { min, max, step } = useMemo(() => momentUnitInputMinMax(unit), [unit])

  const dirty = draftSeconds !== storedSeconds
  const draftLabel = formatProactiveCharacterMomentIntervalLabel(draftSeconds)
  const savedLabel = formatProactiveCharacterMomentIntervalLabel(storedSeconds)

  const applyDraftSeconds = useCallback((nextSeconds: number) => {
    const clamped = resolveProactiveCharacterMomentIntervalSeconds({
      intervalSeconds: nextSeconds,
    })
    setDraftSeconds(clamped)
    const nextUnit = momentPickDisplayUnitForSeconds(clamped)
    setUnit(nextUnit)
    setDraftValue(momentSecondsToUnitValue(clamped, nextUnit))
  }, [])

  const onUnitChange = (nextUnit: ProactiveMessageIntervalUnit) => {
    setUnit(nextUnit)
    setDraftValue(momentSecondsToUnitValue(draftSeconds, nextUnit))
  }

  const syncDraftValueToSeconds = useCallback(() => {
    applyDraftSeconds(momentUnitValueToSeconds(draftValue, unit))
  }, [applyDraftSeconds, draftValue, unit])

  const presetActive = PROACTIVE_CHARACTER_MOMENT_PRESETS.find((p) => p.seconds === draftSeconds)?.id

  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    if (!justSaved) return
    const t = window.setTimeout(() => setJustSaved(false), 2800)
    return () => window.clearTimeout(t)
  }, [justSaved])

  const handleSave = () => {
    const next = momentUnitValueToSeconds(draftValue, unit)
    void (async () => {
      await onSave(
        resolveProactiveCharacterMomentIntervalSeconds({ intervalSeconds: next }),
      )
      setJustSaved(true)
    })()
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-medium text-[#111827]" style={numStyle}>
          {dirty ? `待保存：${draftLabel}` : savedLabel}
        </span>
        {justSaved ? (
          <span className="text-[11px] font-medium text-[#111827]">已保存</span>
        ) : scheduleSaved ? (
          <span className="text-[11px] text-[#9CA3AF]">
            {dirty ? '修改未生效 · 请再次保存' : '再次保存将重置计时'}
          </span>
        ) : (
          <span className="text-[11px] text-[#9CA3AF]">保存后间隔才会生效并开始调度</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PROACTIVE_CHARACTER_MOMENT_PRESETS.map((preset) => {
          const active = presetActive === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyDraftSeconds(preset.seconds)}
              className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                active
                  ? 'bg-[#111827] text-white'
                  : 'border border-[#E5E7EB] bg-[#F9FAFB] text-[#374151]'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-3 py-2">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={draftValue}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (!Number.isFinite(n)) return
              setDraftValue(n)
            }}
            onBlur={syncDraftValueToSeconds}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                syncDraftValueToSeconds()
              }
            }}
            className="min-w-0 flex-1 border-0 bg-transparent text-[18px] text-[#111827] outline-none"
            style={numStyle}
            aria-label="主动发朋友圈间隔"
          />
          <div className="flex shrink-0 gap-1">
            {PROACTIVE_MESSAGE_INTERVAL_UNITS.filter((u) => u.id !== 'second').map((u) => {
              const active = unit === u.id
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onUnitChange(u.id)}
                  className={`rounded-full px-2.5 py-1 text-[12px] transition-colors ${
                    active ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#6B7280]'
                  }`}
                >
                  {u.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className={`mt-3 flex h-10 w-full items-center justify-center rounded-full text-[14px] font-medium transition-all outline-none disabled:opacity-50 ${
          justSaved
            ? 'bg-[#111827]/90 text-white'
            : 'bg-[#111827] text-white active:opacity-90'
        }`}
      >
        {saving ? '保存中…' : justSaved ? '已保存' : '保存间隔'}
      </button>

      <p className="mt-2 text-[11px] leading-relaxed text-[#9CA3AF]">
        最短间隔 <span style={numStyle}>30</span> 分钟。系统会按频率从通讯录中挑选角色，结合人设与近期语境
        <strong className="font-normal text-[#6B7280]">主动发布</strong>朋友圈；是否置顶由角色自行判断。
      </p>
    </div>
  )
}
