import type { ReactNode } from 'react'

import {
  formatProactiveCountdownClock,
  proactiveCountdownNumberStyle,
  type ProactiveMessageCountdownState,
} from './proactiveMessageCountdown'

export function ProactiveMessageCountdownBar({
  state,
}: {
  state: ProactiveMessageCountdownState | null
}) {
  if (!state?.visible) return null
  if (state.blockedReason === 'generating') return null

  const clock = formatProactiveCountdownClock(state.remainingMs)

  let primary: ReactNode
  if (state.remainingMs <= 0) {
    primary = <span>角色即将发来</span>
  } else {
    primary = (
      <span>
        约 <span style={proactiveCountdownNumberStyle}>{clock}</span> 后角色发来
      </span>
    )
  }

  return (
    <div className="mb-2 flex justify-center px-1">
      <div
        className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1 rounded-full border border-[#e8e8e8] bg-[#f7f7f7] px-3 py-1.5 text-[11px] leading-snug text-[#666666]"
        aria-live="polite"
      >
        <span className="text-[#888888]">{state.variableIntervalHint ? '灵动间隔' : '主动消息'}</span>
        <span className="text-[#c7c7c7]" aria-hidden>
          ·
        </span>
        {primary}
        {state.blockedHint ? (
          <span className="text-[#9ca3af]">（{state.blockedHint}）</span>
        ) : state.variableIntervalHint ? (
          <span className="text-[#9ca3af]">（{state.variableIntervalHint}）</span>
        ) : null}
      </div>
    </div>
  )
}
