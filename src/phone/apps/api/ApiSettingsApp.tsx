import { MemoryRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { ApiSettingsHomePage } from './pages/ApiSettingsHomePage'
import { ApiPresetEditPage } from './pages/ApiPresetEditPage'

function EditWrapper() {
  const { id } = useParams()
  return <ApiPresetEditPage key={id ?? 'new'} />
}

export function ApiSettingsApp({ onBack }: { onBack: () => void }) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ApiSettingsHomePage onBack={onBack} />} />
        <Route path="/new" element={<ApiPresetEditPage />} />
        <Route path="/edit/:id" element={<EditWrapper />} />
        <Route path="/image-gen" element={<Navigate to="/" replace />} />
      </Routes>
    </MemoryRouter>
  )
}

export default ApiSettingsApp
