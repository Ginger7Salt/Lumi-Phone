import type { PulsePovId, PulsePost } from './pulseTypes'
import { parsePulsePovId, toCharPovId } from './pulseTypes'

export type PulsePostVisibilityMode = 'public' | 'partial'

export type PulseVisibilityCandidate = {
  povId: PulsePovId
  name: string
  avatarUrl?: string
}

/** 规范化可见性：partial 且名单非空才算部分可见，否则视为公开 */
export function normalizePulsePostVisibility(input: {
  visibility?: PulsePostVisibilityMode | null
  visibleToCharPovIds?: readonly string[] | null
}): { visibility: PulsePostVisibilityMode; visibleToCharPovIds?: PulsePovId[] } {
  const ids = [
    ...new Set(
      (input.visibleToCharPovIds ?? [])
        .map((id) => {
          const t = id.trim()
          if (!t) return ''
          if (t.startsWith('char:')) return t
          const parsed = parsePulsePovId(t)
          if (parsed?.kind === 'char') return toCharPovId(parsed.rawId)
          return toCharPovId(t)
        })
        .filter(Boolean),
    ),
  ] as PulsePovId[]

  if (input.visibility === 'partial' && ids.length > 0) {
    return { visibility: 'partial', visibleToCharPovIds: ids }
  }
  return { visibility: 'public' }
}

export function isPulsePostPartialVisibility(post: Pick<PulsePost, 'visibility' | 'visibleToCharPovIds'>): boolean {
  return (
    post.visibility === 'partial' &&
    Array.isArray(post.visibleToCharPovIds) &&
    post.visibleToCharPovIds.some((id) => id.trim())
  )
}

/** 作者本人始终可见；公开帖全员可见；部分可见仅名单内角色 */
export function isPulsePostVisibleToCharacter(
  post: Pick<PulsePost, 'authorPovId' | 'visibility' | 'visibleToCharPovIds'>,
  charPovId: string,
): boolean {
  const char = charPovId.trim()
  if (!char || !char.startsWith('char:')) return true
  if (!isPulsePostPartialVisibility(post)) return true
  return (post.visibleToCharPovIds ?? []).some((id) => id.trim() === char)
}

/** 当前查看者是否可看该帖（玩家作者本人 / 非部分可见 / 角色在名单） */
export function isPulsePostVisibleToViewer(params: {
  post: Pick<PulsePost, 'authorPovId' | 'visibility' | 'visibleToCharPovIds'>
  viewerPovId: string | null | undefined
}): boolean {
  const viewer = params.viewerPovId?.trim() || ''
  if (!viewer) return true
  if (viewer === params.post.authorPovId.trim()) return true
  if (viewer.startsWith('char:')) {
    return isPulsePostVisibleToCharacter(params.post, viewer)
  }
  // 其他玩家账号不套用角色可见名单
  return true
}

export function formatPulsePostVisibilityLabel(
  post: Pick<PulsePost, 'visibility' | 'visibleToCharPovIds'>,
  nameByPovId?: ReadonlyMap<string, string> | Record<string, string>,
): string | null {
  if (!isPulsePostPartialVisibility(post)) return null
  const ids = (post.visibleToCharPovIds ?? []).map((id) => id.trim()).filter(Boolean)
  if (!ids.length) return null
  const names = ids.map((id) => {
    if (!nameByPovId) return ''
    if (nameByPovId instanceof Map) return nameByPovId.get(id)?.trim() || ''
    return (nameByPovId as Record<string, string>)[id]?.trim() || ''
  }).filter(Boolean)
  if (!names.length) return `仅 ${ids.length} 位角色可见`
  if (names.length <= 2) return `仅 ${names.join('、')} 可见`
  return `仅 ${names[0]}、${names[1]} 等 ${names.length} 人可见`
}
