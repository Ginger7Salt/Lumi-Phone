export type PulseFollowRelation = 'follow' | 'following' | 'follow_back' | 'mutual'

export function resolvePulseFollowRelation(params: {
  iFollow: boolean
  theyFollow: boolean
}): PulseFollowRelation {
  if (params.iFollow && params.theyFollow) return 'mutual'
  if (params.iFollow) return 'following'
  if (params.theyFollow) return 'follow_back'
  return 'follow'
}

export function pulseFollowRelationLabel(relation: PulseFollowRelation): string {
  if (relation === 'mutual') return '互相关注'
  if (relation === 'following') return '已关注'
  if (relation === 'follow_back') return '回关'
  return '关注'
}

/** 主色填充：关注 / 回关；浅底：已关注 / 互相关注 */
export function pulseFollowRelationIsPrimary(relation: PulseFollowRelation): boolean {
  return relation === 'follow' || relation === 'follow_back'
}
