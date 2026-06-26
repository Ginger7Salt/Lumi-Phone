import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

import { CART_FLY_DURATION_MS } from './tasteCartFly'
import { buildCartLineKey } from './tasteItemSpecs'
import type { CartItem, ItemSpecSelection, MenuItem, Store } from './types'

export type FlyAnimationPayload = {
  id: number
  image: string
  fromRect: DOMRect
}

export type AddToCartPayload = {
  item: MenuItem
  specs?: ItemSpecSelection[]
  unitPrice?: number
}

type TasteCartContextValue = {
  store: Store | null
  items: CartItem[]
  setActiveStore: (store: Store | null) => void
  addItem: (payload: AddToCartPayload, fromRect?: DOMRect) => void
  updateQuantity: (lineKey: string, quantity: number) => void
  decrementMenuItem: (itemId: string) => void
  clearCart: () => void
  subtotal: number
  itemCount: number
  flyAnimation: FlyAnimationPayload | null
  clearFlyAnimation: () => void
  cartBounceSignal: number
  triggerCartBounce: () => void
}

const TasteCartContext = createContext<TasteCartContextValue | null>(null)

function buildCartLine(item: MenuItem, specs: ItemSpecSelection[], unitPrice: number, quantity: number): CartItem {
  return {
    ...item,
    quantity,
    specs,
    lineKey: buildCartLineKey(item.id, specs),
    unitPrice,
  }
}

export function TasteCartProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store | null>(null)
  const [items, setItems] = useState<CartItem[]>([])
  const [flyAnimation, setFlyAnimation] = useState<FlyAnimationPayload | null>(null)
  const [cartBounceSignal, setCartBounceSignal] = useState(0)
  const flyTimerRef = useRef<number | null>(null)
  const flySeqRef = useRef(0)

  const setActiveStore = useCallback((next: Store | null) => {
    setStore((prev) => {
      if (next && prev && prev.id !== next.id) {
        setItems([])
      }
      return next
    })
  }, [])

  const clearFlyAnimation = useCallback(() => {
    setFlyAnimation(null)
    if (flyTimerRef.current != null) {
      window.clearTimeout(flyTimerRef.current)
      flyTimerRef.current = null
    }
  }, [])

  const addItem = useCallback(
    (payload: AddToCartPayload, fromRect?: DOMRect) => {
      const { item, specs = [], unitPrice = item.price } = payload
      if (fromRect) {
        clearFlyAnimation()
        flySeqRef.current += 1
        setFlyAnimation({ id: flySeqRef.current, image: item.image, fromRect })
        flyTimerRef.current = window.setTimeout(() => {
          setFlyAnimation(null)
          flyTimerRef.current = null
        }, CART_FLY_DURATION_MS + 40)
      } else {
        setCartBounceSignal((n) => n + 1)
      }
      const lineKey = buildCartLineKey(item.id, specs)
      setItems((prev) => {
        const idx = prev.findIndex((c) => c.lineKey === lineKey)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx]!, quantity: next[idx]!.quantity + 1 }
          return next
        }
        return [...prev, buildCartLine(item, specs, unitPrice, 1)]
      })
      if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(8)
        } catch {
          /* ignore */
        }
      }
    },
    [clearFlyAnimation],
  )

  const triggerCartBounce = useCallback(() => {
    setCartBounceSignal((n) => n + 1)
  }, [])

  const updateQuantity = useCallback((lineKey: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((c) => c.lineKey !== lineKey)
      return prev.map((c) => (c.lineKey === lineKey ? { ...c, quantity } : c))
    })
  }, [])

  const decrementMenuItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const idx = [...prev].reverse().findIndex((c) => c.id === itemId)
      if (idx < 0) return prev
      const realIdx = prev.length - 1 - idx
      const line = prev[realIdx]!
      if (line.quantity <= 1) return prev.filter((_, i) => i !== realIdx)
      const next = [...prev]
      next[realIdx] = { ...line, quantity: line.quantity - 1 }
      return next
    })
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const { subtotal, itemCount } = useMemo(() => {
    let total = 0
    let count = 0
    for (const c of items) {
      total += c.unitPrice * c.quantity
      count += c.quantity
    }
    return { subtotal: Math.round(total * 100) / 100, itemCount: count }
  }, [items])

  const value = useMemo(
    () => ({
      store,
      items,
      setActiveStore,
      addItem,
      updateQuantity,
      decrementMenuItem,
      clearCart,
      subtotal,
      itemCount,
      flyAnimation,
      clearFlyAnimation,
      cartBounceSignal,
      triggerCartBounce,
    }),
    [
      store,
      items,
      setActiveStore,
      addItem,
      updateQuantity,
      decrementMenuItem,
      clearCart,
      subtotal,
      itemCount,
      flyAnimation,
      clearFlyAnimation,
      cartBounceSignal,
      triggerCartBounce,
    ],
  )

  return <TasteCartContext.Provider value={value}>{children}</TasteCartContext.Provider>
}

export function useTasteCart() {
  const ctx = useContext(TasteCartContext)
  if (!ctx) throw new Error('useTasteCart must be used within TasteCartProvider')
  return ctx
}
