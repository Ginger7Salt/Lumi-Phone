import type { AiMomentInteractionDraft, MomentInteraction } from './momentInteractionTypes'

/** 浏览后多久点赞 */
export const MOMENT_LIKE_AFTER_VIEW_SECONDS = 8
/** 点赞后多久出现评论（模拟打字） */
export const MOMENT_COMMENT_AFTER_LIKE_SECONDS = 10
/** 同角色连续多条评论的间隔 */
export const MOMENT_COMMENT_CHAIN_SECONDS = 8

function clampDelay(seconds: number, min = 5, max = 7200): number {
  const n = Number.isFinite(seconds) ? seconds : min
  return Math.max(min, Math.min(max, Math.round(n)))
}

function draftKey(d: Pick<AiMomentInteractionDraft, 'charId' | 'type' | 'content'>): string {
  return `${d.charId.trim()}:${d.type}:${d.content?.trim() ?? ''}`
}

/**
 * 同一角色的 viewed → like → comment 按连贯时间轴排列：
 * 先刷到、约 8s 后点赞、再约 10s 后评论（打字），避免点赞与评论相隔数分钟。
 */
export function alignCharacterInteractionTiming(
  drafts: AiMomentInteractionDraft[],
): AiMomentInteractionDraft[] {
  if (!drafts.length) return drafts

  const byChar = new Map<string, AiMomentInteractionDraft[]>()
  for (const d of drafts) {
    const id = d.charId.trim()
    if (!id) continue
    const list = byChar.get(id) ?? []
    list.push({ ...d })
    byChar.set(id, list)
  }

  const charOrder = [...byChar.keys()].sort((a, b) => {
    const minA = Math.min(...byChar.get(a)!.map((x) => x.delaySeconds))
    const minB = Math.min(...byChar.get(b)!.map((x) => x.delaySeconds))
    return minA - minB || a.localeCompare(b)
  })

  const result: AiMomentInteractionDraft[] = []

  for (const charId of charOrder) {
    const charDrafts = byChar.get(charId)!
    const viewed = charDrafts.filter((d) => d.type === 'viewed')
    const likes = charDrafts.filter((d) => d.type === 'like')
    const comments = charDrafts.filter((d) => d.type === 'comment')

    const originalAnchor = Math.min(...charDrafts.map((d) => d.delaySeconds))
    let anchor = clampDelay(originalAnchor, 15)

    if (likes.length > 0 && comments.length > 0) {
      const earliestComment = Math.min(...comments.map((c) => c.delaySeconds))
      const earliestLike = Math.min(...likes.map((l) => l.delaySeconds))
      anchor = clampDelay(
        Math.min(originalAnchor, earliestLike, earliestComment - MOMENT_COMMENT_AFTER_LIKE_SECONDS),
        15,
      )
    }

    if (viewed.length > 0) {
      const v = { ...viewed[0]! }
      v.delaySeconds = clampDelay(Math.min(v.delaySeconds, anchor), 10)
      anchor = v.delaySeconds
      result.push(v)
    }

    for (let i = 0; i < likes.length; i++) {
      const like = { ...likes[i]! }
      if (viewed.length > 0) {
        like.delaySeconds = clampDelay(
          anchor + (i === 0 ? MOMENT_LIKE_AFTER_VIEW_SECONDS : 2),
          10,
        )
      } else if (comments.length > 0) {
        like.delaySeconds = clampDelay(anchor, 15)
      } else {
        like.delaySeconds = clampDelay(like.delaySeconds, 15)
      }
      anchor = like.delaySeconds
      result.push(like)
    }

    for (let i = 0; i < comments.length; i++) {
      const comment = { ...comments[i]! }
      if (likes.length > 0 || viewed.length > 0) {
        const gap = i === 0 ? MOMENT_COMMENT_AFTER_LIKE_SECONDS : MOMENT_COMMENT_CHAIN_SECONDS
        comment.delaySeconds = clampDelay(anchor + gap, 10)
      } else {
        comment.delaySeconds = clampDelay(comment.delaySeconds, 20)
      }
      anchor = comment.delaySeconds
      result.push(comment)
    }
  }

  return result
}

/** 已物化的互动：按同角色连贯规则重算 visibleAt（保留 id 与回复链字段） */
export function realignInteractionVisibleAt(
  interactions: MomentInteraction[],
  publishedAt: number,
): MomentInteraction[] {
  if (!interactions.length) return interactions

  const drafts: AiMomentInteractionDraft[] = interactions.map((ix) => ({
    charId: ix.charId,
    type: ix.type,
    content: ix.content,
    delaySeconds: Math.max(0, Math.round((ix.visibleAt - publishedAt) / 1000)),
    dwellSeconds: ix.dwellSeconds,
    replyToCharId: ix.replyToCharId,
  }))

  const aligned = alignCharacterInteractionTiming(drafts)
  const pools = new Map<string, AiMomentInteractionDraft[]>()
  for (const d of aligned) {
    const key = draftKey(d)
    const list = pools.get(key) ?? []
    list.push(d)
    pools.set(key, list)
  }

  return interactions.map((ix) => {
    const key = draftKey({
      charId: ix.charId,
      type: ix.type,
      content: ix.content,
    })
    const draft = pools.get(key)?.shift()
    if (!draft) return ix
    return {
      ...ix,
      visibleAt: publishedAt + draft.delaySeconds * 1000,
    }
  })
}
