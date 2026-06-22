import { useState } from 'react'
import { useCurrentApiConfig } from '../../../api/ApiSettingsContext'
import { Pressable } from '../../../../components/Pressable'
import { SHOP_PROPERTIES, SHOP_VEHICLES, TRAVEL_DESTINATIONS } from '../presets'
import { SubTabBar } from '../components/SubTabBar'
import { TabScrollPage, TabSection } from '../components/TabScrollPage'
import { SimFunds, SimNum, SimNumText } from '../components/SimNum'
import { useSimulatorStore } from '../useSimulatorStore'

type AssetsSubTab = 'property' | 'vehicle' | 'travel'

const ASSETS_SUB_TABS = [
  { id: 'property' as const, label: '房产' },
  { id: 'vehicle' as const, label: '座驾' },
  { id: 'travel' as const, label: '出行' },
]

export function AssetsTab() {
  const mainApi = useCurrentApiConfig('chatCard')
  const funds = useSimulatorStore((s) => s.funds)
  const assets = useSimulatorStore((s) => s.assets)
  const artists = useSimulatorStore((s) => s.artists)
  const buyProperty = useSimulatorStore((s) => s.buyProperty)
  const buyVehicle = useSimulatorStore((s) => s.buyVehicle)
  const startTravel = useSimulatorStore((s) => s.startTravel)
  const travelDiary = useSimulatorStore((s) => s.travelDiary)
  const clearTravelDiary = useSimulatorStore((s) => s.clearTravelDiary)
  const canAct = useSimulatorStore((s) => s.canAct)

  const [subTab, setSubTab] = useState<AssetsSubTab>('property')
  const [travelOpen, setTravelOpen] = useState(false)
  const [destId, setDestId] = useState<string>(TRAVEL_DESTINATIONS[0].id)
  const [companionId, setCompanionId] = useState<string | null>(artists[0]?.id ?? null)
  const [busy, setBusy] = useState(false)

  const ownedPropertyCount = assets.properties.length
  const ownedVehicleCount = assets.vehicles.length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SubTabBar tabs={ASSETS_SUB_TABS} active={subTab} onChange={setSubTab} />

      <TabScrollPage>
        {subTab === 'property' && (
          <TabSection title="房产" hint={`已拥有 ${ownedPropertyCount} 处`}>
            <div className="sm-list-stack">
              {SHOP_PROPERTIES.map((p) => {
                const owned = assets.properties.includes(p.id)
                return (
                  <div key={p.id} className="sm-card flex flex-col gap-4 p-5">
                    <div>
                      <h4 className="text-[15px] font-medium text-stone-800">{p.name}</h4>
                      <p className="mt-2 text-[13px] leading-relaxed text-stone-500">{p.desc}</p>
                    </div>
                    <Pressable
                      disabled={owned || funds < p.price}
                      onClick={() => buyProperty(p.id)}
                      className="sm-btn-primary w-full text-center text-[14px] disabled:opacity-40"
                    >
                      {owned ? '已拥有' : <SimFunds amount={p.price} />}
                    </Pressable>
                  </div>
                )
              })}
            </div>
          </TabSection>
        )}

        {subTab === 'vehicle' && (
          <TabSection title="座驾" hint={`已拥有 ${ownedVehicleCount} 辆`}>
            <div className="sm-list-stack">
              {SHOP_VEHICLES.map((v) => {
                const owned = assets.vehicles.includes(v.id)
                return (
                  <div key={v.id} className="sm-card flex flex-col gap-4 p-5">
                    <div>
                      <h4 className="text-[15px] font-medium text-stone-800">{v.name}</h4>
                      <p className="mt-2 text-[13px] leading-relaxed text-stone-500">{v.desc}</p>
                    </div>
                    <Pressable
                      disabled={owned || funds < v.price}
                      onClick={() => buyVehicle(v.id)}
                      className="sm-btn-primary w-full text-center text-[14px] disabled:opacity-40"
                    >
                      {owned ? '已拥有' : <SimFunds amount={v.price} />}
                    </Pressable>
                  </div>
                )
              })}
            </div>
          </TabSection>
        )}

        {subTab === 'travel' && (
          <TabSection title="全球旅行" hint="消耗一次行动，可邀请艺人同行">
            <div className="sm-card p-5">
              <p className="text-[14px] leading-relaxed text-stone-600">
                前往不同城市放松身心，触发专属旅行日记。独行或与艺人同行，好感与声望均可能变化。
              </p>
              <Pressable
                disabled={!canAct() || busy}
                onClick={() => setTravelOpen(true)}
                className="sm-btn-primary mt-5 w-full text-center text-[15px] disabled:opacity-40"
              >
                规划行程
              </Pressable>
            </div>

            <div className="sm-list-stack">
              {TRAVEL_DESTINATIONS.map((d) => (
                <div key={d.id} className="sm-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-[15px] font-medium text-stone-800">{d.name}</h4>
                    <span className="text-[12px] text-stone-500">
                      <SimNum>{d.days}</SimNum> 日
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] text-stone-500">
                    预算 <SimFunds amount={d.cost} />
                  </p>
                </div>
              ))}
            </div>
          </TabSection>
        )}
      </TabScrollPage>

      {travelOpen && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/25 px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] sm:items-center">
          <div className="sm-card max-h-[85vh] w-full max-w-sm overflow-y-auto p-5">
            <h3 className="sm-serif text-[17px] font-semibold">选择目的地</h3>
            <div className="mt-4 space-y-3">
              {TRAVEL_DESTINATIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDestId(d.id)}
                  className={`w-full rounded-xl px-4 py-3.5 text-left text-[14px] leading-relaxed ${
                    destId === d.id ? 'bg-rose-100 text-rose-700' : 'bg-white text-stone-700 ring-1 ring-rose-50'
                  }`}
                >
                  {d.name} · <SimNum>{d.days}</SimNum>日 · <SimFunds amount={d.cost} />
                </button>
              ))}
            </div>
            <p className="mt-5 text-[12px] text-stone-500">同行艺人</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCompanionId(null)}
                className={`rounded-full px-4 py-2 text-[13px] ${
                  !companionId ? 'bg-rose-400 text-white' : 'bg-white ring-1 ring-rose-100'
                }`}
              >
                独行
              </button>
              {artists.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setCompanionId(a.id)}
                  className={`rounded-full px-4 py-2 text-[13px] ${
                    companionId === a.id ? 'bg-rose-400 text-white' : 'bg-white ring-1 ring-rose-100'
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <Pressable onClick={() => setTravelOpen(false)} className="sm-btn-ghost w-full py-3 text-[15px]">
                取消
              </Pressable>
              <Pressable
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  const ok = await startTravel(destId, companionId, mainApi)
                  setBusy(false)
                  if (ok) setTravelOpen(false)
                }}
                className="sm-btn-primary w-full py-3 text-[15px] disabled:opacity-40"
              >
                出发
              </Pressable>
            </div>
          </div>
        </div>
      )}

      {travelDiary && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/30 px-4">
          <div className="sm-card max-h-[80%] w-full max-w-sm overflow-y-auto p-5">
            <h3 className="sm-serif text-[18px] font-semibold">{travelDiary.title}</h3>
            <div className="mt-4 space-y-4">
              {travelDiary.lines.map((line, i) => (
                <p key={i} className="sm-serif text-[15px] leading-[1.85] text-stone-700">
                  <SimNumText text={line} />
                </p>
              ))}
            </div>
            <Pressable onClick={clearTravelDiary} className="sm-btn-primary mt-6 w-full py-3 text-[15px]">
              合上日记
            </Pressable>
          </div>
        </div>
      )}
    </div>
  )
}
