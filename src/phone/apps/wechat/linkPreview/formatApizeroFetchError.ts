/** 极数本源 HTTP 非 200 或 code≠0 时的可读错误 */
import {
  formatApizeroBillingError,
  isApizeroBalanceInsufficient,
  isApizeroDailyFreeQuotaExhausted,
  isApizeroHardQuotaBlock,
} from '../../api/apizeroBilling'

export function formatApizeroFetchError(
  httpStatus: number,
  apiCode: number | undefined,
  apiMsg: string | undefined,
  fallback: string,
): string {
  const msg = apiMsg?.trim()
  if (isApizeroBalanceInsufficient(apiCode, apiMsg)) {
    return msg || '账户余额不足，请前往极数本源充值后再试'
  }
  if (isApizeroDailyFreeQuotaExhausted(apiCode, apiMsg)) {
    return formatApizeroBillingError(apiCode, apiMsg, fallback)
  }
  if (apiCode === 4029) {
    return msg || '调用过快，请稍后再试'
  }
  if (httpStatus === 429) {
    return msg || '请求过于频繁（HTTP 429）'
  }
  if (!httpStatus || httpStatus < 200 || httpStatus >= 300) {
    return msg || `HTTP ${httpStatus}`
  }
  return msg || fallback
}

export function isApizeroQuotaExhaustedError(error: string | undefined): boolean {
  return /4030|4015|今日.*额度|额度已用完|余额不足|余额不够/.test(String(error ?? ''))
}

export { isApizeroHardQuotaBlock, isApizeroBalanceInsufficient, isApizeroDailyFreeQuotaExhausted }
