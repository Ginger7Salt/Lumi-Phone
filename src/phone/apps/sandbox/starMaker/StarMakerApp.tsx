import { AnimatePresence, motion } from 'framer-motion'
import { Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { Pressable } from '../../../components/Pressable'
import { useCustomization } from '../../../CustomizationContext'
import { ApiSetupSheet } from './ApiSetupSheet'
import { PrologueQuiz } from './PrologueQuiz'
import { Chronograph, GlassTabBar } from './components/Chronograph'
import { CompanyStatusBar } from './components/CompanyStatusBar'
import { NewDayNoticeBar } from './components/NewDayNoticeBar'
import { SaveLoadControls, SaveLoadToast } from './components/SaveLoadControls'
import { PeriodBackdrop } from './components/PeriodBackdrop'
import { ScheduleActionFab } from './components/ScheduleActionFab'
import { StatDeltaLayer } from './components/StatDeltaLayer'
import './starMakerTheme.css'
import { AssetsTab } from './tabs/AssetsTab'
import { ProfileTab } from './tabs/ProfileTab'
import { RosterTab } from './tabs/RosterTab'
import { ScheduleTab } from './tabs/ScheduleTab'
import { SocialTab } from './tabs/SocialTab'
import type { SimTab } from './types'
import { useSimulatorStore } from './useSimulatorStore'
import { AwardCeremonyOverlay } from './views/AwardCeremonyOverlay'
import { BirthdayEventOverlay } from './views/BirthdayEventOverlay'
import { DramaEventOverlay } from './views/DramaEventOverlay'
import { ProducerChatRoom } from './views/ProducerChatRoom'
import { SaveArchiveSheet } from './views/SaveArchiveSheet'

export function StarMakerApp({ onBack }: { onBack: () => void }) {
  const { themeStyle } = useCustomization()
  const hydrated = useSimulatorStore((s) => s.hydrated)
  const prologueDone = useSimulatorStore((s) => s.prologueDone)
  const hydrate = useSimulatorStore((s) => s.hydrate)
  const sessionEpoch = useSimulatorStore((s) => s.sessionEpoch)
  const chatRoomArtistId = useSimulatorStore((s) => s.chatRoomArtistId)
  const closeChatRoom = useSimulatorStore((s) => s.closeChatRoom)
  const artists = useSimulatorStore((s) => s.artists)
  const chatArtist = artists.find((a) => a.id === chatRoomArtistId)
  const mainApi = useCurrentApiConfig('chatCard')
  const [tab, setTab] = useState<SimTab>('schedule')
  const [apiOpen, setApiOpen] = useState(false)
  const [saveToast, setSaveToast] = useState<string | null>(null)
  const [archiveMode, setArchiveMode] = useState<'save' | 'load' | null>(null)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!saveToast) return
    const timer = window.setTimeout(() => setSaveToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [saveToast])

  return (
    <div
      className="sm-star-maker-root relative flex h-full min-h-0 flex-col overflow-hidden"
      data-phone-page="app"
      data-app-id="star-maker"
      style={{
        ...themeStyle,
        backgroundColor: '#FFFBFB',
        color: '#2D2422',
        fontFamily: 'var(--phone-font)',
      }}
    >
      <header className="relative z-20 flex shrink-0 items-center gap-1.5 px-3 pb-1 pt-[max(8px,env(safe-area-inset-top,0px))]">
        <Pressable onClick={onBack} className="flex h-9 w-9 shrink-0 items-center justify-center text-stone-600" aria-label="返回幻境">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-rose-400">幻境应用</p>
          <h1 className="sm-serif truncate text-[16px] font-semibold">金牌制作人</h1>
        </div>
        <SaveLoadControls onOpenArchive={setArchiveMode} onToast={setSaveToast} />
        {prologueDone && (
          <Pressable onClick={() => setApiOpen(true)} className="flex h-9 w-9 shrink-0 items-center justify-center text-stone-500" aria-label="设置">
            <Settings2 size={17} strokeWidth={1.5} />
          </Pressable>
        )}
        <SaveLoadToast message={saveToast} />
      </header>

      {hydrated && prologueDone ? <CompanyStatusBar /> : null}

      {!hydrated ? (
        <div className="flex flex-1 items-center justify-center text-[14px] text-stone-500">载入中…</div>
      ) : !prologueDone ? (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <PrologueQuiz key={sessionEpoch} />
        </div>
      ) : (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <PeriodBackdrop />
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <Chronograph />
            <NewDayNoticeBar />
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 h-full w-full"
                >
                  {tab === 'schedule' && <ScheduleTab />}
                  {tab === 'roster' && <RosterTab />}
                  {tab === 'social' && <SocialTab />}
                  {tab === 'assets' && <AssetsTab />}
                  {tab === 'profile' && <ProfileTab />}
                </motion.div>
              </AnimatePresence>
              <StatDeltaLayer />
              <DramaEventOverlay />
              <AwardCeremonyOverlay />
              <BirthdayEventOverlay />
            </div>
            <ScheduleActionFab mainApi={mainApi} />
            <GlassTabBar tab={tab} onTab={setTab} />
          </div>
        </div>
      )}

      {apiOpen && <ApiSetupSheet onClose={() => setApiOpen(false)} />}

      <AnimatePresence>
        {archiveMode && (
          <SaveArchiveSheet
            key={archiveMode}
            mode={archiveMode}
            onClose={() => setArchiveMode(null)}
            onDone={setSaveToast}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatArtist && (
          <ProducerChatRoom
            key={chatArtist.id}
            artist={chatArtist}
            mainApi={mainApi}
            onBack={closeChatRoom}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
