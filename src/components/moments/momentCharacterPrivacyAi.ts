import { filterPublishableCharacterContacts } from './momentFeedVisibility'
import type { MomentPrivacyMeta } from './newMomentTypes'
import type { MomentContactRef } from './newMomentTypes'

export type CharacterMomentPrivacyMode = 'public' | 'only_user' | 'hide_from'

export type CharacterMomentPrivacyDraft = {
  mode: CharacterMomentPrivacyMode
  hideFromCharacterIds: string[]
}

export const CHARACTER_MOMENT_PRIVACY_JSON_HINT = `
"privacy": "public" | "only_user" | "hide_from",
"hideFromCharacterIds": ["角色characterId", "..."]  // 仅 privacy 为 hide_from 时必填，最多 8 人
"mentionUser": true | false,
"mentionCharacterIds": ["角色characterId", "..."]  // 可选，提醒其他好友查看，最多 5 人
`.trim()

export const CHARACTER_MOMENT_PRIVACY_RULES = `
# Privacy Protocol（观测权限 · 必须审慎选择）
真人发朋友圈会设权限，**禁止无脑选 public**。须结合正文内容、人设关系与「谁不该看到」来决策：

- **public**：仅当内容对所有通讯录好友都安全、可公开时使用（如正式通知、无害日常、节日问候）。
- **only_user**：仅对当前用户可见——暧昧钓鱼、冷战暗示、只对 TA 说的悄悄话、欲擒故纵；**不要**对这类内容用 public。
- **hide_from**：对指定 NPC **屏蔽不可见**——不想被某些人看到的动态（如：深夜饮酒、恋情苗头、吐槽家长/上司/同事、叛逆/脆弱面）。须在 hideFromCharacterIds 填入下方 roster 中的 characterId（可多人）。**家长、导师、上司、情敌、爱打小报告的 NPC 等，只要内容不适合他们看，就应屏蔽，而不是 public。**

决策优先级：
1. 只想让用户看见 → only_user
2. 多数人可看，但有个别 NPC 绝不能看 → hide_from（屏蔽那些人）
3. 确实人人可看 → public

hideFromCharacterIds 只能填 roster 中的 characterId，不要填发布者自己；不要编造不存在的 id。

# Mention Protocol（提醒谁看 · 极少使用）
- **mentionUser**：默认 **false**。仅当你想**特别强调**「请用户来看这条」时才设为 true——类似微信「提醒谁看」，会显示「提到了你」并推送未读。
- **与 only_user 不同**：only_user = 仅用户可见（隐私权限）；mentionUser = 在可见范围内额外 @ 强调。**禁止**因 only_user / 钓鱼 / 暧昧就设 mentionUser；仅你可见的动态**不要**再 @。
- **使用场景（极稀有）**：用户私聊明确要求「@你 / 提醒你看 / 让你看这条」；或本条是重磅、必须让用户立刻注意到的重要动态（日常碎碎念、随手拍、情绪发泄**一律 false**）。
- **频率**：绝大多数动态 mentionUser 应为 false；连续多条 true 视为错误。
- **mentionCharacterIds**：可选，提醒 roster 中其他好友（characterId 数组，最多 5 人）；与 mentionUser 可同时使用。
- 提醒谁看**不改变** privacy 可见范围；仅额外通知被提醒的人。
`.trim()

export function buildCharacterMomentPrivacyRosterBlock(params: {
  publisherCharacterId: string
  momentContacts: MomentContactRef[]
  playerDisplayName?: string
  blockedCharacterIds?: Set<string>
}): string {
  const publisherId = params.publisherCharacterId.trim()
  const roster = filterPublishableCharacterContacts(
    params.momentContacts,
    params.blockedCharacterIds,
  ).filter((c) => c.characterId?.trim() && c.characterId.trim() !== publisherId)

  const lines: string[] = []
  if (roster.length) {
    lines.push('【可屏蔽的通讯录 NPC（hide_from 时 hideFromCharacterIds 从此处选 characterId）】')
    for (const c of roster.slice(0, 40)) {
      lines.push(`- ${c.name.trim() || '未命名'}（characterId: ${c.characterId!.trim()}）`)
    }
    if (roster.length > 40) {
      lines.push(`- … 另有 ${roster.length - 40} 人未列出，仍须使用已列出的 id`)
    }
  } else {
    lines.push('（通讯录中暂无可屏蔽的其他 NPC；若无合适对象，勿使用 hide_from，可在 only_user 与 public 间选择。）')
  }

  const playerName = params.playerDisplayName?.trim()
  if (playerName) {
    lines.push(
      `【当前用户】${playerName}（only_user 表示仅 TA 可见；若需对用户也屏蔽请用 hide_from 并另行处理，通常钓鱼动态应对用户 only_user 而非屏蔽用户）`,
    )
  }

  return lines.join('\n')
}

export function normalizeCharacterMomentPrivacyDraft(
  raw: unknown,
  publisherCharacterId: string,
): CharacterMomentPrivacyDraft {
  const publisherId = publisherCharacterId.trim()
  let mode: CharacterMomentPrivacyMode = 'public'

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    const privacyRaw = typeof o.privacy === 'string' ? o.privacy.trim().toLowerCase() : ''
    if (privacyRaw === 'only_user' || privacyRaw === 'onlyuser' || privacyRaw === 'only-you') {
      mode = 'only_user'
    } else if (
      privacyRaw === 'hide_from' ||
      privacyRaw === 'hidefrom' ||
      privacyRaw === 'hidden_from'
    ) {
      mode = 'hide_from'
    } else if (privacyRaw === 'public') {
      mode = 'public'
    }

    const idSources = [o.hideFromCharacterIds, o.hiddenFromCharacterIds, o.hideFrom, o.hiddenFrom]
    const hideFromCharacterIds: string[] = []
    for (const source of idSources) {
      if (!Array.isArray(source)) continue
      for (const entry of source) {
        if (typeof entry !== 'string') continue
        const id = entry.trim()
        if (!id || id === publisherId) continue
        hideFromCharacterIds.push(id)
      }
    }

    const unique = [...new Set(hideFromCharacterIds)].slice(0, 8)
    if (mode === 'hide_from' && unique.length) {
      return { mode: 'hide_from', hideFromCharacterIds: unique }
    }
    if (mode === 'hide_from' && !unique.length) {
      mode = 'public'
    }
    if (mode === 'only_user') {
      return { mode: 'only_user', hideFromCharacterIds: [] }
    }
    return { mode, hideFromCharacterIds: [] }
  }

  if (typeof raw === 'string') {
    const privacyRaw = raw.trim().toLowerCase()
    if (privacyRaw === 'only_user') return { mode: 'only_user', hideFromCharacterIds: [] }
    if (privacyRaw === 'hide_from') return { mode: 'hide_from', hideFromCharacterIds: [] }
  }

  return { mode: 'public', hideFromCharacterIds: [] }
}

export function resolveContactsByCharacterIds(
  characterIds: readonly string[],
  momentContacts: MomentContactRef[],
): MomentContactRef[] {
  const wanted = new Set(characterIds.map((id) => id.trim()).filter(Boolean))
  if (!wanted.size) return []

  const byCharId = new Map<string, MomentContactRef>()
  for (const c of momentContacts) {
    const charId = c.characterId?.trim()
    if (charId) byCharId.set(charId, c)
  }

  const resolved: MomentContactRef[] = []
  for (const id of wanted) {
    const hit = byCharId.get(id)
    if (hit) resolved.push(hit)
  }
  return resolved
}

export function resolveCharacterMomentPrivacyMeta(params: {
  draft: CharacterMomentPrivacyDraft
  momentContacts: MomentContactRef[]
  userContact?: MomentContactRef
}): MomentPrivacyMeta {
  const { draft, momentContacts, userContact } = params

  if (draft.mode === 'only_user') {
    return {
      mode: 'shareWith',
      visibilityLabel: '仅对你可见',
      audienceOnlyUser: true,
      visibleToOnly: userContact ? [userContact] : undefined,
      selectedContactIds: userContact ? [userContact.id] : undefined,
    }
  }

  if (draft.mode === 'hide_from') {
    const hiddenFrom = resolveContactsByCharacterIds(draft.hideFromCharacterIds, momentContacts)
    if (!hiddenFrom.length) {
      return { mode: 'public', visibilityLabel: '公开' }
    }
    const names = hiddenFrom.map((c) => c.name.trim() || '未命名')
    const visibilityLabel =
      names.length <= 2 ? `${names.join('、')} 不可见` : `${names[0]} 等 ${names.length} 人不可见`
    return {
      mode: 'hideFrom',
      visibilityLabel,
      hiddenFrom,
      selectedContactIds: hiddenFrom.map((c) => c.id),
    }
  }

  return { mode: 'public', visibilityLabel: '公开' }
}

export function buildCharacterMomentPrivacyPromptSection(params: {
  publisherCharacterId: string
  momentContacts: MomentContactRef[]
  playerDisplayName?: string
  blockedCharacterIds?: Set<string>
}): string {
  return [
    CHARACTER_MOMENT_PRIVACY_RULES,
    buildCharacterMomentPrivacyRosterBlock(params),
    `JSON 权限字段示例：\n{ ${CHARACTER_MOMENT_PRIVACY_JSON_HINT} }`,
  ].join('\n\n')
}
