import { isMomentsImageGenConfigured } from './momentsImageGenAvailability'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'
import { loadMomentsSettings } from './useMomentsSettingsStore'

/** 朋友圈法则页是否启用「专属生图 API」（关闭则走 API 设置 → 生图 API 默认配置） */
export function isMomentsDedicatedImageGenEnabled(settings: MomentsImageGenSettings): boolean {
  return settings.useDedicatedImageGen === true
}

/**
 * 解析朋友圈实际使用的生图配置：专属已开启且 Key/模型就绪时用法则页配置，否则回退全局默认。
 */
export function resolveMomentsEffectiveImageGenSettings(
  dedicated: MomentsImageGenSettings,
  globalDefault: MomentsImageGenSettings,
): MomentsImageGenSettings {
  if (isMomentsDedicatedImageGenEnabled(dedicated)) {
    const dedicatedActive: MomentsImageGenSettings = { ...dedicated, enabled: true }
    if (isMomentsImageGenConfigured(dedicatedActive)) return dedicatedActive
  }
  return { ...globalDefault }
}

export async function loadResolvedMomentsImageGenSettings(
  loadGlobal: () => Promise<MomentsImageGenSettings>,
): Promise<MomentsImageGenSettings> {
  const global = await loadGlobal()
  const dedicated = loadMomentsSettings().imageGen
  return resolveMomentsEffectiveImageGenSettings(dedicated, global)
}
