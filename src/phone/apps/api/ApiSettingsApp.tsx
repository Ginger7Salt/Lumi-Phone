import { useEffect } from 'react'
import { MemoryRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useApiSettings } from './ApiSettingsContext'
import { API_LINK_PREVIEW_ROUTE } from './linkPreviewDisplayLabels'
import { ApiLinkPreviewPage } from './pages/ApiLinkPreviewPage'
import { ApiSettingsHomePage } from './pages/ApiSettingsHomePage'
import { ApiPresetEditPage } from './pages/ApiPresetEditPage'

function EditWrapper() {
  const { id } = useParams()
  return <ApiPresetEditPage key={id ?? 'new'} />
}

function ApiSettingsBootstrap({ onBack }: { onBack: () => void }) {
  const { reloadFromStorage } = useApiSettings()

  useEffect(() => {
    void reloadFromStorage()
  }, [reloadFromStorage])

  return (
    <Routes>
      <Route path="/" element={<ApiSettingsHomePage onBack={onBack} />} />
      <Route path="/new" element={<ApiPresetEditPage />} />
      <Route path={API_LINK_PREVIEW_ROUTE} element={<ApiLinkPreviewPage />} />
      <Route path="/edit/:id" element={<EditWrapper />} />
      <Route path="/image-gen" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function ApiSettingsApp({ onBack }: { onBack: () => void }) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <ApiSettingsBootstrap onBack={onBack} />
    </MemoryRouter>
  )
}

export default ApiSettingsApp
