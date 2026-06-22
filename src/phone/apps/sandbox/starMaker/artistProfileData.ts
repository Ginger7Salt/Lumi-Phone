import type {
  Artist,
  ArtistGig,
  ArtistSentiment,
  ArtistStatKey,
  FanReview,
  FanReviewTone,
  GigRewards,
  GigType,
} from './types'

function hashSeed(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

function pick<T>(arr: T[], seed: number, offset = 0) {
  return arr[(seed + offset) % arr.length]
}

const GIG_POOL: Array<{ title: string; type: GigType; status: ArtistGig['status'] }> = [
  { title: '都市剧《逆光》主演档期', type: 'film', status: 'shooting' },
  { title: '时尚杂志封面拍摄', type: 'magazine', status: 'confirmed' },
  { title: '国民综艺常驻嘉宾', type: 'variety', status: 'shooting' },
  { title: '轻奢品牌全球代言', type: 'endorsement', status: 'confirmed' },
  { title: '跨年演唱会彩排', type: 'concert', status: 'confirmed' },
  { title: '悬疑电影路演', type: 'film', status: 'done' },
  { title: '访谈节目录制', type: 'variety', status: 'confirmed' },
  { title: '香水广告棚拍', type: 'endorsement', status: 'shooting' },
]

const NEGOTIATED_GIG_TITLES = [
  '品牌挚友官宣活动',
  '平台定制微综艺',
  '音乐节压轴演出',
  '院线电影客串签约',
  '直播带货专场',
  '时尚盛典红毯',
]

const PRAISE_REVIEWS = [
  '状态越来越稳了，期待下一部作品。',
  '业务能力在线，不是流量昙花一现那种。',
  '现场表现力真的没话说，路人转粉。',
  '造型团队加分，本人气质也很能打。',
  '采访里很真诚，对粉丝也很尊重。',
]

const NEUTRAL_REVIEWS = [
  '还行吧，没有特别惊艳但也不算拉垮。',
  '路人围观，等作品出来再评价。',
  '热搜体质，但作品厚度还得再看。',
  '粉丝滤镜挺重的，客观说中规中矩。',
]

const ANTI_REVIEWS = [
  '又是营销咖，作品呢？',
  '表情管理翻车那次还没忘。',
  '资源咖罢了，同辈里真不算突出。',
  '粉丝控评太明显，观感很差。',
]

export function computeArtistSentiment(artist: Artist): ArtistSentiment {
  const charmBoost = artist.stats.charm * 0.22
  const commercialBoost = artist.stats.commercial * 0.12
  const varietyPenalty = Math.max(0, 55 - artist.stats.variety) * 0.15
  const resentmentPenalty = artist.resentment * 0.28
  const statusPenalty =
    artist.status === 'public_romance' ? 4 : artist.status === 'secret_dating' ? 2 : 0

  let fanRatio = Math.round(42 + charmBoost + commercialBoost - varietyPenalty - resentmentPenalty)
  let antiRatio = Math.round(6 + varietyPenalty * 0.4 + resentmentPenalty + statusPenalty)

  fanRatio = Math.min(88, Math.max(28, fanRatio))
  antiRatio = Math.min(38, Math.max(4, antiRatio))

  if (fanRatio + antiRatio > 94) {
    antiRatio = 94 - fanRatio
  }

  const neutralRatio = Math.max(0, 100 - fanRatio - antiRatio)
  return { fanRatio, antiRatio, neutralRatio }
}

function buildDateLabel(seed: number, offsetDays: number) {
  const month = ((seed % 5) + 3 + Math.floor(offsetDays / 28)) % 12 || 12
  const day = ((seed + offsetDays * 3) % 26) + 1
  return `${month}月${day}日起`
}

const GIG_REWARD_PROFILE: Record<
  GigType,
  {
    funds: [number, number]
    reputation: [number, number]
    fans: [number, number]
    affection: [number, number]
    statKey: ArtistStatKey
    statDelta: [number, number]
  }
> = {
  film: {
    funds: [10000, 18000],
    reputation: [2, 5],
    fans: [1500, 3200],
    affection: [1, 3],
    statKey: 'acting',
    statDelta: [2, 4],
  },
  variety: {
    funds: [6000, 12000],
    reputation: [3, 6],
    fans: [2000, 4200],
    affection: [2, 4],
    statKey: 'variety',
    statDelta: [2, 4],
  },
  endorsement: {
    funds: [12000, 22000],
    reputation: [1, 4],
    fans: [1000, 2600],
    affection: [1, 2],
    statKey: 'commercial',
    statDelta: [2, 5],
  },
  concert: {
    funds: [8000, 15000],
    reputation: [2, 5],
    fans: [2600, 5200],
    affection: [2, 5],
    statKey: 'vocal',
    statDelta: [2, 3],
  },
  magazine: {
    funds: [5000, 9000],
    reputation: [4, 8],
    fans: [800, 1900],
    affection: [1, 3],
    statKey: 'charm',
    statDelta: [2, 3],
  },
}

function rangeFromSeed(seed: number, min: number, max: number, salt = 0) {
  const span = max - min + 1
  return min + ((seed + salt * 17) % span)
}

/** 按通告类型与 id 稳定生成完成增益 */
export function computeGigRewards(gig: Pick<ArtistGig, 'id' | 'type'>, artist?: Artist): GigRewards {
  const seed = hashSeed(gig.id + (artist?.id ?? ''))
  const profile = GIG_REWARD_PROFILE[gig.type]
  const commercialBonus = artist ? Math.floor(artist.stats.commercial / 25) : 0

  return {
    company: {
      funds: rangeFromSeed(seed, profile.funds[0], profile.funds[1]) + commercialBonus * 500,
      reputation: rangeFromSeed(seed, profile.reputation[0], profile.reputation[1], 1),
    },
    artist: {
      fans: rangeFromSeed(seed, profile.fans[0], profile.fans[1], 2),
      affection: rangeFromSeed(seed, profile.affection[0], profile.affection[1], 3),
      statKey: profile.statKey,
      statDelta: rangeFromSeed(seed, profile.statDelta[0], profile.statDelta[1], 4),
    },
  }
}

function withGigRewards(gig: ArtistGig, artist?: Artist): ArtistGig {
  return gig.rewards ? gig : { ...gig, rewards: computeGigRewards(gig, artist) }
}

export function buildInitialGigs(artist: Artist): ArtistGig[] {
  const seed = hashSeed(artist.id + artist.name)
  const gigs: ArtistGig[] = []
  for (let i = 0; i < 4; i += 1) {
    const item = pick(GIG_POOL, seed, i * 2)
    const gig: ArtistGig = {
      id: `${artist.id}-gig-${i}`,
      title: item.title,
      type: item.type,
      status: item.status,
      dateLabel: buildDateLabel(seed, i * 9 + 3),
    }
    gigs.push(withGigRewards(gig, artist))
  }
  return gigs
}

export function appendNegotiatedGig(
  artist: Artist,
  gameYear: number,
  gameMonth: number,
  gameDay: number,
): ArtistGig {
  const seed = hashSeed(`${artist.id}-${Date.now()}`)
  const title = pick(NEGOTIATED_GIG_TITLES, seed)
  const types: GigType[] = ['variety', 'endorsement', 'concert', 'film', 'magazine']
  const day = Math.min(28, gameDay + 5 + (seed % 10))
  const gig: ArtistGig = {
    id: `${artist.id}-gig-${Date.now()}`,
    title,
    type: pick(types, seed),
    status: 'confirmed',
    dateLabel: `第${gameYear}年${gameMonth}月${day}日起`,
  }
  return withGigRewards(gig, artist)
}

function review(
  artistId: string,
  idx: number,
  author: string,
  content: string,
  tone: FanReviewTone,
  likes: number,
): FanReview {
  return { id: `${artistId}-review-${idx}`, author, content, tone, likes }
}

export function buildFanReviews(artist: Artist): FanReview[] {
  const seed = hashSeed(artist.id)
  const sentiment = computeArtistSentiment(artist)
  const praiseCount = Math.max(2, Math.round(sentiment.fanRatio / 22))
  const antiCount = Math.max(1, Math.round(sentiment.antiRatio / 14))
  const neutralCount = Math.max(1, 3 - antiCount)

  const reviews: FanReview[] = []
  let idx = 0

  for (let i = 0; i < praiseCount; i += 1) {
    reviews.push(
      review(
        artist.id,
        idx++,
        `粉丝${(seed % 900) + 100 + i}`,
        pick(PRAISE_REVIEWS, seed, i),
        'praise',
        120 + ((seed + i * 17) % 800),
      ),
    )
  }
  for (let i = 0; i < neutralCount; i += 1) {
    reviews.push(
      review(
        artist.id,
        idx++,
        `路人${(seed % 400) + 20 + i}`,
        pick(NEUTRAL_REVIEWS, seed, i + 3),
        'neutral',
        12 + ((seed + i * 9) % 60),
      ),
    )
  }
  for (let i = 0; i < antiCount; i += 1) {
    reviews.push(
      review(
        artist.id,
        idx++,
        `黑粉${(seed % 200) + 8 + i}`,
        pick(ANTI_REVIEWS, seed, i + 5),
        'anti',
        8 + ((seed + i * 11) % 90),
      ),
    )
  }

  return reviews
}

export function ensureArtistProfile(artist: Artist): Artist {
  const rawGigs = artist.gigs?.length ? artist.gigs : buildInitialGigs(artist)
  const gigs = rawGigs.map((g) => withGigRewards(g, artist))
  const fanReviews = artist.fanReviews?.length
    ? artist.fanReviews
    : buildFanReviews({ ...artist, gigs })
  return { ...artist, gigs, fanReviews }
}

export function refreshArtistFanReviews(artist: Artist): Artist {
  return { ...artist, fanReviews: buildFanReviews(artist) }
}
