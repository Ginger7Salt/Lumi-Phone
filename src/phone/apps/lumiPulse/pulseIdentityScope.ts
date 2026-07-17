import type { PlayerNetworkLink, Relationship } from '../wechat/newFriendsPersona/types'
import { isPulseNetizenAuthor } from './pulseNetizenAvatar'
import type { PulsePovId, PulsePost } from './pulseTypes'
import { parsePulsePovId, toCharPovId, toPlayerPovId } from './pulseTypes'

/** 关系过浅：刚认识 / 不太熟，不足以自然「关注」 */
const WEAK_RELATION_LABELS = new Set([
  '联系人',
  '认识',
  '刚认识',
  '不太熟',
  '不熟',
  '不怎么熟',
  '熟人',
  '路人',
  '陌生人',
  '点头之交',
  '一面之缘',
  '网友',
  '群友',
  '听说',
  '路过',
  '普通同事',
  '普通同学',
])

/** 文案里出现浅交信号 → 不关注 */
const WEAK_HINT = /刚认识|不太熟|不怎么熟|几乎不熟|一面之缘|纯路人|仅认识|随便认识/

/** 带敌意标签：可不关注 */
const HOSTILE_HINT = /仇|敌|宿|憎|恨|报复|对立|死对头/

/**
 * 好朋友及以上亲密（含家人/恋人/重要同学同事等）→ 应关注。
 * 覆盖标签或视角文案。
 */
const WORTHY_FOLLOW_HINT =
  /恋|情侣|交往|暧昧|亲密|爱人|伴侣|喜欢|暗恋|订婚|结婚|夫妻|老公|老婆|对象|男女朋友|男友|女友|未婚夫|未婚妻|朋友|好友|挚友|闺蜜|兄弟|姐妹|发小|竹马|青梅|知己|家人|亲属|爸|妈|父|母|哥|姐|弟|妹|同学|同窗|室友|同事|搭档|伙伴|队友|战友|搭子|青梅竹马/

/**
 * 关系名 + 视角文案：是否值得在微博关注对方。
 * 好朋友及以上可以关注；仅「刚认识 / 不太熟 / 敌人」不关注。
 */
export function relationLabelSuggestsFollow(
  label: string,
  perspectiveText = '',
): boolean {
  const name = (label || '').trim()
  const text = `${perspectiveText || ''}`.trim()
  const blob = `${name}${text}`
  if (!name && !text) return false
  if (HOSTILE_HINT.test(blob)) return false
  // 友好/亲密信号优先：即使身份绑定标签仍是「联系人」，视角里写了朋友/恋人也要关注
  if (WORTHY_FOLLOW_HINT.test(blob)) return true
  if (WEAK_RELATION_LABELS.has(name) || WEAK_HINT.test(blob)) return false
  // 有明确关系名且非浅交敌意：视为可关注（如「发小」「前室友」等）
  if (name) return true
  return false
}

/**
 * 根据人脉关系名 + 视角说明，判断「from 是否会在微博关注 to」。
 * 有关系 ≠ 一定关注；单向关系只产生单向关注候选。
 */
export function relationshipSuggestsFollow(rel: Relationship | null | undefined): boolean {
  if (!rel) return false
  return relationLabelSuggestsFollow(
    rel.relation || '',
    `${rel.fromPerspective || ''}${rel.toPerspective || ''}`,
  )
}

/**
 * 从人脉边推导「从谁关注谁」。
 * - 互相关注：须有双向关系边，且两边都值得关注
 * - 单向关注：仅有一边关系且值得关注时写入一边
 * - 不写玩家本人的关注边（用户关注不生成）
 */
export function buildPulseFollowEdgesFromRelationships(params: {
  seedPovIds: readonly string[]
  relationships: readonly Relationship[]
  playerPovId: string
}): Array<{ fromPovId: string; toPovId: string }> {
  const seeds = new Set(params.seedPovIds.map((id) => id.trim()).filter(Boolean))
  const player = params.playerPovId.trim()
  if (!seeds.size) return []

  const toPov = (rawId: string): string | null => {
    const id = rawId.trim()
    if (!id) return null
    if (id === parsePulsePovId(player)?.rawId) return player
    if (seeds.has(toCharPovId(id))) return toCharPovId(id)
    if (seeds.has(toPlayerPovId(id))) return toPlayerPovId(id)
    if (seeds.has(id)) return id
    return null
  }

  /** fromRawId → toRawId → best Relationship */
  const directed = new Map<string, Map<string, Relationship>>()
  for (const rel of params.relationships) {
    const from = rel.fromCharacterId?.trim()
    const to = rel.toCharacterId?.trim()
    if (!from || !to || from === to) continue
    if (!relationshipSuggestsFollow(rel)) continue
    let row = directed.get(from)
    if (!row) {
      row = new Map()
      directed.set(from, row)
    }
    const prev = row.get(to)
    if (!prev || (rel.fromPerspective?.length ?? 0) > (prev.fromPerspective?.length ?? 0)) {
      row.set(to, rel)
    }
  }

  const edges: Array<{ fromPovId: string; toPovId: string }> = []
  const seen = new Set<string>()
  const push = (fromPov: string, toPovId: string) => {
    if (!fromPov || !toPovId || fromPov === toPovId) return
    // 不生成用户关注列表
    if (fromPov === player) return
    if (!seeds.has(fromPov) || !seeds.has(toPovId)) return
    const key = `${fromPov}>${toPovId}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push({ fromPovId: fromPov, toPovId })
  }

  for (const [fromRaw, tos] of directed) {
    const fromPov = toPov(fromRaw)
    if (!fromPov) continue
    for (const toRaw of tos.keys()) {
      const toPovId = toPov(toRaw)
      if (!toPovId) continue
      push(fromPov, toPovId)
    }
  }

  return edges
}

/**
 * 从「你↔角色」人脉连线（PlayerNetworkLink）推导角色是否关注用户。
 * 好朋友 / 恋人 / 家人等会关注；刚认识、不太熟、敌对不关注。
 * 仍不写用户→角色关注。
 */
export function buildPulseFollowEdgesFromPlayerLinks(params: {
  seedPovIds: readonly string[]
  playerLinks: readonly PlayerNetworkLink[]
  playerPovId: string
}): Array<{ fromPovId: string; toPovId: string }> {
  const seeds = new Set(params.seedPovIds.map((id) => id.trim()).filter(Boolean))
  const player = params.playerPovId.trim()
  if (!player || !seeds.has(player) || !params.playerLinks.length) return []

  const edges: Array<{ fromPovId: string; toPovId: string }> = []
  const seen = new Set<string>()

  for (const link of params.playerLinks) {
    const charPov = toCharPovId(link.characterId)
    if (!seeds.has(charPov)) continue

    // 对方→你：角色会关注用户
    if (
      relationLabelSuggestsFollow(
        link.relationThemToYou,
        `${link.theySeeYou || ''}${link.youSeeThem || ''}`,
      )
    ) {
      const key = `${charPov}>${player}`
      if (!seen.has(key)) {
        seen.add(key)
        edges.push({ fromPovId: charPov, toPovId: player })
      }
    }
  }

  return edges
}

/** 合并关注边并去重（仍然过滤用户作为 from） */
export function mergePulseFollowEdges(
  ...lists: Array<Array<{ fromPovId: string; toPovId: string }>>
): Array<{ fromPovId: string; toPovId: string }> {
  const seen = new Set<string>()
  const out: Array<{ fromPovId: string; toPovId: string }> = []
  for (const list of lists) {
    for (const e of list) {
      const from = e.fromPovId.trim()
      const to = e.toPovId.trim()
      if (!from || !to || from === to) continue
      const key = `${from}>${to}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ fromPovId: from, toPovId: to })
    }
  }
  return out
}

/** 当前身份视角下是否允许展示该作者（角色须绑定当前身份；网友/本玩家可见） */
export function isPulseAuthorVisibleForIdentity(params: {
  authorPovId: string
  playerPovId: string | null | undefined
  allowedCharPovIds: ReadonlySet<string> | null | undefined
  isAiGenerated?: boolean
}): boolean {
  const author = params.authorPovId.trim()
  if (!author) return false
  const player = params.playerPovId?.trim() || ''
  if (player && author === player) return true
  if (isPulseNetizenAuthor(author, params.isAiGenerated)) return true
  if (author.startsWith('ai:')) return true
  if (author.startsWith('player:')) return false
  if (author.startsWith('char:')) {
    const allowed = params.allowedCharPovIds
    if (!allowed) return true
    return allowed.has(author)
  }
  return true
}

export function filterPostsForIdentityScope(
  posts: readonly PulsePost[],
  playerPovId: string | null | undefined,
  allowedCharPovIds: ReadonlySet<string> | null | undefined,
): PulsePost[] {
  if (!allowedCharPovIds) return [...posts]
  return posts.filter((p) =>
    isPulseAuthorVisibleForIdentity({
      authorPovId: p.authorPovId,
      playerPovId,
      allowedCharPovIds,
      isAiGenerated: p.isAiGenerated,
    }),
  )
}

export function toCharPovIdSet(characterIds: Iterable<string>): Set<string> {
  const out = new Set<string>()
  for (const id of characterIds) {
    const t = id.trim()
    if (t) out.add(t.startsWith('char:') ? t : toCharPovId(t))
  }
  return out
}

export type { PulsePovId }
