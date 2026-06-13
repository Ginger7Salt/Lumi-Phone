import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setupServiceWorkerControlWatcher } from './phone/apps/backgroundNotify/backgroundPushClient'
import { installBackgroundKeepAlive } from './phone/apps/backgroundNotify/backgroundKeepAlive'
import { maybeRecoverFromBrokenKeepAlivePwa } from './phone/apps/backgroundNotify/keepAliveBootRecovery'
import { installProactivePrivateMessageEngine } from './phone/apps/wechat/proactivePrivateMessageEngine'
import { installProactiveCharacterMomentEngine } from './components/moments/proactiveCharacterMomentEngine'
import { isLikelyIosBrowser } from './phone/apps/backgroundNotify/backgroundPushClient'

/**
 * 键盘覆盖内容而不是挤压 viewport（Chromium 等）。
 * iOS WebKit 不支持 VirtualKeyboard API，强行设置会与 visualViewport 滚动抢布局。
 */
if (
  'virtualKeyboard' in navigator &&
  !/iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
) {
  ;(navigator as Navigator & { virtualKeyboard?: { overlaysContent: boolean } }).virtualKeyboard!.overlaysContent = true
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/** 先渲染 UI，再挂 SW / 保活，避免 iOS PWA 冷启动被保活逻辑抢在 React 之前 */
queueMicrotask(() => {
  maybeRecoverFromBrokenKeepAlivePwa()
  const installSwWatcher = () => {
    if ('serviceWorker' in navigator) {
      setupServiceWorkerControlWatcher()
    }
  }
  /** iOS 主屏幕 PWA：推迟 SW 接管，避免与首屏 React 绘制抢时序导致白屏 */
  const iosDeferMs = isLikelyIosBrowser() ? 2500 : 0
  if (iosDeferMs > 0) {
    window.setTimeout(installSwWatcher, iosDeferMs)
  } else {
    installSwWatcher()
  }
  installBackgroundKeepAlive()
  installProactivePrivateMessageEngine()
  installProactiveCharacterMomentEngine()
})
