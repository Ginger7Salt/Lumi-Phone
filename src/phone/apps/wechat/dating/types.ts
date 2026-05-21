export type DateMode = 'normal' | 'vn'
export type NarrativePerspective = 'first' | 'second' | 'third'
/** 剧情 AI 目标正文字数（汉字）：与 DatingStoryPage、generateDatingAi 共用 */
export const DATING_AI_LENGTH_TARGET_MIN = 60
/** UI 可设上限；模型正文约落在目标的 88%～118%（不含思维链 / VN 语音参数） */
export const DATING_AI_LENGTH_TARGET_MAX = 10_000

export function clampDatingLengthTargetChars(raw: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 500
  return Math.max(
    DATING_AI_LENGTH_TARGET_MIN,
    Math.min(DATING_AI_LENGTH_TARGET_MAX, Math.round(n)),
  )
}
/** 送入约会剧情模型的上下文预算（词符/token；仍受 API/模型实际上限） */
export const DATING_AI_MAX_CONTEXT_TOKENS = 200_000

/** 剧情续写单次 completion 最大回复（词符/token；仍受所选模型/API 限制） */
export const DATING_AI_MAX_OUTPUT_TOKENS = 30_000

/**
 * 参考资料汉字总预算（按 {@link DATING_AI_MAX_CONTEXT_TOKENS} 估算，预留 system/思维链指令）。
 * 各段独立裁剪，合计可接近该预算。
 */
export const DATING_AI_REFERENCE_TOTAL_CHAR_BUDGET = 150_000

/**
 * 长期记忆 / 尚未总结·私聊 / 群聊 等按段软上限。
 */
export const DATING_AI_REFERENCE_SECTION_CHAR_CAP = 30_000

/** 「尚未总结·线下剧情」正文摘录软上限（游标后全文） */
export const DATING_AI_OFFLINE_UNSUMMARIZED_CHAR_CAP = 80_000

/** 「最近剧情」「场景人物线索」注入软上限 */
export const DATING_AI_HISTORY_PROMPT_MAX = 60_000

export const DATING_AI_SCENE_HINTS_PROMPT_MAX = 20_000

export type NarrativeGenOptions = {
  /** 期望字数（大概值，非硬性） */
  lengthTargetChars?: number
  autoUserReaction?: boolean
  /** 文风描述，与 referenceSnippet 一并注入 system 侧补充（见 datingStylePrompt） */
  stylePrompt?: string
  /** 参考片段，模仿句式与节奏 */
  referenceSnippet?: string
  /** 剧情分支：选中卡片后的续写执导（仅当轮注入 user 侧一次） */
  branchContinuationHint?: string
  /**
   * 仅 **VN 自定义输入** 发送时由界面填入；缺省表示其它入口（分支/普通输入）不附加本条语义。
   * `paraphrase`：玩家输入仅为剧情走向引导，**尚未发生**，正文须当场演出过程。
   * `canon`：玩家输入视为**已经发生**的事实，正文写他人反应与后续。
   */
  vnCustomIntentMode?: 'canon' | 'paraphrase'
}

export type PlotItemType = 'player' | 'ai'

export type DatingCardBgMode = 'solid' | 'gradient' | 'image'

export type DatingCardStyle = {
  /** 是否显示卡片内容（不影响返回/菜单键） */
  showContent: boolean
  /** 字体颜色（同时用于返回/菜单图标） */
  textColor: string
  /** 背景模式 */
  bgMode: DatingCardBgMode
  /** 纯色 */
  solidColor: string
  /** 渐变 */
  gradientFrom: string
  gradientTo: string
  gradientAngle: number
  /** 图片（URL 或 dataURL） */
  imageUrl: string
  /** 毛玻璃 */
  glass: boolean
  /** 毛玻璃强度（px） */
  glassBlur: number
  /** 背景不透明度 0-1（只影响背景层） */
  bgOpacity: number
  /** 标签样式 */
  tagBgMode: DatingCardBgMode
  tagSolidColor: string
  tagGradientFrom: string
  tagGradientTo: string
  tagGradientAngle: number
  tagImageUrl: string
  tagBgOpacity: number
  tagTextColor: string
  /** 圆角（px），999 表示胶囊 */
  tagRadius: number
}

export type CharacterInfo = {
  id: string
  avatarUrl: string
  realName: string
  pinyin: string
  age: number
  heightCm: number
  weightKg: number
  zodiac: string
  /** 生日：月+日，如 3-14 / 03-14 */
  birthdayMD: string
  /** 座右铭 */
  motto: string
  /** 顶部身份卡样式 */
  cardStyle?: Partial<DatingCardStyle>
  identityTags: string[]
  signature: string
  prompt: string
}

/** 本段 AI 剧情曾成功写入的「尾声延展」补丁：重新生成时用于把人设条目恢复为补丁前正文，避免新稿被当轮覆写牵着走 */
export type WorldBookAfterRevertEntry = {
  worldBookId: string
  itemId: string
  /** 应用该轮补丁前该条目的正文（空串表示当时为空） */
  contentBefore: string
  /**
   * 该轮补丁成功写入后的正文（与模型 newContent 对齐）。
   * 重新生成时：若人设里当前正文与此不一致，视为用户已手改或后续剧情已覆盖，**跳过**本条回滚，以当前库为准。
   */
  contentAfterPatch?: string
}

export type PlotItem = {
  id: string
  type: PlotItemType
  content: string
  timestamp: number
  highlightText?: string
  /** 完整思维链（`<thinking>...</thinking>` 内原文；兼容旧存档 `<logicpass>`，供折叠查看） */
  logicPass?: string
  /** 旧版：仅一行规划摘要，兼容历史存档 */
  planSummary?: string
  /** 仅 AI 条：每次「重新回复」追加一条，不覆盖旧稿 */
  versions?: string[]
  /** 与 `versions` 等长时，各版对应的思维链文本 */
  versionLogicPasses?: (string | undefined)[]
  /** 当前展示版本下标，默认指向最新 */
  currentVersionIndex?: number
  /**
   * 本条 AI 最近一次**成功落库**的尾声延展补丁所对应的「补丁前」快照；仅用于重新生成时恢复人设。
   * 若最近一次完成本条时模型未提交补丁，则为 undefined。
   */
  worldBookAfterRevertEntries?: WorldBookAfterRevertEntry[]
}

export type BranchOption = {
  id: string
  content: string
  nextPrompt: string
  /** 模型分支风格：顺水推舟 / 趣味性 / 转折性 / 恶搞性 */
  styleLabel?: string
}

export type CharacterArchive = {
  characterId: string
  plots: PlotItem[]
  currentProgress: number
  modePreference: DateMode
  /** 上帝视角：旁白推进，不直接对「你」说话、不与玩家互动 */
  godPerspective: boolean
  branchEnabled: boolean
  /** 线下普通模式：是否在每轮 AI 剧情后生成弹幕（走弹幕接口与全局/角色弹幕配置） */
  offlineDanmakuEnabled?: boolean
  /** VN 模式：禁用语音合成/播放（省 token + 省请求） */
  vnVoiceDisabled?: boolean
  /** VN 自定义输入面板：开启「转述」时，输入仅为剧情引导（未发生）；关闭则视为既定事实 */
  vnCustomInputParaphrase?: boolean
  lastDateAt: number | null
  pendingBranches: BranchOption[]
  branchNodeHistory: number[]
  /** 选中分支卡片后、待发送时注入续写执导（发送后清空） */
  branchContinuationHint?: string
  /** 线下/VN 剧情生成：目标正文字数（汉字），与界面「目标字数」同步落盘，避免切换角色后仍用默认 500 */
  datingLengthTargetChars?: number
}

