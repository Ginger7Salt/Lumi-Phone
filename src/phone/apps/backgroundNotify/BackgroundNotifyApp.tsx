import { ChevronLeft, CircleHelp, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import {
  canRepromptNotificationPermission,
  describeNotificationPermissionBlock,
  disableBackgroundPush,
  connectWebPushWorker,
  enableBackgroundKeepAlive,
  enableBackgroundPush,
  getLumiPushDiagnostics,
  getNotificationPermissionDiagnostics,
  getPushPermissionState,
  isBackgroundKeepAliveEnabledLocally,
  isBackgroundNotifyOperational,
  isBackgroundPushEnabledLocally,
  isLikelyIosBrowser,
  isPageControlledByServiceWorker,
  OFFLINE_PUSH_VPN_HINT,
  primeBackgroundMediaKeepAliveFromUserGesture,
  resolveBackgroundPushEnabled,
  sendTestSystemNotification,
  subscribeWebPushFromUserGesture,
  startNotificationPermissionRequestFromUserGesture,
  syncPushPermissionState,
  warmLumiPushStack,
  type PushPermissionState,
} from './backgroundPushClient'
import { disableBackgroundKeepAlive, syncBackgroundKeepAliveRuntime } from './backgroundKeepAlive'
import {
  kickstartKeepAliveAudioFromUserGesture,
  isHtmlKeepAlivePlaying,
  stopBackgroundMediaKeepAlive,
} from './backgroundMediaKeepAlive'
import { shouldUseAudioForKeepAlive } from './backgroundKeepAliveStrategy'

function WxSwitch({
  on,
  onToggle,
  pending,
}: {
  on: boolean
  onToggle: () => void
  pending?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-busy={pending}
      onClick={onToggle}
      className="relative h-8 w-[52px] shrink-0 rounded-full transition-[background-color] duration-300 ease-out active:scale-[0.98]"
      style={{ backgroundColor: on ? '#000000' : '#cccccc' }}
    >
      <motion.span
        className="pointer-events-none absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.18)]"
        animate={{ x: on ? 22 : 0 }}
        transition={{ type: 'spring', stiffness: 560, damping: 38, mass: 0.72 }}
        aria-hidden
      />
      {pending ? (
        <span
          className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-black/12"
          aria-hidden
        />
      ) : null}
    </button>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-[14px] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">{children}</div>
  )
}

type HelpTopic = 'keepAlive' | 'push'

function FeatureHelpButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex size-7 shrink-0 items-center justify-center rounded-full text-[#8e8e8e] transition-colors hover:bg-black/5 hover:text-[#666] active:scale-95"
      aria-label={`${label}说明`}
    >
      <CircleHelp className="size-4" strokeWidth={1.75} aria-hidden />
    </button>
  )
}

function KeepAliveHelpContent({ onIos }: { onIos: boolean }) {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-[#666]">
      <p>尽量维持 Lumi 页面进程，便于切后台时 AI 任务与延时消息队列继续运行。</p>
      {onIos ? (
        <>
          <p>
            iPhone 使用<strong className="font-medium text-black">静音循环播放</strong>配合 Web
            Locks，可在控制中心看到「Lumi Phone · 后台运行中」。
          </p>
          <p>播放一起听等其它音频时会自动让路，结束后恢复保活。</p>
        </>
      ) : (
        <>
          <p>
            安卓使用 <strong className="font-medium text-black">Web Locks + Service Worker 心跳</strong>
            尽量维持页面进程，<strong className="font-medium text-black">不会播放静音音频</strong>，也不占用媒体播放条。
          </p>
          <p>
            切到后台后通知栏可能出现「后台运行中」文字提示；进程仍可能被系统回收。若需系统通知栏提醒新消息，请另开「后台推送」。
          </p>
        </>
      )}
    </div>
  )
}

function PushHelpContent({ onIos }: { onIos: boolean }) {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-[#666]">
      <p>
        选择是否在切后台时用系统通知栏展示新消息（含微信本地通知）。停留在 Lumi 内只更新红点，不弹通知栏。
      </p>
      <p>
        可选增强：连接并订阅云端 Web Push 后，Lumi 被划掉或进程被杀时，进行中的微信任务可由 Worker
        延迟推送兜底。Worker 连不上也不影响开启本开关与本地通知。
      </p>
      <p>{OFFLINE_PUSH_VPN_HINT}</p>
      {onIos ? (
        <>
          <p>
            iPhone 需用 Safari「添加到主屏幕」安装的 PWA，且 iOS ≥ 16.4 才支持 Web Push。可与「后台保活」同时开启。
          </p>
          <p className="rounded-[10px] bg-[#fff8f0] px-3 py-2 text-[#8a5a00]">
            <strong className="font-medium text-[#6b4500]">关于通知头像：</strong>
            iOS 系统会忽略 Web 通知里的 icon 参数，通知栏左侧固定为 Lumi App 图标，无法像原生微信那样显示每个角色的相册头像。标题仍会显示角色/群备注，正文显示消息预览（安卓 Chrome 可显示角色头像）。
          </p>
        </>
      ) : (
        <p>可与「后台保活」同时开启：保活维持进程，推送决定是否弹系统通知。</p>
      )}
    </div>
  )
}

function FeatureHelpSheet({
  topic,
  onIos,
  onClose,
}: {
  topic: HelpTopic
  onIos: boolean
  onClose: () => void
}) {
  const title = topic === 'keepAlive' ? '后台保活' : '后台推送'
  return (
    <motion.div
      role="dialog"
      aria-modal
      aria-labelledby="background-notify-help-title"
      initial={{ y: 28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 28, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="w-full max-w-[360px] rounded-[16px] bg-white p-4 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="background-notify-help-title" className="text-[17px] font-semibold text-black">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#666] transition-colors hover:bg-black/5"
          aria-label="关闭说明"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="mt-3 max-h-[min(52vh,360px)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {topic === 'keepAlive' ? <KeepAliveHelpContent onIos={onIos} /> : <PushHelpContent onIos={onIos} />}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full rounded-[12px] bg-black py-3 text-[15px] font-medium text-white transition-opacity active:opacity-80"
      >
        知道了
      </button>
    </motion.div>
  )
}

export function BackgroundNotifyApp({ onBack }: { onBack: () => void }) {
  const { state } = useCustomization()
  const pageStyle = state.appPageStyles.backgroundNotify
  const { theme } = state

  const [keepAliveEnabled, setKeepAliveEnabled] = useState(() => isBackgroundKeepAliveEnabledLocally())
  const [pushEnabled, setPushEnabled] = useState(() => isBackgroundPushEnabledLocally())
  const [permission, setPermission] = useState(getPushPermissionState())
  const [pending, setPending] = useState(false)
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [swDiag, setSwDiag] = useState<Awaited<ReturnType<typeof getLumiPushDiagnostics>> | null>(null)
  const [pageControlledLive, setPageControlledLive] = useState(() =>
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? isPageControlledByServiceWorker()
      : false,
  )
  const [, setPermDiag] = useState(getNotificationPermissionDiagnostics)
  const toggleLockRef = useRef(false)
  const onIos = isLikelyIosBrowser()

  const refresh = useCallback(async () => {
    try {
      const [on, perm] = await Promise.all([resolveBackgroundPushEnabled(), syncPushPermissionState()])
      setPushEnabled(on)
      setKeepAliveEnabled(isBackgroundKeepAliveEnabledLocally())
      setPermission(perm)
      setPermDiag(getNotificationPermissionDiagnostics())
    } finally {
      /* no-op */
    }
  }, [])

  const refreshSwDiag = useCallback(() => {
    void getLumiPushDiagnostics().then((diag) => {
      setSwDiag(diag)
      setPageControlledLive(diag.pageControlled)
    })
  }, [])

  useEffect(() => {
    void refresh()
    warmLumiPushStack()
    refreshSwDiag()
    setPageControlledLive(isPageControlledByServiceWorker())
    if (!('serviceWorker' in navigator)) return
    const onController = () => {
      setPageControlledLive(isPageControlledByServiceWorker())
      refreshSwDiag()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onController)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onController)
  }, [refresh, refreshSwDiag])

  /** 从 Edge 设置返回后刷新权限读数（只读 Notification.permission） */
  useEffect(() => {
    const resyncPermission = () => {
      setPermission(getPushPermissionState())
      setPermDiag(getNotificationPermissionDiagnostics())
    }
    window.addEventListener('focus', resyncPermission)
    const onVis = () => {
      if (document.visibilityState === 'visible') resyncPermission()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', resyncPermission)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [toast])

  const finishPermissionFlow = useCallback(async (permPromise: Promise<PushPermissionState>) => {
    toggleLockRef.current = true
    setPending(true)
    try {
      const perm = await permPromise
      const synced = perm === 'granted' ? 'granted' : getPushPermissionState()
      setPermission(synced)
      setPermDiag(getNotificationPermissionDiagnostics())
      if (synced === 'granted') {
        setToast('通知权限已允许，可打开上方「后台保活」或「后台推送」开关')
        void primeBackgroundMediaKeepAliveFromUserGesture()
      } else {
        setToast(describeNotificationPermissionBlock(synced))
      }
      return synced
    } finally {
      toggleLockRef.current = false
      setPending(false)
    }
  }, [])

  /** 同步阶段立刻发起 requestPermission，避免 setState 消耗用户手势 */
  const onRequestPermissionClick = useCallback(() => {
    if (toggleLockRef.current) return
    void primeBackgroundMediaKeepAliveFromUserGesture()
    const permPromise = startNotificationPermissionRequestFromUserGesture()
    void finishPermissionFlow(permPromise)
  }, [finishPermissionFlow])

  const onSubscribeWebPushClick = useCallback(() => {
    if (toggleLockRef.current) return
    toggleLockRef.current = true
    setPending(true)
    void subscribeWebPushFromUserGesture()
      .then((result) => {
        if (result.ok) {
          setToast(result.message ?? 'Web Push 订阅成功')
          void getLumiPushDiagnostics().then(setSwDiag)
        } else {
          setToast(result.message)
        }
      })
      .finally(() => {
        toggleLockRef.current = false
        setPending(false)
      })
  }, [])

  const onConnectWebPushClick = useCallback(() => {
    if (toggleLockRef.current) return
    toggleLockRef.current = true
    setPending(true)
    void connectWebPushWorker()
      .then((result) => {
        void getLumiPushDiagnostics().then(setSwDiag)
        setToast(result.ok ? result.message ?? 'Push Worker 已连接' : result.message)
      })
      .finally(() => {
        toggleLockRef.current = false
        setPending(false)
      })
  }, [])

  const onKeepAliveToggleClick = useCallback(() => {
    if (toggleLockRef.current) return

    const wasEnabled = keepAliveEnabled
    const turningOn = !wasEnabled

    if (!turningOn) {
      toggleLockRef.current = true
      setPending(true)
      setKeepAliveEnabled(false)
      void (async () => {
        try {
          disableBackgroundKeepAlive()
          setToast('已关闭后台保活')
        } finally {
          toggleLockRef.current = false
          setPending(false)
        }
      })()
      return
    }

    if (shouldUseAudioForKeepAlive()) {
      kickstartKeepAliveAudioFromUserGesture()
    }
    const permPromise = startNotificationPermissionRequestFromUserGesture()
    toggleLockRef.current = true
    void (async () => {
      try {
        const perm = await permPromise
        const synced = perm === 'granted' ? 'granted' : getPushPermissionState()
        setPermission(synced)
        setPermDiag(getNotificationPermissionDiagnostics())
        if (synced !== 'granted') {
          stopBackgroundMediaKeepAlive()
          setToast(describeNotificationPermissionBlock(synced))
          return
        }

        setPending(true)
        setKeepAliveEnabled(true)

        const result = await enableBackgroundKeepAlive({ skipPermissionRequest: true })
        if (result.ok) {
          syncBackgroundKeepAliveRuntime()
          if (shouldUseAudioForKeepAlive() && !isHtmlKeepAlivePlaying()) {
            setToast('后台保活已保存，但静音播放未启动；请关闭后再开一次开关')
          } else {
            setToast(result.message ?? '后台保活已开启')
          }
        } else {
          setKeepAliveEnabled(wasEnabled)
          stopBackgroundMediaKeepAlive()
          setToast(result.message)
        }
      } catch (e) {
        setKeepAliveEnabled(wasEnabled)
        stopBackgroundMediaKeepAlive()
        setToast(e instanceof Error ? e.message : '操作失败')
      } finally {
        toggleLockRef.current = false
        setPending(false)
      }
    })()
  }, [keepAliveEnabled])

  const onPushToggleClick = useCallback(() => {
    if (toggleLockRef.current) return

    const wasEnabled = pushEnabled
    const turningOn = !wasEnabled

    if (!turningOn) {
      toggleLockRef.current = true
      setPending(true)
      setPushEnabled(false)
      void (async () => {
        try {
          await disableBackgroundPush()
          setToast('已关闭后台推送')
          setPermission(getPushPermissionState())
          setPermDiag(getNotificationPermissionDiagnostics())
          void getLumiPushDiagnostics().then(setSwDiag)
        } finally {
          toggleLockRef.current = false
          setPending(false)
        }
      })()
      return
    }

    const permPromise = startNotificationPermissionRequestFromUserGesture()
    toggleLockRef.current = true
    void (async () => {
      try {
        const perm = await permPromise
        const synced = perm === 'granted' ? 'granted' : getPushPermissionState()
        setPermission(synced)
        setPermDiag(getNotificationPermissionDiagnostics())
        if (synced !== 'granted') {
          setToast(describeNotificationPermissionBlock(synced))
          return
        }

        setPending(true)
        setPushEnabled(true)

        const result = await enableBackgroundPush({ skipPermissionRequest: true })
        if (result.ok) {
          setPermission(getPushPermissionState())
          setPermDiag(getNotificationPermissionDiagnostics())
          void getLumiPushDiagnostics().then(setSwDiag)
          setToast(result.message ?? '后台推送已开启')
        } else {
          setPushEnabled(wasEnabled)
          setToast(result.message)
        }
      } catch (e) {
        setPushEnabled(wasEnabled)
        setToast(e instanceof Error ? e.message : '操作失败')
      } finally {
        toggleLockRef.current = false
        setPending(false)
      }
    })()
  }, [pushEnabled])

  const onTest = useCallback(async () => {
    if (toggleLockRef.current) return
    toggleLockRef.current = true
    setPending(true)
    try {
      const result = await sendTestSystemNotification()
      if (result.ok) {
        setToast(result.hint ?? '测试通知已发起')
      } else {
        setToast(result.message)
      }
    } finally {
      toggleLockRef.current = false
      setPending(false)
    }
  }, [])

  const swConnected = pageControlledLive
  const notifyOperational = isBackgroundNotifyOperational(permission, pageControlledLive)

  useEffect(() => {
    if (!swDiag || swConnected) return
    if (swDiag.swState !== 'installing' && swDiag.swState !== 'waiting') return
    const t = window.setInterval(() => refreshSwDiag(), 2000)
    return () => window.clearInterval(t)
  }, [swDiag, swConnected, refreshSwDiag])

  const notificationAllowedLabel =
    permission === 'unsupported' ? '不支持' : permission === 'granted' ? '是' : '否'

  const pageControlledLabel = pageControlledLive ? '是' : '否'

  const offlinePushLabel =
    swDiag == null ? '检测中…' : swDiag.offlinePushOperational ? '是' : '否'

  const workerProbeLabel =
    swDiag == null
      ? '检测中…'
      : swDiag.workerProbeState === 'connected'
        ? '已连接'
        : swDiag.workerProbeState === 'unconfigured'
          ? '未配置'
          : swDiag.workerProbeState === 'unsupported'
            ? '不支持'
            : '未连接'

  const showConnectWebPushButton =
    swDiag != null && swDiag.workerProbeState !== 'connected'

  const showSubscribeWebPushButton =
    permission === 'granted' &&
    !!swDiag?.webPushOfflineConfigured &&
    !swDiag.offlinePushOperational

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      data-phone-page="app"
      data-app-id="backgroundNotify"
      style={{
        backgroundColor: pageStyle?.pageBg || '#f2f2f4',
        backgroundImage: pageStyle?.pageBgImageUrl ? `url(${pageStyle.pageBgImageUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: pageStyle?.fontFamily || 'var(--phone-font)',
      }}
    >
      <header
        className="flex shrink-0 items-center gap-2 border-b px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]"
        style={{
          borderColor: theme.border,
          backgroundColor: pageStyle?.headerBg || theme.surface,
        }}
      >
        <Pressable
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full"
          style={{ color: pageStyle?.headerText || theme.text }}
          aria-label="返回桌面"
        >
          <ChevronLeft className="size-5" />
        </Pressable>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8e8e8e]">System</p>
          <h1 className="truncate text-[17px] font-semibold" style={{ color: pageStyle?.headerText || theme.text }}>
            后台通知
          </h1>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-28 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-0.5">
              <p className="text-[16px] font-medium text-black">后台保活</p>
              <FeatureHelpButton label="后台保活" onClick={() => setHelpTopic('keepAlive')} />
            </div>
            <WxSwitch on={keepAliveEnabled} onToggle={onKeepAliveToggleClick} pending={pending} />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#f0f0f0] pt-4">
            <div className="flex min-w-0 items-center gap-0.5">
              <p className="text-[16px] font-medium text-black">后台推送</p>
              <FeatureHelpButton label="后台推送" onClick={() => setHelpTopic('push')} />
            </div>
            <WxSwitch on={pushEnabled} onToggle={onPushToggleClick} pending={pending} />
          </div>

          <div className="mt-4 space-y-2 border-t border-[#f0f0f0] pt-4 text-[13px] text-[#666]">
            <div className="flex justify-between gap-2">
              <span>是否允许通知</span>
              <span
                className={`font-medium ${permission === 'granted' ? 'text-black' : permission === 'unsupported' ? 'text-[#8e8e8e]' : 'text-[#c93400]'}`}
              >
                {notificationAllowedLabel}
              </span>
            </div>
            <div>
              <div className="flex justify-between gap-2">
                <div className="min-w-0 pr-2">
                  <span>SW 已接管本页</span>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#8e8e8e]">
                    本页是否由 Service Worker 控制；切后台发通知更稳。首次安装 SW 后需刷新一次
                  </p>
                </div>
                <span
                  className={`shrink-0 font-medium ${pageControlledLive ? 'text-black' : 'text-[#c93400]'}`}
                >
                  {pageControlledLabel}
                </span>
              </div>
              {!pageControlledLive && swDiag?.needsPageReload ? (
                <p className="mt-1 text-[11px] leading-relaxed text-[#c93400]">
                  SW 已安装但未接管当前页，请刷新本页后再试
                </p>
              ) : null}
            </div>
            <div className="flex justify-between gap-2">
              <span>通知是否可用</span>
              <span className={`font-medium ${notifyOperational ? 'text-black' : 'text-[#c93400]'}`}>
                {notifyOperational ? '是' : '否'}
              </span>
            </div>
            <div>
              <div className="flex justify-between gap-2">
                <div className="min-w-0 pr-2">
                  <span>离线推送</span>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#8e8e8e]">
                    备注：国内网络通常需开梯子，才能稳定连接与收消息
                  </p>
                </div>
                <span
                  className={`shrink-0 font-medium ${swDiag?.offlinePushOperational ? 'text-black' : swDiag == null ? 'text-[#8e8e8e]' : 'text-[#c93400]'}`}
                >
                  {offlinePushLabel}
                </span>
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <span>离线推送连接</span>
              <span
                className={`font-medium ${
                  swDiag?.workerProbeState === 'connected'
                    ? 'text-black'
                    : swDiag == null
                      ? 'text-[#8e8e8e]'
                      : 'text-[#c93400]'
                }`}
              >
                {workerProbeLabel}
              </span>
            </div>
            {swDiag?.workerProbeHint && swDiag.workerProbeState !== 'connected' ? (
              <p className="text-[12px] leading-relaxed text-[#c93400]">{swDiag.workerProbeHint}</p>
            ) : null}
            {swDiag && !swDiag.offlinePushOperational && swDiag.offlinePushBlockHint ? (
              <p className="text-[12px] leading-relaxed text-[#c93400]">{swDiag.offlinePushBlockHint}</p>
            ) : null}
            {permission !== 'granted' && permission !== 'unsupported' ? (
              <div className="pt-2">
                {canRepromptNotificationPermission() ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={onRequestPermissionClick}
                    className="w-full rounded-[10px] border border-black/10 bg-[#f7f7f8] py-2.5 text-[14px] font-medium text-black transition-opacity disabled:opacity-40"
                  >
                    允许通知
                  </button>
                ) : (
                  <div className="rounded-[10px] bg-[#fff8f5] px-3 py-2.5 text-[12px] leading-relaxed text-[#8e3a00]">
                    <p className="font-medium">请在系统设置中允许此网站的通知权限</p>
                  </div>
                )}
              </div>
            ) : null}
            {showConnectWebPushButton ? (
              <div className="pt-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={onConnectWebPushClick}
                  className="w-full rounded-[10px] border border-black/10 bg-[#f7f7f8] py-2.5 text-[14px] font-medium text-black transition-opacity disabled:opacity-40"
                >
                  离线推送连接
                </button>
              </div>
            ) : null}
            {showSubscribeWebPushButton ? (
              <div className="pt-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={onSubscribeWebPushClick}
                  className="w-full rounded-[10px] bg-black py-2.5 text-[14px] font-medium text-white transition-opacity disabled:opacity-40"
                >
                  订阅离线推送（Web Push）
                </button>
                <p className="mt-2 text-[11px] leading-relaxed text-[#8e8e8e]">
                  需在用户点击时完成订阅；国内网络请开梯子后再点。
                </p>
              </div>
            ) : null}
          </div>
        </Card>

        <div className="mt-4">
          <Card>
            <p className="text-[15px] font-medium text-black">测试系统通知</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#8e8e8e]">
              发送后请切换到其他 App 或桌面。
            </p>
            <button
              type="button"
              disabled={pending || !pushEnabled || !notifyOperational}
              onClick={() => void onTest()}
              className="mt-4 w-full rounded-[12px] bg-black py-3 text-[15px] font-medium text-white transition-opacity disabled:opacity-40"
            >
              发送测试通知
            </button>
            {!pushEnabled ? (
              <p className="mt-2 text-[12px] text-[#c93400]">请先打开上方「后台推送」开关</p>
            ) : !notifyOperational ? (
              <p className="mt-2 text-[12px] text-[#c93400]">请先允许网站通知权限</p>
            ) : null}
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {helpTopic ? (
          <motion.div
            key="help-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-8"
            onClick={() => setHelpTopic(null)}
          >
            <FeatureHelpSheet topic={helpTopic} onIos={onIos} onClose={() => setHelpTopic(null)} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {toast ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-50 flex justify-center px-6">
          <p className="max-w-[320px] rounded-[12px] bg-[rgba(28,28,30,0.92)] px-4 py-2.5 text-center text-[13px] leading-relaxed text-white shadow-lg">
            {toast}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default BackgroundNotifyApp
