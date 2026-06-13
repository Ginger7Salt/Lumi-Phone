export type WebPushProviderKind = 'standard'

/** 标准 Web Push（Cloudflare Worker 等）；国内网络常需梯子访问 FCM 推送通道 */
export const OFFLINE_WEB_PUSH_ARCHITECTURE =
  'Service Worker + 云端 Web Push（进程被杀后兜底；国内常需梯子）'

export const OFFLINE_PUSH_VPN_HINT =
  '离线推送走浏览器 Web Push 通道（如 FCM），国内网络通常需要梯子才能稳定订阅与收消息。'

function readEnvTrim(key: string): string {
  const raw = import.meta.env[key] as string | undefined
  return raw?.trim() ?? ''
}

/** 云端 Web Push 后端（如 Cloudflare Worker，免费、无需自购服务器） */
export function getWebPushApiBase(): string {
  const base =
    readEnvTrim('VITE_WEB_PUSH_API_BASE') || readEnvTrim('VITE_LUMI_PUSH_API_BASE')
  return base.replace(/\/+$/, '')
}

export function getWebPushProvider(): WebPushProviderKind {
  return 'standard'
}

export function isWebPushOfflineConfigured(): boolean {
  return !!getWebPushApiBase()
}

/** @deprecated */
export function getLumiPushApiBase(): string {
  return getWebPushApiBase()
}

/** @deprecated */
export function isPushApiConfigured(): boolean {
  return isWebPushOfflineConfigured()
}

export function getWebPushProviderLabel(): string {
  return '云端 Web Push'
}

export function describeOfflinePushSetupHint(): string {
  if (getWebPushApiBase()) return OFFLINE_PUSH_VPN_HINT
  return '未配置 VITE_WEB_PUSH_API_BASE（可用现有 Cloudflare Worker 地址，无需买服务器）'
}
