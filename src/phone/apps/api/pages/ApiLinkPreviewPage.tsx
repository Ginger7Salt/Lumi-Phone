import { useNavigate } from 'react-router-dom'

import { useApiSettings } from '../ApiSettingsContext'
import { ApiLinkPreviewSection } from '../components/ApiLinkPreviewSection'
import { TopNav } from '../components/TopNav'
import { LINK_PREVIEW_FEATURE_TITLE } from '../linkPreviewDisplayLabels'
import { apiTheme } from '../theme'

export function ApiLinkPreviewPage() {
  const nav = useNavigate()
  const { linkPreview, setLinkPreviewSettings } = useApiSettings()

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      style={{ background: apiTheme.bg, fontFamily: apiTheme.font }}
    >
      <TopNav title={LINK_PREVIEW_FEATURE_TITLE} onBack={() => nav('/')} />
      <div className="min-h-0 flex-1 overflow-y-auto px-0 pb-[calc(24px+env(safe-area-inset-bottom,0px))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <ApiLinkPreviewSection
          layout="page"
          settings={linkPreview}
          onChange={setLinkPreviewSettings}
        />
      </div>
    </div>
  )
}
