import { PHONE_NUM_FONT_FAMILY } from '../../phone/types'

import {
  formatProactiveCharacterMomentIntervalLabel,
  hasProactiveCharacterMomentScheduleSaved,
  type ProactiveCharacterMomentSchedule,
} from './proactiveCharacterMomentTypes'

const numStyle = { fontFamily: PHONE_NUM_FONT_FAMILY } as const

function formatSavedAt(ms: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="shrink-0 text-[12px] text-[#9CA3AF]">{label}</span>
      <span className="text-right text-[12px] font-medium text-[#111827]" style={numStyle}>
        {value}
      </span>
    </div>
  )
}

export function ProactiveMomentGlobalSavedSummary({
  enabled,
  schedule,
  pickCount,
}: {
  enabled: boolean
  schedule: ProactiveCharacterMomentSchedule
  pickCount: number
}) {
  const saved = hasProactiveCharacterMomentScheduleSaved(schedule)
  const intervalLabel = formatProactiveCharacterMomentIntervalLabel(schedule.intervalSeconds)

  return (
    <div className="mt-5 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#9CA3AF]">
          当前已保存
        </p>
        {saved ? (
          <span className="rounded-full bg-[#111827]/8 px-2 py-0.5 text-[10px] font-medium text-[#111827]">
            已保存
          </span>
        ) : (
          <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] text-[#9CA3AF]">
            频率待保存
          </span>
        )}
      </div>
      <div className="mt-1 divide-y divide-[#E5E7EB]">
        <SummaryRow label="调度方式" value="全局随机" />
        <SummaryRow label="总开关" value={enabled ? '已开启' : '已关闭'} />
        <SummaryRow label="发布频率" value={saved ? intervalLabel : '待保存'} />
        <SummaryRow label="每轮抽取" value={`${pickCount} 人`} />
        <SummaryRow
          label="计时起点"
          value={saved ? formatSavedAt(schedule.lastFiredAtMs) : '保存频率后开始'}
        />
      </div>
    </div>
  )
}

export function ProactiveMomentCharacterSavedSummary({
  characterName,
  schedule,
}: {
  characterName: string
  schedule: ProactiveCharacterMomentSchedule
}) {
  const saved = hasProactiveCharacterMomentScheduleSaved(schedule)
  if (!schedule.enabled) return null

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-medium text-[#111827]">{characterName}</p>
        {saved ? (
          <span className="shrink-0 rounded-full bg-[#111827]/8 px-2 py-0.5 text-[10px] font-medium text-[#111827]">
            已保存
          </span>
        ) : (
          <span className="shrink-0 text-[10px] text-[#9CA3AF]">待保存频率</span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-[#6B7280]" style={numStyle}>
        {saved
          ? `${formatProactiveCharacterMomentIntervalLabel(schedule.intervalSeconds)} · 起计 ${formatSavedAt(schedule.lastFiredAtMs)}`
          : '已开启，请保存发布频率'}
      </p>
    </div>
  )
}

export function ProactiveMomentPerCharacterSavedSummary({
  rows,
}: {
  rows: { characterId: string; characterName: string; schedule: ProactiveCharacterMomentSchedule }[]
}) {
  const active = rows.filter((r) => r.schedule.enabled)
  if (!active.length) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFA] px-4 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#9CA3AF]">
          当前已保存
        </p>
        <p className="mt-2 text-[12px] text-[#9CA3AF]">暂无已开启的角色配置</p>
      </div>
    )
  }

  const savedCount = active.filter((r) => hasProactiveCharacterMomentScheduleSaved(r.schedule)).length

  return (
    <div className="mt-5 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#9CA3AF]">
          当前已保存
        </p>
        <span className="text-[10px] text-[#9CA3AF]" style={numStyle}>
          {savedCount}/{active.length} 已保存频率
        </span>
      </div>
      <div className="mt-2 space-y-2">
        {active.map((row) => (
          <ProactiveMomentCharacterSavedSummary
            key={row.characterId}
            characterName={row.characterName}
            schedule={row.schedule}
          />
        ))}
      </div>
    </div>
  )
}
