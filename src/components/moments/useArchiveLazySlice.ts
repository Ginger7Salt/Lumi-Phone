import { useEffect, useRef, useState } from 'react'

export function useArchiveLazySlice<T>(items: T[], initialCount = 14, step = 10) {
  const [visibleCount, setVisibleCount] = useState(initialCount)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setVisibleCount(initialCount)
  }, [initialCount, items])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || visibleCount >= items.length) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setVisibleCount((count) => Math.min(items.length, count + step))
      },
      { rootMargin: '240px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [items.length, step, visibleCount])

  return {
    visibleItems: items.slice(0, visibleCount),
    sentinelRef,
    hasMore: visibleCount < items.length,
  }
}
