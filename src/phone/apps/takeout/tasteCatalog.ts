import type { Store } from './types'
import { buildTasteEditorialImage } from './tasteVisuals'
import { NUANZHOU_CONGEE_STORE } from './tasteCongeeStore'
import { WANFENG_DESSERT_STORE } from './tasteDessertStore'
import { SHIO_SUSHI_STORE } from './tasteJapaneseStore'
import { QINGNING_THAI_STORE } from './tasteThaiStore'
import { MIRRA_WESTERN_STORE } from './tasteWesternStore'

export const TASTE_STORES: Store[] = [
  NUANZHOU_CONGEE_STORE,
  WANFENG_DESSERT_STORE,
  MIRRA_WESTERN_STORE,
  SHIO_SUSHI_STORE,
  QINGNING_THAI_STORE,
].filter((s): s is Store => !!s)

if (import.meta.env.DEV && TASTE_STORES.length === 0) {
  console.warn('[LumiTaste] 店铺资源未加载，请检查 店铺菜品图 目录与 glob 路径')
}

export function getStoreById(id: string): Store | undefined {
  return TASTE_STORES.find((s) => s.id === id)
}

export function getStoreHotItems(store: Store) {
  return store.hotItemIds
    .map((id) => store.menus.find((m) => m.id === id))
    .filter((m): m is Store['menus'][number] => !!m)
}

export function resolveOrderItemImage(
  storeId: string,
  item: { id?: string; name: string; image?: string },
): string {
  if (item.image) return item.image
  const store = getStoreById(storeId)
  if (store) {
    const byId = item.id ? store.menus.find((m) => m.id === item.id) : undefined
    const byName = store.menus.find((m) => m.name === item.name)
    if (byId?.image) return byId.image
    if (byName?.image) return byName.image
  }
  return buildTasteEditorialImage(`${storeId}:${item.name}`, 'square')
}
