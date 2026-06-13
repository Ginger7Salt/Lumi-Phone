/** 朋友圈位置：从大到小用「·」连接；须为角色世界观内的自拟地名，非提示词示例 */

const LOCATION_SEP = /[·・,，/\\、>\s]+/

const EMPTY_LOCATION = /^(无|不显示|null|none|n\/a)$/i

/** 非地理/抽象地点，不可作为 location 任一级 */
const NON_PLACE_EXACT = new Set([
  '家里',
  '家中',
  '在家',
  '宅家',
  '居家',
  '公司',
  '单位',
  '办公室',
  '工位',
  '宿舍',
  '寝室',
  '房间',
  '卧室',
  '客厅',
  '厨房',
  '浴室',
  '卫生间',
  '厕所',
  '学校',
  '教室',
  '实验室',
  '网上',
  '线上',
  '心里',
  '脑海',
  '梦中',
  '附近',
  '这里',
  '这边',
  '那儿',
  '那边',
  '某处',
  '未知',
  '保密',
  'home',
  'at home',
  'bedroom',
  'office',
  'online',
])

const NON_PLACE_PATTERN =
  /^(在)?(家|公司|单位|宿舍|学校|办公室|房间|卧室|客厅)(里|中|内|上)?$/i

function isPlaceSegment(segment: string): boolean {
  const s = segment.trim()
  if (!s || s.length < 2) return false
  const lower = s.toLowerCase()
  if (NON_PLACE_EXACT.has(s) || NON_PLACE_EXACT.has(lower)) return false
  if (NON_PLACE_PATTERN.test(s)) return false
  return true
}

export function normalizeMomentLocation(raw: unknown): string | undefined {
  if (raw == null) return undefined
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (!trimmed || EMPTY_LOCATION.test(trimmed)) return undefined

  const parts = trimmed
    .split(LOCATION_SEP)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter(isPlaceSegment)

  if (!parts.length) return undefined
  return parts.slice(0, 4).join('·')
}

export function formatMomentLocationDisplay(location?: string | null): string {
  const normalized = normalizeMomentLocation(location ?? undefined)
  return normalized ?? ''
}

export const MOMENT_LOCATION_PROMPT_HINT = `
可选字段 location：发朋友圈时附带的位置。**非必填，默认 null**。
# 是否带位置（由角色自行决定）
- **绝大多数动态 location 填 null**；不必每条都带地址，是否附带完全取决于你当下是否想强调「我在哪里」。
- **适合附带位置**：打卡探店、演出/展览现场、旅行异地、正文明确在强调所在场所（「在这家咖啡馆」「XX 展太好看了」等）。
- **通常不带位置**：日常碎碎念、纯情绪发泄、在家/公司/宿舍的随手拍、与用户暧昧拉扯、没有「强调地点」含义的内容——填 null 即可。
- 带与不带都是正常选择；不要为了凑字段而硬写位置。

# 若决定附带 location，格式须遵守：
- 从大到小用「·」连接，格式为「市/省·区/县·街道/商圈/店铺/地标」，可只写前 1~2 级
- 地名必须从【角色人设 + 世界背景 + 本条动态正文场景】中自拟，符合该角色所在世界观
- **市级锚点**：同一角色在未搬家/出差/旅行等明确跨城情节前，第一级地名须长期固定，不得动态间无故换城市
- 禁止照抄本提示中的格式占位符或任何示例专名；禁止所有角色共用同一座城市名
- 禁止非地理词汇：家里、家中、公司、卧室、办公室、附近、某处等
- 格式说明（非填空答案）：「{自拟市名}·{自拟区名}」或 null；错误：「XX市·家里」
`.trim()
