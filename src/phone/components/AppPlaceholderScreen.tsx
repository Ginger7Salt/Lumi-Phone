import type { AppSlot } from '../types'
import { AppIconTile } from './AppIconTile'
import { Pressable } from './Pressable'
import { useCustomization } from '../CustomizationContext'

type Props = {
  appId: AppSlot['id']
  onBack: () => void
  /** 主文案；不传则用默认占位说明 */
  message?: string
  /** 补充说明（较小字号） */
  hint?: string
}

export function AppPlaceholderScreen({ appId, onBack, message, hint }: Props) {
  const { state } = useCustomization()
  const app = state.apps.find((a) => a.id === appId)
  const { theme, appPageStyles } = state
  const pageStyle = appPageStyles[appId]
  const title = app?.label ?? '应用'

  return (
    <div
      className="flex h-full flex-col"
      data-phone-page="app"
      data-app-id={appId}
      style={{
        backgroundColor: pageStyle?.pageBg || 'var(--phone-bg)',
        backgroundImage: pageStyle?.pageBgImageUrl ? `url(${pageStyle.pageBgImageUrl})` : 'none',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        fontFamily: pageStyle?.fontFamily || 'var(--phone-font)',
      }}
    >
      <header
        className="flex shrink-0 items-center gap-2 px-3 pb-2"
        style={{
          borderBottom: `1px solid ${theme.border}`,
          paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
          backgroundColor: pageStyle?.headerBg || theme.surface,
          backgroundImage: pageStyle?.headerBgImageUrl ? `url(${pageStyle.headerBgImageUrl})` : 'none',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
        }}
      >
        <Pressable
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ color: pageStyle?.headerText || theme.text }}
          aria-label="返回桌面"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <AppIconTile appId={appId} bgSize={50} glyphSize={32} radius={13} />
          <h1 className="truncate text-[15px] font-semibold" style={{ color: pageStyle?.headerText || theme.text }}>
            {title}
          </h1>
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-6">
        <section
          className="w-full max-w-[320px] rounded-[18px] border p-5 text-center"
          style={{
            backgroundColor: pageStyle?.cardBg || theme.surface,
            backgroundImage: pageStyle?.cardBgImageUrl ? `url(${pageStyle.cardBgImageUrl})` : 'none',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
            borderColor: theme.border,
            boxShadow: 'var(--phone-shadow)',
          }}
        >
          <p className="text-[14px] leading-relaxed" style={{ color: theme.textMuted }}>
            {message ?? '此页面为占位，后续可接入真实功能或后端。'}
          </p>
          {hint ? (
            <p className="mt-3 text-[12px] leading-relaxed opacity-90" style={{ color: theme.textMuted }}>
              {hint}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
