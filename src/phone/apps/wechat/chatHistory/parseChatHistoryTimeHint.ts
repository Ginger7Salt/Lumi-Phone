/** 将剧情时间提示（when= / 行首 / 标题）解析为毫秒时间戳，referenceMs 为当前剧情「现在」 */

import type { WeChatForwardedMessageItem } from '../newFriendsPersona/types'

function startOfLocalDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function setLocalTime(baseDayMs: number, hh: number, mm: number): number {
  const d = new Date(baseDayMs)
  d.setHours(hh, mm, 0, 0)
  return d.getTime()
}

function parseHm(text: string): { hh: number; mm: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return { hh, mm }
}

function parseYmdParts(text: string): { y: number; mo: number; d: number } | null {
  const m =
    /^(\d{4})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})\s*日?$/.exec(text.trim()) ??
    /^(\d{4})(\d{2})(\d{2})$/.exec(text.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y, mo, d }
}

function parseMdParts(text: string, referenceMs: number): { y: number; mo: number; d: number } | null {
  const m = /^(\d{1,2})\s*[-/月]\s*(\d{1,2})\s*日?$/.exec(text.trim())
  if (!m) return null
  const ref = new Date(referenceMs)
  const mo = Number(m[1])
  const d = Number(m[2])
  if (!Number.isFinite(mo) || !Number.isFinite(d) || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y: ref.getFullYear(), mo, d }
}

/** 从标题推断大致发生时间（无 when= 时的兜底） */
export function inferChatHistoryWhenHintFromTitle(title: string): string | undefined {
  const t = title.trim()
  if (!t) return undefined
  if (/昨晚|昨夜/.test(t)) return '昨天 22:30'
  if (/前天/.test(t)) return '前天 20:00'
  if (/刚才|刚刚|早前/.test(t)) return '刚才'
  if (/上周|上个星期/.test(t)) return '上周'
  if (/上个月/.test(t)) return '30天前'
  if (/之前|当时|那次|旧账|以前/.test(t)) return '3天前 15:00'
  return undefined
}

export function parseChatHistoryTimeHint(hint: string, referenceMs: number): number | null {
  const raw = String(hint ?? '').trim()
  if (!raw) return null

  const refDay = startOfLocalDay(referenceMs)

  // 绝对：2026-06-10 14:32 / 2026年6月10日 14:32
  const absWithHm =
    /^(\d{4}\s*[-/年]\s*\d{1,2}\s*[-/月]\s*\d{1,2}\s*日?)\s+(\d{1,2}:\d{2})$/.exec(raw) ??
    /^(\d{4}\s*[-/年]\s*\d{1,2}\s*[-/月]\s*\d{1,2}\s*日?)(?:\s+(\d{1,2}:\d{2}))?$/.exec(raw)
  if (absWithHm) {
    const ymd = parseYmdParts(absWithHm[1]!)
    if (ymd) {
      const hm = absWithHm[2] ? parseHm(absWithHm[2]) : { hh: 20, mm: 0 }
      if (hm) {
        const d = new Date(ymd.y, ymd.mo - 1, ymd.d, hm.hh, hm.mm, 0, 0)
        return d.getTime()
      }
    }
  }

  // 06-10 14:32（当年）
  const mdHm = /^(\d{1,2}\s*[-/月]\s*\d{1,2}\s*日?)\s+(\d{1,2}:\d{2})$/.exec(raw)
  if (mdHm) {
    const ymd = parseMdParts(mdHm[1]!, referenceMs)
    const hm = parseHm(mdHm[2]!)
    if (ymd && hm) {
      return new Date(ymd.y, ymd.mo - 1, ymd.d, hm.hh, hm.mm, 0, 0).getTime()
    }
  }

  // 仅 HH:mm → 参考日当天
  const hmOnly = parseHm(raw)
  if (hmOnly) return setLocalTime(refDay, hmOnly.hh, hmOnly.mm)

  // 相对天数
  const relDayHm =
    /^(今天|昨天|前天|大前天)(?:\s+(\d{1,2}:\d{2}))?$/.exec(raw) ??
    /^(\d+)\s*天前(?:\s+(\d{1,2}:\d{2}))?$/.exec(raw)
  if (relDayHm) {
    let dayOffset = 0
    const token = relDayHm[1]!
    if (token === '今天') dayOffset = 0
    else if (token === '昨天') dayOffset = -1
    else if (token === '前天') dayOffset = -2
    else if (token === '大前天') dayOffset = -3
    else {
      const n = Number(token)
      if (Number.isFinite(n) && n > 0) dayOffset = -Math.min(n, 365)
    }
    const hm = relDayHm[2] ? parseHm(relDayHm[2]) : { hh: 20, mm: 0 }
    if (hm) {
      const dayMs = refDay + dayOffset * 86_400_000
      return setLocalTime(dayMs, hm.hh, hm.mm)
    }
  }

  if (/^刚才|刚刚$/.test(raw)) return referenceMs - 8 * 60_000
  if (/^上周$/.test(raw)) return referenceMs - 7 * 86_400_000
  if (/^上个月$/.test(raw)) return referenceMs - 30 * 86_400_000

  // 上周三 14:00
  const weekdayHm = /^上(?:周|星期)([一二三四五六日天])(?:\s+(\d{1,2}:\d{2}))?$/.exec(raw)
  if (weekdayHm) {
    const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }
    const target = map[weekdayHm[1]!]
    if (target != null) {
      const ref = new Date(referenceMs)
      const cur = ref.getDay()
      let diff = cur - target
      if (diff <= 0) diff += 7
      diff += 7
      const dayMs = refDay - diff * 86_400_000
      const hm = weekdayHm[2] ? parseHm(weekdayHm[2]) : { hh: 15, mm: 0 }
      if (hm) return setLocalTime(dayMs, hm.hh, hm.mm)
    }
  }

  return null
}

/** 卡片内对话结束时间锚点：优先 when=，其次标题，再次剧情现在 */
export function resolveChatHistoryEndAnchorMs(params: {
  anchorMs: number
  historyWhenHint?: string
  titleHint?: string
}): number {
  const { anchorMs } = params
  const hints = [
    params.historyWhenHint?.trim(),
    inferChatHistoryWhenHintFromTitle(params.titleHint ?? ''),
  ].filter(Boolean) as string[]

  for (const hint of hints) {
    const parsed = parseChatHistoryTimeHint(hint, anchorMs)
    if (parsed != null && parsed <= anchorMs + 60_000) return parsed
  }

  // 默认：略早于「现在」的近期对话，而非卡在发送当下
  return anchorMs - 45 * 60_000
}

/** 从单行 `[…]` 内文剥离可选时间前缀，返回时间与「发送者: 正文」 */
export function peelChatHistoryLineTimePrefix(
  inner: string,
  referenceMs: number,
  blockWhenHint?: string,
): { senderPart: string; content: string; timestamp?: number; timeHint?: string } | null {
  let rest = inner.trim()
  if (!rest) return null

  let timestamp: number | undefined
  let timeHint: string | undefined
  const block = blockWhenHint?.trim()

  const tryPeel = (re: RegExp, map: (m: RegExpExecArray) => string, keepHintOnFail = false): boolean => {
    const m = re.exec(rest)
    if (!m) return false
    const hint = map(m)
    const parsed = parseChatHistoryTimeHint(hint, referenceMs)
    rest = rest.slice(m[0].length).trim()
    if (parsed != null) {
      timestamp = parsed
      return true
    }
    if (keepHintOnFail) timeHint = hint
    return true
  }

  if (
    !tryPeel(/^(\d{4}\s*[-/年]\s*\d{1,2}\s*[-/月]\s*\d{1,2}\s*日?\s+\d{1,2}:\d{2})\s+/, (m) => m[1]!) &&
    !tryPeel(/^(\d{1,2}\s*[-/月]\s*\d{1,2}\s*日?\s+\d{1,2}:\d{2})\s+/, (m) => m[1]!) &&
    !tryPeel(/^(今天|昨天|前天|大前天|\d+天前)(?:\s+(\d{1,2}:\d{2}))?\s+/, (m) =>
      m[2] ? `${m[1]} ${m[2]}` : m[1]!,
    ) &&
    !tryPeel(/^(\d{1,2}:\d{2})\s+/, (m) => (block ? `${block.split(/\s+/)[0]} ${m[1]!}` : m[1]!), !block)
  ) {
    // 无行首时间
  }

  const colon = rest.match(/^([^:：\[【]{1,64})[:：]\s*(.+)$/)
  if (!colon) return null
  const senderPart = colon[1]!.trim()
  const content = colon[2]!.trim()
  if (!senderPart && !content) return null

  return {
    senderPart,
    content,
    ...(timestamp != null ? { timestamp } : {}),
    ...(timeHint ? { timeHint } : {}),
  }
}

export function resolveForwardedMessageTimestamps(
  messages: readonly WeChatForwardedMessageItem[],
  anchorMs: number,
  blockWhenHint?: string,
): WeChatForwardedMessageItem[] {
  const block = blockWhenHint?.trim()
  return messages.map((m) => {
    if (typeof m.timestamp === 'number' && Number.isFinite(m.timestamp)) {
      const { timeHint: _th, ...rest } = m
      return rest
    }
    const hint = m.timeHint?.trim()
    if (!hint) return m
    const combined =
      block && /^\d{1,2}:\d{2}$/.test(hint) ? `${block.split(/\s+/)[0]} ${hint}` : hint
    const ts = parseChatHistoryTimeHint(combined, anchorMs)
    if (ts == null) return m
    const { timeHint: _th, ...rest } = m
    return { ...rest, timestamp: ts }
  })
}
