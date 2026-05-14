import { Construction } from 'lucide-react'
import { useMemo } from 'react'
import { Pressable } from '../../components/Pressable'
import { AppIconTile } from '../../components/AppIconTile'
import { useCustomization } from '../../CustomizationContext'
import type { AppSlot } from '../../types'
import './lumiMeetPlatinum.css'
import { LUMI_MEET_ROOT_ID } from './lumiMeetPortal'

/**
 * 遇见（Lumi Meet）暂为「开发中」占位；完整广场 / 匹配 / 会话等入口恢复时再接回各子模块。
 */
export function LumiMeetApp({ onBack }: { onBack: () => void }) {
  const { state, themeStyle } = useCustomization()
  const pageStyle = state.appPageStyles.lumiMeet
  const title = useMemo(() => state.apps.find((a) => a.id === 'lumiMeet')?.label ?? '遇见', [state.apps])

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
          <p className="meet-caption-en truncate text-[9px] uppercase tracking-[0.42em] opacity-55">Lumi Meet</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 pb-16 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(235,228,218,0.75)', color: '#8a8278' }}
          aria-hidden
        >
          <Construction className="size-8" strokeWidth={1.35} />
        </div>
        <div>
          <p className="text-[17px] font-medium" style={{ color: pageStyle?.headerText ?? '#2c2a26' }}>
            正在开发中
          </p>
          <p className="mt-2 text-[14px] leading-relaxed opacity-65" style={{ color: pageStyle?.headerText ?? '#2c2a26' }}>
            该功能尚未开放，敬请期待后续版本。
          </p>
        </div>
      </div>
    </div>
  )
}
