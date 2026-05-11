import type { MeetMatchIntention, MeetOrientationPreference, RadarFilters } from './meetTypes'

const ORI_LABEL: Record<MeetOrientationPreference, string> = {
  hetero: '异性恋',
  homo: '同性恋',
  bi_pan: '双性恋 / 泛性恋',
}

const INTENT_LABEL: Record<MeetMatchIntention, string> = {
  romance: '寻找浪漫',
  platonic: '纯粹友谊',
  soulmate: '灵魂共鸣',
  casual: '闲聊搭子',
}

/** 由勾选意向推导 legacy purpose（写入持久化，兼容旧提示片段） */
export function meetIntentionsToPurpose(intents: MeetMatchIntention[]): RadarFilters['purpose'] {
  if (!intents.length) return 'love'
  if (intents.includes('romance') || intents.includes('soulmate')) return 'love'
  if (intents.includes('platonic')) return 'friend'
  return 'buddy'
}

/** 旧 purpose → 默认意向列表（迁移用） */
export function legacyPurposeToMeetIntentions(p: RadarFilters['purpose']): MeetMatchIntention[] {
  if (p === 'love') return ['romance']
  if (p === 'friend') return ['platonic']
  return ['casual']
}

/** 注入 AI 用户消息的「寻觅法则」硬约束块 */
export function buildEncounterAiCriteriaBlock(filters: RadarFilters): string {
  const intents =
    filters.meetIntentions.length > 0 ? filters.meetIntentions : legacyPurposeToMeetIntentions(filters.purpose)
  const intentZh = intents.map((k) => INTENT_LABEL[k]).join('；')

  const oriBlock =
    filters.orientationPreferences.length > 0
      ? `【性取向匹配】生成角色的对外取向设定（nickname 旁 orientation 字段及人设自述）须与用户勾选相容，用户接受类型为：${filters.orientationPreferences.map((k) => ORI_LABEL[k]).join('、')}（满足其一即可）。`
      : `【性取向匹配】用户未限定取向标签；你可自由设定合法合规的取向表述。`

  const kw = filters.keywords.trim()
  const vibe = kw ? `【氛围关键词】${kw}` : ''

  return [
    `【年龄硬约束】角色真实年龄必须在 ${filters.ageMin}–${filters.ageMax} 岁之间（不得超出；须在 comprehensive / persona / 自述中一致）。`,
    oriBlock,
    `【交友意向】用户勾选：${intentZh}。捏人时动机与相处预期须与上述意向整体相容，禁止生成明显违背的用户人设。`,
    vibe,
  ]
    .filter(Boolean)
    .join('\n')
}

/** 离线兜底：在年龄区间内取确定性年龄 */
export function pickOfflineAgeYears(seed: string, ageMin: number, ageMax: number): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const span = Math.max(0, ageMax - ageMin)
  if (span <= 0) return Math.max(18, Math.min(99, ageMin))
  return ageMin + (h >>> 0) % (span + 1)
}
