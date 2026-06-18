import { AppPlaceholderScreen } from '../../components/AppPlaceholderScreen'
import { SANDBOX_UNDER_DEV } from './sandboxConstants'
import { SandboxHub } from './SandboxHub'

export function SandboxApp({ onBack }: { onBack: () => void }) {
  if (SANDBOX_UNDER_DEV) {
    return (
      <AppPlaceholderScreen
        appId="sandbox"
        onBack={onBack}
        underDev
        message="功能开发中"
        hint="幻境引擎与高阶玩法模拟正在打磨，平行宇宙推演与内置模拟器将在此接入。"
      />
    )
  }
  return <SandboxHub onBack={onBack} />
}
