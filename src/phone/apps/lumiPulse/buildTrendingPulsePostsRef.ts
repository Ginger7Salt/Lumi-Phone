import { buildPulsePostMediaBriefForAi, toCharPovId, type PulsePost } from './pulseTypes'
import { usePulseStore } from './usePulseStore'

const POST_LINE_MAX = 160
const BLOCK_MAX = 4_500

function collectPostsByAuthor(authorPovId: string): PulsePost[] {
  const state = usePulseStore.getState()
  const acc = state.currentAccountId
  const id = authorPovId.trim()
  if (!acc || !id) return []
  const byWorld = state.root.byAccount[acc]?.worldByPov
  if (!byWorld) return []
  const merged = new Map<string, PulsePost>()
  for (const world of Object.values(byWorld)) {
    for (const p of world.posts ?? []) {
      if (p.authorPovId === id) merged.set(p.id, p)
    }
  }
  return [...merged.values()].sort((a, b) => b.createdAt - a.createdAt)
}

function formatPostLine(post: PulsePost, index: number): string {
  const text = post.content.replace(/\s+/g, ' ').trim().slice(0, POST_LINE_MAX) || '（无文字）'
  const media = buildPulsePostMediaBriefForAi(post)
  const mediaHint = media
    ? `｜${media.split('\n')[0] ?? '含配图'}`
    : ''
  return `${index}. ${text}${mediaHint}`
}

/**
 * 热搜演化：把用户/角色近期已发微博压成参考块（公开帖，非私聊）。
 */
export function buildTrendingPulsePostsRef(params: {
  enabled: boolean
  playerPovId?: string | null
  playerDisplayName?: string
  playerPostCount: number
  /** char raw id 或 char: pov */
  characterIds: Array<{ characterId: string; name: string }>
  charPostCount: number
}): string {
  if (!params.enabled) return ''

  const playerN = Math.max(0, Math.min(12, Math.floor(params.playerPostCount)))
  const charN = Math.max(0, Math.min(12, Math.floor(params.charPostCount)))
  const parts: string[] = []

  if (playerN > 0 && params.playerPovId?.trim()) {
    const posts = collectPostsByAuthor(params.playerPovId.trim()).slice(0, playerN)
    const who = params.playerDisplayName?.trim() || '用户'
    if (posts.length) {
      parts.push(
        [
          `【近期微博参考｜用户「${who}」｜共 ${posts.length} 条】`,
          '（公开动态，可作热搜素材；勿照抄私聊口吻）',
          ...posts.map((p, i) => formatPostLine(p, i + 1)),
        ].join('\n'),
      )
    } else {
      parts.push(`【近期微博参考｜用户「${who}」】\n（暂无该用户近期微博可引用）`)
    }
  }

  if (charN > 0) {
    for (const c of params.characterIds) {
      const raw = c.characterId.trim()
      if (!raw) continue
      const pov = raw.startsWith('char:') ? raw : toCharPovId(raw)
      const posts = collectPostsByAuthor(pov).slice(0, charN)
      const name = c.name.trim() || '角色'
      if (posts.length) {
        parts.push(
          [
            `【近期微博参考｜角色「${name}」｜共 ${posts.length} 条】`,
            '（该角色公开发博，可作舆论素材）',
            ...posts.map((p, i) => formatPostLine(p, i + 1)),
          ].join('\n'),
        )
      } else {
        parts.push(`【近期微博参考｜角色「${name}」】\n（暂无该角色近期微博可引用）`)
      }
    }
  }

  const joined = parts.filter(Boolean).join('\n\n')
  if (!joined) return ''
  return joined.slice(0, BLOCK_MAX)
}
