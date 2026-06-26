import type { MenuItem, Store, StoreCoupon } from './types'
import {
  parseStoreImageFolder,
  pickHotItemIds,
  slugifyWithPrefix,
  sortMenuEntries,
} from './tasteStoreAssets'
import {
  averageReviewRating,
  buildThaiStoreReviews,
} from './tasteStoreReviews'

const thaiImageModules = import.meta.glob<string>(
  '../../../../店铺菜品图/泰式料理/*.{webp,png,jpg,jpeg}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

function inferCategory(name: string): string {
  if (/汤|冬阴功/.test(name)) return '汤品'
  if (/咖喱/.test(name)) return '咖喱'
  if (/饭|炒饭|河粉/.test(name)) return '主食'
  if (/虾|鱿鱼/.test(name)) return '海鲜'
  if (/沙拉|凤爪/.test(name)) return '开胃小食'
  if (/炒鸡|牛肉|鸡汤/.test(name)) return '热炒'
  if (/糯米饭|西米露/.test(name)) return '甜品'
  return '招牌'
}

function inferPrice(name: string, category: string): number {
  if (category === '汤品') {
    if (/冬阴功/.test(name)) return 48
    return 38
  }
  if (category === '咖喱') {
    if (/牛腩|大虾/.test(name)) return 58
    return 52
  }
  if (category === '主食') {
    if (/菠萝/.test(name)) return 42
    if (/河粉/.test(name)) return 38
    return 36
  }
  if (category === '海鲜') {
    if (/老虎虾/.test(name)) return 68
    return 48
  }
  if (category === '开胃小食') return 32
  if (category === '热炒') {
    if (/罗勒|香茅牛肉/.test(name)) return 56
    return 46
  }
  if (category === '甜品') return 28
  return 42
}

function buildDesc(name: string, category: string): string {
  const map: Record<string, string> = {
    汤品: '酸辣平衡，香茅与南姜气息清晰，建议趁热享用。',
    咖喱: '椰浆底咖喱，辣度温和，配米饭更完整。',
    主食: '泰式经典主食，出餐快，适合一人食或分享。',
    海鲜: '现做现出，虾肉弹牙，香料层次丰富。',
    开胃小食: '酸辣开胃，适合作为前菜或配餐。',
    热炒: '锅气足，香茅与罗勒风味突出。',
    甜品: '椰香与果香收尾，甜度克制。',
    招牌: '青柠屿人气单品，寻味合作商户推荐。',
  }
  return map[category] ?? `${name}，青柠屿泰式料理外送推荐。`
}

function buildMenuItem(name: string, image: string): MenuItem {
  const category = inferCategory(name)
  const price = inferPrice(name, category)
  const listPrice = Math.ceil(price * 1.12)
  return {
    id: slugifyWithPrefix('qt', name),
    name,
    desc: buildDesc(name, category),
    price,
    listPrice: listPrice > price ? listPrice : undefined,
    image,
    category,
  }
}

function buildThaiStoreFromAssets(): Store | null {
  const parsed = parseStoreImageFolder(thaiImageModules)
  if (!parsed) return null

  const { logoImage, coverImage, menuEntries } = parsed
  const sorted = sortMenuEntries(menuEntries, inferCategory)
  const menus = sorted.map(({ name, image }) => buildMenuItem(name, image))
  const hotItemIds = pickHotItemIds(menus, [
    '泰式冬阴功汤',
    '经典泰式炒河粉',
    '芒果糯米饭',
    '绿咖喱鸡肉',
    '菠萝炒饭',
  ])

  const reviews = buildThaiStoreReviews()
  const coupons: StoreCoupon[] = [
    { id: 'qt-c1', threshold: 40, discount: 6 },
    { id: 'qt-c2', threshold: 75, discount: 15 },
    { id: 'qt-c3', threshold: 110, discount: 25 },
  ]

  return {
    id: 'qingning-thai',
    name: '青柠屿',
    category: '泰式料理',
    coverImage,
    logoImage,
    deliveryTime: '约 28-40 分钟',
    deliveryMinutes: 34,
    minOrder: 40,
    deliveryFee: 1.5,
    distanceKm: 3.2,
    monthlySales: 418,
    hotItemIds,
    coupons,
    tags: ['酸辣平衡', '食无忧', '寻味甄选'],
    rating: averageReviewRating(reviews),
    reviewCount: reviews.length,
    intro:
      '青柠屿主打泰式冬阴功、咖喱与炒河粉，香茅与青柠的层次清晰。寻味合作商户，适合想换口味的工作日晚餐与周末小聚外送。',
    address: '徐汇区衡山路 88 号 · B1',
    reviews,
    menus,
  }
}

export const QINGNING_THAI_STORE = buildThaiStoreFromAssets()
