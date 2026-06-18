export type FavoriteFilterId = 'all' | 'voice' | 'text' | 'image'

export type FavoriteItem = {
  id: string
  messageId: string
  sourceCharacterId: string
  sourceName: string
  /** 原消息真实发送方（收藏时从 chat message.type 解析） */
  sourceSenderKind: 'character' | 'player'
  sourceAvatarUrl?: string
  /** 原消息时间 */
  timestamp: number
  /** 收藏时间 */
  savedAt: number
  tags?: string[]
} & (
  | { type: 'text'; content: string }
  | { type: 'voice'; duration: number; audioUrl?: string; transcript?: string; voiceAudioKvKey?: string }
  | { type: 'image'; imageUrls: string[] }
)

export const FAVORITE_FILTER_OPTIONS: ReadonlyArray<{
  id: FavoriteFilterId
  label: string
  en: string
}> = [
  { id: 'all', label: '全部', en: 'All' },
  { id: 'voice', label: '语音', en: 'Voice' },
  { id: 'text', label: '语录', en: 'Quotes' },
  { id: 'image', label: '影像', en: 'Media' },
] as const
