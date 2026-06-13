import type { ApiConfig } from '../../phone/apps/api/types'

export const MOMENTS_CHAT_API_NOT_CONFIGURED_MESSAGE =
  '请先在「API 设置」中配置聊天模型（API 地址、Key、模型 ID），再生成角色朋友圈。'

export function isMomentsChatApiConfigured(apiConfig: ApiConfig | null | undefined): boolean {
  return !!(apiConfig?.apiUrl?.trim() && apiConfig?.apiKey?.trim() && apiConfig?.modelId?.trim())
}

export function assertMomentsChatApiConfigured(
  apiConfig: ApiConfig | null | undefined,
): asserts apiConfig is ApiConfig {
  if (!isMomentsChatApiConfigured(apiConfig)) {
    throw new Error(MOMENTS_CHAT_API_NOT_CONFIGURED_MESSAGE)
  }
}
