import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { Pressable } from '../../components/Pressable'
import { tasteNumStyle } from './tasteTypography'
import {
  defaultSpecSelections,
  draftFromSelections,
  resolveUnitPrice,
  selectionsFromDraft,
} from './tasteItemSpecs'
import type { ItemSpecSelection, MenuItem, MenuItemSpecGroup } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'

export function ItemSpecSheet({
  open,
  item,
  specGroups,
  onClose,
  onConfirm,
}: {
  open: boolean
  item: MenuItem | null
  specGroups: MenuItemSpecGroup[]
  onClose: () => void
  onConfirm: (payload: { specs: ItemSpecSelection[]; unitPrice: number }) => void
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open || !item) return
    setDraft(draftFromSelections(defaultSpecSelections(specGroups)))
  }, [open, item, specGroups])

  const unitPrice = useMemo(() => {
    if (!item) return 0
    const specs = selectionsFromDraft(specGroups, draft)
    return resolveUnitPrice(item.price, specGroups, specs)
  }, [draft, item, specGroups])

  if (!item) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-[120] bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[121] max-h-[78vh] overflow-hidden rounded-t-3xl bg-white shadow-[0_-16px_48px_rgba(0,0,0,0.12)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-gray-200" />
            <div className="flex items-start gap-3 px-5 pt-4">
              <img src={item.image} alt="" className="size-16 shrink-0 rounded-xl object-cover" draggable={false} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-medium text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
                  {item.name}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-neutral-400">{item.desc}</p>
                <p className="mt-2 text-[15px] text-[#1C1C1E]" style={tasteNumStyle}>
                  ¥ {unitPrice.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-[42vh] overflow-y-auto px-5">
              {specGroups.map((group) => (
                <div key={group.id} className="mb-5">
                  <p className="text-[12px] font-medium text-[#1C1C1E]">
                    {group.label}
                    {group.required === false ? (
                      <span className="ml-1 text-[10px] font-normal text-neutral-400">（可选）</span>
                    ) : null}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.options.map((opt) => {
                      const active = (draft[group.id] ?? group.options[0]?.id) === opt.id
                      return (
                        <Pressable
                          key={opt.id}
                          type="button"
                          onClick={() => setDraft((prev) => ({ ...prev, [group.id]: opt.id }))}
                          className={`rounded-full border px-3.5 py-2 text-[12px] transition-colors ${
                            active
                              ? 'border-[#1C1C1E] bg-[#1C1C1E] text-white'
                              : 'border-gray-200 bg-white text-neutral-600'
                          }`}
                        >
                          {opt.label}
                          {opt.priceDelta ? (
                            <span className="ml-1 text-[10px] opacity-80">
                              {opt.priceDelta > 0 ? `+${opt.priceDelta}` : opt.priceDelta}
                            </span>
                          ) : null}
                        </Pressable>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 flex gap-3 px-5 pt-2">
              <Pressable
                type="button"
                onClick={onClose}
                className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-gray-200 text-[13px] text-neutral-600"
              >
                取消
              </Pressable>
              <Pressable
                type="button"
                onClick={() => {
                  const specs = selectionsFromDraft(specGroups, draft)
                  onConfirm({ specs, unitPrice })
                }}
                className="flex h-12 flex-[1.4] items-center justify-center rounded-2xl bg-[#1C1C1E] text-[13px] tracking-[0.06em] text-white"
              >
                加入购物车
              </Pressable>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
