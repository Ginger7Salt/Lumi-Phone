import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type VnPlaySpeed = 1 | 1.5 | 2

type VnStore = {
  isAutoPlay: boolean
  playSpeed: VnPlaySpeed
  isInnerVoiceMode: boolean
  logOpen: boolean
  toggleAutoPlay: () => void
  cyclePlaySpeed: () => void
  toggleInnerVoiceMode: () => void
  openLog: () => void
  closeLog: () => void
}

const VnStoreContext = createContext<VnStore | null>(null)

export function VNStoreProvider({ children }: { children: ReactNode }) {
  const [isAutoPlay, setIsAutoPlay] = useState(false)
  const [playSpeed, setPlaySpeed] = useState<VnPlaySpeed>(1)
  const [isInnerVoiceMode, setIsInnerVoiceMode] = useState(false)
  const [logOpen, setLogOpen] = useState(false)

  const value = useMemo<VnStore>(
    () => ({
      isAutoPlay,
      playSpeed,
      isInnerVoiceMode,
      logOpen,
      toggleAutoPlay: () => setIsAutoPlay((v) => !v),
      cyclePlaySpeed: () => {
        setPlaySpeed((v) => (v === 1 ? 1.5 : v === 1.5 ? 2 : 1))
      },
      toggleInnerVoiceMode: () => setIsInnerVoiceMode((v) => !v),
      openLog: () => setLogOpen(true),
      closeLog: () => setLogOpen(false),
    }),
    [isAutoPlay, playSpeed, isInnerVoiceMode, logOpen],
  )

  return <VnStoreContext.Provider value={value}>{children}</VnStoreContext.Provider>
}

export function useVNStore() {
  const ctx = useContext(VnStoreContext)
  if (!ctx) throw new Error('useVNStore must be used within VNStoreProvider')
  return ctx
}

