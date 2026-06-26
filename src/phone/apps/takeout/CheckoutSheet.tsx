import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { PaymentKeyboard } from '../wechat/wallet/PaymentKeyboard'
import { walletReadSnapshot, walletSpend } from '../wechat/wallet/walletMockStore'
import { useWalletMockStore } from '../wechat/wallet/walletMockStore'
import { useTasteCart } from './TasteCartContext'
import { tasteNumStyle } from './tasteTypography'
import { PaymentSuccessCeremony } from './PaymentSuccessCeremony'
import {
  buildDeliveryAddressFromSelection,
  sanitizeRecipientNickname,
} from './tasteDeliveryRecipient'
import { TasteRecipientLabelWithRealName } from './TasteRecipientDisplay'
import { formatSpecSummary } from './tasteItemSpecs'
import { emitTasteOrderPlaced, useTasteDeliveryAddresses, computeOrderDeliveredAt } from './tasteOrderBridge'
import type { DeliveryAddressOption, TasteOrderPayload } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'

function resolveRealName(addr: DeliveryAddressOption): string {
  return addr.realRecipientName?.trim() || addr.label.trim() || '我'
}

export function CheckoutSheet({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: (order: TasteOrderPayload) => void
}) {
  const { store, items, subtotal, itemCount, clearCart } = useTasteCart()
  const addresses = useTasteDeliveryAddresses()
  const { verifyPaymentPassword } = useWalletMockStore()
  const [addressId, setAddressId] = useState('')
  const [slipName, setSlipName] = useState('')
  const [remark, setRemark] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [payBlur, setPayBlur] = useState(false)
  const [successCeremonyOpen, setSuccessCeremonyOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || addresses.length === 0) return
    const first = addresses[0]!
    setAddressId(first.id)
    setSlipName(resolveRealName(first))
  }, [open, addresses])

  const selectedRecipient = useMemo(
    () => addresses.find((a) => a.id === addressId) ?? addresses[0],
    [addressId, addresses],
  )

  const realRecipientName = selectedRecipient ? resolveRealName(selectedRecipient) : '我'

  const selectedAddress = useMemo(() => {
    if (!selectedRecipient) return null
    return buildDeliveryAddressFromSelection(selectedRecipient, slipName)
  }, [selectedRecipient, slipName])

  const pickRecipient = (addr: DeliveryAddressOption) => {
    setAddressId(addr.id)
    setSlipName(resolveRealName(addr))
  }

  const handlePayClick = () => {
    setError('')
    const snap = walletReadSnapshot()
    if (!snap.isPaymentPasswordSet) {
      setError('请先在微信 · 我 · 卡包中设定 6 位支付密码')
      return
    }
    if (snap.balance < subtotal) {
      setError('钱包余额不足')
      return
    }
    setPayBlur(true)
    setPayOpen(true)
  }

  const finalizeOrder = () => {
    if (!store || !selectedAddress) return
    const ok = walletSpend(subtotal, '餐饮消费')
    if (!ok) {
      setError('支付失败')
      setSuccessCeremonyOpen(false)
      setPayBlur(false)
      return
    }
    const placedAt = Date.now()
    const payload: TasteOrderPayload = {
      orderId: `taste-${placedAt}-${Math.random().toString(36).slice(2, 8)}`,
      storeId: store.id,
      storeName: store.name,
      total: subtotal,
      itemCount,
      deliveryAddress: selectedAddress,
      remark: remark.trim(),
      items: items.map((c) => ({
        id: c.id,
        name: c.name,
        quantity: c.quantity,
        price: c.unitPrice,
        image: c.image,
        specs: c.specs.length ? c.specs : undefined,
        specSummary: formatSpecSummary(c.specs) || undefined,
      })),
      placedAt,
      deliveredAt: computeOrderDeliveredAt(store.id, placedAt),
    }
    void (async () => {
      await emitTasteOrderPlaced(payload)
      clearCart()
      setPayBlur(false)
      setPayOpen(false)
      setSuccessCeremonyOpen(false)
      onSuccess(payload)
      onClose()
    })()
  }

  const handlePayVerified = () => {
    setPayBlur(true)
    setSuccessCeremonyOpen(true)
  }

  if (!store) return null

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="absolute inset-0 z-[75] flex flex-col bg-white"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 40 }}
            style={{ filter: payBlur ? 'blur(20px)' : undefined }}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
              <Pressable type="button" onClick={onClose} className="text-[13px] tracking-[0.06em] text-neutral-500">
                关闭
              </Pressable>
              <p className="text-[11px] tracking-[0.18em] text-neutral-400">确认订单</p>
              <div className="w-10" />
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
              <h2 className="text-[22px] font-medium text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
                {store.name}
              </h2>
              <p className="mt-3 text-[22px] leading-none text-[#1C1C1E]" style={tasteNumStyle}>
                ¥ {subtotal.toFixed(2)}
              </p>
              <p className="mt-1 text-[12px] text-neutral-500" style={tasteNumStyle}>
                共 {itemCount} 件
              </p>

              <div className="mt-8">
                <p className="text-[10px] tracking-[0.12em] text-neutral-400">收货人</p>
                <p className="mt-1 text-[11px] text-neutral-400">先选择真实收货人</p>
                <div className="mt-3 space-y-2">
                  {addresses.map((addr) => {
                    const active = addr.id === (selectedRecipient?.id ?? '')
                    const realName = resolveRealName(addr)
                    return (
                      <Pressable
                        key={addr.id}
                        type="button"
                        onClick={() => pickRecipient(addr)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                          active ? 'border-[#1C1C1E] bg-[#F9FAFB]' : 'border-gray-100 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[14px] font-medium text-[#1C1C1E]">{realName}</span>
                          <span className="text-[10px] tracking-[0.06em] text-neutral-400">
                            {addr.kind === 'self' ? '我' : '通讯录'}
                          </span>
                        </div>
                      </Pressable>
                    )
                  })}
                </div>
              </div>

              <div className="mt-8">
                <p className="text-[10px] tracking-[0.12em] text-neutral-400">收货名</p>
                <p className="mt-1 text-[11px] text-neutral-400">外卖单上显示的称呼，可与真实姓名不同</p>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-1 border-b border-dashed border-gray-200 pb-2">
                  <input
                    type="text"
                    value={slipName}
                    onChange={(e) => setSlipName(e.target.value)}
                    placeholder="如：某位可爱小朋友、肥肥先生…"
                    maxLength={32}
                    className="min-w-[8rem] flex-1 border-0 bg-transparent py-1 text-[15px] text-[#1C1C1E] outline-none placeholder:text-neutral-300"
                  />
                  {realRecipientName ? (
                    <span className="shrink-0 text-[14px] text-neutral-300">（{realRecipientName}）</span>
                  ) : null}
                </div>
                {selectedRecipient && slipName.trim() && sanitizeRecipientNickname(slipName) !== realRecipientName ? (
                  <p className="mt-2 text-[11px] text-neutral-400">
                    预览：
                    <TasteRecipientLabelWithRealName
                      nickname={sanitizeRecipientNickname(slipName)}
                      realName={realRecipientName}
                      nicknameClassName="text-neutral-500"
                      realNameClassName="text-neutral-300"
                    />
                  </p>
                ) : null}
              </div>

              <div className="mt-8">
                <p className="text-[10px] tracking-[0.12em] text-neutral-400">备注</p>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="饮食偏好或想悄悄留下的话…"
                  rows={3}
                  className="mt-3 w-full resize-none border-0 border-b border-dashed border-gray-200 bg-transparent py-2 text-[14px] text-[#1C1C1E] outline-none placeholder:text-neutral-300"
                />
              </div>

              {error ? <p className="mt-6 text-center text-[12px] text-[#d95050]">{error}</p> : null}
            </div>

            <div
              className="shrink-0 border-t border-gray-100 px-5 py-4"
              style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
            >
              <Pressable
                type="button"
                onClick={handlePayClick}
                className="flex h-12 w-full flex-col items-center justify-center rounded-none bg-[#1C1C1E] text-white"
              >
                <span className="text-[13px] tracking-[0.08em]">使用微信钱包支付</span>
                <span className="mt-0.5 text-[11px] opacity-80" style={tasteNumStyle}>
                  ¥ {subtotal.toFixed(2)}
                </span>
              </Pressable>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <PaymentKeyboard
        open={payOpen}
        amountLabel={`¥ ${subtotal.toFixed(2)}`}
        subtitle={store.name}
        showInlineSuccess={false}
        onClose={() => {
          setPayOpen(false)
          setPayBlur(false)
        }}
        verifyPin={verifyPaymentPassword}
        onVerified={handlePayVerified}
      />

      <PaymentSuccessCeremony
        open={successCeremonyOpen}
        amountLabel={`¥ ${subtotal.toFixed(2)}`}
        storeName={store.name}
        onFinished={finalizeOrder}
      />
    </>
  )
}
