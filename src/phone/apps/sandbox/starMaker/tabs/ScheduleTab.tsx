import { TabScrollPage, TabSection } from '../components/TabScrollPage'
import { useSimulatorStore } from '../useSimulatorStore'
import { SimNum, SimNumText } from '../components/SimNum'

export function ScheduleTab() {
  const hotSearches = useSimulatorStore((s) => s.hotSearches)
  const lastFlavor = useSimulatorStore((s) => s.lastFlavor)
  const clearLastFlavor = useSimulatorStore((s) => s.clearLastFlavor)

  return (
    <TabScrollPage>
      {lastFlavor ? (
        <div className="sm-story-line sm-serif relative px-5 py-4 text-[14px] leading-relaxed text-stone-700">
          <SimNumText text={lastFlavor} />
          <button type="button" className="absolute right-3 top-3 text-stone-400" onClick={clearLastFlavor}>
            ×
          </button>
        </div>
      ) : null}

      <TabSection title="热搜榜" hint="实时舆论风向，影响声望与绯闻走向">
        <div className="sm-card divide-y divide-rose-50 p-2">
          {(hotSearches ?? []).map((h) => (
            <div key={h.id} className="flex items-center gap-3 px-3 py-3">
              <SimNum className="w-5 text-center text-[13px] text-rose-300">{h.rank}</SimNum>
              <span className="min-w-0 flex-1 text-[14px] leading-snug text-stone-800">{h.keyword}</span>
              <SimNum className="shrink-0 text-[12px] text-stone-400">{h.heat}</SimNum>
              {h.type === 'gossip' && <span className="shrink-0 text-[10px] text-rose-500">绯闻</span>}
              {h.type === 'negative' && <span className="shrink-0 text-[10px] text-stone-500">舆情</span>}
            </div>
          ))}
        </div>
      </TabSection>
    </TabScrollPage>
  )
}
