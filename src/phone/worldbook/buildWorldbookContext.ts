import type { LoreEntry } from './loreArchiveTypes'
import { formatGlobalWorldBookItemLineForPrompt } from './buildGlobalWechatWorldBooksPrompt'
import type { GlobalWechatPlate, GlobalWechatWorldBookScope } from './globalWorldBookTypes'
import { GLOBAL_WECHAT_PLATE_LABELS, normalizeGlobalWechatWorldBookScope } from './globalWorldBookTypes'

const MAX_LORE_INJECT_CHARS = 12000

function normalizeMemberSet(currentChatMembers: string[]): Set<string> {
  return new Set(currentChatMembers.map((x) => String(x ?? '').trim()).filter(Boolean))
}

function entryMatchesPlate(scope: GlobalWechatWorldBookScope, plate: GlobalWechatPlate | undefined): boolean {
  const s = normalizeGlobalWechatWorldBookScope(scope)
  if (s.mode === 'all') return true
  if (plate == null) return false
  return s.plates.includes(plate)
}

function entryMatchesCharacterScope(entry: LoreEntry, inScene: Set<string>): boolean {
  const cs = entry.characterScope
  if (!cs || cs.mode === 'all') return true
  const ids = cs.mode === 'characters' ? cs.ids ?? [] : []
  if (!ids.length) return false
  return ids.some((id) => inScene.has(String(id ?? '').trim()))
}

function plateScopeLabel(scope: GlobalWechatWorldBookScope): string {
  const s = normalizeGlobalWechatWorldBookScope(scope)
  if (s.mode === 'all') return '全部板块'
  return s.plates.map((p) => GLOBAL_WECHAT_PLATE_LABELS[p]).join('、')
}

function characterScopeLabel(entry: LoreEntry): string {
  const cs = entry.characterScope
  if (!cs || cs.mode === 'all') return '全部角色（档案相关场景）'
  const ids = cs.ids ?? []
  if (!ids.length) return '未指定角色'
  return `限定 ${ids.length} 名角色`
}

/**
 * 按当前会话成员与所在微信/约会板块，从档案室统一条目组装注入块。
 * `plate === undefined` 时：仅注入「全部板块」类条目（与旧全局世界书行为一致）。
 */
export function buildWorldbookContext(
  currentChatMembers: string[],
  entries: LoreEntry[],
  plate?: GlobalWechatPlate | null,
): string {
  const inScene = normalizeMemberSet(currentChatMembers)
  const plateArg = plate ?? undefined

  const candidates = (entries ?? []).filter((e) => {
    if (e.enabled === false) return false
    if (!String(e.content ?? '').trim()) return false
    if (!entryMatchesPlate(e.plateScope, plateArg)) return false
    if (!inScene.size && e.characterScope?.mode === 'characters') return false
    return entryMatchesCharacterScope(e, inScene)
  })

  if (!candidates.length) return ''

  const allFirst = candidates.filter((e) => e.characterScope?.mode !== 'characters')
  const targeted = candidates.filter((e) => e.characterScope?.mode === 'characters')
  const sortedAll = [...allFirst].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  const sortedTargeted = [...targeted].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  const ordered = [...sortedAll, ...sortedTargeted]

  const lines: string[] = []
  lines.push('【档案与世界书】')
  lines.push(
    '请务必在叙事与设定理解中严格遵守下列条目。条目按标注的生效板块与作用角色筛选；正文宜为客观第三人称描述。若条目限定具体角色：仅该角色在台词、心理与知情范围内受其约束。',
  )
  lines.push(
    '【效力层级】本段与角色人设上的「世界书条目」为同一优先级，均高于会话后方内置的通用扮演说明、《线上回复输出协议》中的语气与节奏建议、以及表情包资源目录等——若存在冲突，以本段及人设世界书为准；客户端解析所需的硬性格式（如换行对应多条气泡、禁止 JSON/Markdown 围栏等）仍须遵守。若本段与人设世界书条文冲突，以更贴合当前场景与角色的表述为准；必要时宁可弱化套路化格式也不可违背上述设定。',
  )

  let n = 1
  for (const e of ordered) {
    const title = String(e.title ?? '').trim() || '未命名'
    const plateL = plateScopeLabel(e.plateScope)
    const charL = characterScopeLabel(e)
    const bodyLine = formatGlobalWorldBookItemLineForPrompt(title, String(e.content).trim())
    lines.push(`${n}. [${plateL}｜${charL}]`)
    lines.push(bodyLine)
    n += 1
  }

  let out = lines.join('\n')
  if (out.length > MAX_LORE_INJECT_CHARS) {
    out = `${out.slice(0, MAX_LORE_INJECT_CHARS)}\n…（档案与世界书因长度已截断）`
  }
  return out
}
