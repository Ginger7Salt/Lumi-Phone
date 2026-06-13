import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import {
  formatProactiveMessageIntervalLabel,
  pickDisplayUnitForSeconds,
  PROACTIVE_MESSAGE_INTERVAL_UNITS,
  PROACTIVE_MESSAGE_NUMBER_FONT,
  PROACTIVE_MESSAGE_PRESETS,
  resolveProactiveMessageIntervalSeconds,
  secondsToUnitValue,
  type ProactiveMessageIntervalUnit,
  unitInputMinMax,
  unitValueToSeconds,
} from '../proactivePrivateMessageTypes'

const numStyle = { fontFamily: PROACTIVE_MESSAGE_NUMBER_FONT } as const

export function ProactiveMessageIntervalControl({
  savedIntervalSeconds,
  scheduleSaved,
  onSave,
  saving = false,
}: {
  /** 已落库的间隔（秒） */
  savedIntervalSeconds: number
  /** 是否已至少保存过一次（保存后才会开始倒计时/调度） */
  scheduleSaved: boolean
  onSave: (seconds: number) => void | Promise<void>
  saving?: boolean
}) {
  const storedSeconds = resolveProactiveMessageIntervalSeconds({
    proactiveMessageIntervalSeconds: savedIntervalSeconds,
  })

  const [draftSeconds, setDraftSeconds] = useState(storedSeconds)
  const [unit, setUnit] = useState<ProactiveMessageIntervalUnit>(() =>
    pickDisplayUnitForSeconds(storedSeconds),
  )
  const [draftValue, setDraftValue] = useState(() => secondsToUnitValue(storedSeconds, unit))

  useEffect(() => {
    setDraftSeconds(storedSeconds)
    const nextUnit = pickDisplayUnitForSeconds(storedSeconds)
    setUnit(nextUnit)
    setDraftValue(secondsToUnitValue(storedSeconds, nextUnit))
  }, [storedSeconds])

  const { min, max, step } = useMemo(() => unitInputMinMax(unit), [unit])

  const dirty = draftSeconds !== storedSeconds
  const draftLabel = formatProactiveMessageIntervalLabel(draftSeconds)
  const savedLabel = formatProactiveMessageIntervalLabel(storedSeconds)

  const applyDraftSeconds = useCallback((nextSeconds: number) => {
    const clamped = resolveProactiveMessageIntervalSeconds({
      proactiveMessageIntervalSeconds: nextSeconds,
    })
    setDraftSeconds(clamped)
    const nextUnit = pickDisplayUnitForSeconds(clamped)
    setUnit(nextUnit)
    setDraftValue(secondsToUnitValue(clamped, nextUnit))
  }, [])

  const onUnitChange = (nextUnit: ProactiveMessageIntervalUnit) => {
    setUnit(nextUnit)
    setDraftValue(secondsToUnitValue(draftSeconds, nextUnit))
  }

  const syncDraftValueToSeconds = useCallback(() => {
    applyDraftSeconds(unitValueToSeconds(draftValue, unit))
  }, [applyDraftSeconds, draftValue, unit])

  const presetActive = PROACTIVE_MESSAGE_PRESETS.find((p) => p.seconds === draftSeconds)?.id

  const handleSave = () => {
    const next = unitValueToSeconds(draftValue, unit)
    void onSave(resolveProactiveMessageIntervalSeconds({ proactiveMessageIntervalSeconds: next }))
  }

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-medium text-black" style={numStyle}>
          {dirty ? `待保存：${draftLabel}` : savedLabel}
        </span>
        {scheduleSaved ? (
          <span className="text-[11px] text-[#8e8e8e]">
            已保存 {savedLabel}
            {dirty ? ' · 修改未生效' : ' · 再次保存将重置倒计时'}
          </span>
        ) : (
          <span className="text-[11px] text-[#8e8e8e]">保存后间隔才会生效并开始倒计时</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {PROACTIVE_MESSAGE_PRESETS.map((preset) => {
          const active = presetActive === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyDraftSeconds(preset.seconds)}
              className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                active
                  ? 'bg-black text-white'
                  : 'border border-[#e5e5e5] bg-[#f7f7f7] text-[#333333]'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-2">
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
            className="min-w-0 flex-1 border-0 bg-transparent text-[18px] text-black outline-none"
            style={numStyle}
            aria-label="主动消息间隔数值"
          />
          <div className="flex shrink-0 gap-1">
            {PROACTIVE_MESSAGE_INTERVAL_UNITS.map((u) => {
              const active = unit === u.id
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onUnitChange(u.id)}
                  className={`rounded-full px-2.5 py-1 text-[12px] transition-colors ${
                    active
                      ? 'bg-black text-white'
                      : 'bg-[#f2f2f2] text-[#666666]'
                  }`}
                >
                  {u.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <Pressable
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="mt-3 flex h-10 w-full items-center justify-center rounded-[10px] bg-black text-[14px] font-medium text-white transition-opacity active:opacity-90 disabled:opacity-50"
      >
        {saving ? '保存中…' : '保存间隔'}
      </Pressable>

      <p className="mt-2 text-[11px] text-[#8e8e8e]">
        最短间隔 <span style={numStyle}>30</span> 秒；保存后立即按新间隔重新计时。角色会结合上下文主动发消息，避免重复上一轮内容。
      </p>
    </div>
  )
}
