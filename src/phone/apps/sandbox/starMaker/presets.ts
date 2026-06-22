import type { Artist, DramaEvent, HotSearchItem, PlayerProfile, PlayerStats, ShopProperty, ShopVehicle } from './types'

function artist(
  id: string,
  name: string,
  mbti: string,
  tags: string[],
  stats: Artist['stats'],
  extra: Partial<Pick<Artist, 'fans' | 'affection' | 'personaSummary' | 'characterId'>> = {},
): Artist {
  return {
    id,
    name,
    mbti,
    avatar: '',
    tags,
    affection: extra.affection ?? 25,
    resentment: 0,
    status: 'friend',
    stats,
    fans: extra.fans ?? 18000,
    personaSummary: extra.personaSummary ?? '',
    characterId: extra.characterId,
  }
}

export const INITIAL_ROSTER: Artist[] = [
  artist(
    'sm-linyuan',
    '林远',
    'INTJ',
    ['冰山影帝', '禁欲系'],
    { vocal: 58, acting: 94, variety: 36, charm: 90, stamina: 72, commercial: 82 },
    {
      fans: 320000,
      affection: 32,
      personaSummary: '三金影帝候选人，镜头外沉默寡言，对经纪人格外克制，却会在深夜发很长语音。',
    },
  ),
  artist(
    'sm-xiawei',
    '夏薇',
    'ENFP',
    ['傲娇主唱', '舞台女王'],
    { vocal: 96, acting: 52, variety: 78, charm: 92, stamina: 68, commercial: 88 },
    {
      fans: 480000,
      affection: 28,
      personaSummary: '顶流女团出身，嘴硬心软，讨厌被安排但会偷偷记住经纪人的喜好。',
    },
  ),
]

export const SCOUT_POOL: Artist[] = [
  artist(
    'scout-zhou',
    '周予安',
    'INFP',
    ['新人练习生', '潜力股'],
    { vocal: 80, acting: 58, variety: 62, charm: 74, stamina: 70, commercial: 24 },
    { fans: 4200, affection: 18, personaSummary: '选秀遗珠，眼神干净，渴望被看见。' },
  ),
  artist(
    'scout-chen',
    '陈暮',
    'ISTP',
    ['地下说唱', '反差萌'],
    { vocal: 68, acting: 44, variety: 90, charm: 76, stamina: 82, commercial: 28 },
    { fans: 9800, affection: 16, personaSummary: '地下舞台出身，台上张扬台下社恐。' },
  ),
  artist(
    'scout-ye',
    '叶知秋',
    'ISFP',
    ['古典舞者', '清冷美人'],
    { vocal: 50, acting: 70, variety: 48, charm: 88, stamina: 76, commercial: 38 },
    { fans: 16000, affection: 22, personaSummary: '国家舞团退役，对娱乐圈规则半懂半疑。' },
  ),
]

export const SHOP_PROPERTIES: ShopProperty[] = [
  { id: 'prop-river', name: '江景大平层', price: 680000, desc: '落地窗外是整城灯火，适合私密宴会。', unlockDateSpot: '江景露台' },
  { id: 'prop-villa', name: '城郊独栋', price: 1200000, desc: '带花园与酒窖，生日宴与度假皆可。', unlockDateSpot: '私家花园' },
  { id: 'prop-loft', name: '旧厂改造 loft', price: 420000, desc: '工业风与玫瑰粉碰撞，艺人爱来拍照。', unlockDateSpot: '天台夜景' },
]

export const SHOP_VEHICLES: ShopVehicle[] = [
  { id: 'veh-sedan', name: '黑色商务轿车', price: 280000, desc: '低调接送，狗仔难拍清脸。' },
  { id: 'veh-convert', name: '玫瑰金敞篷', price: 520000, desc: '深夜兜风专用，绯闻概率上升。' },
  { id: 'veh-van', name: '艺人保姆车', price: 380000, desc: '团队出行，探班通告效率提升。' },
]

export const TRAVEL_DESTINATIONS = [
  { id: 'kyoto', name: '京都', cost: 45000, days: 3 },
  { id: 'sanya', name: '三亚', cost: 32000, days: 2 },
  { id: 'paris', name: '巴黎', cost: 88000, days: 5 },
] as const

export interface QuizQuestion {
  id: string
  text: string
  choices: Array<{
    id: string
    label: string
    effects: Partial<{
      funds: number
      reputation: number
      prStyle: PlayerProfile['prStyle']
      romanceStyle: PlayerProfile['romanceStyle']
      scoutBias: string
      playerStats: Partial<PlayerStats>
    }>
  }>
}

export const PROLOGUE_QUIZ: QuizQuestion[] = [
  {
    id: 'q-betrayal',
    text: '同僚在未经告知的情况下，抢先接手了你负责的项目。你会如何应对？',
    choices: [
      {
        id: 'endure',
        label: '先忍着，记在心里，以后再说',
        effects: { reputation: 5, prStyle: 'calm', playerStats: { pr: 4, insight: 3 } },
      },
      {
        id: 'destroy',
        label: '当面翻脸，谁也别想好过',
        effects: {
          funds: -8000,
          reputation: 12,
          prStyle: 'bold',
          playerStats: { eloquence: 5, stamina: 3 },
        },
      },
      {
        id: 'use',
        label: '把这事儿当筹码，反客为主',
        effects: { funds: 5000, prStyle: 'scandal', playerStats: { charm: 4, resource: 4 } },
      },
    ],
  },
  {
    id: 'q-cp',
    text: '公司要求你安排两位艺人以 CP 形式配合宣传、拉升热度。你的第一反应是？',
    choices: [
      {
        id: 'accept',
        label: '可以，有流量就行',
        effects: {
          funds: 10000,
          romanceStyle: 'public',
          playerStats: { charm: 3, resource: 5 },
        },
      },
      {
        id: 'refuse',
        label: '不行，我不想牺牲艺人',
        effects: {
          reputation: 8,
          romanceStyle: 'secret',
          playerStats: { pr: 5, insight: 3 },
        },
      },
      {
        id: 'balance',
        label: '能谈，但得按我的规矩来',
        effects: {
          reputation: 4,
          funds: 3000,
          romanceStyle: 'career',
          playerStats: { eloquence: 4, pr: 3 },
        },
      },
    ],
  },
  {
    id: 'q-night',
    text: '重要通告将至，临近凌晨两点仍有多项事务尚未落实。你首先会？',
    choices: [
      {
        id: 'data',
        label: '回工位，把合同和流程一项项过一遍',
        effects: { funds: 8000, scoutBias: 'scout-zhou', playerStats: { resource: 5, insight: 3 } },
      },
      {
        id: 'gut',
        label: '直接去找艺人，当面聊清楚',
        effects: { reputation: 6, scoutBias: 'scout-ye', playerStats: { insight: 5, charm: 3 } },
      },
      {
        id: 'noise',
        label: '让团队先发预告，把热度顶起来',
        effects: { funds: 5000, scoutBias: 'scout-chen', playerStats: { pr: 4, eloquence: 3 } },
      },
    ],
  },
  {
    id: 'q-birthday',
    text: '在你生日这一天，你更倾向于如何度过？',
    choices: [
      {
        id: 'party',
        label: '叫朋友出来，热闹一下',
        effects: { reputation: 10, romanceStyle: 'public', playerStats: { charm: 5, eloquence: 3 } },
      },
      {
        id: 'home',
        label: '一个人待着，说不定有惊喜',
        effects: { romanceStyle: 'secret', playerStats: { insight: 4, charm: 3 } },
      },
      {
        id: 'work',
        label: '还在公司，赢了就当给自己庆生',
        effects: { funds: 15000, romanceStyle: 'career', playerStats: { stamina: 5, resource: 4 } },
      },
    ],
  },
  {
    id: 'q-first',
    text: '初次签约艺人时，你最看重的是？',
    choices: [
      {
        id: 'talent',
        label: '看潜力，能不能练出来',
        effects: { reputation: 5, scoutBias: 'sm-linyuan', playerStats: { insight: 4, pr: 2 } },
      },
      {
        id: 'star',
        label: '看话题，能不能火',
        effects: { funds: 6000, scoutBias: 'sm-xiawei', playerStats: { charm: 5, resource: 3 } },
      },
      {
        id: 'story',
        label: '看故事，能不能打动人',
        effects: { reputation: 3, scoutBias: 'scout-zhou', playerStats: { eloquence: 4, charm: 3 } },
      },
    ],
  },
  {
    id: 'q-scandal',
    text: '你旗下艺人突登热搜，舆论却呈一面倒的负评。你的第一步是？',
    choices: [
      {
        id: 'silence',
        label: '先不发声，等风头过去',
        effects: { playerStats: { pr: 5, insight: 3 } },
      },
      {
        id: 'face',
        label: '马上发声明，正面回应',
        effects: { reputation: 4, playerStats: { eloquence: 5, pr: 2 } },
      },
      {
        id: 'redirect',
        label: '赶紧放新料，把视线引开',
        effects: { funds: 4000, playerStats: { charm: 4, resource: 3 } },
      },
    ],
  },
  {
    id: 'q-contract',
    text: '甲方递来一份条款苛刻的合同。你会？',
    choices: [
      {
        id: 'negotiate',
        label: '一条一条跟他们对磨',
        effects: { playerStats: { eloquence: 5, stamina: 2 } },
      },
      {
        id: 'legal',
        label: '不废话了，叫法务上',
        effects: { funds: -3000, playerStats: { pr: 4, resource: 4 } },
      },
      {
        id: 'trade',
        label: '先让一步，以后再找补',
        effects: { reputation: 3, playerStats: { charm: 3, insight: 4 } },
      },
    ],
  },
  {
    id: 'q-poach',
    text: '对手公司以优渥条件试图挖走你旗下的艺人。你会如何应对？',
    choices: [
      {
        id: 'money',
        label: '加钱留人，诚意给足',
        effects: { funds: -6000, playerStats: { resource: 5, stamina: 2 } },
      },
      {
        id: 'heart',
        label: '聊感情，聊这些年的情分',
        effects: { playerStats: { charm: 5, eloquence: 3 } },
      },
      {
        id: 'swap',
        label: '放人也行，拿解约金布局下一个',
        effects: { funds: 8000, playerStats: { pr: 4, insight: 4 } },
      },
    ],
  },
  {
    id: 'q-fans',
    text: '两家粉丝在网络上激烈对峙，局势几近失控。你会？',
    choices: [
      {
        id: 'guide',
        label: '发条长文，让大家冷静点',
        effects: { reputation: 5, playerStats: { pr: 4, insight: 4 } },
      },
      {
        id: 'fight',
        label: '自己下场，跟黑粉硬刚',
        effects: { reputation: -3, playerStats: { eloquence: 5, stamina: 2 } },
      },
      {
        id: 'wait',
        label: '不说话，等他们自己吵完',
        effects: { playerStats: { insight: 3, resource: 3 } },
      },
    ],
  },
  {
    id: 'q-future',
    text: '五年之后，你希望自己成为怎样的存在？',
    choices: [
      {
        id: 'legend',
        label: '圈里一提名字，就知道厉害',
        effects: { reputation: 6, playerStats: { pr: 4, resource: 5, eloquence: 3 } },
      },
      {
        id: 'exception',
        label: '成为艺人最信任的那个经纪人',
        effects: { playerStats: { charm: 5, insight: 4, eloquence: 2 } },
      },
      {
        id: 'shadow',
        label: '不出镜就好，幕后操盘',
        effects: { funds: 5000, playerStats: { insight: 5, pr: 4, stamina: 2 } },
      },
    ],
  },
]

export function buildInitialHotSearches(): HotSearchItem[] {
  const now = Date.now()
  return [
    { id: 'hs-1', rank: 1, keyword: '盛夏档综艺阵容官宣', heat: 98, type: 'positive', createdAt: now },
    { id: 'hs-2', rank: 2, keyword: '林远新剧路透', heat: 86, type: 'positive', artistId: 'sm-linyuan', createdAt: now },
    { id: 'hs-3', rank: 3, keyword: '某顶流恋情瓜', heat: 74, type: 'gossip', createdAt: now },
  ]
}

export function randomScout(): Artist {
  const base = SCOUT_POOL[Math.floor(Math.random() * SCOUT_POOL.length)]
  const v = () => Math.floor(Math.random() * 10) - 5
  return {
    ...base,
    id: `scout-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    stats: {
      vocal: clamp(base.stats.vocal + v()),
      acting: clamp(base.stats.acting + v()),
      variety: clamp(base.stats.variety + v()),
      charm: clamp(base.stats.charm + v()),
      stamina: clamp(base.stats.stamina + v()),
      commercial: clamp(base.stats.commercial + v()),
    },
    fans: Math.max(800, base.fans + Math.floor(Math.random() * 4000)),
    affection: 12 + Math.floor(Math.random() * 12),
  }
}

function clamp(n: number) {
  return Math.max(20, Math.min(99, n))
}

export const DRAMA_TEMPLATES: Omit<DramaEvent, 'id'>[] = [
  {
    title: '副驾驶上的对峙',
    lines: [
      '探班结束的你刚拉开车门，副驾驶上坐着另一位艺人。',
      '走廊尽头，他停住脚步，目光从你脸上移到那辆车，又移回来。',
      '空气里只剩下摄影棚未散的镁光灯味，和一句尚未出口的质问。',
    ],
    choices: [
      {
        id: 'calm',
        label: '当面解释，先稳住两人情绪',
        effects: { affection: {}, resentment: {}, reputation: 3 },
      },
      {
        id: 'lie',
        label: '谎称顺路接送，先糊弄过去',
        effects: { resentment: {}, reputation: -4 },
      },
      {
        id: 'public',
        label: '索性公开关系，承受舆论风暴',
        effects: { setStatus: {}, fans: {}, commercial: {}, clearDrama: true },
      },
    ],
  },
  {
    title: '深夜同回公寓',
    lines: [
      '狗仔长焦镜头里，你们一前一后进了同一栋公寓楼。',
      '二十分钟后，热搜词条已经爬到了第三位。',
      '公关部的电话震个不停——这一次，躲不过去了。',
    ],
    choices: [
      {
        id: 'press',
        label: '花钱撤热搜，维持地下恋',
        effects: { funds: -15000, resentment: {} },
      },
      {
        id: 'lawyer',
        label: '发律师函硬刚，声望受损',
        effects: { reputation: -8, funds: -5000 },
      },
      {
        id: 'admit',
        label: '召开记者会，公开恋情',
        effects: { setStatus: {}, fans: {}, commercial: {}, clearDrama: true },
      },
    ],
  },
]

export const AWARD_CATEGORIES = [
  { id: 'best-screen', name: '最佳荧幕表现', stat: 'acting' as const },
  { id: 'best-stage', name: '最佳舞台魅力', stat: 'vocal' as const },
  { id: 'best-variety', name: '最佳综艺感', stat: 'variety' as const },
  { id: 'best-commercial', name: '年度商业价值', stat: 'commercial' as const },
]
