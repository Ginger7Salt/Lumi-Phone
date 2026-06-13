import { useEffect, useState } from 'react'

/** 朋友圈互动解锁时钟（默认 5s tick，仅用于互动区重算 visibleAt） */
export function useMomentInteractionClock(intervalMs = 5000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}
