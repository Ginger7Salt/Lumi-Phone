/** 极数本源 video-parse / content-extract 常见计费方案（以接口文档与控制台为准） */
export type ApizeroBillingPlanKind =
  | 'anonymous'
  | 'free_trial'
  | 'pay_per_use'
  | 'monthly_basic'
  | 'monthly_premium'
  | 'vip_gold'
  | 'vip_enterprise'
  | 'enterprise'
  | 'subscription'
  | 'unknown'

export type ApizeroBillingPeriod = 'daily' | 'monthly' | 'pay_per_use' | 'unlimited'

export type ApizeroBillingMeta = {
  planKind: ApizeroBillingPlanKind
  planLabel: string
  period: ApizeroBillingPeriod
  /** 日限额；null 表示无日限额（按次付费等） */
  dailyLimit: number | null
  dailyUsed: number | null
  dailyRemaining: number | null
  /** 月限额（月卡） */
  monthlyLimit: number | null
  monthlyUsed: number | null
  monthlyRemaining: number | null
  qpsLimit: number | null
  unitPriceYuan: number | null
}

export const APIZERO_BILLING_PLAN_LABELS: Record<ApizeroBillingPlanKind, string> = {
  anonymous: '匿名免费',
  free_trial: '免费试用',
  pay_per_use: '按次付费',
  monthly_basic: '基础版月卡',
  monthly_premium: '畅想套餐',
  vip_gold: 'VIP 黄金会员',
  vip_enterprise: 'VIP 企业会员',
  enterprise: '企业定制',
  subscription: '套餐日额度',
  unknown: '已填 Key',
}

/** 接口文档常见默认值（服务端响应优先） */
export const APIZERO_DEFAULT_LIMITS = {
  web: { anonymous: 5000, freeTrialKey: 10000 },
  video: { anonymous: 5, freeTrialKey: 20 },
} as const

function readBodyNum(body: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = body[key]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.floor(v)
  }
  return undefined
}

function inferPlanKind(
  withKey: boolean,
  dailyLimit: number | undefined,
  monthlyLimit: number | undefined,
  apiMsg: string | undefined,
): ApizeroBillingPlanKind {
  if (!withKey) return 'anonymous'
  const msg = String(apiMsg ?? '')
  if (/按次|pay.?per.?use|per.?call/i.test(msg)) return 'pay_per_use'
  if (typeof monthlyLimit === 'number') {
    if (monthlyLimit >= 900_000) return 'monthly_premium'
    if (monthlyLimit >= 50_000) return 'monthly_basic'
    return 'subscription'
  }
  if (typeof dailyLimit !== 'number') return 'pay_per_use'
  if (dailyLimit <= 0) return 'pay_per_use'
  if (dailyLimit === APIZERO_DEFAULT_LIMITS.video.freeTrialKey) return 'subscription'
  if (dailyLimit >= 900_000) return 'vip_enterprise'
  if (dailyLimit >= 15_000) return 'vip_gold'
  if (dailyLimit >= 100_000) return 'enterprise'
  return 'subscription'
}

function periodForPlan(plan: ApizeroBillingPlanKind, monthlyLimit?: number): ApizeroBillingPeriod {
  if (plan === 'anonymous' || plan === 'free_trial' || plan === 'vip_gold' || plan === 'vip_enterprise') {
    return 'daily'
  }
  if (plan === 'pay_per_use') return 'pay_per_use'
  if (plan === 'enterprise') return 'unlimited'
  if (typeof monthlyLimit === 'number') return 'monthly'
  if (plan === 'monthly_basic' || plan === 'monthly_premium') return 'monthly'
  return 'daily'
}

/** 从极数本源响应头 / JSON / 文案解析计费与额度（浏览器端优先 JSON） */
export function parseApizeroBillingMeta(
  headers: Headers | undefined,
  bodyData: unknown,
  apiCode: number | undefined,
  apiMsg: string | undefined,
  withKey: boolean,
): ApizeroBillingMeta {
  const body =
    bodyData && typeof bodyData === 'object' ? (bodyData as Record<string, unknown>) : {}

  const dailyLimit = readBodyNum(body, ['limit_daily', 'daily_limit', 'limit'])
  const dailyUsed = readBodyNum(body, ['used', 'used_daily', 'daily_used'])
  const dailyRemaining = readBodyNum(body, ['remaining', 'remaining_daily', 'daily_remaining'])

  const monthlyLimit = readBodyNum(body, ['limit_monthly', 'monthly_limit'])
  const monthlyUsed = readBodyNum(body, ['used_monthly', 'monthly_used'])
  const monthlyRemaining = readBodyNum(body, ['remaining_monthly', 'monthly_remaining'])

  const qpsLimit = readBodyNum(body, ['limit_qps', 'qps_limit', 'qps'])
  const unitPriceYuan = readBodyNum(body, ['unit_price', 'price', 'cost'])

  let resolvedDailyLimit = dailyLimit
  if (resolvedDailyLimit == null && headers) {
    const h = headers.get('x-ratelimit-limit-daily') ?? headers.get('X-RateLimit-Limit-Daily')
    if (h) {
      const n = Number(h)
      if (Number.isFinite(n) && n >= 0) resolvedDailyLimit = Math.floor(n)
    }
  }

  const planKind = inferPlanKind(withKey, resolvedDailyLimit, monthlyLimit, apiMsg)
  const period = periodForPlan(planKind, monthlyLimit)

  let effectiveDailyLimit: number | null = resolvedDailyLimit ?? null
  if (period === 'pay_per_use' || period === 'unlimited') effectiveDailyLimit = null
  if (planKind === 'pay_per_use') effectiveDailyLimit = null

  let effectiveDailyRemaining = dailyRemaining ?? null
  if (
    effectiveDailyRemaining == null &&
    typeof effectiveDailyLimit === 'number' &&
    typeof dailyUsed === 'number'
  ) {
    effectiveDailyRemaining = Math.max(0, effectiveDailyLimit - dailyUsed)
  }
  if (apiCode === 4030 || apiCode === 4015) {
    if (typeof effectiveDailyRemaining !== 'number' && planKind !== 'pay_per_use') {
      effectiveDailyRemaining = 0
    }
  }

  return {
    planKind,
    planLabel: APIZERO_BILLING_PLAN_LABELS[planKind],
    period,
    dailyLimit: effectiveDailyLimit,
    dailyUsed: dailyUsed ?? null,
    dailyRemaining: effectiveDailyRemaining,
    monthlyLimit: monthlyLimit ?? null,
    monthlyUsed: monthlyUsed ?? null,
    monthlyRemaining: monthlyRemaining ?? null,
    qpsLimit: qpsLimit ?? null,
    unitPriceYuan: unitPriceYuan ?? null,
  }
}

export function isApizeroBalanceInsufficient(apiCode: number | undefined, apiMsg: string | undefined): boolean {
  const msg = String(apiMsg ?? '').trim()
  if (/余额不足|余额不够|请先充值|insufficient balance|balance insufficient/i.test(msg)) return true
  if (typeof apiCode === 'number' && /4012|4016|4021|4022/.test(String(apiCode)) && /余额|balance/i.test(msg)) {
    return true
  }
  return false
}

/** 4030 仅表示「今日免费/套餐日额度」用尽；按次付费有余额时服务端应仍返回成功 */
export function isApizeroDailyFreeQuotaExhausted(apiCode: number | undefined, apiMsg?: string): boolean {
  if (apiCode === 4030 || apiCode === 4015) return true
  return /今日.*额度.*用完|今日免费额度已用完|daily.*quota/i.test(String(apiMsg ?? ''))
}

export function formatApizeroBillingError(
  apiCode: number | undefined,
  apiMsg: string | undefined,
  fallback: string,
  meta?: Pick<ApizeroBillingMeta, 'planKind' | 'period'>,
): string {
  const msg = apiMsg?.trim()
  if (isApizeroBalanceInsufficient(apiCode, apiMsg)) {
    return msg || '账户余额不足，请前往极数本源充值后再试'
  }
  if (apiCode === 4029) {
    return msg || '调用过快，请稍后再试（不同套餐 QPS 不同）'
  }
  if (isApizeroDailyFreeQuotaExhausted(apiCode, apiMsg)) {
    if (meta?.planKind === 'pay_per_use' || meta?.period === 'pay_per_use') {
      return msg || '今日赠送免费次数已用完；按次付费需确保账户有余额'
    }
    if (meta?.planKind === 'free_trial') {
      return msg || '今日免费试用次数已用完，可升级按次付费/月卡或明日再试'
    }
    return msg || '今日套餐额度已用完，可升级方案、充值或明日再试'
  }
  return msg || fallback
}

export function isApizeroHardQuotaBlock(
  apiCode: number | undefined,
  apiMsg: string | undefined,
  meta?: Pick<ApizeroBillingMeta, 'planKind' | 'period'>,
): boolean {
  if (isApizeroBalanceInsufficient(apiCode, apiMsg)) return true
  if (!isApizeroDailyFreeQuotaExhausted(apiCode, apiMsg)) return false
  // 按次付费：4030 可能只是「免费部分」用尽，不应在 UI 层当作永久封禁（以服务端是否 code=0 为准）
  if (meta?.planKind === 'pay_per_use' || meta?.period === 'pay_per_use') return false
  return true
}

export function formatQuotaLineDisplay(
  line: {
    kind: 'web' | 'video'
    label: string
    limit: number
    remaining: number
    used?: number
    period: ApizeroBillingPeriod
    dailyLimit: number | null
    monthlyLimit: number | null
    monthlyRemaining: number | null
  },
  planKind: ApizeroBillingPlanKind,
): { statusText: string; showBar: boolean; barPercent: number } {
  if (planKind === 'pay_per_use' || line.period === 'pay_per_use') {
    return {
      statusText: '无日限额 · 按次扣费（仅成功响应计费）',
      showBar: false,
      barPercent: 100,
    }
  }
  if (line.period === 'monthly' && line.monthlyLimit != null) {
    const rem = line.monthlyRemaining ?? Math.max(0, line.monthlyLimit - (line.used ?? 0))
    return {
      statusText: rem <= 0 ? '本月已用完' : `本月剩余 ${rem}`,
      showBar: true,
      barPercent: line.monthlyLimit > 0 ? Math.min(100, Math.round((rem / line.monthlyLimit) * 100)) : 0,
    }
  }
  if (line.period === 'unlimited') {
    return { statusText: '不限次数', showBar: false, barPercent: 100 }
  }
  const limit = line.dailyLimit ?? line.limit
  const rem = line.remaining
  return {
    statusText: rem <= 0 ? '今日已用完' : `今日剩余 ${rem}`,
    showBar: true,
    barPercent: limit > 0 ? Math.min(100, Math.round((rem / limit) * 100)) : 0,
  }
}
