import type { MenuItem, Store, StoreCoupon } from './types'
import {
  parseStoreImageFolder,
  pickHotItemIds,
  slugifyWithPrefix,
  sortMenuEntries,
} from './tasteStoreAssets'
import {
  averageReviewRating,
  buildWesternStoreReviews,
} from './tasteStoreReviews'

const westernImageModules = import.meta.glob<string>(
  '../../../../店铺菜品图/西餐厅/*.{webp,png,jpg,jpeg}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

function inferCategory(name: string): string {
  if (/巴斯克|熔岩|提拉米苏/.test(name)) return '甜品'
  if (/汤|浓汤|清汤|金汤/.test(name)) return '汤品'
  if (/蜗牛|鹅肝|北极贝|沙拉|青口/.test(name)) return '前菜'
  return '主菜'
}

function inferPrice(name: string, category: string): number {
  if (category === '甜品') {
    if (/熔岩/.test(name)) return 72
    return 58
  }
  if (category === '汤品') {
    if (/龙虾/.test(name)) return 88
    if (/松露/.test(name)) return 68
    return 58
  }
  if (category === '前菜') {
    if (/鹅肝/.test(name)) return 158
    if (/北极贝/.test(name)) return 128
    if (/蜗牛/.test(name)) return 98
    if (/沙拉/.test(name)) return 88
    return 78
  }
  if (/M9|和牛西冷/.test(name)) return 388
  if (/战斧/.test(name)) return 488
  if (/菲力/.test(name)) return 328
  if (/蓝龙/.test(name)) return 358
  if (/肋排/.test(name)) return 268
  if (/鸭胸/.test(name)) return 198
  if (/银鳕鱼/.test(name)) return 228
  if (/牛舌/.test(name)) return 168
  if (/意面/.test(name)) return 168
  return 198
}

function buildDesc(name: string, category: string): string {
  const map: Record<string, string> = {
    主菜: '主厨推荐，按单现做，建议趁热享用。',
    前菜: '经典法式前菜，适合开胃分享。',
    汤品: '慢炖出味，餐前暖胃之选。',
    甜品: '餐后收尾，甜度克制。',
  }
  return map[category] ?? `${name}，Mirra 觅芮招牌料理。`
}

function buildMenuItem(name: string, image: string): MenuItem {
  const category = inferCategory(name)
  const price = inferPrice(name, category)
  const listPrice = Math.ceil(price * 1.08)
  return {
    id: slugifyWithPrefix('mr', name),
    name,
    desc: buildDesc(name, category),
    price,
    listPrice: listPrice > price ? listPrice : undefined,
    image,
    category,
  }
}

function buildWesternStoreFromAssets(): Store | null {
  const parsed = parseStoreImageFolder(westernImageModules)
  if (!parsed) return null

  const { logoImage, coverImage, menuEntries } = parsed
  const sorted = sortMenuEntries(menuEntries, inferCategory)
  const menus = sorted.map(({ name, image }) => buildMenuItem(name, image))
  const hotItemIds = pickHotItemIds(menus, [
    'M9 和牛西冷',
    '香煎法式鹅肝',
    '干式熟成战斧',
    '白兰地菲力',
  ])

  const reviews = buildWesternStoreReviews()
  const coupons: StoreCoupon[] = [
    { id: 'mr-c1', threshold: 80, discount: 15 },
    { id: 'mr-c2', threshold: 150, discount: 35 },
    { id: 'mr-c3', threshold: 280, discount: 60 },
  ]

  return {
    id: 'mirra-western',
    name: 'Mirra 觅芮西餐厅',
    category: '现代法餐',
    coverImage,
    logoImage,
    deliveryTime: '约 40-55 分钟',
    deliveryMinutes: 48,
    minOrder: 80,
    deliveryFee: 2.5,
    distanceKm: 4.6,
    monthlySales: 214,
    hotItemIds,
    coupons,
    tags: ['主厨现做', '慢必赔', '寻味甄选'],
    rating: averageReviewRating(reviews),
    reviewCount: reviews.length,
    intro:
      'Mirra 觅芮以现代法餐为基调，干式熟成、低温料理与季节海鲜为主打。寻味合作商户，适合纪念日与晚餐外送。',
    address: '黄浦区复兴中路 517 号 · B1',
    reviews,
    menus,
  }
}

export const MIRRA_WESTERN_STORE = buildWesternStoreFromAssets()
