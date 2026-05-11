import { useEffect, useState } from 'react'
import { DatingProvider } from './DatingContext'
import { DatingRoleSelectPage } from './DatingRoleSelectPage'
import { DatingStoryPage } from './DatingStoryPage'

type Page = 'select' | 'story'

function DatingSystemInner({
  onVnChromeChange,
  onOpenPersonaManager,
}: {
  onVnChromeChange?: (hidden: boolean) => void
  onOpenPersonaManager?: () => void
}) {
  const [page, setPage] = useState<Page>('select')

  useEffect(() => {
    const hidden = page === 'story'
    onVnChromeChange?.(hidden)
    return () => {
      onVnChromeChange?.(false)
    }
  }, [onVnChromeChange, page])

  return page === 'select' ? (
    <DatingRoleSelectPage onEnterStory={() => setPage('story')} onOpenPersonaManager={onOpenPersonaManager} />
  ) : (
    <DatingStoryPage onBackToSelect={() => setPage('select')} />
  )
}

export function DatingSystem({
  onVnChromeChange,
  onOpenPersonaManager,
}: {
  onVnChromeChange?: (hidden: boolean) => void
  onOpenPersonaManager?: () => void
}) {
  return (
    <DatingProvider>
      <DatingSystemInner onVnChromeChange={onVnChromeChange} onOpenPersonaManager={onOpenPersonaManager} />
    </DatingProvider>
  )
}

export default DatingSystem

