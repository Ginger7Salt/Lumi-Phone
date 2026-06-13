import type { AiMomentInteractionDraft, MomentInteraction } from './momentInteractionTypes'

/** 异步延时互动：单条解锁相对发圈时刻的上限（10 分钟） */
export const MOMENT_INTERACTION_DELAY_MAX_SECONDS = 600
/** 异步延时互动：单条解锁相对发圈时刻的下限 */
export const MOMENT_INTERACTION_DELAY_MIN_SECONDS = 30
/** 不同角色之间至少间隔（各自刷朋友圈） */
export const MOMENT_CROSS_CHARACTER_GAP_SECONDS = 55
/** 评区接话：相对被回复 comment 的间隔 */
export const MOMENT_THREAD_REPLY_GAP_SECONDS = 42

/** 浏览后多久点赞（同角色连贯动作） */
export const MOMENT_LIKE_AFTER_VIEW_SECONDS = 10
/** 点赞后多久出现评论（同角色连贯动作） */
export const MOMENT_COMMENT_AFTER_LIKE_SECONDS = 12
/** 同角色连续多条 comment 的间隔 */
export const MOMENT_COMMENT_CHAIN_SECONDS = 12

export function clampMomentInteractionDelay(
  seconds: number,
  min = MOMENT_INTERACTION_DELAY_MIN_SECONDS,
): number {
  const n = Number.isFinite(seconds) ? seconds : min
  return Math.max(min, Math.min(MOMENT_INTERACTION_DELAY_MAX_SECONDS, Math.round(n)))
}

function clampDelay(
  seconds: number,
  min = MOMENT_INTERACTION_DELAY_MIN_SECONDS,
  max = MOMENT_INTERACTION_DELAY_MAX_SECONDS,
): number {
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

/**
 * 不同角色的首条互动错开，避免 A 刚评完 B 立刻接上（模拟各自刷圈）。
 */
export function staggerCrossCharacterDelays(
  drafts: AiMomentInteractionDraft[],
): AiMomentInteractionDraft[] {
  if (drafts.length <= 1) return drafts

  const out = drafts.map((d) => ({ ...d }))
  const byChar = new Map<string, AiMomentInteractionDraft[]>()
  for (const d of out) {
    const id = d.charId.trim()
    if (!id) continue
    const list = byChar.get(id) ?? []
    list.push(d)
    byChar.set(id, list)
  }

  const charOrder = [...byChar.keys()].sort((a, b) => {
    const minA = Math.min(...byChar.get(a)!.map((x) => x.delaySeconds))
    const minB = Math.min(...byChar.get(b)!.map((x) => x.delaySeconds))
    return minA - minB || a.localeCompare(b)
  })

  let nextAvailable = MOMENT_INTERACTION_DELAY_MIN_SECONDS
  for (const charId of charOrder) {
    const charDrafts = byChar.get(charId)!
    const charMin = Math.min(...charDrafts.map((d) => d.delaySeconds))
    const shift = Math.max(0, nextAvailable - charMin)
    if (shift > 0) {
      for (const d of charDrafts) {
        d.delaySeconds = clampMomentInteractionDelay(d.delaySeconds + shift)
      }
    }
    const charMax = Math.max(...charDrafts.map((d) => d.delaySeconds))
    nextAvailable = clampMomentInteractionDelay(charMax + MOMENT_CROSS_CHARACTER_GAP_SECONDS)
  }

  return out
}

/**
 * 评区回复须晚于被回复角色的上一条 comment（跨角色接话时间轴）。
 * 多轮扫描：每轮先处理首评再处理接话，直到接话 delay 全部晚于被回复者。
 */
export function alignThreadedCommentDelays(
  drafts: AiMomentInteractionDraft[],
): AiMomentInteractionDraft[] {
  if (!drafts.length) return drafts

  const out = drafts.map((d) => ({ ...d }))
  const commentDrafts = out.filter((d) => d.type === 'comment')
  if (!commentDrafts.length) return out

  const maxPasses = Math.max(2, commentDrafts.length)
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false
    const lastCommentDelayByChar = new Map<string, number>()

    const roots = commentDrafts.filter((d) => !d.replyToCharId?.trim())
    const replies = commentDrafts.filter((d) => d.replyToCharId?.trim())
    const ordered = [
      ...roots.sort(
        (a, b) => a.delaySeconds - b.delaySeconds || a.charId.localeCompare(b.charId),
      ),
      ...replies.sort(
        (a, b) => a.delaySeconds - b.delaySeconds || a.charId.localeCompare(b.charId),
      ),
    ]

    for (const d of ordered) {
      const charId = d.charId.trim()
      const replyTo = d.replyToCharId?.trim()
      if (replyTo) {
        const parentDelay = lastCommentDelayByChar.get(replyTo)
        if (parentDelay != null) {
          const next = clampDelay(
            Math.max(d.delaySeconds, parentDelay + MOMENT_THREAD_REPLY_GAP_SECONDS),
            MOMENT_INTERACTION_DELAY_MIN_SECONDS,
          )
          if (next !== d.delaySeconds) {
            d.delaySeconds = next
            changed = true
          }
        }
      }
      const prev = lastCommentDelayByChar.get(charId)
      lastCommentDelayByChar.set(
        charId,
        prev != null ? Math.max(prev, d.delaySeconds) : d.delaySeconds,
      )
    }

    if (!changed) break
  }

  return out
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

  const aligned = alignThreadedCommentDelays(
    staggerCrossCharacterDelays(alignCharacterInteractionTiming(drafts)),
  )
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
