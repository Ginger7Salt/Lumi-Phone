import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { Pressable } from '../../components/Pressable'
import { ItemSpecSheet } from './ItemSpecSheet'
import { useTasteCart } from './TasteCartContext'
import {
  formatSpecLabelsHint,
  menuItemNeedsSpecs,
  resolveMenuItemSpecGroups,
} from './tasteItemSpecs'
import { tasteNumStyle } from './tasteTypography'
import type { MenuItem, Store } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'

function DishCard({
  item,
  quantity,
  specGroups,
  onAdd,
  onDecrease,
}: {
  item: MenuItem
  quantity: number
  specGroups: ReturnType<typeof resolveMenuItemSpecGroups>
  onAdd: (item: MenuItem, btn: HTMLButtonElement) => void
  onDecrease: (itemId: string) => void
}) {
  const hasSpecs = specGroups.length > 0
  const specHint = formatSpecLabelsHint(specGroups)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="flex gap-3 border-b border-gray-50/80 bg-white/88 py-4 pr-1 backdrop-blur-[2px]">
      <img
        src={item.image}
        alt=""
        className="size-[88px] shrink-0 rounded-xl object-cover"
        draggable={false}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-[15px] font-medium leading-snug text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
          {item.name}
        </h3>
        <p className="mt-1 line-clamp-2 flex-1 text-[11px] leading-relaxed text-neutral-400">{item.desc}</p>
        {hasSpecs ? (
          <p className="mt-1 text-[10px] text-[#D4AF37]">可选规格 · {specHint}</p>
        ) : null}
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="text-[14px] text-[#1C1C1E]" style={tasteNumStyle}>
            ¥ {item.price.toFixed(2)}
          </p>
          {quantity > 0 ? (
            <div className="flex items-center gap-2.5">
              <Pressable
                type="button"
                onClick={() => onDecrease(item.id)}
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-[17px] leading-none text-neutral-400 transition-transform active:scale-95"
                aria-label={`减少 ${item.name}`}
              >
                −
              </Pressable>
              <span
                className="min-w-[1.25rem] text-center text-[13px] font-medium text-[#1C1C1E]"
                style={tasteNumStyle}
              >
                {quantity}
              </span>
              <Pressable
                ref={addBtnRef}
                type="button"
                onClick={() => {
                  if (addBtnRef.current) onAdd(item, addBtnRef.current)
                }}
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#1C1C1E] text-[17px] leading-none text-[#1C1C1E] transition-transform active:scale-95"
                aria-label={`增加 ${item.name}`}
              >
                +
              </Pressable>
            </div>
          ) : (
            <Pressable
              ref={addBtnRef}
              type="button"
              onClick={() => {
                if (addBtnRef.current) onAdd(item, addBtnRef.current)
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-300 text-[18px] leading-none text-[#1C1C1E] transition-transform active:scale-95"
              aria-label={hasSpecs ? `选规格 ${item.name}` : `添加 ${item.name}`}
            >
              +
            </Pressable>
          )}
        </div>
      </div>
    </div>
  )
}

export function StoreMenu({
  store,
  scrollRootRef,
  stickyTop,
}: {
  store: Store
  scrollRootRef: RefObject<HTMLDivElement | null>
  stickyTop: number
}) {
  const { addItem, decrementMenuItem, items } = useTasteCart()
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [specItem, setSpecItem] = useState<MenuItem | null>(null)
  const [specSheetOpen, setSpecSheetOpen] = useState(false)
  const [specFromRect, setSpecFromRect] = useState<DOMRect | null>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const categoryClickRef = useRef(false)

  const quantityById = useMemo(() => {
    const map = new Map<string, number>()
    for (const cartItem of items) {
      map.set(cartItem.id, (map.get(cartItem.id) ?? 0) + cartItem.quantity)
    }
    return map
  }, [items])

  const categories = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const m of store.menus) {
      if (!seen.has(m.category)) {
        seen.add(m.category)
        out.push(m.category)
      }
    }
    return out
  }, [store.menus])

  const grouped = useMemo(() => {
    return categories.map((cat) => ({
      category: cat,
      items: store.menus.filter((m) => m.category === cat),
    }))
  }, [categories, store.menus])

  const specGroups = useMemo(
    () => (specItem ? resolveMenuItemSpecGroups(specItem, store.category) : []),
    [specItem, store.category],
  )

  const categoryHeaderHeight = 36
  const stickyScrollMargin = stickyTop + categoryHeaderHeight

  useEffect(() => {
    if (!activeCategory && categories[0]) setActiveCategory(categories[0])
  }, [activeCategory, categories])

  useEffect(() => {
    const root = scrollRootRef.current
    if (!root || categories.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (categoryClickRef.current) return
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]
        if (!top?.target) return
        const cat = top.target.getAttribute('data-category')
        if (cat) setActiveCategory(cat)
      },
      {
        root,
        rootMargin: `-${stickyScrollMargin + 12}px 0px -55% 0px`,
        threshold: [0, 0.15, 0.4, 0.7],
      },
    )

    for (const cat of categories) {
      const el = sectionRefs.current[cat]
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [categories, store.id, scrollRootRef, stickyScrollMargin])

  const handleAdd = (item: MenuItem, btn: HTMLButtonElement) => {
    const rect = btn.getBoundingClientRect()
    if (menuItemNeedsSpecs(item, store.category)) {
      setSpecItem(item)
      setSpecFromRect(rect)
      setSpecSheetOpen(true)
      return
    }
    addItem({ item }, rect)
  }

  const scrollToCategory = useCallback(
    (cat: string) => {
      categoryClickRef.current = true
      setActiveCategory(cat)
      const root = scrollRootRef.current
      const section = sectionRefs.current[cat]
      if (root && section) {
        const rootTop = root.getBoundingClientRect().top
        const sectionTop = section.getBoundingClientRect().top
        root.scrollTo({
          top: root.scrollTop + (sectionTop - rootTop) - stickyScrollMargin,
          behavior: 'smooth',
        })
      } else {
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      window.setTimeout(() => {
        categoryClickRef.current = false
      }, 480)
    },
    [scrollRootRef, stickyScrollMargin],
  )

  return (
    <div className="relative bg-transparent">
      <ItemSpecSheet
        open={specSheetOpen}
        item={specItem}
        specGroups={specGroups}
        onClose={() => {
          setSpecSheetOpen(false)
          setSpecItem(null)
          setSpecFromRect(null)
        }}
        onConfirm={({ specs, unitPrice }) => {
          if (!specItem) return
          addItem({ item: specItem, specs, unitPrice }, specFromRect ?? undefined)
          setSpecSheetOpen(false)
          setSpecItem(null)
          setSpecFromRect(null)
        }}
      />

      <div className="flex">
        <aside
          className="sticky z-10 flex w-[76px] shrink-0 self-start flex-col border-r border-gray-100/80 bg-white/80 backdrop-blur-sm"
          style={{ top: stickyTop }}
        >
          <nav className="py-2">
            {categories.map((cat) => {
              const active = activeCategory === cat
              return (
                <Pressable
                  key={cat}
                  type="button"
                  onClick={() => scrollToCategory(cat)}
                  className={`relative flex min-h-[52px] w-full items-center justify-center px-1.5 py-2.5 text-center text-[11px] leading-snug transition-colors ${
                    active ? 'bg-white font-medium text-[#1C1C1E]' : 'text-neutral-400'
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="taste-cat-line"
                      className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 bg-[#D4AF37]"
                    />
                  ) : null}
                  {cat}
                </Pressable>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 bg-transparent">
          <div className="border-b border-gray-50/80 bg-white/80 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-[11px] leading-relaxed text-neutral-500">
              部分菜品支持选辣度、温度、糖度等规格；带标记的菜品点 + 即可定制。
            </p>
          </div>

          {grouped.map(({ category, items: menuItems }) => (
            <section
              key={category}
              ref={(el) => {
                sectionRefs.current[category] = el
              }}
              data-category={category}
              style={{ scrollMarginTop: stickyScrollMargin }}
            >
              <h2
                className="sticky z-[1] border-b border-gray-50 bg-white/95 px-3 py-2.5 text-[12px] font-medium text-[#1C1C1E] backdrop-blur-sm"
                style={{ fontFamily: SERIF, top: stickyTop }}
              >
                {category}
              </h2>
              <div className="px-3">
                {menuItems.map((item) => (
                  <DishCard
                    key={item.id}
                    item={item}
                    quantity={quantityById.get(item.id) ?? 0}
                    specGroups={resolveMenuItemSpecGroups(item, store.category)}
                    onAdd={handleAdd}
                    onDecrease={decrementMenuItem}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
