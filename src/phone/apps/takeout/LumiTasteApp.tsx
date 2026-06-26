import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import { CheckoutSheet } from './CheckoutSheet'
import { DeliveryTrackingPage } from './DeliveryTrackingPage'
import { FloatingCart } from './FloatingCart'
import { getStoreById } from './tasteCatalog'
import { parseTasteChatThreadId, resolveCharacterOrderPersona, resolveTasteChatThread, tasteChatThreadId } from './tasteChatService'
import { TasteCartProvider, useTasteCart } from './TasteCartContext'
import {
  suppressTasteFeastCeremonyAutoOpen,
  tryOpenTasteFeastCeremony,
} from './tasteFeastCeremonyBridge'
import { emitTasteOrderPlaced, useTasteOrders, needsTasteFeastCeremony, readTasteOrders } from './tasteOrderBridge'
import { TasteChatRoom } from './TasteChatRoom'
import { TasteHome } from './TasteHome'
import { TasteMessagesPage, type TasteMessagesSegment } from './TasteMessagesPage'
import { TasteOrdersPage } from './TasteOrdersPage'
import { TasteProfilePage } from './TasteProfilePage'
import { StorePage } from './StorePage'
import { TasteAppBackground } from './TasteAppBackground'
import { TasteTabBar } from './TasteTabBar'
import { useTasteWechatAccounts } from './useTasteWechatAccounts'
import type { TasteChatKind, TasteMainTab, TasteOrderPayload } from './types'
import {
  readPendingTasteTrackingOrderId,
  readPendingTasteTrackingOrderSeed,
  readPendingTasteTrackingReturnToWeChat,
  resetPendingTasteTrackingNavigation,
} from './tasteNavigation'
import { loadAccountsBundle } from '../wechat/wechatAccountPersistence'

const MAIN_TAB_TITLE: Record<TasteMainTab, string> = {
  order: '寻味',
  delivery: '送餐',
  messages: '消息',
  profile: '我的',
}

function LumiTasteMain({ onBack }: { onBack: () => void }) {
  const { state } = useCustomization()
  const pageStyle = state.appPageStyles.takeout
  const { currentAccountId } = useTasteWechatAccounts()
  const orders = useTasteOrders(currentAccountId)
  const [mainTab, setMainTab] = useState<TasteMainTab>('order')
  const [menuStoreId, setMenuStoreId] = useState<string | null>(null)
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(() => readPendingTasteTrackingOrderId())
  const [trackingSeedOrder, setTrackingSeedOrder] = useState<TasteOrderPayload | null>(() =>
    readPendingTasteTrackingOrderSeed(),
  )
  const returnToWeChatOnTrackingExitRef = useRef(readPendingTasteTrackingReturnToWeChat())
  const pendingNavigationAppliedRef = useRef(false)
  const [activeChatThreadId, setActiveChatThreadId] = useState<string | null>(null)
  const [messagesSegment, setMessagesSegment] = useState<TasteMessagesSegment>('inbox')
  const menuStore = menuStoreId ? getStoreById(menuStoreId) : null
  const trackingOrder = useMemo(() => {
    if (!trackingOrderId) return null
    const fromList = orders.find((o) => o.orderId === trackingOrderId)
    if (fromList) return fromList
    if (trackingSeedOrder?.orderId === trackingOrderId) return trackingSeedOrder
    return null
  }, [orders, trackingOrderId, trackingSeedOrder])

  useEffect(() => {
    if (!trackingOrderId) {
      setTrackingSeedOrder(null)
      return
    }
    if (orders.some((o) => o.orderId === trackingOrderId)) {
      setTrackingSeedOrder(null)
    }
  }, [orders, trackingOrderId])
  const { store: cartStore, setActiveStore } = useTasteCart()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [toast, setToast] = useState('')

  const activeChat = useMemo(() => {
    if (!activeChatThreadId || !currentAccountId) return null
    const parsed = parseTasteChatThreadId(activeChatThreadId)
    if (!parsed) return null
    const order =
      orders.find((o) => o.orderId === parsed.orderId) ??
      (trackingSeedOrder?.orderId === parsed.orderId ? trackingSeedOrder : null)
    if (!order) return null
    const persona = resolveCharacterOrderPersona(order, state.wechatPersonaContacts)
    const thread = resolveTasteChatThread(currentAccountId, order, parsed.kind, persona.name)
    const store = getStoreById(order.storeId)
    return { thread, order, persona, deliveryMinutes: store?.deliveryMinutes ?? 35 }
  }, [activeChatThreadId, currentAccountId, orders, state.wechatPersonaContacts, trackingSeedOrder])

  const showTabBar =
    !menuStoreId && !checkoutOpen && !trackingOrderId && !activeChatThreadId

  const closeTracking = useCallback(() => {
    resetPendingTasteTrackingNavigation()
    pendingNavigationAppliedRef.current = false
    setTrackingOrderId(null)
    if (returnToWeChatOnTrackingExitRef.current) {
      returnToWeChatOnTrackingExitRef.current = false
      suppressTasteFeastCeremonyAutoOpen()
      window.dispatchEvent(new CustomEvent('phone:open-app', { detail: { id: 'wechat' } }))
      return
    }
    setMainTab('delivery')
  }, [])

  const openStore = useCallback(
    (storeId: string) => {
      const next = getStoreById(storeId)
      if (next) {
        setActiveStore(next)
        setMenuStoreId(storeId)
        setMainTab('order')
      }
    },
    [setActiveStore],
  )

  const handleTabChange = useCallback((tab: TasteMainTab) => {
    resetPendingTasteTrackingNavigation()
    pendingNavigationAppliedRef.current = false
    setMainTab(tab)
    setMenuStoreId(null)
    setTrackingOrderId(null)
    setActiveChatThreadId(null)
  }, [])

  const openFeastCeremony = useCallback(
    async (orderId: string, seed?: TasteOrderPayload) => {
      let accountId = currentAccountId?.trim()
      if (seed) {
        if (!accountId) {
          const bundle = await loadAccountsBundle()
          accountId = bundle?.currentAccountId?.trim() || 'default'
        }
        if (!readTasteOrders(accountId).some((o) => o.orderId === orderId)) {
          await emitTasteOrderPlaced(seed)
        }
      }
      if (!accountId) {
        const bundle = await loadAccountsBundle()
        accountId = bundle?.currentAccountId?.trim() || 'default'
      }
      tryOpenTasteFeastCeremony({ accountId, orderId })
    },
    [currentAccountId],
  )

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2200)
  }

  const openTracking = useCallback(
    (order: TasteOrderPayload) => {
      setTrackingSeedOrder(order)
      setTrackingOrderId(order.orderId)
    },
    [],
  )

  useEffect(() => {
    const pendingId = readPendingTasteTrackingOrderId()
    if (!pendingId) {
      pendingNavigationAppliedRef.current = false
      return
    }
    if (pendingNavigationAppliedRef.current) return
    pendingNavigationAppliedRef.current = true
    returnToWeChatOnTrackingExitRef.current = readPendingTasteTrackingReturnToWeChat()
    setMainTab('delivery')
    const pendingSeed = readPendingTasteTrackingOrderSeed()
    const fromList = orders.find((o) => o.orderId === pendingId)
    if (fromList) {
      openTracking(fromList)
      return
    }
    if (pendingSeed?.orderId === pendingId) {
      setTrackingSeedOrder(pendingSeed)
      setTrackingOrderId(pendingId)
      if (currentAccountId && !readTasteOrders(currentAccountId).some((o) => o.orderId === pendingId)) {
        void emitTasteOrderPlaced(pendingSeed)
      }
      return
    }
    setTrackingOrderId(pendingId)
  }, [currentAccountId, orders, openTracking])

  const handlePaySuccess = useCallback((order: TasteOrderPayload) => {
    setMenuStoreId(null)
    setMainTab('delivery')
    setTrackingSeedOrder(order)
    setTrackingOrderId(order.orderId)
  }, [])

  const openOrderChat = useCallback(
    (orderId: string, kind: TasteChatKind) => {
      if (!currentAccountId) {
        showToast('请先在「我的」中登录微信小号')
        return
      }
      const order =
        orders.find((o) => o.orderId === orderId) ??
        (trackingSeedOrder?.orderId === orderId ? trackingSeedOrder : null) ??
        (trackingOrder?.orderId === orderId ? trackingOrder : null)
      if (!order) {
        showToast('订单不存在')
        return
      }
      const persona = resolveCharacterOrderPersona(order, state.wechatPersonaContacts)
      resolveTasteChatThread(currentAccountId, order, kind, persona.name)
      setActiveChatThreadId(tasteChatThreadId(orderId, kind))
    },
    [currentAccountId, orders, state.wechatPersonaContacts, trackingOrder, trackingSeedOrder],
  )

  const headerTitle = trackingOrderId
    ? '送餐追踪'
    : menuStore
      ? menuStore.name
      : MAIN_TAB_TITLE[mainTab]

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      data-phone-page="app"
      data-app-id="takeout"
      style={{
        backgroundColor: 'transparent',
        fontFamily: pageStyle?.fontFamily || '"Inter", system-ui, sans-serif',
      }}
    >
      <TasteAppBackground />

      {!activeChatThreadId ? (
        <header
          className="relative z-10 flex shrink-0 items-center gap-2 border-b border-gray-100/80 px-4 py-3 backdrop-blur-md"
          style={{
            paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
            backgroundColor: pageStyle?.headerBg ? `${pageStyle.headerBg}e6` : 'rgba(255,255,255,0.82)',
          }}
        >
          <Pressable
            onClick={() => {
              if (trackingOrderId) {
                closeTracking()
              } else if (menuStoreId) {
                setMenuStoreId(null)
              } else {
                onBack()
              }
            }}
            className="flex size-9 items-center justify-center rounded-full text-[#1C1C1E]"
            aria-label="返回"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" />
            </svg>
          </Pressable>
          <div className="min-w-0 flex-1 text-center">
            <p
              className="truncate px-2 text-[12px] font-medium tracking-[0.14em] text-[#1C1C1E]"
              style={{ fontFamily: '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif' }}
            >
              {headerTitle}
            </p>
          </div>
          <div className="size-9" />
        </header>
      ) : null}

      <div className="relative z-10 min-h-0 flex-1">
        <AnimatePresence mode="sync">
          {activeChat && currentAccountId ? (
            <motion.div
              key={`chat-${activeChat.thread.id}`}
              className="absolute inset-0 flex min-h-0 flex-col overflow-hidden"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <TasteChatRoom
                thread={activeChat.thread}
                order={activeChat.order}
                accountId={currentAccountId}
                onBack={() => setActiveChatThreadId(null)}
                characterName={activeChat.persona.name}
                characterAvatarUrl={activeChat.persona.avatarUrl}
                deliveryMinutes={activeChat.deliveryMinutes}
                onToast={showToast}
              />
            </motion.div>
          ) : trackingOrder ? (
            <motion.div
              key={`track-${trackingOrder.orderId}`}
              className="absolute inset-0 flex min-h-0 flex-col overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <DeliveryTrackingPage
                order={trackingOrder}
                onToast={showToast}
                onOpenChat={(kind) => openOrderChat(trackingOrder.orderId, kind)}
                onStartFeast={(seed) => openFeastCeremony(trackingOrder.orderId, seed)}
                canStartFeast={needsTasteFeastCeremony(trackingOrder)}
                suppressAutoFeastOnMount
              />
            </motion.div>
          ) : trackingOrderId ? (
            <motion.div
              key="track-missing"
              className="absolute inset-0 flex min-h-0 flex-col items-center justify-center px-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-center text-[13px] leading-relaxed text-neutral-500">
                未找到该订单，请稍后在「送餐」列表中查看
              </p>
              <Pressable
                type="button"
                onClick={closeTracking}
                className="mt-4 border border-gray-200 px-4 py-2 text-[11px] tracking-[0.08em] text-neutral-600"
              >
                返回订单列表
              </Pressable>
            </motion.div>
          ) : menuStore ? (
            <motion.div
              key={`menu-${menuStore.id}`}
              className="absolute inset-0 flex flex-col"
              initial={{ x: '100%', opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.6 }}
              transition={{ type: 'spring', stiffness: 380, damping: 42 }}
            >
              <StorePage store={menuStore} />
            </motion.div>
          ) : (
            <motion.div
              key={mainTab}
              className="absolute inset-0 flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {mainTab === 'order' ? <TasteHome onOpenStore={openStore} /> : null}
              {mainTab === 'delivery' ? (
                <TasteOrdersPage
                  onOpenTracking={openTracking}
                  onStartFeast={openFeastCeremony}
                />
              ) : null}
              {mainTab === 'messages' ? (
                <TasteMessagesPage
                  segment={messagesSegment}
                  onSegmentChange={setMessagesSegment}
                  onOpenThread={setActiveChatThreadId}
                />
              ) : null}
              {mainTab === 'profile' ? <TasteProfilePage /> : null}
            </motion.div>
          )}
        </AnimatePresence>

        {cartStore && mainTab === 'order' && !trackingOrderId && !activeChatThreadId ? (
          <>
            <FloatingCart
              minOrder={cartStore.minOrder}
              tabBarInset={showTabBar}
              onCheckout={() => setCheckoutOpen(true)}
            />
            <CheckoutSheet
              open={checkoutOpen}
              onClose={() => setCheckoutOpen(false)}
              onSuccess={handlePaySuccess}
            />
          </>
        ) : null}
      </div>

      {showTabBar ? <TasteTabBar active={mainTab} onChange={handleTabChange} /> : null}

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute left-1/2 z-[90] -translate-x-1/2 rounded-full bg-[#1C1C1E]/90 px-4 py-2 text-[11px] text-white"
            style={{ bottom: showTabBar ? 'calc(72px + env(safe-area-inset-bottom, 0px))' : '6rem' }}
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function LumiTasteApp({ onBack }: { onBack: () => void }) {
  return (
    <TasteCartProvider>
      <LumiTasteMain onBack={onBack} />
    </TasteCartProvider>
  )
}
