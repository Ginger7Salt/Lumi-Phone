import { useMemo } from 'react'

import type { PublishMentionCandidate } from './components/publish/PublishMentionSheet'
import type { PulseFollowingUser, PulsePovOption } from './pulseTypes'
import { usePulseFollowingList } from './pulseStoreSelectors'
import { usePulseMentionDirectory } from './usePulseMentionDirectory'

/** 合并世界角色与关注列表，供发布面板 @ 艾特（展示昵称，携带 povId 以便写表达式） */
export function usePublishMentionCandidates(
  playerPovId: string | null,
  povOptions: PulsePovOption[],
): PublishMentionCandidate[] {
  const following = usePulseFollowingList(playerPovId)
  const directory = usePulseMentionDirectory(povOptions)
  const nickByPov = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of directory) m.set(e.povId, e.nickname)
    return m
  }, [directory])

  return useMemo(() => {
    const seen = new Set<string>()
    const rows: PublishMentionCandidate[] = []

    const push = (name: string, povId?: string, avatarUrl?: string, subtitle?: string) => {
      const key = (povId || name).trim()
      if (!key || seen.has(key)) return
      seen.add(key)
      const display = (povId && nickByPov.get(povId)) || name.trim()
      if (!display) return
      rows.push({
        name: display,
        povId: povId as PublishMentionCandidate['povId'],
        avatarUrl,
        subtitle,
      })
    }

    for (const opt of povOptions) {
      push(opt.label, opt.povId, opt.avatarUrl, opt.worldName)
    }
    for (const user of following as PulseFollowingUser[]) {
      push(user.name, user.povId, user.avatarUrl, user.bio)
    }

    return rows
  }, [following, nickByPov, povOptions])
}
