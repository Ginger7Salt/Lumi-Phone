import { isMomentsImageGenConfigured } from '../../../components/moments/momentsImageGenAvailability'
import {
  DEFAULT_MOMENTS_SETTINGS,
  normalizeImageGenSettings,
  type MomentsImageGenSettings,
} from '../../../components/moments/useMomentsSettingsStore'
import type { ApiPreset, ApiStore } from './types'

export const DEFAULT_IMAGE_GEN_SETTINGS: MomentsImageGenSettings = DEFAULT_MOMENTS_SETTINGS.imageGen

export { normalizeImageGenSettings }

const MOMENTS_SETTINGS_KEY = 'wechat-moments-settings-v1'

export function isImageGenSettingsEmpty(settings: MomentsImageGenSettings): boolean {
  return (
    !settings.siliconflowApiKey.trim() &&
    !settings.qianfanApiKey.trim() &&
    !settings.volcengineApiKey.trim() &&
    !settings.novelaiApiKey.trim() &&
    !settings.geminiApiKey.trim() &&
    !settings.openaiApiKey.trim() &&
    !settings.customApiUrl.trim() &&
    !settings.customApiKey.trim() &&
    !settings.cachedModelsByProvider.siliconflow.length &&
    !settings.cachedModelsByProvider.qianfan.length &&
    !settings.cachedModelsByProvider.volcengine.length &&
    !settings.cachedModelsByProvider.novelai.length &&
    !settings.cachedModelsByProvider.gemini.length &&
    !settings.cachedModelsByProvider.openai.length &&
    !settings.cachedModelsByProvider.custom.length
  )
}

export function loadLegacyMomentsImageGenSettings(): MomentsImageGenSettings | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(MOMENTS_SETTINGS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const imageRaw =
      (parsed.imageGen && typeof parsed.imageGen === 'object'
        ? (parsed.imageGen as Record<string, unknown>)
        : null) ??
      (parsed.imageGenApi && typeof parsed.imageGenApi === 'object'
        ? (parsed.imageGenApi as Record<string, unknown>)
        : null)
    if (!imageRaw) return null
    const normalized = normalizeImageGenSettings(imageRaw)
    if (isImageGenSettingsEmpty(normalized) && !normalized.enabled) return null
    return normalized
  } catch {
    return null
  }
}

/** 将朋友圈 localStorage 中的生图配置迁移到当前 API 预设（仅当预设尚未配置时） */
export function migrateLegacyImageGenIntoStore(store: ApiStore): ApiStore {
  const legacy = loadLegacyMomentsImageGenSettings()
  if (!legacy) return store
  if (!store.presets.length) return store

  const currentId = store.currentPresetId || store.presets[0]!.id
  const idx = store.presets.findIndex((p) => p.id === currentId)
  if (idx < 0) return store

  const preset = store.presets[idx]!
  if (!isImageGenSettingsEmpty(preset.imageGen)) return store

  const nextPresets = [...store.presets]
  nextPresets[idx] = {
    ...preset,
    imageGen: legacy,
    updatedAt: Date.now(),
  }
  return { ...store, presets: nextPresets, currentPresetId: currentId }
}

export function isCharacterImageGenEnabled(settings: MomentsImageGenSettings | null | undefined): boolean {
  if (!settings) return false
  return isMomentsImageGenConfigured(settings)
}

export function patchPresetImageGen(
  preset: ApiPreset,
  patch: Partial<MomentsImageGenSettings>,
): ApiPreset {
  return {
    ...preset,
    imageGen: { ...preset.imageGen, ...patch },
    updatedAt: Date.now(),
  }
}
