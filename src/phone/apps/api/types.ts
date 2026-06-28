import type { MomentsImageGenSettings } from '../../../components/moments/useMomentsSettingsStore'

export type SubApiType = 'xinyu' | 'chatCard' | 'danmaku' | 'voiceAsr'

/** 拉取模型列表时附带的费率（按百万 token 或平台原始单位解析） */
export type ApiModelPricing = {
  inputPerMillion?: number | null
  outputPerMillion?: number | null
  cachedInputPerMillion?: number | null
  currency?: 'CNY' | 'USD'
  unit?: 'per_million_tokens' | 'per_image' | 'unknown'
  rawLabel?: string
}

export type ApiConfig = {
  apiUrl: string
  apiKey: string
  modelId: string
  /** 已拉取的模型列表（用于下拉选择） */
  modelList: string[]
  /** 与 modelList 对应的费率（拉取模型时写入；部分平台 /models 不返回则为空） */
  modelPricingById?: Record<string, ApiModelPricing>
  /** 最近一次测试连接结果（用于首页显示连接状态） */
  lastTest?: { ok: boolean; message: string; at: number }
}

/** 聊天/摘要 API 最小字段（无 modelList，dating/摘要 fallback 常用） */
export type ApiConfigCore = Pick<ApiConfig, 'apiUrl' | 'apiKey' | 'modelId'>

export type SubApiConfig = {
  enabled: boolean
  useMainApi: boolean
  apiConfig: ApiConfig
}

export type ApiPreset = {
  id: string
  name: string
  description?: string
  main: ApiConfig
  sub: Record<SubApiType, SubApiConfig>
  /** 文生图 API（朋友圈配图、聊天室角色发图） */
  imageGen: MomentsImageGenSettings
  createdAt: number
  updatedAt: number
}

export type LinkPreviewSettings = {
  /** 是否启用链接预览（用户发 https 时注入摘要） */
  enabled: boolean
  /** @deprecated 固定为极数本源正文提取地址，仅作存储兼容 */
  apiBase: string
  /** ApiZero API Key（可选；不填走匿名免费额度，填写后配额更高） */
  apiKey: string
  /** 抖音 / 小红书 / B 站等链接走 ApiZero 视频元数据解析 */
  videoParseEnabled: boolean
  /** @deprecated 已由 videoParseEnabled 替代，读取时自动迁移 */
  allowLowTrustHosts?: boolean
  lastTest?: { ok: boolean; message: string; at: number }
}

export type ApiStore = {
  presets: ApiPreset[]
  currentPresetId: string
  linkPreview: LinkPreviewSettings
}

