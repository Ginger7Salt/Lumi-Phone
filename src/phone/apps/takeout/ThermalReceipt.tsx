import { motion } from 'framer-motion'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { formatTasteOrderTime } from './tasteOrderBridge'
import { tasteNumStyle } from './tasteTypography'
import type { CollectedReceipt, TasteOrderPayload } from './types'
import { isCharacterGiftOrder } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'
const EASE = [0.22, 1, 0.36, 1] as const
export const RECEIPT_WIDTH = 'min(280px, 88vw)'

export type ReceiptPaperData = {
  placedAt: number
  storeName: string
  total: number
  items: Array<{ id?: string; name: string; quantity: number; price: number; specSummary?: string }>
  characterName: string
  note: string
}

export function orderToReceiptData(order: TasteOrderPayload): ReceiptPaperData {
  const remark = order.remark.trim()
  const characterName = isCharacterGiftOrder(order)
    ? order.orderSourceCharacterName?.trim() || 'TA'
    : order.deliveryAddress.label.trim() || 'TA'
  return {
    placedAt: order.placedAt,
    storeName: order.storeName,
    total: order.total,
    items: order.items,
    characterName,
    note: remark || '望你按时用餐，别让我挂念。',
  }
}

export function collectedToReceiptData(receipt: CollectedReceipt): ReceiptPaperData {
  return {
    placedAt: receipt.placedAt,
    storeName: receipt.storeName,
    total: receipt.total,
    items: receipt.items,
    characterName: receipt.characterName,
    note: receipt.note,
  }
}

function SawtoothEdge({ flip, compact }: { flip?: boolean; compact?: boolean }) {
  return (
    <div
      className={`${compact ? 'h-2' : 'h-3'} w-full shrink-0`}
      style={{
        backgroundColor: '#F9F8F6',
        ...(flip
          ? {
              WebkitMaskImage:
                'linear-gradient(45deg, transparent 33.33%, black 33.33%) 0 0 / 8px 8px, linear-gradient(-45deg, transparent 33.33%, black 33.33%) 0 0 / 8px 8px',
              maskImage:
                'linear-gradient(45deg, transparent 33.33%, black 33.33%) 0 0 / 8px 8px, linear-gradient(-45deg, transparent 33.33%, black 33.33%) 0 0 / 8px 8px',
              transform: 'rotate(180deg)',
            }
          : {
              WebkitMaskImage:
                'linear-gradient(45deg, transparent 33.33%, black 33.33%) 0 0 / 8px 8px, linear-gradient(-45deg, transparent 33.33%, black 33.33%) 0 0 / 8px 8px',
              maskImage:
                'linear-gradient(45deg, transparent 33.33%, black 33.33%) 0 0 / 8px 8px, linear-gradient(-45deg, transparent 33.33%, black 33.33%) 0 0 / 8px 8px',
            }),
      }}
      aria-hidden
    />
  )
}

export function ReceiptPaper({
  data,
  compact,
}: {
  data: ReceiptPaperData
  compact?: boolean
}) {
  const pad = compact ? 'px-4 py-3' : 'px-5 py-4'
  const titleSize = compact ? 'text-[10px]' : 'text-[12px]'
  const subTitleSize = compact ? 'text-[9px]' : 'text-[11px]'
  const bodySize = compact ? 'text-[9px]' : 'text-[11px]'
  const noteSize = compact ? 'text-[11px]' : 'text-[13px]'
  const signSize = compact ? 'text-[10px]' : 'text-[12px]'
  const gap = compact ? 'my-3' : 'my-4'
  const listGap = compact ? 'mt-3 space-y-1.5' : 'mt-4 space-y-2'

  return (
    <>
      <SawtoothEdge compact={compact} />
      <div className={`bg-[#F9F8F6] font-mono text-gray-800 ${pad}`}>
        <p className={`text-center tracking-[0.18em] text-neutral-500 ${titleSize}`}>LUMI BISTRO</p>
        <p className={`mt-1 text-center tracking-[0.12em] text-neutral-400 ${subTitleSize}`}>订单凭证</p>
        <div className={`${gap} border-t border-dashed border-neutral-300/80`} />
        <p className={`leading-relaxed text-neutral-500 ${bodySize}`} style={tasteNumStyle}>
          {formatTasteOrderTime(data.placedAt)}
        </p>
        <p className={`mt-1.5 truncate text-neutral-500 ${bodySize}`}>{data.storeName}</p>
        <ul className={listGap}>
          {data.items.map((item, i) => (
            <li
              key={`${item.id ?? item.name}-${i}`}
              className={`flex items-start justify-between gap-3 leading-snug ${bodySize}`}
            >
              <span className="min-w-0 flex-1 truncate text-neutral-700">
                {item.name}
                {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                {item.specSummary ? (
                  <span className="block truncate text-[9px] text-neutral-400">{item.specSummary}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-neutral-600" style={tasteNumStyle}>
                {(item.price * item.quantity).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <div className={`mt-3 flex items-center justify-between border-t border-dashed border-neutral-300/80 pt-2 ${compact ? 'text-[10px]' : 'text-[12px]'}`}>
          <span className="text-neutral-500">合计</span>
          <span className="text-neutral-800" style={tasteNumStyle}>
            ¥ {data.total.toFixed(2)}
          </span>
        </div>
        <div className={`${gap} border-t border-dashed border-neutral-300/80`} />
        <p
          className={`leading-[1.65] text-[#1C1C1E] ${noteSize}`}
          style={{ fontFamily: SERIF, fontStyle: 'italic' }}
        >
          备注：{data.note}
        </p>
        <p className={`mt-2.5 text-right text-neutral-500 ${signSize}`} style={{ fontFamily: SERIF }}>
          —— {data.characterName}
        </p>
      </div>
      <SawtoothEdge flip compact={compact} />
    </>
  )
}

function ReceiptPaperFromOrder({ order }: { order: TasteOrderPayload }) {
  return <ReceiptPaper data={orderToReceiptData(order)} />
}

/** 角色订单：热敏打印机场景，小票从出纸口向下打印 */
export function ThermalReceiptPrintScene({
  order,
  active,
  onPrintComplete,
}: {
  order: TasteOrderPayload
  active: boolean
  onPrintComplete?: () => void
}) {
  const paperRef = useRef<HTMLDivElement>(null)
  const [printing, setPrinting] = useState(false)
  const [paperHeight, setPaperHeight] = useState(0)
  const printDuration = useMemo(
    () => 1.6 + order.items.length * 0.14 + (order.remark.trim() ? 0.35 : 0),
    [order.items.length, order.remark],
  )

  useLayoutEffect(() => {
    if (!active) {
      setPaperHeight(0)
      setPrinting(false)
      return
    }
    if (paperRef.current) {
      setPaperHeight(paperRef.current.scrollHeight)
    }
  }, [active, order])

  useEffect(() => {
    if (!active || paperHeight <= 0) return
    const t = window.setTimeout(() => setPrinting(true), 320)
    return () => window.clearTimeout(t)
  }, [active, paperHeight])

  if (!isCharacterGiftOrder(order)) return null

  return (
    <div className="flex w-full flex-col items-center" aria-label="角色专属订单凭证">
      {/* 打印机机身 */}
      <motion.div
        className="relative z-10 rounded-t-xl border border-neutral-700/80 bg-[#1C1C1E] px-5 pb-3 pt-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
        style={{ width: RECEIPT_WIDTH }}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: active ? 1 : 0, y: active ? 0 : -12 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-neutral-600" />
        <p className="mt-2 text-center text-[9px] tracking-[0.28em] text-neutral-500">LUMI PRINT</p>
        <div className="absolute -bottom-1.5 left-4 right-4 h-2.5 rounded-b-sm bg-neutral-900 shadow-inner" />
      </motion.div>

      {/* 出纸槽：高度从 0 向下增长，模拟热敏打印 */}
      <div className="relative" style={{ width: RECEIPT_WIDTH }}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-3 bg-gradient-to-b from-[#1C1C1E]/90 to-transparent"
          aria-hidden
        />

        <motion.div
          className="relative overflow-hidden shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
          initial={{ height: 0 }}
          animate={{ height: printing ? paperHeight : 0 }}
          transition={{ duration: printDuration, ease: [0.25, 0.1, 0.25, 1] }}
          onAnimationComplete={() => {
            if (printing && paperHeight > 0) onPrintComplete?.()
          }}
        >
          <motion.div
            ref={paperRef}
            animate={printing ? { y: [0, 0.6, 0, 0.4, 0] } : { y: 0 }}
            transition={
              printing
                ? { duration: printDuration, ease: 'linear', times: [0, 0.2, 0.45, 0.7, 1] }
                : { duration: 0.2 }
            }
          >
            <ReceiptPaperFromOrder order={order} />
          </motion.div>
        </motion.div>

        {printing && paperHeight > 0 ? (
          <motion.div
            className="pointer-events-none absolute inset-x-0 z-30 h-px bg-[#D4AF37]/75 shadow-[0_0_8px_rgba(212,175,55,0.5)]"
            initial={{ top: 0, opacity: 0 }}
            animate={{ top: paperHeight, opacity: [0, 1, 1, 0] }}
            transition={{ duration: printDuration, ease: [0.25, 0.1, 0.25, 1] }}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  )
}
