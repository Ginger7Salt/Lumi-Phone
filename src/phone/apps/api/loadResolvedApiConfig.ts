import { pullPhoneKvWithLocalStorageLegacy, personaDb } from '../wechat/newFriendsPersona/idb'
import type { ApiConfig, ApiPreset, ApiStore, SubApiType } from './types'
import { SILICONFLOW_ASR_DEFAULT_BASE_URL } from '../wechat/voiceCall/siliconflowAsr'
import { createEmptyApiConfig, createEmptyPreset } from './mock'
import { migrateLegacyImageGenIntoStore, normalizeImageGenSettings } from './imageGenPresetUtils'
import {
  API_STORE_STORAGE_KEY,
  createEmptyLinkPreviewSettings,
  mergeApiStoreLinkPreview,
} from './linkPreviewSettingsUtils'

const STORAGE_KEY = API_STORE_STORAGE_KEY

function normalizeApiConfig(raw: unknown): ApiConfig {
  const r = (raw ?? {}) as Partial<ApiConfig>
  const modelList = Array.isArray(r.modelList) ? r.modelList.filter((x): x is string => typeof x === 'string') : []
  return {
    apiUrl: typeof r.apiUrl === 'string' ? r.apiUrl : '',
    apiKey: typeof r.apiKey === 'string' ? r.apiKey : '',
    modelId: typeof r.modelId === 'string' ? r.modelId : '',
    modelList,
    lastTest:
      r.lastTest && typeof r.lastTest === 'object'
        ? {
            ok: !!(r.lastTest as { ok?: unknown }).ok,
            message: String((r.lastTest as { message?: unknown }).message ?? ''),
            at: Number((r.lastTest as { at?: unknown }).at ?? 0),
          }
        : undefined,
  }
}

function normalizePreset(raw: unknown): ApiPreset | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<ApiPreset>
  const base = createEmptyPreset()
  const subRaw = (r.sub ?? {}) as Partial<
    Record<SubApiType, { enabled?: unknown; useMainApi?: unknown; apiConfig?: unknown }>
  >
  const normalizeSub = (k: SubApiType) => {
    const src = subRaw[k]
    const normalizedApi = normalizeApiConfig(src?.apiConfig ?? createEmptyApiConfig())
    return {
      enabled: typeof src?.enabled === 'boolean' ? src.enabled : true,
      useMainApi: k === 'voiceAsr' ? false : typeof src?.useMainApi === 'boolean' ? src.useMainApi : true,
      apiConfig:
        k === 'voiceAsr'
          ? { ...normalizedApi, apiUrl: normalizedApi.apiUrl.trim() || SILICONFLOW_ASR_DEFAULT_BASE_URL }
          : normalizedApi,
    }
  }
  return {
    ...base,
    id: typeof r.id === 'string' && r.id.trim() ? r.id : base.id,
    name: typeof r.name === 'string' ? r.name : '',
    description: typeof r.description === 'string' ? r.description : '',
    main: normalizeApiConfig(r.main),
    sub: {
      xinyu: normalizeSub('xinyu'),
      chatCard: normalizeSub('chatCard'),
      danmaku: normalizeSub('danmaku'),
      voiceAsr: normalizeSub('voiceAsr'),
    },
    imageGen: normalizeImageGenSettings(r.imageGen),
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : base.createdAt,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : base.updatedAt,
  }
}

function parseApiStore(raw: unknown): ApiStore {
  try {
    if (!raw || typeof raw !== 'object') throw new Error('bad')
    const parsed = raw as Partial<ApiStore>
    const presets = Array.isArray(parsed.presets)
      ? parsed.presets.map((p) => normalizePreset(p)).filter((p): p is ApiPreset => !!p)
      : []
    const currentPresetId =
      typeof parsed.currentPresetId === 'string' && presets.some((p) => p.id === parsed.currentPresetId)
        ? parsed.currentPresetId
        : presets[0]?.id ?? ''
    return migrateLegacyImageGenIntoStore({
      presets,
      currentPresetId,
      ...mergeApiStoreLinkPreview(parsed),
    })
  } catch {
    return { presets: [], currentPresetId: '', linkPreview: createEmptyLinkPreviewSettings() }
  }
}

function resolveFromPreset(preset: ApiPreset | null, subType?: SubApiType): ApiConfig | null {
  if (!preset) return null
  if (!subType) return preset.main
  const sub = preset.sub[subType]
  if (!sub) return preset.main
  if (!sub.enabled) return null
  if (subType === 'voiceAsr') return sub.apiConfig
  if (sub.useMainApi) return preset.main
  return sub.apiConfig.apiUrl || sub.apiConfig.apiKey || sub.apiConfig.modelId ? sub.apiConfig : preset.main
}

/** 从 IndexedDB / localStorage 读取当前聊天卡 API 配置（供后台调度等非 React 场景使用）。 */
export async function loadResolvedApiConfig(subType: SubApiType = 'chatCard'): Promise<ApiConfig | null> {
  try {
    const raw = await pullPhoneKvWithLocalStorageLegacy(STORAGE_KEY, [STORAGE_KEY])
    const store = parseApiStore(raw)
    const preset = store.presets.find((p) => p.id === store.currentPresetId) ?? store.presets[0] ?? null
    return resolveFromPreset(preset, subType)
  } catch {
    try {
      await personaDb.getPhoneKv(STORAGE_KEY)
    } catch {
      // ignore
    }
    return null
  }
}
