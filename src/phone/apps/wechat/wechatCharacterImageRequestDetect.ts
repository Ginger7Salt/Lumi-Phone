/** 聊天信息页未定制时，角色 AI 配图每轮触发概率的默认值 */
export const IMAGE_DEFAULT_ROUND_TRIGGER_PERCENT = 0

const PROFILE_OR_COVER_HINT =
  /(?:换|改|设|当|用作?).{0,8}(?:微信)?(?:头像|封面|背景)|朋友圈.{0,6}(?:背景|封面)|(?:头像|封面|背景).{0,6}(?:换|改|设)/u
const STICKER_HINT = /表情包/u

const EXPLICIT_CHARACTER_IMAGE_REQUEST_PATTERNS: RegExp[] = [
  /(?:请|帮我|给我|能|可以|要|想)?(?:发|送|来|拍|传|share).{0,8}(?:张|个|一张|一下|点)?(?:图|照片|图片|自拍|风景照|实拍)/iu,
  /(?:给|让).{0,6}(?:我|你看).{0,8}(?:看|瞧).{0,4}(?:下|一眼)?(?:你的|你)?(?:图|照片|图片|自拍)?/u,
  /(?:想|要).{0,4}看.{0,6}(?:你的|你)?(?:图|照片|图片|自拍)/u,
  /(?:来|整|搞).{0,4}(?:张|个).{0,4}(?:图|照片|图片)/u,
  /(?:show|send).{0,6}(?:me)?.{0,6}(?:a|your)?.{0,6}(?:photo|picture|pic|selfie)/iu,
]

/** 用户本轮是否明确要求角色发送 AI 配图（非换头像/封面、非表情包） */
export function userExplicitlyRequestsCharacterImage(text: string | null | undefined): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  if (PROFILE_OR_COVER_HINT.test(t) || STICKER_HINT.test(t)) return false
  return EXPLICIT_CHARACTER_IMAGE_REQUEST_PATTERNS.some((re) => re.test(t))
}

const EXPLICIT_CHARACTER_STICKER_REQUEST_PATTERNS: RegExp[] = [
  /(?:请|帮我|给我|能|可以|要|想|再|最后)?.{0,8}(?:发|送|来|回).{0,16}表情包/u,
  /表情包.{0,10}(?:给|让).{0,6}(?:我|你看|看看|瞧)/u,
  /(?:发|送|来).{0,12}(?:这个|那个|同款).{0,8}表情/u,
  /\[表情包\].{0,16}(?:看看|看一下|瞧瞧|发我)/u,
  /(?:这个|那个|同款).{0,6}表情包.{0,8}(?:给|让|发).{0,6}(?:我|你看|看看)/u,
]

/** 用户本轮是否明确要求角色回发/展示表情包（应绕过「每轮概率」客户端拦截） */
export function userExplicitlyRequestsCharacterSticker(text: string | null | undefined): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  if (!STICKER_HINT.test(t) && !/\[表情\]/u.test(t)) return false
  return EXPLICIT_CHARACTER_STICKER_REQUEST_PATTERNS.some((re) => re.test(t))
}

export function buildUserExplicitCharacterImageRequestBias(explicit: boolean): string {
  if (!explicit) return ''
  return `[系统提示] 用户本轮**明确要求**你发送图片/照片/自拍（AI 配图，非换头像/封面）。
若你愿意且当前已启用 \`[图片]\` 协议：可在文字回应后**单独占一行**输出 \`[图片]画面描述\`；此轮**不受**「每轮发图概率」限制。
若你不愿或觉得不合适，只用文字婉拒，**不要**输出 \`[图片]\` 行。`
}
