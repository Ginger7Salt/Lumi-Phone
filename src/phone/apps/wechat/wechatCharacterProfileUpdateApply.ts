import type { Character } from './newFriendsPersona/types'
import { emitWeChatStorageChanged, personaDb } from './newFriendsPersona/idb'

const WECHAT_NICK_MAX = 12
const WECHAT_SIG_MAX = 22

const NICK_DIRECTIVE_RE =
  /^\[(?:改微信昵称|SET_WECHAT_NICKNAME|SETWECHATNICKNAME)\](?:\s*(\{[\s\S]*\}))?\s*$/i
const SIG_DIRECTIVE_RE =
  /^\[(?:改个性签名|SET_WECHAT_SIGNATURE|SETWECHATSIGNATURE)\](?:\s*(\{[\s\S]*\}))?\s*$/i
const PROFILE_DIRECTIVE_RE =
  /^\[(?:改微信资料|SET_WECHAT_PROFILE|SETWECHATPROFILE)\](?:\s*(\{[\s\S]*\}))?\s*$/i

export type CharacterWechatProfileUpdateDirective = {
  nickname?: string
  signature?: string
}

function clampNick(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > WECHAT_NICK_MAX ? t.slice(0, WECHAT_NICK_MAX) : t
}

function clampSig(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > WECHAT_SIG_MAX ? t.slice(0, WECHAT_SIG_MAX) : t
}

function nicknameIsLegalNameClone(nick: string, c: Character): boolean {
  const name = (c.name || '').trim()
  if (!name || !nick) return false
  if (nick === name) return true
  if (name.length >= 2 && nick === name.slice(0, 2)) return true
  if (name.length > 1 && nick.length === 1 && /^[\u4e00-\u9fff]$/.test(nick) && name.startsWith(nick)) {
    return true
  }
  return false
}

function isPlausibleWechatNickname(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length >= 1 && t.length <= WECHAT_NICK_MAX
}

function parseDirectivePayload(raw?: string | null): CharacterWechatProfileUpdateDirective {
  const jsonRaw = String(raw ?? '').trim()
  if (!jsonRaw) return {}
  try {
    const j = JSON.parse(jsonRaw) as {
      nickname?: unknown
      nick?: unknown
      signature?: unknown
      sig?: unknown
      sign?: unknown
    }
    const nickname = clampNick(String(j.nickname ?? j.nick ?? '').trim())
    const signature = clampSig(String(j.signature ?? j.sig ?? j.sign ?? '').trim())
    return {
      ...(nickname ? { nickname } : {}),
      ...(signature ? { signature } : {}),
    }
  } catch {
    return {}
  }
}

export function parseCharacterWechatProfileUpdateDirective(
  line: string,
): CharacterWechatProfileUpdateDirective | null {
  const t = String(line ?? '').trim()
  if (!t) return null
  const nickMatch = NICK_DIRECTIVE_RE.exec(t)
  if (nickMatch) {
    const payload = parseDirectivePayload(nickMatch[1])
    if (!payload.nickname) return null
    return { nickname: payload.nickname }
  }
  const sigMatch = SIG_DIRECTIVE_RE.exec(t)
  if (sigMatch) {
    const payload = parseDirectivePayload(sigMatch[1])
    if (!payload.signature) return null
    return { signature: payload.signature }
  }
  const profileMatch = PROFILE_DIRECTIVE_RE.exec(t)
  if (profileMatch) {
    const payload = parseDirectivePayload(profileMatch[1])
    if (!payload.nickname && !payload.signature) return null
    return payload
  }
  return null
}

export function filterCharacterWechatProfileUpdateDirectives(bubbles: string[]): {
  bubbles: string[]
  directives: CharacterWechatProfileUpdateDirective[]
} {
  const directives: CharacterWechatProfileUpdateDirective[] = []
  const next = bubbles.filter((line) => {
    const directive = parseCharacterWechatProfileUpdateDirective(line)
    if (!directive) return true
    directives.push(directive)
    return false
  })
  return { bubbles: next, directives }
}

export function buildCharacterWechatProfileStateBlock(
  character: Character | null | undefined,
): string {
  if (!character?.id?.trim()) return ''
  const nick = character.wechatNickname?.trim() || '（未设置）'
  const sig = character.wechatSignature?.trim() || '（未设置）'
  return `【你的微信资料 · 当前状态】
微信昵称：${nick}
个性签名：${sig}
说明：个性签名**不会**出现在私聊气泡里；只有对方点进你的**个人朋友圈主页**（封面下方）才能看见。你可随关系进展、心情或人设自行更换；不少角色会长期保留同一句——**不必每轮都改**，有真正理由再改更自然。`
}

/** 用户消息里提及改昵称/签名时的意图提示 */
export function buildUserWechatProfileUpdateBias(message?: string | null): string {
  const t = String(message ?? '').trim()
  if (!t) return ''
  const mentionsNick = /微信昵称|改昵称|换昵称|昵称改成|网名/i.test(t)
  const mentionsSig = /个性签名|个签|改签名|换签名|签名改成/i.test(t)
  if (!mentionsNick && !mentionsSig) return ''
  const parts: string[] = []
  if (mentionsNick) {
    parts.push(
      '若用户是在请你改**微信昵称**：愿意则先 1～2 句口语回应，再**单独一行**输出 `[改微信昵称]{"nickname":"新昵称"}`（1～12 字，勿等于档案姓名）；不愿则只文字婉拒，不要输出指令。',
    )
  }
  if (mentionsSig) {
    parts.push(
      '若用户是在请你改**个性签名**：愿意则先口语回应，再**单独一行**输出 `[改个性签名]{"signature":"新签名"}`（≤22 字，仅展示在个人朋友圈主页）；不愿则只文字婉拒，不要输出指令。',
    )
  }
  return `[系统提示] 用户本轮提到了微信资料变更。${parts.join(' ')}`
}

export const WECHAT_CHARACTER_PROFILE_UPDATE_APPENDIX = `
---------------------
【微信昵称 / 个性签名（可选 · 每轮可用）】
---------------------
你可在**任意一轮**私聊回复中，自行决定是否更新自己的微信昵称或个性签名（也可两者一起改）。**默认大多数轮次不必改**——只有关系、心情或剧情出现**值得对外展示的变化**时再改，才像真人。

■ 个性签名是什么、谁能看见
- 个性签名**不会**出现在私聊聊天气泡里。
- 只有用户或其他角色点进你的**个人朋友圈主页**（封面图下方、昵称下面那一行）才能看到。
- 因此签名更像「对外展示的半公开状态」，可写关系宣言、心情碎片、摆烂一句等；不必在聊天里复读签名内容。

■ 何时值得改（结合人设，勿机械每轮改）
- **昵称**：关系确认后的小甜蜜（如「某某的对象」）、心情转折、玩梗改名；勿把档案**姓名**原样或仅姓氏当昵称。
- **签名**：确定关系后可换成「爱老婆」「爱宝宝」等（须贴合人设与当前关系）；也可写极简留白、上班摸鱼、反内耗等。
- **人设差异**：有的角色签名只留**一句有意义的话**、几年不换；有的爱随手改——按你的性格与世界书判断，**没有充分理由就保持现状**。

■ 怎么输出（与口语回复同轮）
- 先像真人一样用 **0～2 句**口语带过（也可静默直接改，视性格而定），**不要**写成教程。
- 需要改时，在可见回复中**另起一行**，整行**只**输出以下指令之一（JSON 内字符串勿换行）：
  - 只改昵称：\`[改微信昵称]{"nickname":"新昵称"}\`（1～12 字）
  - 只改签名：\`[改个性签名]{"signature":"新签名"}\`（≤22 字，一句话）
  - 同时改：\`[改微信资料]{"nickname":"…","signature":"…"}\`（可只填其中一项）
- 新内容与当前资料**完全相同**时不要输出指令。
- 用户明确要求你改、或你主动想改时均可；用户没提、你也无改的动力时，**不要**为了刷存在感乱改。
`.trim()

export async function applyCharacterWechatProfileUpdateDirectives(params: {
  characterId: string
  directives: CharacterWechatProfileUpdateDirective[]
}): Promise<{ updated: Character | null; nicknameChanged: boolean; signatureChanged: boolean }> {
  const cid = params.characterId.trim()
  if (!cid || !params.directives.length) {
    return { updated: null, nicknameChanged: false, signatureChanged: false }
  }

  let nextNick: string | undefined
  let nextSig: string | undefined
  for (const d of params.directives) {
    if (d.nickname?.trim()) nextNick = clampNick(d.nickname)
    if (d.signature !== undefined) nextSig = clampSig(d.signature)
  }

  const ch = await personaDb.getCharacter(cid)
  if (!ch) return { updated: null, nicknameChanged: false, signatureChanged: false }

  const patch: Partial<Character> = {}
  let nicknameChanged = false
  let signatureChanged = false

  if (nextNick !== undefined) {
    if (!isPlausibleWechatNickname(nextNick) || nicknameIsLegalNameClone(nextNick, ch)) {
      nextNick = undefined
    } else if (nextNick !== (ch.wechatNickname?.trim() || '')) {
      patch.wechatNickname = nextNick
      nicknameChanged = true
    }
  }

  if (nextSig !== undefined && nextSig !== (ch.wechatSignature?.trim() || '')) {
    patch.wechatSignature = nextSig
    signatureChanged = true
  }

  if (!nicknameChanged && !signatureChanged) {
    return { updated: null, nicknameChanged: false, signatureChanged: false }
  }

  const updated: Character = { ...ch, ...patch, updatedAt: Date.now() }
  await personaDb.upsertCharacter(updated)
  emitWeChatStorageChanged()
  return { updated, nicknameChanged, signatureChanged }
}

export async function stripAndApplyCharacterWechatProfileUpdates(params: {
  characterId: string
  bubbles: string[]
}): Promise<{ bubbles: string[]; updated: Character | null }> {
  const filtered = filterCharacterWechatProfileUpdateDirectives(params.bubbles)
  if (!filtered.directives.length) {
    return { bubbles: filtered.bubbles, updated: null }
  }
  const result = await applyCharacterWechatProfileUpdateDirectives({
    characterId: params.characterId,
    directives: filtered.directives,
  })
  return { bubbles: filtered.bubbles, updated: result.updated }
}
