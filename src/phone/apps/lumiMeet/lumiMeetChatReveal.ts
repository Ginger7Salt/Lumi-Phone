/**
 * 遇见临时会话 · NPC 气泡逐条露出节奏（对齐微信 ChatRoom 文本分支的 stagger 思路）
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}

/** 与微信 `computeOpponentStaggerDelayMs` 文本分支一致：短句偏快，长句偏慢 */
export function computeMeetNpcStaggerDelayMs(text: string): number {
  const n = [...String(text ?? '').trim()].length
  if (n <= 0) return 320
  if (n < 200) return Math.max(280, Math.round((n / 5) * 1000))
  return Math.max(400, Math.round((n / 15) * 1000))
}

/** 让出一帧，降低多条 push 被 React 合并到同一刷新的概率 */
export async function yieldToPaint(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
}
