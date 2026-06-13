/** 朋友圈单条动态最多配图张数（与微信一致） */
export const MAX_MOMENT_IMAGES = 9

/** 写入大模型任务：配图张数规则 */
export const MOMENT_IMAGE_COUNT_PROMPT = `
# 配图张数（WeChat 朋友圈）
- images / imagePrompts 数组长度即配图张数：可为 1 张，也可为 2~9 张，勿默认只给 1 张。
- 单图随手拍、单一特写 → 1 张；聚餐多菜、旅行打卡、穿搭合集、活动记录 → 优先 2~9 张。
- 每张英文 prompt 须描述不同画面/角度/主体，禁止九张雷同复制；最多 9 项。
`.trim()

/** 朋友圈正文：最长约 2000 字（公告、小作文、爆瓜等） */
export const MOMENT_BODY_MAX_CHARS = 2000

/** 信息流折叠预览字数 */
export const MOMENT_BODY_COLLAPSE_CHARS = 120

/** 瞬时生成：正文字数拉杆范围（最少 1 字，含标点/emoji） */
export const INSTANT_GEN_TEXT_LENGTH_MIN = 1
export const INSTANT_GEN_TEXT_LENGTH_MAX = MOMENT_BODY_MAX_CHARS
export const INSTANT_GEN_TEXT_LENGTH_DEFAULT = 120

/** 历史朋友圈批量生成：正文字数范围默认值 */
export const HISTORICAL_GEN_TEXT_LENGTH_MIN_DEFAULT = 12
export const HISTORICAL_GEN_TEXT_LENGTH_MAX_DEFAULT = 120

export const HISTORICAL_GEN_TEXT_LENGTH_PRESETS: {
  id: string
  label: string
  min: number
  max: number
}[] = [
  { id: 'quip', label: '碎念', min: 8, max: 45 },
  { id: 'daily', label: '日常', min: 20, max: 120 },
  { id: 'mixed', label: '长短混合', min: 8, max: 180 },
  { id: 'long', label: '偏长', min: 80, max: 400 },
]

export function clampHistoricalTextLengthRange(
  minRaw: number,
  maxRaw: number,
): { min: number; max: number } {
  const min = clampInstantGenTextLength(minRaw)
  const max = clampInstantGenTextLength(maxRaw)
  if (min <= max) return { min, max }
  return { min: max, max: min }
}

export function formatHistoricalTextLengthRangeLabel(min: number, max: number): string {
  const { min: lo, max: hi } = clampHistoricalTextLengthRange(min, max)
  if (lo === hi) return formatInstantGenTextLengthLabel(lo)
  return `${lo}～${hi} 字 · 每条随机`
}

/** 历史批次内为每条动态抽取目标字数（偏短为主，置顶略偏长） */
export function pickHistoricalTextLengthTarget(
  minRaw: number,
  maxRaw: number,
  index: number,
  isPinned = false,
): number {
  const { min, max } = clampHistoricalTextLengthRange(minRaw, maxRaw)
  if (min === max) return min

  const span = max - min
  const roll = Math.random()
  let ratio: number
  if (isPinned) {
    ratio = 0.45 + roll * 0.55
  } else if (roll < 0.5) {
    ratio = roll * 0.42
  } else if (roll < 0.82) {
    ratio = 0.28 + (roll - 0.5) * 0.9
  } else {
    ratio = 0.62 + (roll - 0.82) * 2.1
  }

  const jitter = ((index * 17) % 13) / 100
  ratio = Math.max(0, Math.min(1, ratio + jitter - 0.06))
  return Math.round(min + span * ratio)
}

export function buildHistoricalTextLengthHint(
  minRaw: number,
  maxRaw: number,
  itemTarget: number,
  isPinned = false,
): string {
  const { min, max } = clampHistoricalTextLengthRange(minRaw, maxRaw)
  const target = clampInstantGenTextLength(itemTarget)
  const base = buildInstantGenTextLengthHint(target)
  const variety = [
    `【字数 · 本条】目标约 ${target} 字（批次参考范围 ${min}～${max} 字，每条须不同，勿条条一样长）。`,
    '真人朋友圈多为一两句碎碎念、短吐槽、极简留白；仅少数需要稍长，禁止条条小作文。',
    isPinned ? '本条将置顶：可略长但仍须精炼，勿超过本条目标太多。' : '',
  ]
    .filter(Boolean)
    .join('\n')
  return `${base}\n${variety}`
}

export function trimHistoricalMomentBody(content: string, target: number): string {
  const text = content.trim()
  if (!text) return text
  const hardMax = Math.min(
    MOMENT_BODY_MAX_CHARS,
    Math.max(target + 12, Math.round(target * 1.2)),
  )
  if (text.length <= hardMax) return text
  const slice = text.slice(0, hardMax)
  const cut = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('！'), slice.lastIndexOf('？'), slice.lastIndexOf('\n'))
  if (cut >= Math.floor(hardMax * 0.55)) return slice.slice(0, cut + 1).trim()
  return slice.trim()
}

export const INSTANT_GEN_TEXT_LENGTH_PRESETS: { value: number; label: string }[] = [
  { value: 1, label: '一字' },
  { value: 40, label: '短句' },
  { value: 120, label: '日常' },
  { value: 300, label: '中等' },
  { value: 600, label: '较长' },
  { value: 1200, label: '长文' },
  { value: 2000, label: '小作文' },
]

export function clampInstantGenTextLength(raw: number): number {
  const n = Number.isFinite(raw) ? Math.round(raw) : INSTANT_GEN_TEXT_LENGTH_DEFAULT
  return Math.max(INSTANT_GEN_TEXT_LENGTH_MIN, Math.min(INSTANT_GEN_TEXT_LENGTH_MAX, n))
}

export function snapInstantGenTextLength(raw: number): number {
  const clamped = clampInstantGenTextLength(raw)
  let best = INSTANT_GEN_TEXT_LENGTH_PRESETS[0]!.value
  let bestDist = Math.abs(clamped - best)
  for (const p of INSTANT_GEN_TEXT_LENGTH_PRESETS) {
    const dist = Math.abs(clamped - p.value)
    if (dist < bestDist) {
      best = p.value
      bestDist = dist
    }
  }
  return best
}

export function formatInstantGenTextLengthLabel(chars: number): string {
  const hit = INSTANT_GEN_TEXT_LENGTH_PRESETS.find((p) => p.value === chars)
  if (hit) return `${hit.label} · ${chars} 字`
  return `${chars} 字`
}

export function buildInstantGenTextLengthHint(chars: number): string {
  const target = clampInstantGenTextLength(chars)
  if (target <= 1) {
    return `正文 content 目标 ${target} 字：可仅一字、一个标点或 emoji，极简留白（如「。」「？」「6」）。`
  }
  if (target <= 15) {
    return `正文 content 目标约 ${target} 字以内：极短，一两词或半句话即可。`
  }
  if (target <= 60) {
    return `正文 content 目标约 ${target} 字以内：一两句话、短促口语，适合随手吐槽或感叹。`
  }
  if (target <= 150) {
    return `正文 content 目标约 ${target} 字：日常碎碎念，2～4 句，轻松自然。`
  }
  if (target <= 400) {
    return `正文 content 目标约 ${target} 字：可稍展开，分段 1～2 段，有细节但不冗长。`
  }
  if (target <= 800) {
    return `正文 content 目标约 ${target} 字：可写小故事或较完整观点，须分段换行。`
  }
  if (target <= 1400) {
    return `正文 content 目标约 ${target} 字：长文动态，须层次清晰、分段明确，适合公告/复盘/抒情。`
  }
  return `正文 content 目标约 ${target} 字（上限 ${MOMENT_BODY_MAX_CHARS}）：小作文级长文，须分段、有起承转合，适合爆瓜/通知/深度感悟。`
}

export function fallbackInstantGenBodyContent(targetChars: number): string {
  const n = clampInstantGenTextLength(targetChars)
  if (n <= 1) return '。'
  if (n <= 12) return '嗯。'
  if (n <= 40) return '今天也就这样吧。'
  if (n <= 120) return '随便写两句，反正也没人看。'
  return '有些话说出来就轻了，写在这里当作给自己留档。'
}

export function estimateInstantGenMaxTokens(textLengthTarget: number): number {
  const target = clampInstantGenTextLength(textLengthTarget)
  const floor = target <= 5 ? 500 : 900
  return Math.min(4800, Math.max(floor, Math.round(target * 2.4 + 1000)))
}

export function clampMomentBodyText(text: string, maxChars = MOMENT_BODY_MAX_CHARS): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars)
}

export const MOMENT_BODY_LENGTH_HINT = `
正文 content 最长 ${MOMENT_BODY_MAX_CHARS} 字。日常动态可短；官方公告、通知、小作文、爆瓜等可写长（数百字至 ${MOMENT_BODY_MAX_CHARS} 字），须分段换行、层次清晰。
`.trim()
