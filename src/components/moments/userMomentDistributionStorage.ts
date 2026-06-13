import { personaDb, emitWeChatStorageChanged } from '../../phone/apps/wechat/newFriendsPersona/idb'

export type UserMomentDistributionCharacterRef = {
  charId: string
  displayName: string
}

export type UserMomentDistributionCommentRef = {
  authorName: string
  content: string
  replyToName?: string
}

export type UserMomentDistributionRecord = {
  momentId: string
  updatedAt: number
  publishedAt: number
  previewText: string
  isPinned: boolean
  visibilityLabel: string
  privacyMode: string
  memoryKeywords: string[]
  visibleTo: UserMomentDistributionCharacterRef[]
  hiddenFrom: UserMomentDistributionCharacterRef[]
  /** 点赞名单（面板展示用，含全部互动） */
  likes: string[]
  /** 评论明细（面板展示用，含全部互动） */
  comments: UserMomentDistributionCommentRef[]
  /** 序列化互动摘要（与角色记忆内格式一致） */
  interactionsSnapshot: string
}

function kvKey(accountId: string): string {
  return `wechat-user-moment-distribution-v1:${accountId.trim()}`
}

function normalizeRecord(raw: unknown): UserMomentDistributionRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const momentId = typeof o.momentId === 'string' ? o.momentId.trim() : ''
  if (!momentId) return null
  const mapRefs = (arr: unknown): UserMomentDistributionCharacterRef[] => {
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => {
        if (!x || typeof x !== 'object') return null
        const r = x as Record<string, unknown>
        const charId = typeof r.charId === 'string' ? r.charId.trim() : ''
        const displayName = typeof r.displayName === 'string' ? r.displayName.trim() : ''
        if (!charId) return null
        return { charId, displayName: displayName || '未命名' }
      })
      .filter((x): x is UserMomentDistributionCharacterRef => !!x)
  }
  const mapComments = (arr: unknown): UserMomentDistributionCommentRef[] => {
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => {
        if (!x || typeof x !== 'object') return null
        const r = x as Record<string, unknown>
        const authorName = typeof r.authorName === 'string' ? r.authorName.trim() : ''
        const content = typeof r.content === 'string' ? r.content.trim() : ''
        if (!authorName || !content) return null
        const replyToName =
          typeof r.replyToName === 'string' && r.replyToName.trim() ? r.replyToName.trim() : undefined
        return { authorName, content, ...(replyToName ? { replyToName } : {}) }
      })
      .filter((x): x is UserMomentDistributionCommentRef => !!x)
  }
  const likes = Array.isArray(o.likes)
    ? o.likes.map((x) => String(x ?? '').trim()).filter(Boolean)
    : []
  return {
    momentId,
    updatedAt: Number(o.updatedAt) || 0,
    publishedAt: Number(o.publishedAt) || 0,
    previewText: typeof o.previewText === 'string' ? o.previewText : '',
    isPinned: o.isPinned === true,
    visibilityLabel: typeof o.visibilityLabel === 'string' ? o.visibilityLabel : '',
    privacyMode: typeof o.privacyMode === 'string' ? o.privacyMode : '',
    memoryKeywords: Array.isArray(o.memoryKeywords)
      ? o.memoryKeywords.map((k) => String(k ?? '').trim()).filter(Boolean)
      : [],
    visibleTo: mapRefs(o.visibleTo),
    hiddenFrom: mapRefs(o.hiddenFrom),
    likes,
    comments: mapComments(o.comments),
    interactionsSnapshot: typeof o.interactionsSnapshot === 'string' ? o.interactionsSnapshot : '',
  }
}

export async function loadUserMomentDistributionRecords(
  accountId: string | null | undefined,
): Promise<UserMomentDistributionRecord[]> {
  const acc = accountId?.trim()
  if (!acc) return []
  try {
    const raw = await personaDb.getPhoneKv(kvKey(acc))
    if (!Array.isArray(raw)) return []
    return raw
      .map(normalizeRecord)
      .filter((x): x is UserMomentDistributionRecord => !!x)
      .sort((a, b) => b.updatedAt - a.updatedAt || b.publishedAt - a.publishedAt)
  } catch {
    return []
  }
}

export async function upsertUserMomentDistributionRecord(
  accountId: string | null | undefined,
  record: UserMomentDistributionRecord,
): Promise<void> {
  const acc = accountId?.trim()
  if (!acc) return
  const all = await loadUserMomentDistributionRecords(acc)
  const next = [record, ...all.filter((r) => r.momentId !== record.momentId)]
  await personaDb.setPhoneKv(kvKey(acc), next)
  emitWeChatStorageChanged()
}

export async function removeUserMomentDistributionRecord(
  accountId: string | null | undefined,
  momentId: string,
): Promise<void> {
  const acc = accountId?.trim()
  const id = momentId.trim()
  if (!acc || !id) return
  const all = await loadUserMomentDistributionRecords(acc)
  const next = all.filter((r) => r.momentId !== id)
  await personaDb.setPhoneKv(kvKey(acc), next)
  emitWeChatStorageChanged()
}

export async function clearAllUserMomentDistributionRecords(
  accountId: string | null | undefined,
): Promise<void> {
  const acc = accountId?.trim()
  if (!acc) return
  await personaDb.setPhoneKv(kvKey(acc), [])
  emitWeChatStorageChanged()
}
