import { useState } from 'react'
import { getMbtiTagline4 } from '../../../wechat/newFriendsPersona/mbtiProfileUi'
import { HexRadarChart } from '../components/HexRadarChart'
import { SubTabBar } from '../components/SubTabBar'
import { TabScrollPage, TabSection } from '../components/TabScrollPage'
import { SimNum } from '../components/SimNum'
import {
  IDENTITY_TIERS,
  isIdentityUnlocked,
  PLAYER_STAT_KEYS,
  PLAYER_STAT_LABELS,
  playerStatAvg,
  PR_STYLE_LABELS,
  resolveIdentityTier,
  resolveNextIdentityTier,
  ROMANCE_STYLE_LABELS,
  normalizePlayerStats,
} from '../playerCareer'
import { useSimulatorStore } from '../useSimulatorStore'

type ProfileSubTab = 'bio' | 'stats' | 'career'

const PROFILE_SUB_TABS = [
  { id: 'bio' as const, label: '档案' },
  { id: 'stats' as const, label: '能力' },
  { id: 'career' as const, label: '身份' },
]

export function ProfileTab() {
  const player = useSimulatorStore((s) => s.player)
  const reputation = useSimulatorStore((s) => s.reputation)
  const totalDays = useSimulatorStore((s) => s.totalDays)
  const gameYear = useSimulatorStore((s) => s.gameYear)
  const [subTab, setSubTab] = useState<ProfileSubTab>('bio')

  if (!player) {
    return (
      <TabScrollPage>
        <p className="py-16 text-center text-[14px] text-stone-500">完成序章后即可查看个人档案</p>
      </TabScrollPage>
    )
  }

  const stats = normalizePlayerStats(player.stats)
  const avg = playerStatAvg(stats)
  const identity = resolveIdentityTier(stats, reputation)
  const nextIdentity = resolveNextIdentityTier(stats, reputation)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SubTabBar tabs={PROFILE_SUB_TABS} active={subTab} onChange={setSubTab} />

      <TabScrollPage>
        {subTab === 'bio' && (
          <>
            <div className="sm-card p-5">
              <div className="flex items-start gap-4">
                <div className="sm-artist-avatar flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold">
                  {player.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="sm-serif text-[20px] font-semibold text-[#2D2422]">{player.name}</h2>
                  <p className="mt-1 text-[12px] text-stone-500">{getMbtiTagline4(player.mbti)}</p>
                  <p className="mt-2 text-[12px] text-stone-500">
                    生日 <SimNum>{player.birthdayMD}</SimNum>
                  </p>
                </div>
              </div>
            </div>

            <TabSection title="经纪履历">
              <div className="sm-card grid grid-cols-2 gap-4 p-5 text-center">
                <div>
                  <p className="text-[11px] text-stone-500">入行</p>
                  <p className="mt-1 text-[16px] text-stone-800">
                    第<SimNum>{gameYear}</SimNum>年
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-stone-500">累计天数</p>
                  <p className="mt-1 text-[16px] text-stone-800">
                    <SimNum>{totalDays}</SimNum> 天
                  </p>
                </div>
              </div>
            </TabSection>

            <TabSection title="行事风格">
              <div className="sm-card flex flex-wrap gap-2 p-5">
                <span className="rounded-full bg-rose-50 px-4 py-2 text-[13px] text-rose-700 ring-1 ring-rose-100">
                  {PR_STYLE_LABELS[player.prStyle]}
                </span>
                <span className="rounded-full bg-rose-50 px-4 py-2 text-[13px] text-rose-700 ring-1 ring-rose-100">
                  {ROMANCE_STYLE_LABELS[player.romanceStyle]}
                </span>
              </div>
            </TabSection>
          </>
        )}

        {subTab === 'stats' && (
          <>
            <div className="sm-card rounded-2xl bg-gradient-to-r from-rose-50 to-pink-50 px-4 py-3 ring-1 ring-rose-100">
              <p className="text-[11px] tracking-[0.16em] text-rose-400">当前身份</p>
              <p className="sm-serif mt-1 text-[17px] font-semibold text-rose-700">{identity.title}</p>
            </div>

            <TabSection title="个人能力" hint="通过行程行动逐步提升">
              <div className="sm-card p-5">
                <div className="flex justify-center py-2">
                  <HexRadarChart
                    stats={stats}
                    axes={PLAYER_STAT_KEYS}
                    labels={PLAYER_STAT_LABELS}
                    size={220}
                  />
                </div>
                <div className="mt-4 space-y-3">
                  {PLAYER_STAT_KEYS.map((key) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-10 text-[11px] text-stone-500">{PLAYER_STAT_LABELS[key]}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rose-100">
                        <div
                          className="h-full rounded-full bg-rose-400"
                          style={{ width: `${stats[key]}%` }}
                        />
                      </div>
                      <SimNum className="w-6 text-right text-[11px] text-stone-700">{stats[key]}</SimNum>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-center text-[12px] text-stone-500">
                  综合均值 <SimNum className="text-rose-500">{Math.round(avg)}</SimNum>
                </p>
              </div>
            </TabSection>

            <TabSection title="成长提示">
              <div className="sm-card space-y-3 p-5 text-[13px] leading-relaxed text-stone-600">
                <p>· 舆论宣发、招募艺人 → 公关 · 资源</p>
                <p>· 洽谈通告、安排培训 → 口才 · 精力</p>
                <p>· 探班、约会、旅行 → 魅力 · 洞察</p>
              </div>
            </TabSection>
          </>
        )}

        {subTab === 'career' && (
          <>
            <div className="sm-card p-5">
              <p className="text-[11px] tracking-[0.16em] text-rose-400">当前身份</p>
              <p className="sm-serif mt-1 text-[18px] font-semibold text-rose-700">{identity.title}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-stone-600">{identity.desc}</p>
            </div>

            {nextIdentity ? (
              <TabSection title="晋升进度" hint={`下一阶：${nextIdentity.title}`}>
                <div className="sm-card space-y-4 p-5">
                  <div>
                    <div className="mb-1.5 flex justify-between text-[12px] text-stone-600">
                      <span>能力均值</span>
                      <span>
                        <SimNum>{Math.round(avg)}</SimNum> / <SimNum>{nextIdentity.minAvg}</SimNum>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-rose-100">
                      <div
                        className="h-full rounded-full bg-rose-400"
                        style={{ width: `${Math.min(100, (avg / nextIdentity.minAvg) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex justify-between text-[12px] text-stone-600">
                      <span>公司声望</span>
                      <span>
                        <SimNum>{reputation}</SimNum> / <SimNum>{nextIdentity.minReputation}</SimNum>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-rose-100">
                      <div
                        className="h-full rounded-full bg-rose-400"
                        style={{ width: `${Math.min(100, (reputation / nextIdentity.minReputation) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </TabSection>
            ) : (
              <TabSection title="晋升进度">
                <div className="sm-card p-5 text-[13px] leading-relaxed text-stone-600">
                  已达最高身份「{identity.title}」，继续书写你的传奇吧。
                </div>
              </TabSection>
            )}

            <TabSection title="身份阶梯" hint="能力与声望同时达标后自动晋升">
              <div className="sm-list-stack">
                {IDENTITY_TIERS.map((tier) => {
                  const unlocked = isIdentityUnlocked(stats, reputation, tier)
                  const current = tier.id === identity.id
                  return (
                    <div
                      key={tier.id}
                      className={`sm-card p-4 ${current ? 'ring-2 ring-rose-300' : ''} ${!unlocked ? 'opacity-55' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h4 className={`text-[15px] font-medium ${current ? 'text-rose-700' : 'text-stone-800'}`}>
                          {tier.title}
                        </h4>
                        <span className="shrink-0 text-[11px] text-stone-400">
                          {unlocked ? (current ? '当前' : '已解锁') : '未解锁'}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-stone-500">{tier.desc}</p>
                      {!unlocked && tier.minAvg > 0 ? (
                        <p className="mt-2 text-[11px] text-stone-400">
                          需能力均值 ≥ <SimNum>{tier.minAvg}</SimNum>，声望 ≥ <SimNum>{tier.minReputation}</SimNum>
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </TabSection>
          </>
        )}
      </TabScrollPage>
    </div>
  )
}
