import { AnimatePresence, motion } from 'framer-motion'
import { Compass, Heart, MessageCircle, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Pressable } from '../../components/Pressable'
import { AppIconTile } from '../../components/AppIconTile'
import { useCustomization } from '../../CustomizationContext'
import type { AppSlot } from '../../types'
import { DiscoverFeed } from './DiscoverFeed'
import { EncounterChats } from './EncounterChats'
import { LumiMeetProvider } from './LumiMeetStore'
import { MyProfile } from './MyProfile'
import { MatchDashboard } from './MatchDashboard'
import './lumiMeetPlatinum.css'
import { LUMI_MEET_ROOT_ID } from './lumiMeetPortal'

type TabId = 'discover' | 'match' | 'chats' | 'me'

const TABS: { id: TabId; zh: string; en: string; icon: typeof Compass }[] = [
  { id: 'discover', zh: '广场', en: 'DISCOVER', icon: Compass },
  { id: 'match', zh: '遇见', en: 'MATCH', icon: Heart },
  { id: 'chats', zh: '消息', en: 'CHATS', icon: MessageCircle },
  { id: 'me', zh: '我的', en: 'ME', icon: UserRound },
]

function LumiMeetShell({ onBack }: { onBack: () => void }) {
  const { state, themeStyle } = useCustomization()
  const pageStyle = state.appPageStyles.lumiMeet
  const [tab, setTab] = useState<TabId>('match')

  const title = useMemo(() => state.apps.find((a) => a.id === 'lumiMeet')?.label ?? '遇见', [state.apps])

  const body = useMemo(() => {
    switch (tab) {
      case 'discover':
        return <DiscoverFeed />
      case 'match':
        return <MatchDashboard />
      case 'chats':
        return <EncounterChats />
      case 'me':
        return <MyProfile />
      default:
        return null
    }
  }, [tab])

  return (
    <div
      id={LUMI_MEET_ROOT_ID}
      className="relative flex h-full min-h-0 flex-col bg-[#f7f6f3]"
      data-phone-page="app"
      data-app-id="lumiMeet"
      style={{
        ...themeStyle,
        backgroundColor: pageStyle?.pageBg ?? '#f7f6f3',
        fontFamily: 'var(--phone-font)',
      }}
    >
      <header
        className="flex shrink-0 items-center gap-2 px-3 pb-2"
        style={{
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
          backgroundColor: pageStyle?.headerBg ?? 'rgba(255,255,255,0.94)',
          color: pageStyle?.headerText ?? '#2c2a26',
        }}
      >
        <Pressable
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full opacity-80"
          aria-label="返回桌面"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <AppIconTile appId={'lumiMeet' as AppSlot['id']} bgSize={46} glyphSize={30} radius={13} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-medium tracking-[0.06em]" style={{ color: pageStyle?.headerText }}>
            {title}
          </h1>
          <p className="meet-caption-en truncate text-[9px] uppercase tracking-[0.42em] opacity-55">Lumi Meet · Platinum</p>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">{body}</div>

      <nav
        className="shrink-0 border-t border-black/[0.05] bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md"
        aria-label="遇见主导航"
      >
        <ul className="flex items-stretch justify-between gap-1">
          {TABS.map((t) => {
            const active = tab === t.id
            const Icon = t.icon
            return (
              <li key={t.id} className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="flex w-full flex-col items-center gap-0.5 rounded-[14px] py-2 transition-colors"
                  style={{
                    color: active ? '#5c534c' : '#b4aea6',
                    backgroundColor: active ? 'rgba(235,228,218,0.55)' : 'transparent',
                  }}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 1.65 : 1.35} />
                  <span className="truncate text-[11px] font-light">{t.zh}</span>
                  <span className="meet-caption-en truncate text-[8px] tracking-[0.22em] opacity-70">{t.en}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

export function LumiMeetApp({ onBack }: { onBack: () => void }) {
  const { state } = useCustomization()
  const hint = useMemo(
    () => ({
      displayName: state.profile.displayName?.trim() || '',
    }),
    [state.profile.displayName],
  )

  return (
    <LumiMeetProvider phoneProfileHint={hint}>
      <AnimatePresence mode="wait">
        <motion.div
          key="meet-root"
          initial={{ opacity: 0.92 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.9 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="h-full min-h-0"
        >
          <LumiMeetShell onBack={onBack} />
        </motion.div>
      </AnimatePresence>
    </LumiMeetProvider>
  )
}
