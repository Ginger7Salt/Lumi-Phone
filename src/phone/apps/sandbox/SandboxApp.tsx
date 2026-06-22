import { useState } from 'react'
import { AppPlaceholderScreen } from '../../components/AppPlaceholderScreen'
import { SandboxHub } from './SandboxHub'
import { StarMakerApp } from './starMaker/StarMakerApp'

/** 改 false 恢复幻境引擎 hub 与金牌制作人 */
const SANDBOX_UNDER_DEV = true

type View = 'hub' | 'star-maker'

export function SandboxApp({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>('hub')

  if (SANDBOX_UNDER_DEV) {
    return (
      <AppPlaceholderScreen
        appId="sandbox"
        onBack={onBack}
        underDev
        message="功能开发中"
        hint="幻境引擎与金牌制作人等高阶文字模拟正在打磨，完成后将在此接入。"
      />
    )
  }

  if (view === 'star-maker') {
    return <StarMakerApp onBack={() => setView('hub')} />
  }

  return <SandboxHub onBack={onBack} onEnterStarMaker={() => setView('star-maker')} />
}
