import type { MomentItemModel } from './mockMoments'
import { sanitizeMomentBodyText } from './momentTextSanitize'
import { loadUserMoments, patchUserMoment } from './momentsFeedStorage'
import { formatMomentPublishedAtAbsolute } from './utils/timeFormat'

export type CharacterMomentPinDirective = {
  action: 'pin' | 'unpin'
  momentId?: string
  hint?: string
  /** 1 = 最新一条 */
  index?: number
}

export function filterCharacterMoments(
  moments: MomentItemModel[],
  characterId: string,
): MomentItemModel[] {
  const cid = characterId.trim()
  if (!cid) return []
  return moments.filter((m) => m.authorCharacterId?.trim() === cid)
}

export function canSubjectPinMoment(moment: MomentItemModel): boolean {
  return !!moment.isUserAuthored || !!moment.authorCharacterId?.trim()
}

function matchMomentHint(moment: MomentItemModel, hint: string): boolean {
  const needle = hint.trim().toLowerCase()
  if (!needle) return false
  const content = sanitizeMomentBodyText(moment.content).toLowerCase()
  if (content.includes(needle)) return true
  if (moment.images?.length && /图片|照片|图/.test(needle)) return true
  return false
}

export function resolveCharacterMomentPinTarget(
  moments: MomentItemModel[],
  characterId: string,
  directive: CharacterMomentPinDirective,
): MomentItemModel | null {
  const pool = filterCharacterMoments(moments, characterId).sort(
    (a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id),
  )
  if (!pool.length) return null

  if (directive.action === 'unpin') {
    if (directive.momentId?.trim()) {
      return pool.find((m) => m.id === directive.momentId?.trim() && m.isPinned) ?? null
    }
    if (directive.hint?.trim()) {
      return pool.find((m) => m.isPinned && matchMomentHint(m, directive.hint!)) ?? null
    }
    if (directive.index && directive.index >= 1) {
      const pinned = pool.filter((m) => m.isPinned)
      return pinned[directive.index - 1] ?? null
    }
    return pool.find((m) => m.isPinned) ?? null
  }

  if (directive.momentId?.trim()) {
    return pool.find((m) => m.id === directive.momentId?.trim()) ?? null
  }
  if (directive.index && directive.index >= 1) {
    return pool[directive.index - 1] ?? null
  }
  if (directive.hint?.trim()) {
    return pool.find((m) => matchMomentHint(m, directive.hint!)) ?? null
  }
  return pool[0] ?? null
}

export async function setMomentPinned(
  accountId: string | null | undefined,
  momentId: string,
  isPinned: boolean,
): Promise<boolean> {
  const id = momentId.trim()
  if (!id) return false
  const all = await loadUserMoments(accountId)
  const target = all.find((m) => m.id === id)
  if (!target || !canSubjectPinMoment(target)) return false
  await patchUserMoment(accountId, id, { isPinned })
  return true
}

export async function applyCharacterMomentPinDirectives(params: {
  accountId: string | null | undefined
  characterId: string
  directives: CharacterMomentPinDirective[]
}): Promise<{ applied: number; pinned: boolean[] }> {
  const cid = params.characterId.trim()
  if (!cid || !params.directives.length) return { applied: 0, pinned: [] }

  const all = await loadUserMoments(params.accountId)
  const pinned: boolean[] = []
  let applied = 0

  for (const directive of params.directives) {
    const target = resolveCharacterMomentPinTarget(all, cid, directive)
    if (!target) continue
    const nextPinned = directive.action === 'pin'
    if (!!target.isPinned === nextPinned) {
      pinned.push(nextPinned)
      applied += 1
      continue
    }
    const ok = await setMomentPinned(params.accountId, target.id, nextPinned)
    if (!ok) continue
    target.isPinned = nextPinned
    pinned.push(nextPinned)
    applied += 1
  }

  return { applied, pinned }
}

export async function buildCharacterMomentsPinCatalogBlock(
  accountId: string | null | undefined,
  characterId: string,
  limit = 12,
): Promise<string> {
  const cid = characterId.trim()
  if (!cid) return ''
  const all = await loadUserMoments(accountId)
  const pool = filterCharacterMoments(all, cid)
    .sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id))
    .slice(0, limit)

  if (!pool.length) {
    return `【你的朋友圈 · 置顶参考】你还没有发过朋友圈。用户若要求置顶某条，需先有对应动态；没有则自然婉拒，不要输出置顶指令。`
  }

  const lines = pool.map((m, i) => {
    const preview =
      sanitizeMomentBodyText(m.content).slice(0, 40) ||
      (m.images?.length ? '[图片动态]' : '[无文字]')
    const pinnedTag = m.isPinned ? ' · 已置顶' : ''
    const time = formatMomentPublishedAtAbsolute(m.timestamp)
    return `${i + 1}. momentId=${m.id} | ${time} | ${preview}${pinnedTag}`
  })

  return `【你的朋友圈 · 置顶参考】（仅列出你本人发布的动态，供置顶/取消置顶指令选用）
${lines.join('\n')}
用户说「最新一条/刚发的那条」→ 用第 1 条的 momentId；说「第二条」→ 用第 2 条。也可按正文关键词选用对应 momentId。`
}
