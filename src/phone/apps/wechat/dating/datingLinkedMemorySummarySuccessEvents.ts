/** 线下约会推剧情成功写入人脉「关联记忆」时全局提示 */
export const DATING_LINKED_MEMORY_SUMMARY_SUCCESS_EVENT = 'dating-linked-memory-summary-success'

export type DatingLinkedMemorySummarySuccessDetail = {
  /** 写入关联记忆的人设显示名 */
  npcNames: string[]
  /** 约会主角（绑定档案）显示名 */
  protagonistName?: string
}

export function dispatchDatingLinkedMemorySummarySuccess(
  detail: DatingLinkedMemorySummarySuccessDetail,
) {
  if (typeof window === 'undefined') return
  const names = (detail.npcNames ?? []).map((n) => String(n).trim()).filter(Boolean)
  if (!names.length) return
  window.dispatchEvent(
    new CustomEvent<DatingLinkedMemorySummarySuccessDetail>(
      DATING_LINKED_MEMORY_SUMMARY_SUCCESS_EVENT,
      {
        detail: {
          npcNames: names,
          protagonistName: detail.protagonistName?.trim() || undefined,
        },
      },
    ),
  )
}
