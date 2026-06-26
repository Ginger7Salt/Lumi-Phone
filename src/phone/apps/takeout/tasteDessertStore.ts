import type { MenuItem, Store, StoreCoupon } from './types'
import {
  parseStoreImageFolder,
  pickHotItemIds,
  slugifyWithPrefix,
  sortMenuEntries,
} from './tasteStoreAssets'
import {
  averageReviewRating,
  buildDessertStoreReviews,
} from './tasteStoreReviews'

const dessertImageModules = import.meta.glob<string>(
  '../../../../店铺菜品图/甜品铺/*.{webp,png,jpg,jpeg}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

/** 按文件名关键词自动归类 */
function inferCategory(name: string): string {
  if (/绵绵冰|雪山冰|鲜奶冰/.test(name)) return '绵绵冰'
  if (/冰沙|冰碗/.test(name)) return '冰沙碗'
  if (/冻冻|冰酪|气泡冻/.test(name)) return '冻冻冰'
  if (/盒子|三明治|班戟|千层|雪媚娘|麻薯|冻糕/.test(name)) return '轻甜盒子'
  if (/茶|气泡水|橙汁|三响炮|鲜榨/.test(name)) return '鲜饮'
  return '招牌冰品'
}

function inferPrice(name: string, category: string): number {
  if (category === '鲜饮') {
    if (/三响炮|气泡水/.test(name)) return 22
    if (/鲜榨/.test(name)) return 18
    return 20
  }
  if (category === '轻甜盒子') {
    if (/千层|班戟/.test(name)) return 38
    if (/三明治|盒子/.test(name)) return 32
    return 26
  }
  if (category === '绵绵冰') return 36
  if (category === '冰沙碗') return 34
  if (category === '冻冻冰') return 30
  return 28
}

function buildDesc(name: string, category: string): string {
  const map: Record<string, string> = {
    绵绵冰: '手作绵绵冰，奶香细绵，甜度克制。',
    冰沙碗: '冰沙细腻，水果新鲜，适合分享。',
    冻冻冰: '层次冻冻，冰感清透，夏日限定。',
    轻甜盒子: '现做轻甜，包装精致，适合外带。',
    鲜饮: '鲜调饮品，低负担，配冰品刚好。',
    招牌冰品: '晚风招牌，现点现做，建议尽快享用。',
  }
  return map[category] ?? `${name}，晚风冰品社人气单品。`
}

function buildMenuItem(name: string, image: string): MenuItem {
  const category = inferCategory(name)
  const price = inferPrice(name, category)
  const listPrice = Math.ceil(price * 1.12)
  return {
    id: slugifyWithPrefix('wf', name),
    name,
    desc: buildDesc(name, category),
    price,
    listPrice: listPrice > price ? listPrice : undefined,
    image,
    category,
  }
}

function buildDessertStoreFromAssets(): Store | null {
  const parsed = parseStoreImageFolder(dessertImageModules)
  if (!parsed) return null

  const { logoImage, coverImage, menuEntries } = parsed
  const sorted = sortMenuEntries(menuEntries, inferCategory)
  const menus = sorted.map(({ name, image }) => buildMenuItem(name, image))
  const hotItemIds = pickHotItemIds(menus, [
    '杨枝甘露冰酪',
    '奥利奥芝士绵绵冰',
    '芋泥波波冰沙碗',
    '芒果千层',
    '黑糖珍珠鲜奶冰',
  ])

  const reviews = buildDessertStoreReviews()
  const coupons: StoreCoupon[] = [
    { id: 'wf-c1', threshold: 35, discount: 6 },
    { id: 'wf-c2', threshold: 55, discount: 12 },
    { id: 'wf-c3', threshold: 80, discount: 18 },
  ]

  return {
    id: 'wanfeng-dessert',
    name: '晚风冰品社',
    category: '创意冰品',
    coverImage,
    logoImage,
    deliveryTime: '约 20-35 分钟',
    deliveryMinutes: 28,
    minOrder: 35,
    deliveryFee: 0.6,
    distanceKm: 2.1,
    monthlySales: 568,
    hotItemIds,
    coupons,
    tags: ['手作冰品', '食无忧', '慢必赔'],
    rating: averageReviewRating(reviews),
    reviewCount: reviews.length,
    intro:
      '晚风冰品社主打绵绵冰、冰沙碗与轻甜盒子，每日现做，甜度可调。寻味合作商户，适合午后与夜宵外送。',
    address: '徐汇区永康路 118 号 · 1 层',
    reviews,
    menus,
  }
}

export const WANFENG_DESSERT_STORE = buildDessertStoreFromAssets()
