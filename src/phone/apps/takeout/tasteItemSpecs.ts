import type { ItemSpecSelection, MenuItem, MenuItemSpecGroup } from './types'

const SPICINESS: MenuItemSpecGroup = {
  id: 'spiciness',
  label: '辣度',
  required: true,
  options: [
    { id: 'none', label: '不辣' },
    { id: 'mild', label: '微辣' },
    { id: 'medium', label: '中辣' },
    { id: 'hot', label: '重辣' },
  ],
}

const HOT_COLD_DRINK_TEMPERATURE: MenuItemSpecGroup = {
  id: 'temperature',
  label: '温度',
  required: true,
  options: [
    { id: 'hot', label: '热饮' },
    { id: 'warm', label: '温' },
    { id: 'less-ice', label: '少冰' },
    { id: 'ice', label: '正常冰' },
  ],
}

const COLD_DRINK_TEMPERATURE: MenuItemSpecGroup = {
  id: 'temperature',
  label: '温度',
  required: true,
  options: [
    { id: 'less-ice', label: '少冰' },
    { id: 'ice', label: '正常冰' },
    { id: 'no-ice', label: '去冰' },
  ],
}

const SUGAR: MenuItemSpecGroup = {
  id: 'sugar',
  label: '糖度',
  required: true,
  options: [
    { id: '0', label: '无糖' },
    { id: '30', label: '三分糖' },
    { id: '50', label: '半糖' },
    { id: '70', label: '七分糖' },
    { id: '100', label: '正常甜' },
  ],
}

const DESSERT_SUGAR: MenuItemSpecGroup = {
  ...SUGAR,
  required: false,
}

const CONGEE_TEMPERATURE: MenuItemSpecGroup = {
  id: 'temperature',
  label: '温度',
  required: true,
  options: [
    { id: 'hot', label: '滚烫' },
    { id: 'warm', label: '温热' },
  ],
}

const NO_SPEC_CATEGORIES = new Set([
  '轻甜盒子',
  '招牌冰品',
  '甜品',
  '刺身',
  '寿司',
  '定食丼',
  '炸物',
  '锅物',
  '前菜',
  '主菜',
  '小食',
  '拉面',
  '面点蒸品',
])

const SPICY_CATEGORIES = new Set(['咖喱', '热炒'])

function pruneSpecGroups(groups: MenuItemSpecGroup[]): MenuItemSpecGroup[] {
  return groups.filter((group) => group.options.length > 1)
}

function isDrinkItem(name: string, category: string): boolean {
  if (category === '鲜饮') return true
  return /茶|气泡|鲜榨|橙汁|三响炮|咖啡|拿铁|奶盖|柠檬|汽水|乌龙|四季春|茉莉|红柚|青提|鲜奶|奶昔/.test(name)
}

function isInherentlyColdDrink(name: string): boolean {
  return /冰|雪|冻|气泡|鲜榨|橙汁|三响炮|汽水|沙冰|奶昔|冷萃|酷乐|冰爽|冰乐/.test(name)
}

function isHotCapableDrink(name: string, category: string, storeCategory: string): boolean {
  if (storeCategory.includes('冰品') || storeCategory.includes('甜品')) return false
  if (/热/.test(name)) return true
  if (isInherentlyColdDrink(name)) return false
  if (/粥铺/.test(storeCategory)) {
    return /豆浆|姜茶|奶茶|奶|茶|咖啡|可可/.test(name)
  }
  if (/奶茶|奶盖|珍珠|拿铁|咖啡|豆浆|可可|姜茶|红豆饮/.test(name)) return true
  if (/茶/.test(name) && !/冰/.test(name)) return true
  return category === '鲜饮' && !isInherentlyColdDrink(name)
}

function drinkNeedsSugar(name: string): boolean {
  if (/气泡水|汽水|苏打/.test(name)) return false
  return true
}

function isCongeeItem(name: string, category: string): boolean {
  return category.includes('粥') || /粥/.test(name)
}

function isSugarCustomizableCold(category: string): boolean {
  return ['绵绵冰', '冰沙碗', '冻冻冰'].includes(category)
}

function isNonSpicyByName(name: string): boolean {
  return /西米露|糯米饭|沙拉|凤爪|鸡汤|鸡饭|炒饭|河粉|刺身|寿司|天妇罗|大福|抹茶|巴斯克|提拉米苏|鹅肝|蜗牛|青口|北极贝|熔岩|提拉米苏|麻薯|雪媚娘|千层|班戟|盒子|三明治|冻糕/.test(
    name,
  )
}

function isSpicyCandidate(name: string, category: string): boolean {
  if (NO_SPEC_CATEGORIES.has(category)) return false
  if (isNonSpicyByName(name)) return false

  if (SPICY_CATEGORIES.has(category)) return true

  if (category === '海鲜') {
    return /辣|椒|咖喱/.test(name)
  }

  if (category === '汤品' || category === '开胃小食') {
    return /冬阴功|咖喱|酸辣|椒|辣|香茅|泰式/.test(name)
  }

  if (category === '主食') {
    return /辣|椒|咖喱|炒/.test(name) && !/鸡饭|白饭/.test(name)
  }

  return /冬阴功|咖喱|罗勒|香茅|泰式|酸辣|椒|辣/.test(name)
}

/** 按菜名 / 分类 / 店铺类型推断可选规格（未手写 specGroups 时使用） */
export function inferMenuItemSpecGroups(
  name: string,
  category: string,
  storeCategory = '',
): MenuItemSpecGroup[] {
  const groups: MenuItemSpecGroup[] = []

  if (isDrinkItem(name, category)) {
    const temperature = isHotCapableDrink(name, category, storeCategory)
      ? HOT_COLD_DRINK_TEMPERATURE
      : COLD_DRINK_TEMPERATURE
    groups.push(temperature)
    if (drinkNeedsSugar(name)) groups.push(SUGAR)
    return pruneSpecGroups(groups)
  }

  if (isSugarCustomizableCold(category)) {
    groups.push(DESSERT_SUGAR)
    return pruneSpecGroups(groups)
  }

  if (isCongeeItem(name, category)) {
    groups.push(CONGEE_TEMPERATURE)
    return pruneSpecGroups(groups)
  }

  if (isSpicyCandidate(name, category)) {
    groups.push(SPICINESS)
  }

  return pruneSpecGroups(groups)
}

export function resolveMenuItemSpecGroups(
  item: MenuItem,
  storeCategory = '',
): MenuItemSpecGroup[] {
  if (item.specGroups?.length) return pruneSpecGroups(item.specGroups)
  return inferMenuItemSpecGroups(item.name, item.category, storeCategory)
}

export function menuItemNeedsSpecs(item: MenuItem, storeCategory = ''): boolean {
  return resolveMenuItemSpecGroups(item, storeCategory).length > 0
}

export function formatSpecLabelsHint(groups: MenuItemSpecGroup[]): string {
  return groups.map((group) => group.label).join(' · ')
}

export function defaultSpecSelections(groups: MenuItemSpecGroup[]): ItemSpecSelection[] {
  return groups.map((group) => {
    const opt = group.options[0]!
    return {
      groupId: group.id,
      groupLabel: group.label,
      optionId: opt.id,
      optionLabel: opt.label,
      priceDelta: opt.priceDelta ?? 0,
    }
  })
}

export function buildCartLineKey(itemId: string, specs: ItemSpecSelection[]): string {
  if (!specs.length) return itemId
  const part = [...specs]
    .map((s) => `${s.groupId}:${s.optionId}`)
    .sort()
    .join('|')
  return `${itemId}#${part}`
}

export function formatSpecSummary(specs: ItemSpecSelection[] | undefined): string {
  if (!specs?.length) return ''
  return specs.map((s) => s.optionLabel).join(' · ')
}

/** 订单列表 / 追踪页一行菜品文案 */
export function formatOrderItemLine(item: {
  name: string
  quantity: number
  specSummary?: string
}): string {
  const qty = item.quantity > 1 ? `×${item.quantity}` : ''
  const spec = item.specSummary?.trim()
  if (spec) return `${item.name}${qty}（${spec}）`
  return `${item.name}${qty}`
}

export function resolveUnitPrice(
  basePrice: number,
  groups: MenuItemSpecGroup[],
  specs: ItemSpecSelection[],
): number {
  let delta = 0
  for (const sel of specs) {
    const group = groups.find((g) => g.id === sel.groupId)
    const opt = group?.options.find((o) => o.id === sel.optionId)
    delta += opt?.priceDelta ?? sel.priceDelta ?? 0
  }
  return Math.round((basePrice + delta) * 100) / 100
}

export function selectionsFromDraft(
  groups: MenuItemSpecGroup[],
  draft: Record<string, string>,
): ItemSpecSelection[] {
  return groups.map((group) => {
    const optionId = draft[group.id] ?? group.options[0]?.id ?? ''
    const opt = group.options.find((o) => o.id === optionId) ?? group.options[0]!
    return {
      groupId: group.id,
      groupLabel: group.label,
      optionId: opt.id,
      optionLabel: opt.label,
      priceDelta: opt.priceDelta ?? 0,
    }
  })
}

export function draftFromSelections(specs: ItemSpecSelection[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of specs) out[s.groupId] = s.optionId
  return out
}
