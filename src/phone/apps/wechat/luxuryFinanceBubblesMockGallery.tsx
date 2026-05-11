import { RedPacketBubbleVisualMocks } from './redPacket/RedPacketBubble'
import { TransferBubbleVisualMocks } from './transfer/TransferBubble'

/**
 * 轻奢铂金风 · 红包与转账气泡验收陈列。
 * 在任意页面临时挂载：`<LuxuryFinanceBubblesMockGallery />` 即可查看八种 Mock。
 */
export function LuxuryFinanceBubblesMockGallery() {
  return (
    <div className="mx-auto max-w-md space-y-6 py-6">
      <RedPacketBubbleVisualMocks />
      <TransferBubbleVisualMocks />
    </div>
  )
}
