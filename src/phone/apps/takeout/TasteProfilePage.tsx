import { useMemo, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import { useCollectedReceipts, removeCollectedReceipt } from './tasteCollectedReceipts'
import { useTasteDeliveryAddresses, useTasteOrders, formatTasteOrderTime } from './tasteOrderBridge'
import { collectedToReceiptData, ReceiptPaper } from './ThermalReceipt'
import { tasteNumStyle } from './tasteTypography'
import { useTasteWechatAccounts } from './useTasteWechatAccounts'
import type { UserAccount } from '../wechat/wechatAccountTypes'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'

function accountInitial(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t.slice(0, 1)
}

function WechatAccountAvatar({ account, size = 'md' }: { account: UserAccount; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-16 text-[22px]' : 'size-10 text-[14px]'
  const url = account.avatarUrl.trim()
  if (url) {
    return <img src={url} alt="" className={`${box} shrink-0 rounded-full object-cover`} />
  }
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-full border border-gray-100 bg-white/90 text-[#1C1C1E] shadow-[0_2px_12px_rgba(0,0,0,0.04)]`}
      style={{ fontFamily: SERIF }}
    >
      {accountInitial(account.nickname)}
    </span>
  )
}

export function TasteProfilePage() {
  const { state } = useCustomization()
  const { accounts, currentAccount, currentAccountId, hydrated, switchingId, switchAccount } =
    useTasteWechatAccounts()
  const orders = useTasteOrders(currentAccountId)
  const collectedReceipts = useCollectedReceipts(currentAccountId)
  const addresses = useTasteDeliveryAddresses()
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null)

  const displayName =
    currentAccount?.nickname.trim() || state.profile.displayName.trim() || '寻味用户'
  const selfAddress = addresses.find((a) => a.kind === 'self')

  const stats = useMemo(
    () => ({
      orders: orders.length,
      stores: new Set(orders.map((o) => o.storeId)).size,
    }),
    [orders],
  )

  const primaryAccountId = accounts[0]?.accountId

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-transparent pb-6">
      <header className="px-6 pb-6 pt-8 text-center">
        {currentAccount ? (
          <div className="mx-auto w-fit">
            <WechatAccountAvatar account={currentAccount} size="lg" />
          </div>
        ) : (
          <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-gray-100 bg-white/90 text-[22px] text-[#1C1C1E] shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            {displayName.slice(0, 1)}
          </div>
        )}
        <h1 className="mt-4 text-[16px] font-medium text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
          {displayName}
        </h1>
        <p className="mt-1 text-[10px] tracking-[0.12em] text-neutral-400">寻味会员</p>
        {currentAccount?.wechatId ? (
          <p className="mt-1 text-[10px] text-neutral-400" style={tasteNumStyle}>
            {currentAccount.wechatId}
          </p>
        ) : null}
      </header>

      <section className="mx-4 overflow-hidden rounded-2xl border border-gray-100 bg-white/92 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="border-b border-gray-50 px-4 py-3">
          <p className="text-[10px] tracking-[0.12em] text-neutral-400">微信小号</p>
        </div>
        {!hydrated ? (
          <p className="px-4 py-4 text-[12px] text-neutral-400">加载中…</p>
        ) : accounts.length === 0 ? (
          <p className="px-4 py-4 text-[12px] leading-relaxed text-neutral-400">
            请先在微信中注册账号，即可在此切换小号点单。
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {accounts.map((account) => {
              const active = account.accountId === currentAccountId
              const isPrimary = account.accountId === primaryAccountId
              return (
                <li key={account.accountId}>
                  <Pressable
                    type="button"
                    disabled={!!switchingId}
                    onClick={() => {
                      if (!active) void switchAccount(account.accountId)
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                      active ? 'bg-[#FAFAFA]' : 'active:bg-gray-50'
                    } ${switchingId && switchingId !== account.accountId ? 'opacity-50' : ''}`}
                  >
                    <WechatAccountAvatar account={account} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[14px] font-medium text-[#1C1C1E]">{account.nickname}</p>
                        <span className="shrink-0 rounded border border-gray-100 px-1.5 py-0.5 text-[9px] text-neutral-400">
                          {isPrimary ? '主号' : '小号'}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-neutral-400" style={tasteNumStyle}>
                        {account.wechatId}
                      </p>
                    </div>
                    {active ? (
                      <span className="shrink-0 text-[10px] tracking-[0.08em] text-[#1C1C1E]">当前</span>
                    ) : switchingId === account.accountId ? (
                      <span className="shrink-0 text-[10px] text-neutral-400">切换中</span>
                    ) : (
                      <span className="shrink-0 text-[10px] text-neutral-300">切换</span>
                    )}
                  </Pressable>
                </li>
              )
            })}
          </ul>
        )}
        {accounts.length > 0 ? (
          <p className="border-t border-gray-50 px-4 py-3 text-[10px] leading-relaxed text-neutral-400">
            切换后将同步微信资料与通讯录；各小号订单与地址独立展示。
          </p>
        ) : null}
      </section>

      <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-white/92 px-4 py-4 text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <p className="text-[20px] leading-none text-[#1C1C1E]" style={tasteNumStyle}>
            {stats.orders}
          </p>
          <p className="mt-2 text-[10px] tracking-[0.08em] text-neutral-400">累计订单</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white/92 px-4 py-4 text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <p className="text-[20px] leading-none text-[#1C1C1E]" style={tasteNumStyle}>
            {stats.stores}
          </p>
          <p className="mt-2 text-[10px] tracking-[0.08em] text-neutral-400">光顾店铺</p>
        </div>
      </div>

      <section className="mx-4 mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-white/92 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex items-baseline justify-between border-b border-gray-50 px-4 py-3">
          <p className="text-[10px] tracking-[0.12em] text-neutral-400">小票收集</p>
          <span className="text-[10px] text-neutral-400" style={tasteNumStyle}>
            {collectedReceipts.length} 张
          </span>
        </div>
        {collectedReceipts.length === 0 ? (
          <p className="px-4 py-5 text-[12px] leading-relaxed text-neutral-400">
            角色为你点外卖时，可在拆封前选择保留订单小票，它们会收藏在这里。
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {collectedReceipts.map((receipt) => {
              const expanded = expandedReceiptId === receipt.id
              return (
                <li key={receipt.id}>
                  <Pressable
                    type="button"
                    onClick={() => setExpandedReceiptId(expanded ? null : receipt.id)}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-gray-50"
                    aria-expanded={expanded}
                  >
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-[#FAFAFA] text-[10px] tracking-[0.08em] text-neutral-500">
                      票
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
                        {receipt.characterName}
                        <span className="mx-1.5 text-neutral-300">·</span>
                        {receipt.storeName}
                      </p>
                      <p className="mt-1 text-[10px] text-neutral-400" style={tasteNumStyle}>
                        {formatTasteOrderTime(receipt.placedAt)} · ¥ {receipt.total.toFixed(2)}
                      </p>
                      {!expanded ? (
                        <p
                          className="mt-1 line-clamp-1 text-[11px] italic text-neutral-500"
                          style={{ fontFamily: SERIF }}
                        >
                          {receipt.note}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[10px] text-neutral-300">{expanded ? '收起' : '展开'}</span>
                  </Pressable>
                  {expanded ? (
                    <div className="border-t border-gray-50 bg-[#FAFAFA] px-4 py-4">
                      <div className="mx-auto w-[min(240px,82vw)] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
                        <ReceiptPaper data={collectedToReceiptData(receipt)} compact />
                      </div>
                      {currentAccountId ? (
                        <div className="mt-3 flex justify-center">
                          <Pressable
                            type="button"
                            onClick={() => {
                              removeCollectedReceipt(currentAccountId, receipt.id)
                              if (expandedReceiptId === receipt.id) setExpandedReceiptId(null)
                            }}
                            className="text-[10px] tracking-[0.06em] text-neutral-400 underline-offset-2 active:underline"
                          >
                            移除此小票
                          </Pressable>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="mx-4 mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-white/92 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="border-b border-gray-50 px-4 py-3">
          <p className="text-[10px] tracking-[0.12em] text-neutral-400">默认收货昵称</p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[14px] font-medium text-[#1C1C1E]">{selfAddress?.label ?? displayName}</p>
        </div>
      </section>

      <section className="mx-4 mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-white/92 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="border-b border-gray-50 px-4 py-3">
          <p className="text-[10px] tracking-[0.12em] text-neutral-400">关于寻味</p>
        </div>
        <div className="space-y-0 divide-y divide-gray-50 px-4 py-1">
          <p className="py-3 text-[12px] leading-relaxed text-neutral-500">
            虚拟外卖体验，支付走微信钱包；下单后可在微信通知角色取餐。
          </p>
        </div>
      </section>
    </div>
  )
}
