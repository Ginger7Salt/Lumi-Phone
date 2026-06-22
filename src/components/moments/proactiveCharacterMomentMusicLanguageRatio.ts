export type ProactiveMomentMusicLanguageId =
  | 'mandarin'
  | 'cantonese'
  | 'english'
  | 'korean'
  | 'japanese'
  | 'other'

export type ProactiveMomentMusicLanguageRatioSettings = Record<
  ProactiveMomentMusicLanguageId,
  number
>

export type ResolvedProactiveMomentMusicLanguageRatioEntry = {
  id: ProactiveMomentMusicLanguageId
  label: string
  percent: number
  weight: number
  examples: string
}

export const PROACTIVE_MOMENT_MUSIC_LANGUAGE_OPTIONS: {
  id: ProactiveMomentMusicLanguageId
  label: string
  examples: string
  hint?: string
}[] = [
  {
    id: 'mandarin',
    label: '华语',
    examples: '周杰伦、林俊杰、邓紫棋、毛不易、薛之谦、孙燕姿等',
    hint: '国语流行、民谣、说唱、影视 OST、抖音热歌等',
  },
  {
    id: 'cantonese',
    label: '粤语',
    examples: '陈奕迅、容祖儿、张学友、杨千嬅、G.E.M. 粤语作品等',
  },
  {
    id: 'english',
    label: '英语',
    examples: 'Taylor Swift、Ed Sheeran、The Weeknd 等',
  },
  {
    id: 'korean',
    label: '韩语',
    examples: 'IU、NewJeans、BTS、BLACKPINK 等',
  },
  {
    id: 'japanese',
    label: '日语',
    examples: 'YOASOBI、米津玄师、宇多田光等',
  },
  {
    id: 'other',
    label: '其他语言',
    examples: '法语、西班牙语、泰语等小众语种真实曲目',
  },
]

export const DEFAULT_PROACTIVE_MOMENT_MUSIC_LANGUAGE_RATIO: ProactiveMomentMusicLanguageRatioSettings =
  {
    mandarin: 75,
    cantonese: 10,
    english: 8,
    korean: 4,
    japanese: 2,
    other: 1,
  }

function clampWeight(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function normalizeProactiveMomentMusicLanguageRatio(
  raw: unknown,
): ProactiveMomentMusicLanguageRatioSettings {
  const base = { ...DEFAULT_PROACTIVE_MOMENT_MUSIC_LANGUAGE_RATIO }
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const next = { ...base }
  for (const opt of PROACTIVE_MOMENT_MUSIC_LANGUAGE_OPTIONS) {
    next[opt.id] = clampWeight(o[opt.id], base[opt.id])
  }
  return next
}

/** 将权重归一化为合计 100% 的生效占比 */
export function resolveProactiveMomentMusicLanguageRatio(
  raw: ProactiveMomentMusicLanguageRatioSettings,
): ResolvedProactiveMomentMusicLanguageRatioEntry[] {
  const weights = PROACTIVE_MOMENT_MUSIC_LANGUAGE_OPTIONS.map((opt) => ({
    ...opt,
    weight: clampWeight(raw[opt.id], DEFAULT_PROACTIVE_MOMENT_MUSIC_LANGUAGE_RATIO[opt.id]),
  }))
  const sum = weights.reduce((acc, row) => acc + row.weight, 0)
  if (sum <= 0) {
    return resolveProactiveMomentMusicLanguageRatio(DEFAULT_PROACTIVE_MOMENT_MUSIC_LANGUAGE_RATIO)
  }

  const rows = weights.map((row) => {
    const exactPercent = (row.weight / sum) * 100
    return {
      ...row,
      percent: Math.floor(exactPercent),
      remainder: exactPercent - Math.floor(exactPercent),
    }
  })

  let allocated = rows.reduce((acc, row) => acc + row.percent, 0)
  const byRemainder = [...rows].sort((a, b) => b.remainder - a.remainder)
  for (let i = 0; allocated < 100 && i < byRemainder.length; i += 1) {
    byRemainder[i].percent += 1
    allocated += 1
  }

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    percent: row.percent,
    weight: row.weight,
    examples: row.examples,
  }))
}

export function formatProactiveMomentMusicLanguageRatioSummary(
  raw: ProactiveMomentMusicLanguageRatioSettings,
): string {
  return resolveProactiveMomentMusicLanguageRatio(raw)
    .filter((row) => row.percent > 0)
    .map((row) => `${row.label} ${row.percent}%`)
    .join(' · ')
}

export function buildProactiveMomentMusicLanguageRatioPrompt(
  raw: ProactiveMomentMusicLanguageRatioSettings,
): string {
  const rows = resolveProactiveMomentMusicLanguageRatio(raw).filter((row) => row.percent > 0)
  const mixLines = rows
    .map((row) => `- **${row.label}**：约 ${row.percent}%（如 ${row.examples}）`)
    .join('\n')

  return `
- 本条若选 postType=music，选歌**语种**须符合下方长期占比（勿每条都选同一语种充数）：
${mixLines}
- 必填 attachedMusic：**网易云音乐能搜到的真实歌曲**；歌名、歌手写法须与所选语种一致。
- 若近期私聊或一起听**明确**提到某首具体歌曲，可破例选该曲，但仍须网易云可搜到、且符合角色人设。
- 勿编造不存在的歌手/组合；勿为装文艺随手选与占比无关的小众英文歌充数。
`.trim()
}
