import type { MomentItemModel } from './mockMoments'
import type { AiMomentInteractionDraft, MomentInteraction } from './momentInteractionTypes'
import {
  collectEngagedCharacterIds,
  materializeInteractions,
  stripViewedForEngagedCharacters,
} from './momentInteractionTypes'
import type { AllowedMomentCharacter } from './momentPrivacyAudience'
import type { MomentPrivacyMeta, NewMomentPrivacy } from './newMomentTypes'

/** 将持久化的 privacy 还原为发布时筛选用的结构 */
export function privacyMetaToDraftPrivacy(meta: MomentPrivacyMeta | undefined): NewMomentPrivacy {
  if (!meta) return { mode: 'public', contacts: [] }
  return {
    mode: meta.mode,
    contacts: meta.visibleToOnly ?? meta.hiddenFrom ?? [],
    selectedTagIds: meta.selectedTagIds,
    selectedContactIds: meta.selectedContactIds,
    audience: meta.audience,
  }
}

export function momentHasVisitorFootprints(moment: MomentItemModel): boolean {
  return (moment.interactions ?? []).some((ix) => ix.type === 'viewed')
}

export function momentNeedsVisitorFootprintBackfill(moment: MomentItemModel): boolean {
  if (!moment.isUserAuthored) return false
  if (moment.privacy?.mode === 'private') return false
  return !momentHasVisitorFootprints(moment)
}

function ensureAtLeastOneViewedDraft(
  drafts: AiMomentInteractionDraft[],
  allowed: AllowedMomentCharacter[],
): AiMomentInteractionDraft[] {
  if (!allowed.length) return drafts

  const engaged = collectEngagedCharacterIds(drafts)
  const hasSilentViewed = drafts.some(
    (d) => d.type === 'viewed' && !engaged.has(d.charId.trim()),
  )
  if (hasSilentViewed) return drafts

  const pick = allowed.find((c) => !engaged.has(c.charId.trim()))
  if (!pick) return drafts

  const out = [...drafts]
  out.push({
    charId: pick.charId,
    type: 'viewed',
    delaySeconds: 100,
    dwellSeconds: 14,
  })
  return out
}

/**
 * 为未点赞/未评论的角色补充静默浏览（viewed），不调用模型。
 */
export function supplementVisitorFootprintDrafts(
  drafts: AiMomentInteractionDraft[],
  allowed: AllowedMomentCharacter[],
): AiMomentInteractionDraft[] {
  if (!allowed.length) return drafts

  const out = [...drafts]
  const engaged = new Set(
    out.filter((d) => d.type === 'like' || d.type === 'comment').map((d) => d.charId.trim()),
  )
  const viewedCharIds = new Set(out.filter((d) => d.type === 'viewed').map((d) => d.charId.trim()))

  const silentCandidates = allowed.filter(
    (c) => !engaged.has(c.charId) && !viewedCharIds.has(c.charId),
  )

  for (let i = 0; i < silentCandidates.length; i++) {
    const c = silentCandidates[i]!
    out.push({
      charId: c.charId,
      type: 'viewed',
      delaySeconds: 90 + i * 65,
      dwellSeconds: 10 + ((c.charId.length + i * 7) % 35),
    })
    viewedCharIds.add(c.charId)
  }

  return ensureAtLeastOneViewedDraft(out, allowed)
}

/** 发布链路收尾：为未互动角色补充静默浏览（viewed），与展示开关无关 */
export function finalizeMomentInteractionDrafts(
  drafts: AiMomentInteractionDraft[],
  allowed: AllowedMomentCharacter[],
): AiMomentInteractionDraft[] {
  if (!allowed.length) return stripViewedForEngagedCharacters(drafts)
  return stripViewedForEngagedCharacters(supplementVisitorFootprintDrafts(drafts, allowed))
}

/** 为已有动态追加 viewed 互动（补录历史数据） */
export function appendVisitorFootprintInteractions(
  moment: MomentItemModel,
  allowed: AllowedMomentCharacter[],
  immediate: boolean,
): MomentInteraction[] {
  if (!allowed.length) return []

  const existing = moment.interactions ?? []
  if (existing.some((ix) => ix.type === 'viewed')) return []

  const existingDrafts: AiMomentInteractionDraft[] = existing.map((ix, index) => ({
    charId: ix.charId,
    type: ix.type,
    content: ix.content,
    delaySeconds:
      Number.isFinite(moment.timestamp) && moment.timestamp > 0
        ? Math.max(0, Math.round((ix.visibleAt - moment.timestamp) / 1000))
        : 60 + index * 30,
    dwellSeconds: ix.dwellSeconds,
  }))

  const supplemented = supplementVisitorFootprintDrafts(existingDrafts, allowed)
  const newViewedDrafts = supplemented.filter(
    (d) =>
      d.type === 'viewed' &&
      !existing.some((e) => e.type === 'viewed' && e.charId.trim() === d.charId.trim()),
  )

  if (!newViewedDrafts.length) return []

  const publishedAt =
    Number.isFinite(moment.timestamp) && moment.timestamp > 0 ? moment.timestamp : Date.now()

  return materializeInteractions(newViewedDrafts, publishedAt, immediate)
}

export function mergeMomentInteractions(
  base: MomentInteraction[] | undefined,
  extra: MomentInteraction[],
): MomentInteraction[] {
  if (!extra.length) return base ?? []
  return [...(base ?? []), ...extra]
}
