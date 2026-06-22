import { useState } from 'react'
import { Pressable } from '../../../../components/Pressable'
import { TabScrollPage, TabSection } from '../components/TabScrollPage'
import { DATE_AFFECTION_THRESHOLD, ROMANCE_LABELS } from '../types'
import { useSimulatorStore } from '../useSimulatorStore'
import { SimNum } from '../components/SimNum'
import { DateOverlay } from '../views/DateOverlay'

export function SocialTab() {
  const artists = useSimulatorStore((s) => s.artists)
  const selectedArtistId = useSimulatorStore((s) => s.selectedArtistId)
  const selectArtist = useSimulatorStore((s) => s.selectArtist)
  const startDate = useSimulatorStore((s) => s.startDate)
  const isDateUnlocked = useSimulatorStore((s) => s.isDateUnlocked)
  const canAct = useSimulatorStore((s) => s.canAct)
  const openChatRoom = useSimulatorStore((s) => s.openChatRoom)

  const [dateStory, setDateStory] = useState<{ title: string; lines: string[] } | null>(null)

  const artist = artists.find((a) => a.id === selectedArtistId) ?? artists[0]

  if (!artist) {
    return (
      <TabScrollPage>
        <p className="py-16 text-center text-[14px] text-stone-500">尚无艺人可联络</p>
      </TabScrollPage>
    )
  }

  const dateReady = isDateUnlocked(artist.id)
  const secretCount = artists.filter((a) => a.status === 'secret_dating').length

  return (
    <TabScrollPage>
      <div className="sm-chip-row">
        {artists.map((a) => (
          <Pressable
            key={a.id}
            onClick={() => selectArtist(a.id)}
            className={`rounded-full px-4 py-2 text-[13px] ${
              a.id === artist.id ? 'bg-rose-400 text-white' : 'bg-white text-stone-600 ring-1 ring-rose-100'
            }`}
          >
            {a.name}
          </Pressable>
        ))}
      </div>

      {secretCount >= 2 && (
        <div className="sm-card border-rose-300/50 bg-rose-50/80 px-5 py-4">
          <p className="sm-serif text-[14px] text-rose-700">修罗场预警</p>
          <p className="mt-2 text-[13px] leading-relaxed text-rose-600/90">
            你与多位艺人保持地下恋，下一次行动后极易触发对峙事件。
          </p>
        </div>
      )}

      <div className="sm-card p-5">
        <div className="flex items-center gap-4">
          <div className="sm-artist-avatar flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-semibold">
            {artist.name.slice(0, 1)}
          </div>
          <div>
            <h3 className="sm-serif text-[18px] font-semibold text-[#2D2422]">{artist.name}</h3>
            <p className="mt-1 text-[12px] text-stone-500">
              好感 <SimNum className="text-rose-500">{artist.affection}</SimNum> ·{' '}
              {ROMANCE_LABELS[artist.status]}
            </p>
            {artist.status === 'secret_dating' && artist.resentment > 30 && (
              <p className="mt-1 text-[11px] text-rose-500">幽怨值偏高，请多联络</p>
            )}
          </div>
        </div>
        <p className="mt-4 text-[14px] leading-relaxed text-stone-600">{artist.personaSummary}</p>
      </div>

      <TabSection title="联络">
        <div className="sm-action-stack">
          <Pressable onClick={() => openChatRoom(artist.id)} className="sm-btn-primary w-full text-center text-[15px]">
            线上闲聊
          </Pressable>
          <Pressable
            disabled={!dateReady || !canAct()}
            onClick={() => {
              const story = startDate(artist.id)
              if (story) setDateStory(story)
            }}
            className="sm-btn-ghost w-full text-center text-[15px] disabled:opacity-40"
          >
            <span className="block">专属约会</span>
            <span className="mt-1 block text-[11px] text-stone-500">
              {dateReady ? '已解锁' : (
                <>
                  好感需达 <SimNum>{DATE_AFFECTION_THRESHOLD}</SimNum>
                </>
              )}
            </span>
          </Pressable>
        </div>
      </TabSection>

      {dateStory && (
        <DateOverlay title={dateStory.title} lines={dateStory.lines} onClose={() => setDateStory(null)} />
      )}
    </TabScrollPage>
  )
}
