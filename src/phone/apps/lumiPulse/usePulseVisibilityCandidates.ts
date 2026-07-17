import { useMemo } from 'react'

import type { PulseVisibilityCandidate } from './pulsePostVisibility'
import type { PulsePovOption } from './pulseTypes'
import { usePulseMentionDirectory } from './usePulseMentionDirectory'
import { usePulseStore } from './usePulseStore'

/** 当前身份绑定角色列表（供发帖「谁可以看」） */
export function usePulseVisibilityCandidates(
  povOptions: readonly PulsePovOption[],
): PulseVisibilityCandidate[] {
  const identityVisible = usePulseStore((s) => s.identityVisibleCharPovIds)
  const directory = usePulseMentionDirectory([...povOptions])

  return useMemo(() => {
    const allowed = identityVisible?.length
      ? new Set(identityVisible.map((id) => id.trim()).filter(Boolean))
      : null
    const nickByPov = new Map(directory.map((e) => [e.povId, e.nickname] as const))
    const rows: PulseVisibilityCandidate[] = []
    const seen = new Set<string>()

    for (const opt of povOptions) {
      const povId = opt.povId.trim()
      if (!povId.startsWith('char:')) continue
      if (allowed && !allowed.has(povId)) continue
      if (seen.has(povId)) continue
      seen.add(povId)
      rows.push({
        povId,
        name: nickByPov.get(povId) || opt.label,
        avatarUrl: opt.avatarUrl,
      })
    }

    // 绑定列表里有、但未出现在世界选项中的角色（通讯录关联）
    if (allowed) {
      for (const povId of allowed) {
        if (seen.has(povId)) continue
        seen.add(povId)
        rows.push({
          povId,
          name: nickByPov.get(povId) || povId.replace(/^char:/, ''),
        })
      }
    }

    return rows
  }, [directory, identityVisible, povOptions])
}
