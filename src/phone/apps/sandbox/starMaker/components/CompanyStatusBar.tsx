import { ACTIONS_PER_DAY } from '../types'
import { useSimulatorStore } from '../useSimulatorStore'
import { SimFunds, SimNum } from './SimNum'

function CoinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
      <path
        d="M12 7.5v9M9.2 9.8h5.6M9.2 14.2h5.6"
        stroke="#b45309"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ReputationIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 15.9l-4.7 2.05.9-5.23-3.8-3.7 5.25-.76L12 3.5z"
        fill="#fecdd3"
        stroke="#f472b6"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StaminaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 2.5L4.5 13.2c-.55.68-.08 1.8.82 1.8H11v6.2l8.5-10.7c.55-.68.08-1.8-.82-1.8H13V2.5z"
        fill="#bbf7d0"
        stroke="#22c55e"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 标题栏下方 · 资金 / 声望 / 体力横条 */
export function CompanyStatusBar() {
  const funds = useSimulatorStore((s) => s.funds)
  const reputation = useSimulatorStore((s) => s.reputation)
  const actionsUsedToday = useSimulatorStore((s) => s.actionsUsedToday)
  const pendingDrama = useSimulatorStore((s) => s.pendingDrama)
  const stamina = pendingDrama ? 0 : ACTIONS_PER_DAY - actionsUsedToday

  return (
    <div className="sm-status-bar shrink-0 px-3 pb-2">
      <div className="flex items-center gap-1.5">
        <div className="sm-status-pill flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1.5">
          <CoinIcon />
          <span className="truncate text-[12px] font-medium text-[#2D2422]">
            <SimFunds amount={funds} />
          </span>
        </div>
        <div className="sm-status-pill flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1.5">
          <ReputationIcon />
          <span className="truncate text-[12px] font-medium text-rose-600">
            <SimNum>{reputation}</SimNum>
          </span>
        </div>
        <div className="sm-status-pill flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1.5">
          <StaminaIcon />
          <span className="truncate text-[12px] font-medium text-emerald-600">
            <SimNum>{stamina}</SimNum>
            <span className="text-[11px] text-stone-400">
              /<SimNum>{ACTIONS_PER_DAY}</SimNum>
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
