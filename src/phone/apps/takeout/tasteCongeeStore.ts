import type { MenuItem, Store, StoreCoupon } from './types'
import {
  parseStoreImageFolder,
  pickHotItemIds,
  slugifyWithPrefix,
  sortMenuEntries,
} from './tasteStoreAssets'
import {
  averageReviewRating,
  buildCongeeStoreReviews,
} from './tasteStoreReviews'

const congeeImageModules = import.meta.glob<string>(
  '../../../../店铺菜品图/粥铺/*.{webp,png,jpg,jpeg}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

function inferCategory(name: string): string {
  if (/凉拌|茶叶蛋/.test(name)) return '小食配菜'
  if (/包|卷|发糕|煎|小笼/.test(name)) return '面点蒸品'
  if (/粥/.test(name)) return '养生粥品'
  return '招牌粥品'
}

function inferPrice(name: string, category: string): number {
  if (category === '小食配菜') {
    if (/凉拌/.test(name)) return 10
    return 8
  }
  if (category === '面点蒸品') {
    if (/小笼|大包/.test(name)) return 22
    if (/发糕|卷/.test(name)) return 14
    return 16
  }
  if (/海鲜|鲜虾|排骨/.test(name)) return 32
  if (/山药|莲子|银耳|芡实|黑米|杂粮/.test(name)) return 26
  if (/南瓜|玉米|青菜|香菇/.test(name)) return 20
  if (/皮蛋/.test(name)) return 18
  return 22
}

function buildDesc(name: string, category: string): string {
  const map: Record<string, string> = {
    养生粥品: '慢火熬制，米粒开花，暖胃轻负担。',
    招牌粥品: '现熬现送，建议趁热享用。',
    面点蒸品: '手工面点，与粥品搭配刚好。',
    小食配菜: '清爽小食，佐粥更完整的一餐。',
  }
  return map[category] ?? `${name}，暖粥小馆人气单品。`
}

function buildMenuItem(name: string, image: string): MenuItem {
  const category = inferCategory(name)
  const price = inferPrice(name, category)
  const listPrice = Math.ceil(price * 1.1)
  return {
    id: slugifyWithPrefix('zm', name),
    name,
    desc: buildDesc(name, category),
    price,
    listPrice: listPrice > price ? listPrice : undefined,
    image,
    category,
  }
}

function buildCongeeStoreFromAssets(): Store | null {
  const parsed = parseStoreImageFolder(congeeImageModules)
  if (!parsed) return null

  const { logoImage, coverImage, menuEntries } = parsed
  const sorted = sortMenuEntries(menuEntries, inferCategory)
  const menus = sorted.map(({ name, image }) => buildMenuItem(name, image))
  const hotItemIds = pickHotItemIds(menus, ['皮蛋瘦肉粥', '海鲜鲜虾粥', '鲜肉小笼包', '南瓜排骨粥'])

  const reviews = buildCongeeStoreReviews()
  const coupons: StoreCoupon[] = [
    { id: 'zm-c1', threshold: 25, discount: 5 },
    { id: 'zm-c2', threshold: 40, discount: 10 },
    { id: 'zm-c3', threshold: 55, discount: 15 },
  ]

  return {
    id: 'nuanzhou-congee',
    name: '暖粥小馆',
    category: '养生粥铺',
    coverImage,
    logoImage,
    deliveryTime: '约 25-40 分钟',
    deliveryMinutes: 32,
    minOrder: 25,
    deliveryFee: 0.8,
    distanceKm: 3.2,
    monthlySales: 486,
    hotItemIds,
    coupons,
    tags: ['明厨亮灶', '食无忧', '慢必赔'],
    rating: averageReviewRating(reviews),
    reviewCount: reviews.length,
    intro:
      '暖粥小馆主打现熬养生粥与手工面点，清晨起灶，米粒绵软。寻味合作商户，适合早餐、夜宵与病后调理外送。',
    address: '长宁区武夷路 320 号 · 1 层',
    reviews,
    menus,
  }
}

export const NUANZHOU_CONGEE_STORE = buildCongeeStoreFromAssets()
