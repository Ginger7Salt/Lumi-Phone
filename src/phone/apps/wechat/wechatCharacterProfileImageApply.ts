import type { WeChatImageMime } from './newFriendsPersona/types'
import { emitWeChatStorageChanged, personaDb } from './newFriendsPersona/idb'
import type { Character } from './newFriendsPersona/types'

import {
  applyProfileImageUrlChange,
  resolveProfileImageRestoreUrl,
} from './wechatCharacterProfileImageHistory'

export type CharacterProfileImageApplyTarget = 'avatar' | 'momentsCover'

export type CharacterProfileImageAction =
  | { kind: 'userImage'; target: CharacterProfileImageApplyTarget }
  | { kind: 'restore'; target: CharacterProfileImageApplyTarget; restoreKey: string }

const AVATAR_DIRECTIVE_RE = /^\[(?:换头像|SET_AVATAR|SETAVATAR)\]\s*$/i
const MOMENTS_COVER_DIRECTIVE_RE =
  /^\[(?:换朋友圈背景|换朋友圈封面|SET_MOMENTS_COVER|SETMOMENTSCOVER)\]\s*$/i
const RESTORE_AVATAR_DIRECTIVE_RE =
  /^\[(?:恢复头像|RESTORE_AVATAR)\|([^\]]+)\]\s*$/i
const RESTORE_COVER_DIRECTIVE_RE =
  /^\[(?:恢复朋友圈背景|恢复朋友圈封面|RESTORE_MOMENTS_COVER)\|([^\]]+)\]\s*$/i

export {
  buildCharacterProfileImageCatalogBlock,
  buildCharacterSelfProfileVisionParts,
} from './wechatCharacterProfileImageHistory'

export function parseCharacterProfileImageApplyDirective(
  line: string,
): CharacterProfileImageApplyTarget | null {
  const t = String(line ?? '').trim()
  if (!t) return null
  if (AVATAR_DIRECTIVE_RE.test(t)) return 'avatar'
  if (MOMENTS_COVER_DIRECTIVE_RE.test(t)) return 'momentsCover'
  return null
}

function parseCharacterProfileImageAction(line: string): CharacterProfileImageAction | null {
  const t = String(line ?? '').trim()
  if (!t) return null
  const userAvatar = parseCharacterProfileImageApplyDirective(t)
  if (userAvatar) return { kind: 'userImage', target: userAvatar }
  const restoreAvatar = RESTORE_AVATAR_DIRECTIVE_RE.exec(t)
  if (restoreAvatar?.[1]?.trim()) {
    return { kind: 'restore', target: 'avatar', restoreKey: restoreAvatar[1].trim() }
  }
  const restoreCover = RESTORE_COVER_DIRECTIVE_RE.exec(t)
  if (restoreCover?.[1]?.trim()) {
    return { kind: 'restore', target: 'momentsCover', restoreKey: restoreCover[1].trim() }
  }
  return null
}

export function filterCharacterProfileImageApplyDirectives(bubbles: string[]): {
  bubbles: string[]
  targets: CharacterProfileImageApplyTarget[]
} {
  const filtered = filterCharacterProfileImageActions(bubbles)
  return {
    bubbles: filtered.bubbles,
    targets: filtered.actions
      .filter((a): a is Extract<CharacterProfileImageAction, { kind: 'userImage' }> => a.kind === 'userImage')
      .map((a) => a.target),
  }
}

export function filterCharacterProfileImageActions(bubbles: string[]): {
  bubbles: string[]
  actions: CharacterProfileImageAction[]
} {
  const actions: CharacterProfileImageAction[] = []
  const next = bubbles.filter((line) => {
    const action = parseCharacterProfileImageAction(line)
    if (!action) return true
    actions.push(action)
    return false
  })
  return { bubbles: next, actions }
}

export function buildUserImageDataUrl(base64: string, mime: WeChatImageMime = 'image/jpeg'): string {
  const b64 = String(base64 ?? '')
    .trim()
    .replace(/^data:image\/(?:jpeg|png|gif|webp);base64,/i, '')
  if (!b64) return ''
  const safeMime = mime || 'image/jpeg'
  return `data:${safeMime};base64,${b64}`
}

/** 用户发图配文时的意图提示，帮助模型输出 `[换头像]` / `[换朋友圈背景]` */
export function buildUserImageProfileApplyCaptionBias(caption?: string | null): string {
  const t = String(caption ?? '').trim()
  if (!t) return ''
  const wantsChange = /换|设|当|用|改成|改为|当作|做你的|当你的/.test(t)
  if (!wantsChange) return ''
  if (/头像|profile\s*pic|avatar/i.test(t)) {
    return `[系统提示] 用户刚发来的图片，并希望你把这张图设为**你的微信头像**。若你愿意：先用 1～2 句自然口语回应（可带一点害羞/开心/犹豫），再**单独占一行**输出 \`[换头像]\`（整行只有这 5 个字，不要加其它说明）。若你不愿或觉得不合适，只文字婉拒，**不要**输出该指令。`
  }
  if (/朋友圈.*(?:背景|封面)|封面图|背景图|moments?\s*cover/i.test(t)) {
    return `[系统提示] 用户刚发来的图片，并希望你把这张图设为**你的朋友圈背景/封面**。若你愿意：先用 1～2 句自然口语回应，再**单独占一行**输出 \`[换朋友圈背景]\`（整行只有这 7 个字）。若你不愿，只文字婉拒，**不要**输出该指令。`
  }
  return ''
}

/** 用户要求恢复历史/原始头像或背景时的意图提示 */
export function buildUserProfileImageRestoreBias(message?: string | null): string {
  const t = String(message ?? '').trim()
  if (!t) return ''
  const wantsAvatar =
    /原始头像|原来的头像|换回.*头像|恢复.*头像|换回头像|之前.*头像|历史头像/i.test(t)
  const wantsCover =
    /原始.*(?:朋友圈|背景|封面)|原来的.*(?:朋友圈|背景|封面)|换回.*(?:朋友圈|背景|封面)|恢复.*(?:朋友圈|背景|封面)/i.test(
      t,
    )
  if (!wantsAvatar && !wantsCover) return ''
  const parts: string[] = []
  if (wantsAvatar) {
    parts.push(
      '若用户请你换回**原始/历史微信头像**：愿意则口语回应，再**单独一行**输出 `[恢复头像|original]`（原始）或 `[恢复头像|1]`（历史列表序号，见【你的微信头像/朋友圈背景·当前与历史】）。不愿则只文字婉拒。',
    )
  }
  if (wantsCover) {
    parts.push(
      '若用户请你换回**原始/历史朋友圈背景**：愿意则口语回应，再**单独一行**输出 `[恢复朋友圈背景|original]` 或 `[恢复朋友圈背景|1]`。不愿则只文字婉拒。',
    )
  }
  return `[系统提示] 用户本轮提到了恢复资料图。${parts.join(' ')}`
}

export const WECHAT_CHARACTER_PROFILE_IMAGE_APPLY_APPENDIX = `
---------------------
【你的微信头像 / 朋友圈背景 · 可见与更换】
---------------------
客户端会在对话前注入你**当前**的微信头像与朋友圈主页背景图（若模型支持识图，请据此了解自己的线上形象；看不清勿编造）。
【你的微信头像 / 朋友圈背景 · 当前与历史】块列出可恢复的 original 与序号；换图后旧图会自动存档。

■ 用户发图更换（须你愿意）
当用户**明确**要求你把「刚收到的那张图」设为微信头像或朋友圈背景时：
- 先像真人一样用 **1～2 句**口语回应。
- 若你**同意**更换：在可见回复中**另起一行**，整行**只**输出：
  - 换头像：\`[换头像]\`
  - 换朋友圈背景/封面：\`[换朋友圈背景]\`
- 客户端会用**用户刚发来的那张图**写入你的资料；**不要**编造 URL，**不要**用 \`[图片]\` 假装已换。
- 若你不愿或图片不合适：只文字婉拒，**禁止**输出上述指令。

■ 恢复原始 / 历史图（须你愿意）
当用户要求换回**原始**或**以前用过**的头像/背景，或你自己想换回时：
- 先 1～2 句口语回应（可带一点怀旧/犹豫）。
- 同意则**另起一行**输出（整行仅此指令）：
  - \`[恢复头像|original]\` 或 \`[恢复头像|1]\`（数字见历史列表）
  - \`[恢复朋友圈背景|original]\` 或 \`[恢复朋友圈背景|1]\`
- 与当前完全相同时不要输出恢复指令。
- 用户没提、你也无更换/恢复意愿时，**不要**主动输出这些指令。
`.trim()

export const WECHAT_CHARACTER_PROFILE_IMAGE_APPLY_IMAGE_ROUND_HINT = `
若用户本轮发来图片并明确要求你把该图设为头像或朋友圈背景：同意时在口语回应后**另起一行**输出 \`[换头像]\` 或 \`[换朋友圈背景]\`（整行仅此指令）；不同意则只文字婉拒。
`.trim()

export async function applyUserImageToCharacterProfile(params: {
  characterId: string
  target: CharacterProfileImageApplyTarget
  imageBase64: string
  imageMime?: WeChatImageMime
}): Promise<Character | null> {
  const cid = params.characterId.trim()
  if (!cid) return null
  const dataUrl = buildUserImageDataUrl(params.imageBase64, params.imageMime)
  if (!dataUrl) return null
  const ch = await personaDb.getCharacter(cid)
  if (!ch) return null
  const next = applyProfileImageUrlChange(ch, params.target, dataUrl)
  if (next.avatarUrl === ch.avatarUrl && next.momentsCoverUrl === ch.momentsCoverUrl) return null
  await personaDb.upsertCharacter(next)
  emitWeChatStorageChanged()
  return next
}

export async function applyCharacterProfileImageRestore(params: {
  characterId: string
  target: CharacterProfileImageApplyTarget
  restoreKey: string
}): Promise<Character | null> {
  const cid = params.characterId.trim()
  if (!cid) return null
  const ch = await personaDb.getCharacter(cid)
  if (!ch) return null
  const url = resolveProfileImageRestoreUrl(ch, params.target, params.restoreKey)
  if (!url) return null
  const next = applyProfileImageUrlChange(ch, params.target, url)
  if (next.avatarUrl === ch.avatarUrl && next.momentsCoverUrl === ch.momentsCoverUrl) return null
  await personaDb.upsertCharacter(next)
  emitWeChatStorageChanged()
  return next
}

export async function stripAndApplyCharacterProfileImageActions(params: {
  characterId: string
  bubbles: string[]
  userImage?: { base64: string; mime: WeChatImageMime } | null
}): Promise<{
  bubbles: string[]
  updated: Character | null
  avatarChanged: boolean
  coverChanged: boolean
}> {
  const filtered = filterCharacterProfileImageActions(params.bubbles)
  if (!filtered.actions.length) {
    return { bubbles: filtered.bubbles, updated: null, avatarChanged: false, coverChanged: false }
  }

  let latest: Character | null = null
  let avatarChanged = false
  let coverChanged = false

  for (const action of filtered.actions) {
    if (action.kind === 'userImage') {
      if (!params.userImage?.base64?.trim()) continue
      const updated = await applyUserImageToCharacterProfile({
        characterId: params.characterId,
        target: action.target,
        imageBase64: params.userImage.base64,
        imageMime: params.userImage.mime,
      })
      if (!updated) continue
      latest = updated
      if (action.target === 'avatar') avatarChanged = true
      else coverChanged = true
      continue
    }

    const updated = await applyCharacterProfileImageRestore({
      characterId: params.characterId,
      target: action.target,
      restoreKey: action.restoreKey,
    })
    if (!updated) continue
    latest = updated
    if (action.target === 'avatar') avatarChanged = true
    else coverChanged = true
  }

  return { bubbles: filtered.bubbles, updated: latest, avatarChanged, coverChanged }
}
