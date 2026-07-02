/** 世界书条目 AI 补全：默认目标字数（含标点，约） */
export const WB_ITEM_GEN_DEFAULT_CHARS = 100
export const WB_ITEM_GEN_MIN_CHARS = 40
export const WB_ITEM_GEN_MAX_CHARS = 800
export const WB_ITEM_GEN_TARGET_STORAGE_KEY = 'wb-item-gen-target-chars'

export function clampWbItemGenTargetChars(n: number | undefined | null): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : WB_ITEM_GEN_DEFAULT_CHARS
  return Math.min(WB_ITEM_GEN_MAX_CHARS, Math.max(WB_ITEM_GEN_MIN_CHARS, v))
}

/** 与弹窗说明一致：汉字约数（含标点），去空白计长 */
export function approximateChineseTextLength(text: string): number {
  return String(text ?? '').replace(/\s+/g, '').length
}

export function wbItemGenMaxTokensForTarget(targetChars: number): number {
  const n = clampWbItemGenTargetChars(targetChars)
  return Math.min(4096, Math.max(512, Math.ceil(n * 4.5)))
}

export function isWorldBookGeneratedBodyTooShort(body: string, targetChars: number): boolean {
  const target = clampWbItemGenTargetChars(targetChars)
  const minAcceptable = Math.max(WB_ITEM_GEN_MIN_CHARS, Math.floor(target * 0.55))
  return approximateChineseTextLength(body) < minAcceptable
}
