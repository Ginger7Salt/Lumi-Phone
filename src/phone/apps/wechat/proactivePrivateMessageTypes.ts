import type { ChatConversationSettingsRow, WeChatChatMessage } from './newFriendsPersona/types'
import { PHONE_NUM_FONT_FAMILY } from '../../types'

/** 角色私聊「主动消息」：会话级开关与频率（秒） */

export const PROACTIVE_MESSAGE_INTERVAL_MIN_SECONDS = 30
export const PROACTIVE_MESSAGE_INTERVAL_MAX_SECONDS = 24 * 60 * 60
export const PROACTIVE_MESSAGE_INTERVAL_DEFAULT_SECONDS = 2 * 60 * 60

export type ProactiveMessageIntervalUnit = 'second' | 'minute' | 'hour'

export const PROACTIVE_MESSAGE_INTERVAL_UNITS: ReadonlyArray<{
  id: ProactiveMessageIntervalUnit
  label: string
}> = [
  { id: 'second', label: '秒' },
  { id: 'minute', label: '分钟' },
  { id: 'hour', label: '小时' },
]

export const PROACTIVE_MESSAGE_PRESETS = [
  { id: 'rare', label: '很少', seconds: 4 * 60 * 60 },
  { id: 'normal', label: '适中', seconds: 2 * 60 * 60 },
  { id: 'often', label: '频繁', seconds: 60 * 60 },
] as const

/** 数字展示字体（跟随全局数字衬线栈） */
export const PROACTIVE_MESSAGE_NUMBER_FONT = PHONE_NUM_FONT_FAMILY

export function clampProactiveMessageIntervalSeconds(raw: number): number {
  if (!Number.isFinite(raw)) return PROACTIVE_MESSAGE_INTERVAL_DEFAULT_SECONDS
  return Math.min(
    PROACTIVE_MESSAGE_INTERVAL_MAX_SECONDS,
    Math.max(PROACTIVE_MESSAGE_INTERVAL_MIN_SECONDS, Math.round(raw)),
  )
}

/** 兼容旧版按分钟存储的字段 */
export function resolveProactiveMessageIntervalSeconds(
  row:
    | {
        proactiveMessageIntervalSeconds?: number
        proactiveMessageIntervalMinutes?: number
      }
    | null
    | undefined,
): number {
  const sec = row?.proactiveMessageIntervalSeconds
  if (typeof sec === 'number' && Number.isFinite(sec)) {
    return clampProactiveMessageIntervalSeconds(sec)
  }
  const min = row?.proactiveMessageIntervalMinutes
  if (typeof min === 'number' && Number.isFinite(min)) {
    return clampProactiveMessageIntervalSeconds(min * 60)
  }
  return PROACTIVE_MESSAGE_INTERVAL_DEFAULT_SECONDS
}

export function pickDisplayUnitForSeconds(seconds: number): ProactiveMessageIntervalUnit {
  const s = clampProactiveMessageIntervalSeconds(seconds)
  if (s < 60) return 'second'
  if (s < 3600) return 'minute'
  return 'hour'
}

export function secondsToUnitValue(seconds: number, unit: ProactiveMessageIntervalUnit): number {
  const s = clampProactiveMessageIntervalSeconds(seconds)
  if (unit === 'second') return s
  if (unit === 'minute') return Math.max(1, Math.round(s / 60))
  const hours = s / 3600
  return hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10
}

export function unitValueToSeconds(value: number, unit: ProactiveMessageIntervalUnit): number {
  const v = Number(value)
  if (!Number.isFinite(v) || v <= 0) return PROACTIVE_MESSAGE_INTERVAL_MIN_SECONDS
  if (unit === 'second') return clampProactiveMessageIntervalSeconds(v)
  if (unit === 'minute') return clampProactiveMessageIntervalSeconds(v * 60)
  return clampProactiveMessageIntervalSeconds(v * 3600)
}

export function unitInputMinMax(unit: ProactiveMessageIntervalUnit): { min: number; max: number; step: number } {
  if (unit === 'second') {
    return {
      min: PROACTIVE_MESSAGE_INTERVAL_MIN_SECONDS,
      max: PROACTIVE_MESSAGE_INTERVAL_MAX_SECONDS,
      step: 1,
    }
  }
  if (unit === 'minute') {
    return { min: 1, max: 24 * 60, step: 1 }
  }
  return { min: 1, max: 24, step: 1 }
}

export function formatProactiveMessageIntervalLabel(seconds: number): string {
  const s = clampProactiveMessageIntervalSeconds(seconds)
  if (s < 60) return `约每 ${s} 秒`
  if (s < 3600) {
    const m = Math.round(s / 60)
    return `约每 ${m} 分钟`
  }
  if (s % 3600 === 0) return `约每 ${s / 3600} 小时`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m > 0 ? `约每 ${h} 小时 ${m} 分钟` : `约每 ${h} 小时`
}

/** 是否已保存过主动消息间隔（保存后才会开始倒计时与调度） */
export function hasProactiveMessageScheduleSaved(
  row: Pick<ChatConversationSettingsRow, 'proactiveMessageLastFiredAtMs'> | null | undefined,
): boolean {
  return (row?.proactiveMessageLastFiredAtMs ?? 0) > 0
}

/** 好感度 ≥ 此值时，可视为「较亲密」关系，久未回复时偏日常报备 */
export const PROACTIVE_INTIMATE_AFFECTION_MIN = 60

/** 用户距上次发言超过此时长（毫秒），且关系较亲密时，优先报备有趣日常 */
export const PROACTIVE_LONG_USER_SILENCE_MS = 4 * 60 * 60 * 1000

/** 主动消息与普通私聊共用的输出节奏说明（条数不设上限） */
const PROACTIVE_OUTPUT_PARITY_HINT =
  '**发送逻辑与手动聊天完全一致**：条数不设机械上限，语境自然需要几条就几条；' +
  '每一独立行对应一条气泡，短句优先，多数行 **1～15 字** 为宜（语气词、单独「？」「……」可更短），能拆则拆，禁止整轮挤成一行长文。' +
  '仍完全遵守《线上回复输出协议》中的换行分条、表情包/语音/AI 配图/撤回等格式规则。'

/** 主动消息回合：追加在 API 消息列表末尾，触发模型以 assistant（角色）侧输出；不入库、不展示 */
export const PROACTIVE_INITIATION_USER_NUDGE =
  '[系统·主动消息回合] 用户此刻没有新发消息。请你以**角色本人**身份主动给用户发微信气泡（assistant 侧输出）。' +
  PROACTIVE_OUTPUT_PARITY_HINT +
  '这是**角色发给用户**，不是用户发给你，**禁止**替用户续写 user 侧台词、禁止模拟用户发消息。' +
  '对白里「我」指角色本人，「你」指用户。' +
  '若你们关系较亲密且用户已有一阵子没回：优先像真正在意对方那样，**报备一两件有趣日常**（吃到好吃的、路上趣事、工作小插曲、看到联想到用户的东西等），让用户感到被放心上；勿查岗、勿质问「怎么不理我」。'

export const PROACTIVE_PRIVATE_MESSAGE_REPLY_BIAS = [
  '【主动消息·最高优先级】',
  '本回合是**角色主动发给用户**的私聊：你是角色（assistant 席位），输出的是**角色微信气泡**，不是用户消息。',
  '用户此刻未在输入；由你根据**完整聊天记录与语境**主动开口。',
  PROACTIVE_OUTPUT_PARITY_HINT,
  '**禁止**身份倒错：勿替用户（user 席位）发言、勿模拟用户发消息、勿写成用户在向你汇报。',
  '对白中的「我/我的」默认指**角色本人**；称呼用户用「你」。',
  '须结合最近对话话题、关系与人设推进或延展，**禁止**复读、换皮重发上一轮已说过的话或同义句。',
  '可分享日常、问候、接梗、轻调侃或新信息；勿机械模板「你怎么不理我」。',
  '**较亲密关系 + 用户久未回复**时：优先**报备有趣日常**（刚吃到/看到的、路上小事、联想到用户的小细节），传达「惦记你、想跟你分享」；让用户感到被在意、被放心上；禁止查岗、禁止 guilt tripping。',
  '若用户尚未回应你上一轮发言（且不属于上述亲密报备场景）：可**酌情**一句轻问在干嘛、忙不忙等（贴合语境即可，**非必须**）；禁止施压、质问或连环催促。',
  '用户可能正在忙或未看手机，语气自然有度。',
  '**寻味点外卖**：若想主动给用户点外卖，须遵守输出协议中的 `[TAKEOUT_ORDER]`；`storeId` 与 `items[].name` 只能从协议附带的寻味菜单价目表原样选取；口语与指令须一致（禁止嘴上说 A 店、指令点 B 店）；口语里**禁止编造具体金额**，卡片会显示真实总价。',
].join('\n')

const PROACTIVE_INTIMATE_DAILY_LIFE_SHARE_BIAS = [
  '【亲密·久未回复·日常报备（优先）】',
  '你们关系较亲密，用户已有一阵子没回消息；本轮**优先**像真正在意对方那样，主动分享一两件**具体、有趣、生活化**的日常片段。',
  '可参考：刚吃到/喝到的好东西、路上或店里看见的趣事、工作/学习小插曲、天气或季节感、看到某样东西联想到用户、睡前/刚醒的小状态等——须贴合人设与最近聊天语境，**禁止**编造与用户已知设定冲突的细节。',
  '目标是让用户感到**被惦记、被放心上**；分享本身即是关心，不必每轮都追问「你怎么不回」。',
  '若结尾需要一句惦念，最多**一句**轻、软、不施压（如「忙完记得看一眼」「想到你了」）；**禁止**查岗、质问、连环催回复、道德绑架式「是不是不想理我了」。',
  '语气像给朋友/在意的人随手发微信，自然、有温度，不要公告体或客服腔。',
].join('\n')

/** 用户已发言但角色尚未回复时：与手动催回复同路，不再追加「主动开口」占位 user 消息 */
export const PROACTIVE_REPLY_PENDING_USER_BIAS = [
  '【主动消息调度】用户已在聊天室发了新消息但尚未收到你的回复。',
  '请像用户手动催回复时一样，结合完整上下文**正常回复用户最新发言**。',
  PROACTIVE_OUTPUT_PARITY_HINT,
  '**禁止**身份倒错：勿替用户（user 席位）发言、勿模拟用户发消息。',
  '对白中的「我/我的」指角色本人；称呼用户用「你」。',
  '须贴合人设与语境，**禁止**复读、换皮重发同义句。',
].join('\n')

export function computeMsSinceLastUserMessage(
  messages: WeChatChatMessage[],
  nowMs: number = Date.now(),
): number | null {
  const userMessages = messages
    .filter((m) => !m.isRecalled && m.type === 'player')
    .sort((a, b) => a.timestamp - b.timestamp)
  const lastUser = userMessages[userMessages.length - 1]
  if (!lastUser) return null
  return Math.max(0, nowMs - lastUser.timestamp)
}

function formatProactiveSilenceDuration(ms: number): string {
  if (ms < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(ms / 60_000))
    return `约 ${minutes} 分钟`
  }
  if (ms < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.round(ms / 3_600_000))
    return `约 ${hours} 小时`
  }
  const days = Math.max(1, Math.round(ms / 86_400_000))
  return days >= 2 ? `约 ${days} 天` : '约 1 天'
}

export type ProactivePrivateMessageReplyBiasContext = {
  msSinceLastUserMessage?: number | null
  affection?: number | null
  relationshipDef?: string | null
}

export function hasPendingUserMessageWithoutReply(messages: WeChatChatMessage[]): boolean {
  const sorted = [...messages].filter((m) => !m.isRecalled).sort((a, b) => a.timestamp - b.timestamp)
  const last = sorted[sorted.length - 1]
  if (!last || last.type !== 'player') return false
  return !sorted.some((m) => m.type === 'character' && m.timestamp > last.timestamp)
}

export function resolveProactiveMessageAiRound(messages: WeChatChatMessage[]): {
  proactiveInitiation: boolean
  proactiveInitiationNudge: string
} {
  if (hasPendingUserMessageWithoutReply(messages)) {
    // 与手动催回复一致：历史末尾已是用户消息，无需再塞「主动开口」占位 user
    return {
      proactiveInitiation: false,
      proactiveInitiationNudge: '',
    }
  }
  return {
    proactiveInitiation: true,
    proactiveInitiationNudge: PROACTIVE_INITIATION_USER_NUDGE,
  }
}

function shouldPreferIntimateDailyLifeShare(ctx: ProactivePrivateMessageReplyBiasContext): boolean {
  const affection = ctx.affection
  const silenceMs = ctx.msSinceLastUserMessage
  if (typeof affection !== 'number' || !Number.isFinite(affection)) return false
  if (typeof silenceMs !== 'number' || !Number.isFinite(silenceMs)) return false
  return affection >= PROACTIVE_INTIMATE_AFFECTION_MIN && silenceMs >= PROACTIVE_LONG_USER_SILENCE_MS
}

/** 根据最近聊天记录追加「勿复读 / 亲密报备 / 可轻追问 / 待回复用户」偏向 */
export function buildProactiveCatchUpReplyBias(slotIndex: number, totalSlots: number): string {
  if (totalSlots <= 1 || slotIndex < 1 || slotIndex > totalSlots) return ''
  return [
    `【主动消息·离线补发 ${slotIndex}/${totalSlots}】`,
    `用户离线期间错过了多轮主动消息；本条对应时间线上第 ${slotIndex} 个到期时点（共 ${totalSlots} 轮）。`,
    '须与前面已补发轮次**内容不同**，勿复读、勿同义换皮；按各自时点自然推进或报备日常。',
    '勿在本条里解释「我刚连发好几条」——每条都是独立时点发出的微信消息。',
  ].join('\n')
}

export function buildProactivePrivateMessageReplyBias(
  messages: WeChatChatMessage[],
  ctx: ProactivePrivateMessageReplyBiasContext = {},
): string {
  const allSorted = [...messages].filter((m) => !m.isRecalled).sort((a, b) => a.timestamp - b.timestamp)
  const lastOverall = allSorted[allSorted.length - 1]
  const pendingUserReply = hasPendingUserMessageWithoutReply(messages)
  const preferIntimateDailyShare = !pendingUserReply && shouldPreferIntimateDailyLifeShare(ctx)

  const lines: string[] = [
    pendingUserReply ? PROACTIVE_REPLY_PENDING_USER_BIAS : PROACTIVE_PRIVATE_MESSAGE_REPLY_BIAS,
  ]

  if (pendingUserReply) {
    const latestUserText = lastOverall?.content?.trim()
    if (latestUserText) {
      lines.push('【用户最新发言（须回应）】', latestUserText.slice(0, 400))
    }
    return lines.join('\n')
  }

  const trailingChar: string[] = []
  for (let i = allSorted.length - 1; i >= 0; i -= 1) {
    const m = allSorted[i]
    if (!m || m.type !== 'character') break
    const t = m.content?.trim()
    if (t) trailingChar.unshift(t.slice(0, 240))
  }

  const userHasNotRepliedSince = lastOverall?.type === 'character' && trailingChar.length > 0

  if (trailingChar.length) {
    lines.push(
      '【上轮你已发送（禁止复述）】',
      ...trailingChar.map((t, idx) => `${idx + 1}. ${t}`),
      '本轮必须换表达、换角度或自然推进话题；禁止同义复读、禁止只加标点重复发送。',
    )
  }

  if (preferIntimateDailyShare) {
    const silenceMs = ctx.msSinceLastUserMessage!
    const relHint =
      typeof ctx.relationshipDef === 'string' && ctx.relationshipDef.trim()
        ? ctx.relationshipDef.trim()
        : `好感度约 ${Math.round(ctx.affection!)}`
    lines.push(
      PROACTIVE_INTIMATE_DAILY_LIFE_SHARE_BIAS,
      `【关系与沉默时长】${relHint}；用户距上次发言已 ${formatProactiveSilenceDuration(silenceMs)}。`,
    )
  } else if (userHasNotRepliedSince) {
    lines.push(
      '【用户尚未回应你上一轮】可结合语境酌情轻问一句在干嘛、忙不忙等（非必须）；语气贴合人设，勿质问、勿连环催回复。',
    )
  }

  return lines.join('\n')
}
