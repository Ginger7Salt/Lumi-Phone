export interface MenuItemSpecOption {
  id: string
  label: string
  /** 相对基础价的加价（可为负） */
  priceDelta?: number
}

export interface MenuItemSpecGroup {
  id: string
  label: string
  required?: boolean
  options: MenuItemSpecOption[]
}

/** 用户已选规格（购物车 / 订单行） */
export interface ItemSpecSelection {
  groupId: string
  groupLabel: string
  optionId: string
  optionLabel: string
  priceDelta?: number
}

export interface MenuItem {
  id: string
  name: string
  desc: string
  price: number
  /** 划线原价（预览/促销展示） */
  listPrice?: number
  image: string
  category: string
  /** 可选规格；未填则按菜名/分类自动推断 */
  specGroups?: MenuItemSpecGroup[]
}

export interface CartItem extends MenuItem {
  quantity: number
  /** 区分同菜不同规格 */
  lineKey: string
  specs: ItemSpecSelection[]
  /** 含规格加价后的单价 */
  unitPrice: number
}

export interface StoreCoupon {
  id: string
  /** 满减门槛 */
  threshold: number
  /** 减免金额 */
  discount: number
}

export interface StoreReview {
  id: string
  author: string
  rating: number
  text: string
  date: string
}

export interface Store {
  id: string
  name: string
  category: string
  coverImage: string
  /** 店铺 logo（方形） */
  logoImage: string
  deliveryTime: string
  /** 预计送达分钟数（首页紧凑展示） */
  deliveryMinutes: number
  /** 起送价 */
  minOrder: number
  /** 配送费 */
  deliveryFee: number
  /** 距离 km */
  distanceKm: number
  /** 月销量 */
  monthlySales: number
  /** 综合评分 0–5 */
  rating: number
  /** 评价条数 */
  reviewCount: number
  /** 首页热卖菜品 id（2–3 个） */
  hotItemIds: string[]
  /** 店铺优惠券 */
  coupons: StoreCoupon[]
  /** 服务/特色标签 */
  tags: string[]
  intro: string
  address: string
  reviews: StoreReview[]
  menus: MenuItem[]
}

export type StoreTab = 'menu' | 'reviews' | 'merchant'

export type DeliveryAddressKind = 'self' | 'character'

export interface DeliveryAddressOption {
  id: string
  kind: DeliveryAddressKind
  /** 收货名（外卖单/骑手可见，可自定义） */
  label: string
  /** 真实收货人姓名（与收货名独立） */
  realRecipientName?: string
  /** 保留字段，不再写入具体地址 */
  detail: string
  characterId?: string
}

export interface TasteOrderReview {
  storeRating: number
  riderRating: number
  text: string
  submittedAt: number
}

export interface TasteOrderPayload {
  orderId: string
  storeId: string
  storeName: string
  total: number
  itemCount: number
  deliveryAddress: DeliveryAddressOption
  remark: string
  items: Array<{
    id?: string
    name: string
    quantity: number
    price: number
    image?: string
    specs?: ItemSpecSelection[]
    specSummary?: string
  }>
  placedAt: number
  /** 预计送达时间戳（下单时写入，持久化） */
  deliveredAt?: number
  /** 下单方：用户自点 / 角色赠予 */
  orderSource?: 'user' | 'character'
  orderSourceCharacterId?: string
  orderSourceCharacterName?: string
  /** 飨味评价提交时间；存在即视为 evaluated */
  evaluatedAt?: number
  review?: TasteOrderReview
  /** 用户赠角色单：角色已通过微信告知用户送达（防重复推送） */
  characterDeliveryNotifiedAt?: number
}

export function isCharacterGiftOrder(order: TasteOrderPayload): boolean {
  return order.orderSource === 'character'
}

/** 用户为微信角色点的外卖（收货人为角色，非角色给用户点的礼赠单） */
export function isUserGiftToCharacterOrder(order: TasteOrderPayload): boolean {
  if (order.orderSource === 'character') return false
  const cid = order.deliveryAddress.characterId?.trim()
  return order.deliveryAddress.kind === 'character' && !!cid
}

export function resolveUserGiftCharacterId(order: TasteOrderPayload): string | null {
  if (!isUserGiftToCharacterOrder(order)) return null
  return order.deliveryAddress.characterId!.trim()
}

export type TasteMainTab = 'order' | 'delivery' | 'messages' | 'profile'

export type TasteChatKind = 'merchant' | 'courier' | 'group' | 'character-merchant' | 'character-courier'

export type TasteChatMessageFrom = 'user' | 'peer' | 'character'

export type TasteChatMessage = {
  id: string
  threadId: string
  from: TasteChatMessageFrom
  text: string
  ts: number
  /** 群聊时对方昵称 */
  senderName?: string
}

export type TasteChatThread = {
  id: string
  orderId: string
  kind: TasteChatKind
  title: string
  subtitle: string
  avatarUrl?: string
  /** 配送群：商家 logo */
  merchantAvatarUrl?: string
  /** 配送群：骑手头像 */
  courierAvatarUrl?: string
  updatedAt: number
  /** 角色观察者线程：是否已生成过聊天记录 */
  characterHistoryGenerated?: boolean
  /** 角色观察者线程：角色展示名 */
  characterObserverName?: string
}

export const LUMI_TASTE_ORDER_EVENT = 'lumi-taste-order-placed'
export const LUMI_TASTE_ORDER_UPDATED_EVENT = 'lumi-taste-order-updated'
export const LUMI_TASTE_CHAT_EVENT = 'lumi-taste-chat-changed'
export const LUMI_TASTE_RECEIPTS_EVENT = 'lumi-taste-receipts-changed'

/** 用户选择保留的角色订单小票 */
export interface CollectedReceipt {
  id: string
  orderId: string
  storeId: string
  storeName: string
  total: number
  itemCount: number
  characterName: string
  characterId?: string
  note: string
  items: Array<{ id?: string; name: string; quantity: number; price: number; specs?: ItemSpecSelection[]; specSummary?: string }>
  placedAt: number
  collectedAt: number
}
