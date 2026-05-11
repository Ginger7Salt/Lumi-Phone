import { formatMD, zodiacFromMD } from './utils'

/** 解析身高为厘米（与旧版通讯录逻辑一致：<3 视为米） */
export function parseHeightCm(raw: string): number | null {
  const t = String(raw || '').trim().toLowerCase()
  if (!t) return null
  const m = t.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  const cm = n < 3 ? n * 100 : n
  if (cm < 80 || cm > 260) return null
  return cm
}

/** 解析体重为千克 */
export function parseWeightKg(raw: string): number | null {
  const t = String(raw || '').trim().toLowerCase()
  if (!t) return null
  const m = t.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const kg = Number(m[1])
  if (!Number.isFinite(kg) || kg <= 0 || kg < 20 || kg > 300) return null
  return kg
}

/** BMI = kg / (m^2)，无效输入返回 null */
export function calculateBMI(heightCm: number, weightKg: number): number | null {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) return null
  const m = heightCm / 100
  const bmi = weightKg / (m * m)
  if (!Number.isFinite(bmi)) return null
  return bmi
}

/** 与常见中国成人分级一致（&lt;18.5 偏瘦，18.5~23.9 正常，24~27.9 偏胖，≥28 肥胖） */
export function bmiStatusLabelZh(bmi: number): string {
  if (bmi < 18.5) return '偏瘦'
  if (bmi < 24) return '正常'
  if (bmi < 28) return '偏胖'
  return '肥胖'
}

export type ZodiacBilingual = { en: string; zh: string }

const ZODIAC_SLICES: { before: number; en: string; zh: string }[] = [
  { before: 120, en: 'Capricorn', zh: '摩羯座' },
  { before: 219, en: 'Aquarius', zh: '水瓶座' },
  { before: 321, en: 'Pisces', zh: '双鱼座' },
  { before: 420, en: 'Aries', zh: '白羊座' },
  { before: 521, en: 'Taurus', zh: '金牛座' },
  { before: 622, en: 'Gemini', zh: '双子座' },
  { before: 723, en: 'Cancer', zh: '巨蟹座' },
  { before: 823, en: 'Leo', zh: '狮子座' },
  { before: 923, en: 'Virgo', zh: '处女座' },
  { before: 1024, en: 'Libra', zh: '天秤座' },
  { before: 1123, en: 'Scorpio', zh: '天蝎座' },
  { before: 1222, en: 'Sagittarius', zh: '射手座' },
  { before: 1232, en: 'Capricorn', zh: '摩羯座' },
]

/** 将月日编码为可比整数 MMDD */
function mmddToKey(month: number, day: number): number | null {
  if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }
  return month * 100 + day
}

/**
 * 根据日期字符串推演星座。
 * 支持：`MM-DD`（与人设字段 birthdayMD 一致）、`YYYY-MM-DD`。
 */
export function getZodiacSign(dateString: string): ZodiacBilingual | null {
  const raw = String(dateString ?? '').trim()
  if (!raw) return null

  let month = 0
  let day = 0
  const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymd) {
    month = Number(ymd[2])
    day = Number(ymd[3])
  } else {
    const md = raw.match(/^(\d{1,2})-(\d{1,2})$/)
    if (!md) return null
    month = Number(md[1])
    day = Number(md[2])
  }

  const key = mmddToKey(month, day)
  if (key == null) return null

  for (const row of ZODIAC_SLICES) {
    if (key < row.before) return { en: row.en, zh: row.zh }
  }
  return { en: 'Capricorn', zh: '摩羯座' }
}

/** 与人设存储一致的中文星座（沿用 utils 边界） */
export function zodiacZhFromStoredMD(md: string): string {
  return zodiacFromMD(md)
}

/** 校验月日并在需要时规整为 MM-DD */
export function normalizeBirthdayMD(md: string): string {
  const m = Number(md.slice(0, 2))
  const d = Number(md.slice(3, 5))
  if (!Number.isFinite(m) || !Number.isFinite(d) || m < 1 || m > 12 || d < 1 || d > 31) return '01-01'
  return formatMD(m, d)
}
