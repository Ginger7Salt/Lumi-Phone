import { useEffect, useState } from 'react'

import type { MomentItemModel } from './mockMoments'
import { loadUserMoments } from './momentsFeedStorage'
import type { MomentContactRef } from './newMomentTypes'
import { useMomentInteractionClock } from './useMomentInteractionClock'
import { useMomentsStore } from './useMomentsStore'
import { useSyncMomentInteractionNotices } from './useSyncMomentInteractionNotices'

type Props = {
  accountId?: string | null
  userDisplayName: string
  playerIdentityId?: string | null
  momentContacts: MomentContactRef[]
}

/** 在任意 Tab 下后台同步朋友圈互动通知（供发现页 / 底栏红点使用） */
export function MomentsNoticeRuntime({
  accountId,
  userDisplayName,
  playerIdentityId,
  momentContacts,
}: Props) {
  const bindAccount = useMomentsStore((s) => s.bindAccount)
  const [moments, setMoments] = useState<MomentItemModel[]>([])
  const now = useMomentInteractionClock(5000)

  useEffect(() => {
    void bindAccount(accountId)
  }, [accountId, bindAccount])

  useEffect(() => {
    const acc = accountId?.trim()
    if (!acc) {
      setMoments([])
      return
    }

    let cancelled = false
    const load = () => {
      void loadUserMoments(acc).then((items) => {
        if (!cancelled) setMoments(items)
      })
    }

    load()
    const timer = window.setInterval(load, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [accountId])

  useSyncMomentInteractionNotices({
    moments,
    now,
    userDisplayName,
    playerIdentityId,
    momentContacts,
  })

  return null
}

export function useMomentsInteractionUnreadCount(): number {
  return useMomentsStore((s) => s.notices.filter((n) => !n.isRead).length)
}
