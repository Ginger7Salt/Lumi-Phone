/** 金牌制作人 · 核心类型 */

export type ArtistStatKey = 'vocal' | 'acting' | 'variety' | 'charm' | 'stamina' | 'commercial'

export type ArtistStats = Record<ArtistStatKey, number>

export type RomanceStatus = 'friend' | 'ambiguous' | 'secret_dating' | 'public_romance'

export type GigType = 'film' | 'variety' | 'endorsement' | 'concert' | 'magazine'

export type GigStatus = 'confirmed' | 'shooting' | 'done'

export interface GigCompanyReward {
  funds: number
  reputation: number
}

export interface GigArtistReward {
  fans: number
  affection?: number
  statKey?: ArtistStatKey
  statDelta?: number
}

export interface GigRewards {
  company: GigCompanyReward
  artist: GigArtistReward
}

export interface ArtistGig {
  id: string
  title: string
  dateLabel: string
  type: GigType
  status: GigStatus
  /** 通告完成后的公司与艺人增益 */
  rewards?: GigRewards
}

export type FanReviewTone = 'praise' | 'neutral' | 'anti'

export interface FanReview {
  id: string
  author: string
  content: string
  tone: FanReviewTone
  likes: number
}

export interface ArtistSentiment {
  fanRatio: number
  antiRatio: number
  neutralRatio: number
}

export type DayPeriod = 'morning' | 'afternoon' | 'evening'

export interface Artist {
  id: string
  name: string
  mbti: string
  avatar: string
  tags: string[]
  affection: number
  /** 地下恋时的幽怨值，过高易触发修罗场 */
  resentment: number
  status: RomanceStatus
  stats: ArtistStats
  fans: number
  personaSummary: string
  characterId?: string
  /** 通告行程 */
  gigs?: ArtistGig[]
  /** 粉丝评价 */
  fanReviews?: FanReview[]
}

export interface HotSearchItem {
  id: string
  rank: number
  keyword: string
  heat: number
  type: 'positive' | 'negative' | 'gossip'
  artistId?: string
  createdAt: number
}

export interface ShopProperty {
  id: string
  name: string
  price: number
  desc: string
  unlockDateSpot?: string
}

export interface ShopVehicle {
  id: string
  name: string
  price: number
  desc: string
}

export interface DramaChoice {
  id: string
  label: string
  effects: DramaEffects
}

export interface DramaEffects {
  funds?: number
  reputation?: number
  affection?: Record<string, number>
  resentment?: Record<string, number>
  fans?: Record<string, number>
  commercial?: Record<string, number>
  setStatus?: Record<string, RomanceStatus>
  clearDrama?: boolean
}

export interface DramaEvent {
  id: string
  title: string
  lines: string[]
  choices: DramaChoice[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'artist'
  content: string
  ts: number
}

export interface PlayerProfile {
  name: string
  birthdayMD: string
  mbti: string
  /** 公关风格 */
  prStyle: 'calm' | 'bold' | 'scandal'
  /** 恋爱倾向 */
  romanceStyle: 'career' | 'secret' | 'public'
  /** 经纪人个人能力 */
  stats: PlayerStats
}

export interface PlayerStats {
  /** 公关能力 */
  pr: number
  /** 魅力 */
  charm: number
  /** 口才 */
  eloquence: number
  /** 洞察力 */
  insight: number
  /** 精力 */
  stamina: number
  /** 资源整合 */
  resource: number
}

export interface SimApiConfig {
  mode: 'inherit' | 'custom'
  apiUrl: string
  apiKey: string
  modelId: string
}

export interface ProducerState {
  /** 是否完成序章 */
  prologueDone: boolean
  player: PlayerProfile | null
  funds: number
  reputation: number
  assets: { properties: string[]; vehicles: string[] }
  artists: Artist[]
  scoutPool: Artist[]
  hotSearches: HotSearchItem[]
  chatThreads: Record<string, ChatMessage[]>
  dateUnlockedIds: string[]
  /** 游戏内第几年 */
  gameYear: number
  /** 游戏内月日 */
  gameMonth: number
  gameDay: number
  /** 今日已用行动次数 0-6 */
  actionsUsedToday: number
  /** 累计游戏天数 */
  totalDays: number
  selectedArtistId: string | null
  pendingDrama: DramaEvent | null
  pendingBirthday: boolean
  pendingQuarterlyAwards: boolean
  lastAwardDay: number
  /** 最近操作摘要，供 AI */
  recentLog: string[]
}

export type SimTab = 'schedule' | 'roster' | 'social' | 'assets' | 'profile'

export interface StatDelta {
  id: string
  label: string
  value: string
  tone: 'gain' | 'loss' | 'neutral'
}

export interface NewDayNotice {
  gameYear: number
  gameMonth: number
  gameDay: number
  season: string
}

export const GIG_TYPE_LABELS: Record<GigType, string> = {
  film: '影视',
  variety: '综艺',
  endorsement: '代言',
  concert: '演出',
  magazine: '杂志',
}

export const GIG_STATUS_LABELS: Record<GigStatus, string> = {
  confirmed: '已确认',
  shooting: '进行中',
  done: '已完成',
}

export const FAN_REVIEW_TONE_LABELS: Record<FanReviewTone, string> = {
  praise: '好评',
  neutral: '路人',
  anti: '黑粉',
}

export const STAT_LABELS: Record<ArtistStatKey, string> = {
  vocal: '唱功',
  acting: '演技',
  variety: '综艺感',
  charm: '魅力',
  stamina: '体能',
  commercial: '商业价值',
}

export const PERIOD_LABELS: Record<DayPeriod, string> = {
  morning: '早上',
  afternoon: '下午',
  evening: '晚上',
}

export const ROMANCE_LABELS: Record<RomanceStatus, string> = {
  friend: '同事',
  ambiguous: '暧昧',
  secret_dating: '地下恋',
  public_romance: '公开恋情',
}

export const DATE_AFFECTION_THRESHOLD = 55
export const ACTIONS_PER_DAY = 6
export const HOURS_PER_ACTION = 4
export const QUARTER_DAYS = 90
export const RECRUIT_COST = 12000
export const DRAMA_AFFECTION_MIN = 70
