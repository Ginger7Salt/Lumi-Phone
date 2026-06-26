import { isMomentsImageProvider } from './momentsImageProviderRegistry'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

/** 角色/瞬时朋友圈是否可调用生图 API（已开启引擎且当前 provider 已填 Key） */
export function isMomentsImageGenConfigured(settings: MomentsImageGenSettings): boolean {
  if (!settings.enabled) return false
  const provider = settings.provider
  if (!isMomentsImageProvider(provider)) return false
  if (provider === 'siliconflow') return !!settings.siliconflowApiKey?.trim()
  if (provider === 'qianfan') return !!settings.qianfanApiKey?.trim()
  if (provider === 'volcengine') return !!settings.volcengineApiKey?.trim()
  if (provider === 'novelai') return !!settings.novelaiApiKey?.trim()
  if (provider === 'gemini') return !!settings.geminiApiKey?.trim()
  if (provider === 'openai') return !!settings.openaiApiKey?.trim()
  if (provider === 'custom') return !!settings.customApiUrl?.trim() && !!settings.customApiKey?.trim()
  return false
}
