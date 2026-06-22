import { motion } from 'framer-motion'
import { useState } from 'react'
import { getMbtiTagline4 } from '../../../wechat/newFriendsPersona/mbtiProfileUi'
import { Pressable } from '../../../../components/Pressable'
import { useCurrentApiConfig } from '../../../api/ApiSettingsContext'
import { computeArtistSentiment } from '../artistProfileData'
import { ArtistAvatar } from '../components/ArtistAvatar'
import { HexRadarChart } from '../components/HexRadarChart'
import { SubTabBar } from '../components/SubTabBar'
import { formatFans, SimFunds, SimNum, SimNumText } from '../components/SimNum'
import {
  FAN_REVIEW_TONE_LABELS,
  GIG_STATUS_LABELS,
  GIG_TYPE_LABELS,
  ROMANCE_LABELS,
  STAT_LABELS,
  type Artist,
  type ArtistGig,
  type ArtistStatKey,
} from '../types'
import { useSimulatorStore } from '../useSimulatorStore'

const STAT_KEYS: ArtistStatKey[] = ['vocal', 'acting', 'variety', 'charm', 'stamina', 'commercial']

type DetailSubTab = 'stats' | 'gigs' | 'sentiment'

const DETAIL_TABS = [
  { id: 'stats' as const, label: '能力' },
  { id: 'gigs' as const, label: '行程' },
  { id: 'sentiment' as const, label: '舆情' },
]

function SentimentBar({
  label,
  ratio,
  colorClass,
}: {
  label: string
  ratio: number
  colorClass: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="text-stone-600">{label}</span>
        <SimNum className="font-medium text-stone-800">{ratio}%</SimNum>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-rose-100">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${ratio}%` }} />
      </div>
    </div>
  )
}

function GigRewardPanel({ gig }: { gig: ArtistGig }) {
  const rewards = gig.rewards
  if (!rewards) return null

  const done = gig.status === 'done'
  const { company, artist: artistReward } = rewards

  return (
    <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2.5">
      <p className="text-[11px] font-medium tracking-[0.06em] text-rose-500">
        {done ? '已获得增益' : '完成后预计增益'}
      </p>
      <div className="mt-2 space-y-2 text-[12px] leading-relaxed text-stone-700">
        <div>
          <span className="text-stone-500">公司 · </span>
          资金 <SimFunds amount={company.funds} className="text-emerald-700" />
          <span className="text-stone-300"> · </span>
          声望 <SimNum className="text-rose-600">+{company.reputation}</SimNum>
        </div>
        <div>
          <span className="text-stone-500">艺人 · </span>
          粉丝 <SimNum className="text-rose-600">+{formatFans(artistReward.fans)}</SimNum>
          {artistReward.affection ? (
            <>
              <span className="text-stone-300"> · </span>
              好感 <SimNum className="text-rose-600">+{artistReward.affection}</SimNum>
            </>
          ) : null}
          {artistReward.statKey && artistReward.statDelta ? (
            <>
              <span className="text-stone-300"> · </span>
              {STAT_LABELS[artistReward.statKey]}{' '}
              <SimNum className="text-rose-600">+{artistReward.statDelta}</SimNum>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function ArtistDetailSheet({ artist, onClose }: { artist: Artist; onClose: () => void }) {
  const mainApi = useCurrentApiConfig('chatCard')
  const canAct = useSimulatorStore((s) => s.canAct)
  const trainArtist = useSimulatorStore((s) => s.trainArtist)
  const visitSet = useSimulatorStore((s) => s.visitSet)

  const [subTab, setSubTab] = useState<DetailSubTab>('stats')
  const [trainStat, setTrainStat] = useState<ArtistStatKey>('acting')
  const [busy, setBusy] = useState(false)

  const gigs = artist.gigs ?? []
  const reviews = artist.fanReviews ?? []
  const sentiment = computeArtistSentiment(artist)

  return (
    <motion.div
      className="absolute inset-0 z-[100] flex min-h-0 flex-col bg-gradient-to-b from-[#FFFBFB] to-[#FFF5F7]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-rose-100 px-4 pb-3 pt-[max(10px,env(safe-area-inset-top,0px))]">
        <ArtistAvatar artist={artist} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="sm-serif truncate text-[18px] font-semibold text-[#2D2422]">{artist.name}</h2>
          <p className="truncate text-[12px] text-stone-500">{getMbtiTagline4(artist.mbti)}</p>
        </div>
        <Pressable onClick={onClose} className="flex h-9 w-9 items-center justify-center text-stone-600" aria-label="关闭">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
      </div>

      <SubTabBar tabs={DETAIL_TABS} active={subTab} onChange={setSubTab} />

      <div className="sm-tab-scroll min-h-0 flex-1">
        <div className="sm-tab-scroll-inner space-y-4">
          {subTab === 'stats' && (
            <>
              <div className="sm-card p-5">
                <div className="flex flex-wrap gap-1.5">
                  {artist.tags.map((t) => (
                    <span key={t} className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] text-rose-600">
                      {t}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex justify-center">
                  <HexRadarChart stats={artist.stats} axes={STAT_KEYS} labels={STAT_LABELS} size={148} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[11px] text-stone-500">粉丝</p>
                    <p className="mt-1 text-[14px] text-stone-800">
                      <SimNum>{formatFans(artist.fans)}</SimNum>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-500">好感</p>
                    <p className="mt-1 text-[14px] text-rose-500">
                      <SimNum>{artist.affection}</SimNum>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-500">关系</p>
                    <p className="mt-1 text-[12px] text-stone-700">{ROMANCE_LABELS[artist.status]}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {STAT_KEYS.map((k) => (
                    <div key={k} className="flex items-center gap-3">
                      <span className="w-14 text-[11px] text-stone-500">{STAT_LABELS[k]}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rose-100">
                        <div className="h-full rounded-full bg-rose-400" style={{ width: `${artist.stats[k]}%` }} />
                      </div>
                      <SimNum className="w-6 text-right text-[11px]">{artist.stats[k]}</SimNum>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sm-card p-4">
                <p className="text-[13px] font-medium text-[#2D2422]">培养</p>
                <div className="sm-chip-row mt-3">
                  {STAT_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTrainStat(k)}
                      className={`rounded-full px-4 py-2 text-[13px] ${
                        trainStat === k ? 'bg-rose-400 text-white' : 'bg-white text-stone-600 ring-1 ring-rose-100'
                      }`}
                    >
                      {STAT_LABELS[k]}
                    </button>
                  ))}
                </div>
                <div className="sm-action-stack mt-3">
                  <Pressable
                    disabled={!canAct() || busy}
                    onClick={() => {
                      if (trainArtist(artist.id, trainStat)) setBusy(false)
                    }}
                    className="sm-btn-primary w-full text-center text-[15px] disabled:opacity-40"
                  >
                    安排培训
                  </Pressable>
                  <Pressable
                    disabled={!canAct() || busy}
                    onClick={async () => {
                      setBusy(true)
                      await visitSet(artist.id, mainApi)
                      setBusy(false)
                    }}
                    className="sm-btn-ghost w-full text-center text-[15px] disabled:opacity-40"
                  >
                    剧组探班
                  </Pressable>
                </div>
              </div>
            </>
          )}

          {subTab === 'gigs' && (
            <div className="space-y-2.5">
              {gigs.length === 0 ? (
                <div className="sm-card p-8 text-center text-[14px] text-stone-500">暂无通告行程</div>
              ) : (
                gigs.map((gig) => (
                  <div key={gig.id} className="sm-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[15px] font-medium leading-snug text-[#2D2422]">{gig.title}</p>
                      <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-600">
                        {GIG_TYPE_LABELS[gig.type]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-stone-500">
                      <SimNumText text={gig.dateLabel} />
                      <span className="text-stone-300">·</span>
                      <span className="text-rose-600">{GIG_STATUS_LABELS[gig.status]}</span>
                    </div>
                    <GigRewardPanel gig={gig} />
                  </div>
                ))
              )}
            </div>
          )}

          {subTab === 'sentiment' && (
            <>
              <div className="sm-card p-4">
                <p className="text-[13px] font-medium text-[#2D2422]">粉丝舆论占比</p>
                <div className="mt-4 space-y-3">
                  <SentimentBar label="粉丝" ratio={sentiment.fanRatio} colorClass="bg-rose-400" />
                  <SentimentBar label="路人" ratio={sentiment.neutralRatio} colorClass="bg-stone-300" />
                  <SentimentBar label="黑粉" ratio={sentiment.antiRatio} colorClass="bg-stone-600" />
                </div>
              </div>

              <div className="space-y-2.5">
                <p className="px-1 text-[12px] text-stone-500">粉丝评价</p>
                {reviews.map((r) => (
                  <div key={r.id} className="sm-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-stone-700">{r.author}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          r.tone === 'praise'
                            ? 'bg-rose-50 text-rose-600'
                            : r.tone === 'anti'
                              ? 'bg-stone-100 text-stone-600'
                              : 'bg-stone-50 text-stone-500'
                        }`}
                      >
                        {FAN_REVIEW_TONE_LABELS[r.tone]}
                      </span>
                    </div>
                    <p className="mt-2 text-[14px] leading-relaxed text-stone-700">{r.content}</p>
                    <p className="mt-2 text-[11px] text-stone-400">
                      <SimNum>{r.likes}</SimNum> 赞
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
