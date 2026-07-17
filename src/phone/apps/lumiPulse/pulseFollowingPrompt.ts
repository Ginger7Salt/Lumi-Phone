import { loadAccountsBundle } from '../wechat/wechatAccountPersistence'
import { isPulseNetizenAuthor } from './pulseNetizenAvatar'
import { isPulsePostVisibleToCharacter } from './pulsePostVisibility'
import {
  isPulseWorldPovId,
  toCharPovId,
  type PulseFollowingUser,
  type PulsePovId,
  type PulsePost,
} from './pulseTypes'
import { usePulseStore } from './usePulseStore'

const DEFAULT_MAX_ITEMS = 36
const DEFAULT_MAX_CHARS = 2200

function clip(s: string, max: number): string {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function classifyFollowee(u: PulseFollowingUser): 'circle' | 'player' | 'netizen' {
  const pov = u.povId.trim()
  if (pov.startsWith('player:')) return 'player'
  if (pov.startsWith('char:')) return 'circle'
  if (isPulseNetizenAuthor(pov) || pov.startsWith('ai:')) return 'netizen'
  return 'netizen'
}

function resolveFollowingList(params: {
  characterId: string
  accountId?: string | null
}): PulseFollowingUser[] {
  const charPov = toCharPovId(params.characterId)
  const { root, currentAccountId } = usePulseStore.getState()
  const acc =
    params.accountId?.trim() ||
    currentAccountId?.trim() ||
    Object.keys(root.byAccount ?? {})[0] ||
    ''
  if (!acc) return []
  return root.byAccount[acc]?.followingByPov[charPov] ?? []
}

function theyFollowMeBack(
  accountId: string,
  myPov: PulsePovId,
  theirPov: string,
): boolean {
  const list = usePulseStore.getState().root.byAccount[accountId]?.followingByPov[theirPov] ?? []
  return list.some((u) => u.povId.trim() === myPov)
}

/**
 * 从本地微博数据拼「你当前关注了谁」提示块。
 * 无社交生成 / 关注列表为空时返回空串。
 */
export function buildPulseCharacterFollowingPromptBlock(params: {
  characterId: string
  accountId?: string | null
  maxItems?: number
  maxChars?: number
}): string {
  const characterId = params.characterId.trim()
  if (!characterId) return ''

  const { root, currentAccountId } = usePulseStore.getState()
  const acc =
    params.accountId?.trim() ||
    currentAccountId?.trim() ||
    Object.keys(root.byAccount ?? {})[0] ||
    ''
  if (!acc) return ''

  const myPov = toCharPovId(characterId)
  const list = resolveFollowingList({ characterId, accountId: acc })
  if (!list.length) return ''

  const maxItems = Math.min(60, Math.max(4, params.maxItems ?? DEFAULT_MAX_ITEMS))
  const maxChars = Math.max(400, params.maxChars ?? DEFAULT_MAX_CHARS)
  const statsByPov = root.byAccount[acc]?.profileStatsByPov ?? {}

  const circle: string[] = []
  const players: string[] = []
  const netizens: string[] = []

  for (const u of list.slice(0, maxItems)) {
    const name = (u.name || '').trim() || '未命名'
    const kind = classifyFollowee(u)
    const bio =
      clip(u.bio || '', 48) ||
      clip(statsByPov[u.povId]?.verifyLabel || '', 48) ||
      clip(statsByPov[u.povId]?.bio || '', 48)
    const mutual = theyFollowMeBack(acc, myPov, u.povId)
    const mutualTag = mutual ? ' · **互关**' : ' · **你单关**'
    const ver = u.verified || statsByPov[u.povId]?.verifyLabel ? ' · 认证' : ''
    const bioBit = bio ? `：${bio}` : ''

    if (kind === 'player') {
      players.push(`- 用户微博「${name}」${bioBit}${mutualTag}${ver}`)
    } else if (kind === 'circle') {
      circle.push(`- 圈内「${name}」${bioBit}${mutualTag}${ver}`)
    } else {
      netizens.push(`- 圈外网友「${name}」${bioBit}${mutualTag}`)
    }
  }

  const lines: string[] = [
    '【你的微博关注列表】',
    '以下来自本地已生成的微博社交数据（含人脉圈内关注 + 圈外网友）；谈及「我关注了谁 / 刷到谁」时须与此一致，禁止声称关注表外熟人，也勿否认表内已关注。',
    '谈及粉丝/私信/热度时保持克制：可一句带过，禁止向用户连发人气盘点或「怕被抢走」式自恋调情。',
  ]
  if (circle.length) {
    lines.push('【圈内 · 人脉角色/NPC】')
    lines.push(...circle)
  }
  if (players.length) {
    lines.push('【用户微博】')
    lines.push(...players)
  }
  if (netizens.length) {
    lines.push('【圈外网友】')
    lines.push(...netizens)
  }
  if (list.length > maxItems) {
    lines.push(`（另有 ${list.length - maxItems} 个关注未逐条列出。）`)
  }

  const visiblePlayerPosts = listRecentPlayerPostsVisibleToCharacter({
    accountId: acc,
    charPovId: myPov,
    limit: 4,
  })
  if (visiblePlayerPosts.length) {
    lines.push('【用户近期对你可见的微博】')
    lines.push(
      '以下为用户发帖且对你可见的内容（部分可见帖若未列则你看不到，禁止声称看过）：',
    )
    for (const p of visiblePlayerPosts) {
      const snippet = clip(p.content || '（图文）', 72)
      lines.push(`- 「${p.authorName}」：${snippet}`)
    }
  }

  const body = lines.join('\n').slice(0, maxChars)
  return `\n\n---\n${body}\n（↑ 关注关系以本表为准；人脉看法/称呼仍服从上方人脉表。）\n`
}

function listRecentPlayerPostsVisibleToCharacter(params: {
  accountId: string
  charPovId: string
  limit: number
}): PulsePost[] {
  const byWorld = usePulseStore.getState().root.byAccount[params.accountId]?.worldByPov
  if (!byWorld) return []
  const out: PulsePost[] = []
  for (const [wid, world] of Object.entries(byWorld)) {
    if (!isPulseWorldPovId(wid)) continue
    for (const p of world.posts ?? []) {
      if (!p.authorPovId.startsWith('player:')) continue
      if (!isPulsePostVisibleToCharacter(p, params.charPovId)) continue
      out.push(p)
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt).slice(0, Math.max(1, params.limit))
}

/** 确保已绑当前微信账号后再读关注列表（私聊 / 发帖注入用） */
export async function loadPulseCharacterFollowingPromptBlock(params: {
  characterId: string
  accountId?: string | null
  maxItems?: number
  maxChars?: number
}): Promise<string> {
  const characterId = params.characterId.trim()
  if (!characterId) return ''

  let accountId = params.accountId?.trim() || ''
  if (!accountId) {
    try {
      const bundle = await loadAccountsBundle()
      accountId = bundle?.currentAccountId?.trim() || ''
    } catch {
      accountId = ''
    }
  }
  if (accountId) {
    try {
      await usePulseStore.getState().bindAccount(accountId)
    } catch {
      /* 无微博数据仍可返回空 */
    }
  }

  return buildPulseCharacterFollowingPromptBlock({
    characterId,
    accountId: accountId || null,
    maxItems: params.maxItems,
    maxChars: params.maxChars,
  })
}
