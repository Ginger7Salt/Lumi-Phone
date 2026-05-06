/** 线下普通剧情弹幕：由 `DatingContext` 在 AI 完成后推送行文本，由 `DatingStoryPage` 注册实际入队逻辑（避免 Context 持有大量弹幕动画状态）。 */
export type DatingOfflineDanmakuSink = (lines: string[]) => void

let sink: DatingOfflineDanmakuSink | null = null

export function registerDatingOfflineDanmakuSink(fn: DatingOfflineDanmakuSink | null) {
  sink = fn
}

export function emitDatingOfflineDanmakuLines(lines: string[]) {
  const trimmed = lines.map((s) => String(s ?? '').trim()).filter(Boolean)
  if (!trimmed.length) return
  sink?.(trimmed)
}
