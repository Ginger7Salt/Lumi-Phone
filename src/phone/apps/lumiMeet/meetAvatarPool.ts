/**
 * 遇见雷达匹配头像：与微信侧人设/NPC 头像池同源目录（根目录 image/），
 * 选取时尽量避开镜像微信中已有角色的头像 URL（含 basename 对齐打包路径与 /image/ 路径）。
 *
 * 年龄段：此前把「青年池」与「长辈文件夹」及异性池混在同一数组里均匀随机，会导致明明是年轻女性却抽到长辈目录或男性目录头像。
 * 现改为分层：先青年同性 → 再长辈同性 → 最后才跨池兜底。
 */
import { publicAssetUrl } from '../../../publicAssetUrl'
import { parseMeetAgeYearsFromInfo } from './comprehensivePersona'
import type { RadarFilters } from './meetTypes'

const AVATAR_MALE_E_SUNNY = Object.values(
  import.meta.glob('../../../../image/微信头像男E型阳光/*.{png,jpg,jpeg,webp,gif}', {
    eager: true,
    import: 'default',
  }) as Record<string, string>,
)
const AVATAR_MALE_I_COOL = Object.values(
  import.meta.glob('../../../../image/微信头像男I型清冷/*.{png,jpg,jpeg,webp,gif}', {
    eager: true,
    import: 'default',
  }) as Record<string, string>,
)
const AVATAR_FEMALE_CUTE = Object.values(
  import.meta.glob('../../../../image/微信头像女可爱活泼/*.{png,jpg,jpeg,webp,gif}', {
    eager: true,
    import: 'default',
  }) as Record<string, string>,
)
const AVATAR_FEMALE_COOL = Object.values(
  import.meta.glob('../../../../image/微信头像女清冷和御姐/*.{png,jpg,jpeg,webp,gif}', {
    eager: true,
    import: 'default',
  }) as Record<string, string>,
)
const AVATAR_ELDER_MALE = Object.values(
  import.meta.glob('../../../../image/40岁以上长辈头像男/*.{png,jpg,jpeg,webp,gif}', {
    eager: true,
    import: 'default',
  }) as Record<string, string>,
)
const AVATAR_ELDER_FEMALE = Object.values(
  import.meta.glob('../../../../image/40岁以上长辈头像女/*.{png,jpg,jpeg,webp,gif}', {
    eager: true,
    import: 'default',
  }) as Record<string, string>,
)

/** 全量合并（去重保序） */
export const MEET_ENCOUNTER_AVATAR_URLS: string[] = dedupeUrls([
  ...AVATAR_MALE_E_SUNNY,
  ...AVATAR_MALE_I_COOL,
  ...AVATAR_FEMALE_CUTE,
  ...AVATAR_FEMALE_COOL,
  ...AVATAR_ELDER_MALE,
  ...AVATAR_ELDER_FEMALE,
])

export type MeetAvatarExclusion = {
  urls: Set<string>
  basenames: Set<string>
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    const t = typeof u === 'string' ? u.trim() : ''
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function avatarBasename(url: string): string {
  const noq = url.split('?')[0] ?? url
  const seg = noq.split(/[/\\]/).pop() ?? ''
  return seg.trim().toLowerCase()
}

/** 从若干条目的 avatarUrl 构造排除集（全字 + 文件名） */
export function buildMeetAvatarExclusion(rows: Iterable<{ avatarUrl?: string | null }>): MeetAvatarExclusion {
  const urls = new Set<string>()
  const basenames = new Set<string>()
  for (const row of rows) {
    const u = row.avatarUrl?.trim()
    if (!u) continue
    urls.add(u)
    const bn = avatarBasename(u)
    if (bn) basenames.add(bn)
  }
  return { urls, basenames }
}

function isExcluded(candidate: string, ex?: MeetAvatarExclusion): boolean {
  if (!ex) return false
  const t = candidate.trim()
  if (!t) return true
  if (ex.urls.has(t)) return true
  const bn = avatarBasename(t)
  if (bn && ex.basenames.has(bn)) return true
  return false
}

function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * 从头像无关的性别文案推断头像池（男/女）；无法解析时返回 null，沿用雷达筛选。
 * 须与卡片上展示的 gender 一致，避免「文字女 + 男向头像」。
 */
/**
 * 从体征/叙事里人称与用词兜底推断性别（当顶层 gender 写成「其他」或与正文不一致时）。
 */
export function inferMeetAvatarGenderFromProse(info: string, physiology: string): 'male' | 'female' | null {
  const blob = `${info}\n${physiology}`.slice(0, 900)
  if (/女生|姑娘|学姐|师妹|女主|女友|姐妹(?!圈)|母女|女单/u.test(blob)) return 'female'
  if (/男生|小伙|学长|师弟|男主|男友|父子/u.test(blob)) return 'male'
  const she = (blob.match(/她/g) ?? []).length
  /** 「他们」里的「他」不算男主称谓 */
  const heAlone = (blob.match(/他(?!们)/g) ?? []).length
  if (she >= 2 && she >= heAlone + 2) return 'female'
  if (heAlone >= 2 && heAlone >= she + 2) return 'male'
  return null
}

/** 综合顶层性别文案、正文兜底、雷达筛选，得到用于头像池的「男/女」提示 */
export function resolveMeetAvatarNpcGenderLabel(params: {
  npcGenderRaw: string
  proseInfo: string
  prosePhysiology: string
  filterGender: RadarFilters['gender']
}): string | undefined {
  const fromLabel = inferMeetAvatarGenderFromNpc(params.npcGenderRaw)
  if (fromLabel === 'female') return '女'
  if (fromLabel === 'male') return '男'
  const fromProse = inferMeetAvatarGenderFromProse(params.proseInfo, params.prosePhysiology)
  if (fromProse === 'female') return '女'
  if (fromProse === 'male') return '男'
  if (params.filterGender === 'female') return '女'
  if (params.filterGender === 'male') return '男'
  return undefined
}

export function inferMeetAvatarGenderFromNpc(npcGender: string | undefined | null): 'male' | 'female' | null {
  const raw = (npcGender ?? '').trim()
  if (!raw) return null
  const compact = raw.replace(/\s/g, '')
  if (!compact || compact === '其他' || compact === '未知' || compact === '保密' || compact === '不限') return null
  if (/^(男|男性|男生)$/u.test(compact) || /^male$/i.test(raw)) return 'male'
  if (/^(女|女性|女生)$/u.test(compact) || /^female$/i.test(raw)) return 'female'
  if (compact.includes('女') && !compact.includes('男')) return 'female'
  if (compact.includes('男') && !compact.includes('女')) return 'male'
  return null
}

/** 生成角色性别优先于雷达筛选（雷达「不限」时也必须按角色性别选图） */
function resolveAvatarPoolGender(
  filters: RadarFilters | undefined,
  npcGender: string | undefined,
): 'male' | 'female' | 'any' {
  const inferred = inferMeetAvatarGenderFromNpc(npcGender)
  if (inferred === 'male' || inferred === 'female') return inferred
  return filters?.gender ?? 'any'
}

/** 青年 / 长辈头像分组（用于分层抽取，避免年龄文件夹串味） */
const POOL_YOUNG_FEMALE = dedupeUrls([...AVATAR_FEMALE_CUTE, ...AVATAR_FEMALE_COOL])
const POOL_YOUNG_MALE = dedupeUrls([...AVATAR_MALE_E_SUNNY, ...AVATAR_MALE_I_COOL])
const POOL_ELDER_FEMALE = dedupeUrls([...AVATAR_ELDER_FEMALE])
const POOL_ELDER_MALE = dedupeUrls([...AVATAR_ELDER_MALE])

export type MeetAvatarAgeBand = 'young' | 'elder'

/**
 * 结合卡片年龄、正文措辞与雷达年龄区间，推断应用「青年池」还是「长辈池」。
 * 默认偏青年（约会场景多数为年轻人），避免未写明年岁时误进长辈目录。
 */
export function resolveMeetAvatarAgeBand(params: {
  ageYears?: number | null
  filters?: RadarFilters
  proseInfo?: string
  prosePhysiology?: string
}): MeetAvatarAgeBand {
  const blob = `${params.proseInfo ?? ''}\n${params.prosePhysiology ?? ''}`.slice(0, 900)
  if (/退休|疗养|养老院|孙子|孙女|中老年|大妈大爷|五十岁|六十岁|花甲|古稀/u.test(blob)) return 'elder'
  if (/大四|大三|大二|大一|高中生|应届生|二十出头/u.test(blob)) return 'young'

  let y = params.ageYears
  if (y == null || !Number.isFinite(y)) {
    const fromInfo = parseMeetAgeYearsFromInfo(params.proseInfo ?? '')
    if (fromInfo != null) y = fromInfo
  }
  if (y != null && Number.isFinite(y)) {
    if (y >= 40) return 'elder'
    return 'young'
  }

  const f = params.filters
  if (f) {
    if (f.ageMin >= 45) return 'elder'
    if (f.ageMax <= 36) return 'young'
  }

  return 'young'
}

/**
 * 分层候选：每一层只在上一层全部不可用（通常被 exclusion 占满）时才落到下一层。
 */
function buildAvatarPickTiers(
  poolGender: 'male' | 'female' | 'any',
  ageBand: MeetAvatarAgeBand,
): string[][] {
  if (poolGender === 'any') {
    if (ageBand === 'elder') {
      return [
        dedupeUrls([...POOL_ELDER_FEMALE, ...POOL_ELDER_MALE]),
        dedupeUrls([...POOL_YOUNG_FEMALE, ...POOL_YOUNG_MALE]),
      ]
    }
    return [
      dedupeUrls([...POOL_YOUNG_FEMALE, ...POOL_YOUNG_MALE]),
      dedupeUrls([...POOL_ELDER_FEMALE, ...POOL_ELDER_MALE]),
    ]
  }

  if (poolGender === 'female') {
    if (ageBand === 'elder') {
      return [
        POOL_ELDER_FEMALE,
        POOL_YOUNG_FEMALE,
        dedupeUrls([...POOL_YOUNG_MALE, ...POOL_ELDER_MALE]),
      ]
    }
    return [
      POOL_YOUNG_FEMALE,
      POOL_ELDER_FEMALE,
      dedupeUrls([...POOL_YOUNG_MALE, ...POOL_ELDER_MALE]),
    ]
  }

  // male
  if (ageBand === 'elder') {
    return [POOL_ELDER_MALE, POOL_YOUNG_MALE, dedupeUrls([...POOL_YOUNG_FEMALE, ...POOL_ELDER_FEMALE])]
  }
  return [
    POOL_YOUNG_MALE,
    POOL_ELDER_MALE,
    dedupeUrls([...POOL_YOUNG_FEMALE, ...POOL_ELDER_FEMALE]),
  ]
}

function pickFromList(seed: string, list: string[]): string {
  if (!list.length) return ''
  const idx = hashSeed(seed) % list.length
  return list[idx]!
}

/**
 * 为遇见邂逅 NPC 选取头像；优先避开 exclusion；池为空时回退默认资源。
 * @param npcGender 模型返回的性别文案（如「女」「男」）；若可解析则**覆盖**雷达筛选决定头像池，保证与卡片一致。
 */
export function pickMeetAvatar(
  seed: string,
  opts?: {
    filters?: RadarFilters
    exclusion?: MeetAvatarExclusion
    npcGender?: string
    /** 卡片年龄（若有） */
    ageYears?: number | null
    /** 覆盖自动推断的年龄段 */
    avatarAgeBand?: MeetAvatarAgeBand
    proseInfo?: string
    prosePhysiology?: string
  },
): string {
  const exclusion = opts?.exclusion
  const poolGender = resolveAvatarPoolGender(opts?.filters, opts?.npcGender)
  const ageBand =
    opts?.avatarAgeBand ??
    resolveMeetAvatarAgeBand({
      ageYears: opts?.ageYears,
      filters: opts?.filters,
      proseInfo: opts?.proseInfo,
      prosePhysiology: opts?.prosePhysiology,
    })
  const tiers = buildAvatarPickTiers(poolGender, ageBand)
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]!
    const prefer = tier.filter((u) => u && !isExcluded(u, exclusion))
    if (prefer.length) return pickFromList(`${seed}:t${i}`, prefer)
  }

  const anyFree = MEET_ENCOUNTER_AVATAR_URLS.filter((u) => !isExcluded(u, exclusion))
  if (anyFree.length) return pickFromList(`${seed}:fallback`, anyFree)

  if (MEET_ENCOUNTER_AVATAR_URLS.length) return pickFromList(`${seed}:collision`, MEET_ENCOUNTER_AVATAR_URLS)

  return publicAssetUrl('/image/个人名片默认头像1.png')
}
