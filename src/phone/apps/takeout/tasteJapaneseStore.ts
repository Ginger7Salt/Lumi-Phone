import type { MenuItem, Store, StoreCoupon } from './types'
import {
  parseStoreImageFolder,
  pickHotItemIds,
  slugifyWithPrefix,
  sortMenuEntries,
} from './tasteStoreAssets'
import {
  averageReviewRating,
  buildJapaneseStoreReviews,
} from './tasteStoreReviews'

const japaneseImageModules = import.meta.glob<string>(
  '../../../../店铺菜品图/日料餐厅/*.{webp,png,jpg,jpeg}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

function inferCategory(name: string): string {
  if (/大福|抹茶/.test(name)) return '甜品'
  if (/刺身/.test(name)) return '刺身'
  if (/寿司|军舰|鳗鱼卷|虾卷/.test(name)) return '寿司'
  if (/寿喜|小锅/.test(name)) return '锅物'
  if (/定食|丼饭|寿喜饭/.test(name)) return '定食丼'
  if (/天妇罗|炸猪排|唐扬|小丸子/.test(name)) return '炸物'
  if (/拉面/.test(name)) return '拉面'
  return '小食'
}

function inferPrice(name: string, category: string): number {
  if (category === '刺身') {
    if (/三文鱼/.test(name)) return 88
    return 68
  }
  if (category === '寿司') {
    if (/火焰|鳗鱼/.test(name)) return 58
    if (/蟹籽/.test(name)) return 48
    return 42
  }
  if (category === '锅物') {
    if (/和牛/.test(name)) return 128
    return 98
  }
  if (category === '定食丼') {
    if (/鳗鱼/.test(name)) return 78
    if (/寿喜饭/.test(name)) return 68
    return 58
  }
  if (category === '炸物') {
    if (/天妇罗/.test(name)) return 48
    if (/炸猪排/.test(name)) return 52
    return 32
  }
  if (category === '拉面') return 52
  if (category === '甜品') return 26
  if (/温泉蛋/.test(name)) return 18
  return 28
}

function buildDesc(name: string, category: string): string {
  const map: Record<string, string> = {
    刺身: '当日鲜切，建议尽快食用，配芥末酱油更佳。',
    寿司: '现握现做，醋饭温度适中，适合单人或分享。',
    锅物: '暖锅上桌，汤底鲜甜，适合秋冬外送。',
    定食丼: '一碗定食，米饭、主菜与配菜齐全。',
    炸物: '现炸出餐，外酥里嫩，配塔塔酱或天妇罗汁。',
    拉面: '豚骨浓汤慢熬，面条劲道，建议趁热吃。',
    小食: '日式小食，开胃或配餐皆宜。',
    甜品: '餐后轻甜，抹茶风味，甜度克制。',
  }
  return map[category] ?? `${name}，汐鮨 Shio Sushi 人气单品。`
}

function buildMenuItem(name: string, image: string): MenuItem {
  const category = inferCategory(name)
  const price = inferPrice(name, category)
  const listPrice = Math.ceil(price * 1.1)
  return {
    id: slugifyWithPrefix('ss', name),
    name,
    desc: buildDesc(name, category),
    price,
    listPrice: listPrice > price ? listPrice : undefined,
    image,
    category,
  }
}

function buildJapaneseStoreFromAssets(): Store | null {
  const parsed = parseStoreImageFolder(japaneseImageModules)
  if (!parsed) return null

  const { logoImage, coverImage, menuEntries } = parsed
  const sorted = sortMenuEntries(menuEntries, inferCategory)
  const menus = sorted.map(({ name, image }) => buildMenuItem(name, image))
  const hotItemIds = pickHotItemIds(menus, [
    '厚切三文鱼刺身',
    '和牛寿喜烧锅',
    '三文鱼握寿司',
    '蒲烧鳗鱼卷',
    '豚骨拉面',
  ])

  const reviews = buildJapaneseStoreReviews()
  const coupons: StoreCoupon[] = [
    { id: 'ss-c1', threshold: 45, discount: 8 },
    { id: 'ss-c2', threshold: 80, discount: 18 },
    { id: 'ss-c3', threshold: 120, discount: 30 },
  ]

  return {
    id: 'shio-sushi',
    name: '汐鮨 Shio Sushi',
    category: '日式料理',
    coverImage,
    logoImage,
    deliveryTime: '约 30-45 分钟',
    deliveryMinutes: 38,
    minOrder: 45,
    deliveryFee: 1.5,
    distanceKm: 3.8,
    monthlySales: 392,
    hotItemIds,
    coupons,
    tags: ['新鲜刺身', '食无忧', '寻味甄选'],
    rating: averageReviewRating(reviews),
    reviewCount: reviews.length,
    intro:
      '汐鮨 Shio Sushi 主打刺身、握寿司与寿喜锅，食材每日到店。寻味合作商户，适合一人食与轻聚会外送。',
    address: '静安区南京西路 1266 号 · 2 层',
    reviews,
    menus,
  }
}

export const SHIO_SUSHI_STORE = buildJapaneseStoreFromAssets()
