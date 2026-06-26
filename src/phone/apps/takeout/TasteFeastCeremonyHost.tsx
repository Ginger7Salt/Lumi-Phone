import { useCallback, useEffect, useState } from 'react'

import { useCustomization } from '../../CustomizationContext'
import { DeliveryFeastCeremony } from './DeliveryFeastCeremony'
import {
  consumePendingTasteFeastCeremony,
  markTasteFeastCeremonyActive,
  registerTasteFeastCeremonyHandler,
  type TasteFeastCeremonyRequest,
} from './tasteFeastCeremonyBridge'
import { needsTasteFeastCeremony, readTasteOrders } from './tasteOrderBridge'
import { LUMI_TASTE_ORDER_EVENT, LUMI_TASTE_ORDER_UPDATED_EVENT, type TasteOrderPayload } from './types'

export function TasteFeastCeremonyHost() {
  const { state } = useCustomization()
  const playerName = state.profile.displayName?.trim() || '我'
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [order, setOrder] = useState<TasteOrderPayload | null>(null)

  const resolveOrder = useCallback((req: TasteFeastCeremonyRequest): TasteOrderPayload | null => {
    const orders = readTasteOrders(req.accountId)
    const found = orders.find((o) => o.orderId === req.orderId)
    if (!found || !needsTasteFeastCeremony(found)) return null
    return found
  }, [])

  const openFeast = useCallback(
    (req: TasteFeastCeremonyRequest): boolean => {
      const nextOrder = resolveOrder(req)
      if (!nextOrder) return false
      setAccountId(req.accountId)
      setOrder(nextOrder)
      setOpen(true)
      markTasteFeastCeremonyActive(nextOrder.orderId)
      return true
    },
    [resolveOrder],
  )

  const closeFeast = useCallback(() => {
    setOpen(false)
    setOrder(null)
    setAccountId(null)
    markTasteFeastCeremonyActive(null)
  }, [])

  useEffect(() => {
    registerTasteFeastCeremonyHandler(openFeast)
    const pending = consumePendingTasteFeastCeremony()
    if (pending) openFeast(pending)
    return () => registerTasteFeastCeremonyHandler(null)
  }, [openFeast])

  useEffect(() => {
    const refreshOrder = () => {
      if (!accountId || !order) return
      const fresh = readTasteOrders(accountId).find((o) => o.orderId === order.orderId)
      if (fresh && needsTasteFeastCeremony(fresh)) {
        setOrder(fresh)
      }
    }
    window.addEventListener(LUMI_TASTE_ORDER_EVENT, refreshOrder)
    window.addEventListener(LUMI_TASTE_ORDER_UPDATED_EVENT, refreshOrder)
    return () => {
      window.removeEventListener(LUMI_TASTE_ORDER_EVENT, refreshOrder)
      window.removeEventListener(LUMI_TASTE_ORDER_UPDATED_EVENT, refreshOrder)
    }
  }, [accountId, order])

  if (!order || !accountId) return null

  return (
    <div className="pointer-events-auto absolute inset-0 z-[10035]">
      <DeliveryFeastCeremony
        open={open}
        order={order}
        accountId={accountId}
        authorName={playerName}
        onFinished={closeFeast}
      />
    </div>
  )
}
