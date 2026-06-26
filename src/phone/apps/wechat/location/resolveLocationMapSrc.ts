import type { WeChatLocationPayload } from '../newFriendsPersona/types'
import { buildGrayscaleMapDataUrl } from './locationMapVisual'

/** 聊天卡片地图源：始终以 seed 现场重绘，避免落库截断的 data URL 变灰块 */
export function resolveLocationMapSrc(
  data: Pick<WeChatLocationPayload, 'mapImageSeed' | 'snapshotUrl'>,
): string {
  const seed = data.mapImageSeed?.trim()
  if (seed) return buildGrayscaleMapDataUrl(seed)
  const snap = data.snapshotUrl?.trim()
  if (snap && snap.includes('</svg>')) return snap
  return buildGrayscaleMapDataUrl('fallback')
}
