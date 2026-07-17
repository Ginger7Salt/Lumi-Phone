import type { MomentItemModel } from './mockMoments'
import { loadUserMoments } from './momentsFeedStorage'
import { normalizeMomentLocation } from './momentLocationUtils'

const LOCATION_PART_SEP = '·'

/** 「A市」「某市」等占位城名（模型常抄提示用语） */
const PLACEHOLDER_CITY_EXACT =
  /^(?:[A-Za-z]|[甲乙丙丁戊己庚辛壬癸ABCDEFGHIJKLMNOPQRSTUVWXYZ]|某+|某某|示例|假名|虚构|测试|占位)(?:市|城|县)?$/u

const NON_CITY_TOKEN = new Set([
  '城市',
  '都市',
  '超市',
  '市场',
  '本市',
  '全市',
  '城区',
  '市区',
  '地铁',
  '商场',
  '世界',
  '国家',
  '帝国',
  '王国',
])

export function isPlaceholderLocationCity(city: string | null | undefined): boolean {
  const t = (city ?? '').trim()
  if (!t) return true
  if (PLACEHOLDER_CITY_EXACT.test(t)) return true
  if (/^[A-Za-z]$/u.test(normalizeCityKey(t))) return true
  if (/^[A-Za-z][市城县]$/u.test(t)) return true
  return false
}

/** 从人设 / 世界书文本抽取可用的世界观城市候选（优先显式「××市」） */
export function extractWorldviewCityCandidatesFromText(
  ...texts: Array<string | null | undefined>
): string[] {
  const joined = texts
    .map((t) => (t ?? '').trim())
    .filter(Boolean)
    .join('\n')
  if (!joined) return []

  const scores = new Map<string, { city: string; score: number }>()
  const bump = (raw: string, score: number) => {
    const city = raw.trim().replace(/[「」『』""']/g, '')
    if (city.length < 2 || city.length > 16) return
    if (NON_CITY_TOKEN.has(city)) return
    if (isPlaceholderLocationCity(city)) return
    const key = normalizeCityKey(city)
    if (!key || key.length < 2) return
    const prev = scores.get(key)
    if (prev) prev.score += score
    else scores.set(key, { city, score })
  }

  for (const m of joined.matchAll(
    /(?:生活在|现居|家住|定居|位于|住在|来自|出生于|老家|主城|帝都|王城|都城|据点在|常住)[于在]?[「『""']?([\u4e00-\u9fffA-Za-z·]{2,16})/gu,
  )) {
    bump(m[1]!, 5)
  }
  for (const m of joined.matchAll(/([\u4e00-\u9fff]{2,12}市)/gu)) {
    bump(m[1]!, 4)
  }
  for (const m of joined.matchAll(/([\u4e00-\u9fff]{2,10}(?:城|都))(?=[，。；、\s」』""'（）()]|$)/gu)) {
    const hit = m[1]!
    if (hit.endsWith('城市') || hit.endsWith('都市')) continue
    bump(hit, 2)
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .map((x) => x.city)
    .slice(0, 8)
}

/** 丢掉字母占位城等非法位置 */
export function rejectPlaceholderMomentLocation(
  location: string | null | undefined,
): string | undefined {
  const normalized = normalizeMomentLocation(location ?? undefined)
  if (!normalized) return undefined
  const city = extractCitySegment(normalized)
  if (isPlaceholderLocationCity(city)) return undefined
  for (const part of parseLocationParts(normalized)) {
    if (isPlaceholderLocationCity(part)) return undefined
  }
  return normalized
}

/** 跨城/迁居类信号：上下文中出现时才允许市级变更 */
const RELOCATION_SIGNAL =
  /(?:搬家|迁居|搬迁|搬到|搬去|去了|来到|飞到|飞往|出差|差旅|旅游|旅行|出游|游玩|度假|转场|异地|外地|另一座|换城市|落脚|抵达|落地|回程|返家|离开.+?(?:市|城|省)|回到.+?(?:市|城|省)|在.+?(?:市|城|省).?(?:出差|旅游|玩|打卡))/i

export function parseLocationParts(location: string | null | undefined): string[] {
  const normalized = normalizeMomentLocation(location ?? undefined)
  if (!normalized) return []
  return normalized.split(LOCATION_PART_SEP).map((p) => p.trim()).filter(Boolean)
}

export function extractCitySegment(location: string | null | undefined): string | null {
  const parts = parseLocationParts(location)
  return parts[0] ?? null
}

/** 去掉「市/省/自治区」等后缀便于比对 */
export function normalizeCityKey(city: string): string {
  return city
    .trim()
    .replace(/(特别行政区|自治区|自治州|地区|盟|市|省)$/u, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

export function citiesReferToSamePlace(a: string, b: string): boolean {
  const ka = normalizeCityKey(a)
  const kb = normalizeCityKey(b)
  if (!ka || !kb) return false
  if (ka === kb) return true
  return ka.includes(kb) || kb.includes(ka)
}

export function detectRelocationSignalsInContext(...texts: (string | null | undefined)[]): boolean {
  const joined = texts
    .map((t) => (t ?? '').trim())
    .filter(Boolean)
    .join('\n')
  if (!joined) return false
  return RELOCATION_SIGNAL.test(joined)
}

export function replaceLocationCity(location: string, anchorCity: string): string | undefined {
  const normalized = normalizeMomentLocation(location)
  if (!normalized) return normalizeMomentLocation(anchorCity)
  const parts = parseLocationParts(normalized)
  if (!parts.length) return normalizeMomentLocation(anchorCity)
  const rest = parts.slice(1)
  return normalizeMomentLocation(
    rest.length ? `${anchorCity.trim()}${LOCATION_PART_SEP}${rest.join(LOCATION_PART_SEP)}` : anchorCity.trim(),
  )
}

export function resolveAnchorCityFromLocations(locations: string[]): string | null {
  const cities: string[] = []
  for (const loc of locations) {
    const cleaned = rejectPlaceholderMomentLocation(loc)
    const city = extractCitySegment(cleaned)
    if (city && !isPlaceholderLocationCity(city)) cities.push(city)
  }
  if (!cities.length) return null

  const counts = new Map<string, { city: string; count: number; lastIndex: number }>()
  cities.forEach((city, index) => {
    const key = normalizeCityKey(city)
    const prev = counts.get(key)
    if (prev) {
      prev.count += 1
      prev.lastIndex = index
    } else {
      counts.set(key, { city, count: 1, lastIndex: index })
    }
  })

  let best: { city: string; count: number; lastIndex: number } | null = null
  for (const row of counts.values()) {
    if (
      !best ||
      row.count > best.count ||
      (row.count === best.count && row.lastIndex > best.lastIndex)
    ) {
      best = row
    }
  }
  return best?.city ?? null
}

export async function loadCharacterMomentLocationHistory(
  accountId: string | null | undefined,
  characterId: string,
  limit = 12,
): Promise<string[]> {
  const cid = characterId.trim()
  if (!cid) return []
  const all = await loadUserMoments(accountId)
  const locations: string[] = []
  for (const item of all) {
    if (item.authorCharacterId?.trim() !== cid) continue
    const loc = formatMomentLocationForHistory(item.location)
    if (loc) locations.push(loc)
    if (locations.length >= limit) break
  }
  return locations
}

function formatMomentLocationForHistory(location: string | null | undefined): string | null {
  return rejectPlaceholderMomentLocation(location) ?? null
}

export async function resolveCharacterLocationAnchor(params: {
  accountId: string | null | undefined
  characterId: string
}): Promise<{ anchorCity: string | null; recentLocations: string[] }> {
  const recentLocations = await loadCharacterMomentLocationHistory(
    params.accountId,
    params.characterId,
  )
  return {
    anchorCity: resolveAnchorCityFromLocations(recentLocations),
    recentLocations,
  }
}

/** 历史位置优先；否则用人设/世界书抽出的世界观城名 */
export function mergeLocationAnchorWithPersona(params: {
  locationAnchor: { anchorCity: string | null; recentLocations: string[] }
  personaTexts: Array<string | null | undefined>
}): { anchorCity: string | null; recentLocations: string[] } {
  const recentLocations = params.locationAnchor.recentLocations
    .map((x) => rejectPlaceholderMomentLocation(x))
    .filter((x): x is string => Boolean(x))
  const historyCity =
    resolveAnchorCityFromLocations(recentLocations) ??
    (params.locationAnchor.anchorCity && !isPlaceholderLocationCity(params.locationAnchor.anchorCity)
      ? params.locationAnchor.anchorCity
      : null)
  const personaCity = extractWorldviewCityCandidatesFromText(...params.personaTexts)[0] ?? null
  return {
    recentLocations,
    anchorCity: historyCity ?? personaCity,
  }
}

export function buildCharacterLocationPromptBlock(params: {
  anchorCity: string | null
  recentLocations: string[]
  relocationAllowed: boolean
}): string {
  const { anchorCity, recentLocations, relocationAllowed } = params
  const recentLine =
    recentLocations.length > 0
      ? `近期朋友圈位置：${recentLocations.slice(0, 5).join('；')}`
      : '近期朋友圈尚无位置记录。'

  if (anchorCity) {
    const crossCityRule = relocationAllowed
      ? `- 上下文中已出现搬家/出差/旅行等**明确跨城**依据时，才可填写其他城市，且须与正文一致。\n- 无明确跨城依据时，市级仍必须是「${anchorCity}」。`
      : `- 除非长期记忆或近期对话**明确**出现搬家、出差、旅行、异地打卡等跨城情节，否则**禁止**填写其他城市。\n- 无跨城依据的日常/情绪/在家动态：location 填 null。`

    return [
      '【位置锚点 · 市级一致性（仅在你决定附带 location 时生效）】',
      `该角色已建立常驻市级锚点：**${anchorCity}**（${recentLine}）`,
      '- **默认不带位置**：多数动态 location 填 null；只有角色主动想强调所在地点时才附带。',
      `- 若填写 location，第一级（「·」前）**必须与「${anchorCity}」指同一座城市**；禁止无故换城。`,
      crossCityRule,
      `- 同城外出打卡（商场/咖啡/公园/演出）：可写「${anchorCity}·区/商圈/店名」，仅细化下级，**市级不变**。`,
      '- 禁止因换一条动态就随意换城市；拿不准或无需强调地点时填 null。',
      '- **严禁**字母/序号占位城市（如用字母市名轮换）；地名须来自人设与世界观。',
    ].join('\n')
  }

  return [
    '【位置锚点 · 市级一致性（仅在你决定附带 location 时生效）】',
    recentLine,
    '- **默认不带位置**：多数动态 location 填 null；是否附带由角色自行决定，非必要不写。',
    '- 若本条附带 location：**第一级地名必须取自【角色人设基础信息 / 世界书 / 世界背景】中已出现的城市或地名**；没有明确城市时填 null，禁止自编占位城市。',
    '- 选定常驻城后后续附带位置时须长期保持一致；除非记忆/对话明确跨城，否则不要更换市级。',
    '- **严禁**「字母+市」、甲乙丙市、某市、某某市等占位写法。',
  ].join('\n')
}

export function enforceCharacterLocationConsistency(params: {
  location: string | undefined
  anchorCity: string | null
  contextTexts: (string | null | undefined)[]
  /** 本条正文（生成后校验时传入） */
  postContent?: string | null
}): string | undefined {
  const normalized = rejectPlaceholderMomentLocation(params.location)
  if (!normalized) return undefined

  const relocationAllowed = detectRelocationSignalsInContext(
    ...params.contextTexts,
    params.postContent,
  )

  if (!params.anchorCity) {
    // 无人设锚点时：若上下文抽得出世界观城市，且模型写了无关城，纠正或丢弃占位
    const personaCities = extractWorldviewCityCandidatesFromText(...params.contextTexts)
    const preferred = personaCities[0] ?? null
    const city = extractCitySegment(normalized)
    if (!preferred) {
      // 无任何世界观城市线索却编出城名：仍允许非占位地名（历史兼容），但占位已剔除
      return normalized
    }
    if (!city || citiesReferToSamePlace(city, preferred)) return normalized
    if (relocationAllowed) return normalized
    return replaceLocationCity(normalized, preferred)
  }

  const city = extractCitySegment(normalized)
  if (!city || citiesReferToSamePlace(city, params.anchorCity)) {
    return normalized
  }

  if (relocationAllowed) {
    return normalized
  }

  return replaceLocationCity(normalized, params.anchorCity)
}

/** 从已发布动态列表中提取锚点（无需 async 读库） */
export function resolveAnchorFromMomentItems(
  moments: MomentItemModel[],
  characterId: string,
): { anchorCity: string | null; recentLocations: string[] } {
  const cid = characterId.trim()
  const recentLocations: string[] = []
  for (const item of moments) {
    if (item.authorCharacterId?.trim() !== cid) continue
    const loc = formatMomentLocationForHistory(item.location)
    if (loc) recentLocations.push(loc)
    if (recentLocations.length >= 12) break
  }
  return {
    anchorCity: resolveAnchorCityFromLocations(recentLocations),
    recentLocations,
  }
}
