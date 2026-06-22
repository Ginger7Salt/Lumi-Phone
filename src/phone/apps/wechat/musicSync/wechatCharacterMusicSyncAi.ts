import type { WeChatChatMessage, WeChatMusicSyncInvitePayload, WeChatMusicSyncPayload } from '../newFriendsPersona/types'
import { isActiveSyncListeningWithCharacter } from './syncListeningPlaybackBias'

type CharacterMusicSyncInviteLookupRow = {
  id: string
  musicSync?: WeChatMusicSyncPayload
  type?: WeChatChatMessage['type']
  from?: 'self' | 'other'
}

function isCharacterMusicInviteSender(row: CharacterMusicSyncInviteLookupRow): boolean {
  if (row.from === 'other') return true
  if (row.from === 'self') return false
  return row.type === 'character'
}

function normalizeDirectiveLine(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/^`+|`+$/g, '')
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/［/g, '[')
    .replace(/］/g, ']')
}

export type CharacterMusicSyncDirective =
  | { kind: 'play_next' }
  | { kind: 'play_prev' }
  | {
      kind: 'play'
      trackId?: number
      title?: string
      artist?: string
      coverUrl?: string
    }
  | {
      kind: 'seek'
      timeMs?: number
      time?: string
      lyric?: string
      percent?: number
    }
  | {
      kind: 'invite'
      trackId?: number
      title?: string
      artist?: string
      coverUrl?: string
      replyText?: string
    }

function parseDirectiveJson(inline: string): Record<string, unknown> | null {
  try {
    const j = JSON.parse(inline) as Record<string, unknown>
    return j && typeof j === 'object' && !Array.isArray(j) ? j : null
  } catch {
    return null
  }
}

function pickTrackFields(j: Record<string, unknown> | null): {
  trackId?: number
  title?: string
  artist?: string
  coverUrl?: string
  replyText?: string
} {
  if (!j) return {}
  const trackId = Number(j.trackId ?? j.songId ?? j.id)
  const title = typeof j.title === 'string' ? j.title.trim() : typeof j.trackTitle === 'string' ? j.trackTitle.trim() : ''
  const artist =
    typeof j.artist === 'string'
      ? j.artist.trim()
      : typeof j.trackArtist === 'string'
        ? j.trackArtist.trim()
        : ''
  const coverUrl =
    typeof j.coverUrl === 'string'
      ? j.coverUrl.trim()
      : typeof j.cover === 'string'
        ? j.cover.trim()
        : ''
  const replyText = typeof j.replyText === 'string' ? j.replyText.trim().slice(0, 500) : ''
  return {
    ...(Number.isFinite(trackId) && trackId > 0 ? { trackId } : {}),
    ...(title ? { title } : {}),
    ...(artist ? { artist } : {}),
    ...(coverUrl ? { coverUrl } : {}),
    ...(replyText ? { replyText } : {}),
  }
}

function pickSeekFields(j: Record<string, unknown> | null): {
  timeMs?: number
  time?: string
  lyric?: string
  percent?: number
} {
  if (!j) return {}
  const timeMs = Number(j.timeMs ?? j.ms ?? j.positionMs)
  const time =
    typeof j.time === 'string'
      ? j.time.trim()
      : typeof j.at === 'string'
        ? j.at.trim()
        : ''
  const lyric =
    typeof j.lyric === 'string'
      ? j.lyric.trim()
      : typeof j.line === 'string'
        ? j.line.trim()
        : typeof j.text === 'string'
          ? j.text.trim()
          : ''
  const percent = Number(j.percent ?? j.percentage ?? j.pct)
  return {
    ...(Number.isFinite(timeMs) && timeMs >= 0 ? { timeMs: Math.floor(timeMs) } : {}),
    ...(time ? { time } : {}),
    ...(lyric ? { lyric: lyric.slice(0, 200) } : {}),
    ...(Number.isFinite(percent) && percent >= 0 ? { percent: Math.max(0, Math.min(100, percent)) } : {}),
  }
}

function trySeekWithJson(raw: string): CharacterMusicSyncDirective | null {
  const normalized = normalizeDirectiveLine(raw)
  if (/^\[MUSIC_SEEK\]$/i.test(normalized)) return { kind: 'seek' }
  const inline = /^\[MUSIC_SEEK\]\s*(\{[\s\S]*\})$/i.exec(normalized)
  if (!inline) return null
  return { kind: 'seek', ...pickSeekFields(parseDirectiveJson(inline[1]!)) }
}

function tryTagWithJson(
  raw: string,
  tag: string,
  kind: CharacterMusicSyncDirective['kind'],
): CharacterMusicSyncDirective | null {
  const normalized = normalizeDirectiveLine(raw)
  const tagOnly = new RegExp(`^\\[${tag}\\]$`, 'i').exec(normalized)
  if (tagOnly) {
    if (kind === 'play_next') return { kind: 'play_next' }
    if (kind === 'play_prev') return { kind: 'play_prev' }
    return { kind: kind as 'play' | 'invite' }
  }
  const inline = new RegExp(`^\\[${tag}\\]\\s*(\\{[\\s\\S]*\\})$`, 'i').exec(normalized)
  if (!inline) return null
  const fields = pickTrackFields(parseDirectiveJson(inline[1]!))
  if (kind === 'play_next') return { kind: 'play_next' }
  if (kind === 'play_prev') return { kind: 'play_prev' }
  if (kind === 'play') return { kind: 'play', ...fields }
  return { kind: 'invite', ...fields }
}

export function parseCharacterMusicSyncDirective(raw: string): CharacterMusicSyncDirective | null {
  return (
    tryTagWithJson(raw, 'MUSIC_PLAY_NEXT', 'play_next') ??
    tryTagWithJson(raw, 'MUSIC_PLAY_PREV', 'play_prev') ??
    tryTagWithJson(raw, 'MUSIC_PLAY', 'play') ??
    tryTagWithJson(raw, 'MUSIC_SYNC_INVITE', 'invite') ??
    trySeekWithJson(raw)
  )
}

/** 整行指令、拆行 JSON、或仅 JSON 残留行 */
export function parseCharacterMusicSyncDirectiveFromArtifactLine(raw: string): CharacterMusicSyncDirective | null {
  const parsed = parseCharacterMusicSyncDirective(raw)
  if (parsed) return parsed
  const t = normalizeDirectiveLine(raw)
  if (!t.startsWith('{') || !t.endsWith('}')) return null
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null
    const fields = pickTrackFields(j)
    if (fields.trackId || fields.title || fields.artist) {
      return { kind: 'invite', ...fields }
    }
    const seekFields = pickSeekFields(j)
    if (seekFields.timeMs != null || seekFields.time || seekFields.lyric || seekFields.percent != null) {
      return { kind: 'seek', ...seekFields }
    }
  } catch {
    return null
  }
  return null
}

export function mergeCharacterMusicSyncDirectiveLines(currentLine: string, nextLine?: string): string {
  const current = normalizeDirectiveLine(currentLine)
  const next = normalizeDirectiveLine(nextLine ?? '')
  if (/^\[MUSIC_(PLAY_NEXT|PLAY_PREV|PLAY|SYNC_INVITE|SEEK)\]$/i.test(current) && next.startsWith('{') && next.endsWith('}')) {
    return `${current}${next}`
  }
  return current
}

const CHARACTER_MUSIC_SYNC_DIRECTIVE_INLINE_RE =
  /\[(?:MUSIC_PLAY_NEXT|MUSIC_PLAY_PREV|MUSIC_PLAY|MUSIC_SYNC_INVITE|MUSIC_SEEK)\](?:\s*(\{[\s\S]*?\}))?/gi

/** 从口语正文中剥离内联指令（保留可见对白） */
export function stripInlineCharacterMusicSyncDirectives(text: string): {
  cleaned: string
  inlineDirectives: CharacterMusicSyncDirective[]
} {
  const inlineDirectives: CharacterMusicSyncDirective[] = []
  const cleaned = String(text ?? '')
    .replace(CHARACTER_MUSIC_SYNC_DIRECTIVE_INLINE_RE, (match) => {
      const directive = parseCharacterMusicSyncDirective(match)
      if (directive) inlineDirectives.push(directive)
      return ''
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { cleaned, inlineDirectives }
}

export function mergeCharacterMusicSyncDirectiveBubbles(bubbles: string[]): string[] {
  const merged = [...bubbles]
  for (let i = 0; i < merged.length; i += 1) {
    const next = mergeCharacterMusicSyncDirectiveLines(
      merged[i]!,
      merged[i + 1] != null ? String(merged[i + 1] ?? '') : undefined,
    )
    if (next !== merged[i]) {
      merged[i] = next
      merged.splice(i + 1, 1)
    }
  }
  return merged
}

export function filterCharacterMusicSyncDirectives(bubbles: string[]): {
  bubbles: string[]
  directives: CharacterMusicSyncDirective[]
} {
  const directives: CharacterMusicSyncDirective[] = []
  const next: string[] = []
  for (const raw of bubbles) {
    const line = String(raw ?? '').trim()
    if (!line) continue
    const wholeLine = parseCharacterMusicSyncDirectiveFromArtifactLine(line)
    if (wholeLine) {
      directives.push(wholeLine)
      continue
    }
    if (isCharacterMusicSyncDirectiveArtifactLine(line)) continue
    const { cleaned, inlineDirectives } = stripInlineCharacterMusicSyncDirectives(line)
    directives.push(...inlineDirectives)
    if (cleaned.trim()) next.push(cleaned.trim())
  }
  return { bubbles: next, directives }
}

export function isCharacterMusicSyncDirectiveArtifactLine(line: string): boolean {
  const t = normalizeDirectiveLine(line)
  if (!t) return false
  if (parseCharacterMusicSyncDirective(t)) return true
  if (/^\[MUSIC_(PLAY_NEXT|PLAY_PREV|PLAY|SYNC_INVITE|SEEK)\]/i.test(t)) return true
  if (!t.startsWith('{') || !t.endsWith('}')) return false
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    if (!j || typeof j !== 'object' || Array.isArray(j)) return false
    const keys = Object.keys(j)
    return (
      keys.length > 0 &&
      keys.every((k) =>
        /^(trackId|songId|id|title|trackTitle|artist|trackArtist|cover|coverUrl|replyText|timeMs|ms|positionMs|time|at|lyric|line|text|percent|percentage|pct)$/.test(
          k,
        ),
      )
    )
  } catch {
    return false
  }
}

export function formatCharacterMusicSyncInviteTranscriptLine(
  messageId: string,
  data: WeChatMusicSyncInvitePayload,
): string {
  const artist = data.trackArtist?.trim() || '未知歌手'
  const mid = messageId.trim() || data.inviteId
  const head = `（你向用户发来音乐共听邀约：《${data.trackTitle}》— ${artist}；messageId=${mid}；inviteId=${data.inviteId}）`
  let status = ''
  if (data.userResponded === 'accepted') {
    status = '；用户已通过邀约卡接受并与你一起听'
  } else if (data.userResponded === 'declined') {
    status =
      '；**用户已拒绝本次共听邀约**（勿再用 MUSIC_PLAY / MUSIC_SEEK 直接点播或拉进度，下次须 MUSIC_SYNC_INVITE 重新邀请并等用户接受）'
  } else {
    status = '；用户尚未回应邀约卡（勿 MUSIC_PLAY 直接点播，等待接受/拒绝或重新发邀约）'
  }
  const lyrics = data.lyricsExcerpt?.trim()
  const base = `${head}${status}`
  if (!lyrics) return base
  return `${base}；歌词节选：\n${lyrics}`
}

export function findLatestCharacterMusicSyncInvite(
  msgs: readonly CharacterMusicSyncInviteLookupRow[],
): { messageId: string; invite: WeChatMusicSyncInvitePayload } | null {
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (!m || !isCharacterMusicInviteSender(m)) continue
    const ms = m.musicSync
    if (ms?.kind === 'music_invite') {
      return { messageId: m.id, invite: ms }
    }
  }
  return null
}

/** 注入 replyBias：告知角色最近一次共听邀约的用户回应，以及是否允许直接点播 */
export function buildCharacterMusicSyncInviteStateBias(
  characterId: string,
  msgs: readonly CharacterMusicSyncInviteLookupRow[],
): string {
  const cid = characterId.trim()
  if (!cid) return ''
  if (isActiveSyncListeningWithCharacter(cid)) return ''

  const latest = findLatestCharacterMusicSyncInvite(msgs)
  if (!latest) {
    return `[一起听·状态] 当前未与该用户处于共听会话。若要一起听，须发 \`[MUSIC_SYNC_INVITE]\` 邀约卡并等用户点击接受；**禁止** \`[MUSIC_PLAY]\` / \`[MUSIC_SEEK]\` / \`[MUSIC_PLAY_NEXT]\` / \`[MUSIC_PLAY_PREV]\` 直接点播或切歌。`
  }

  const title = latest.invite.trackTitle?.trim() || '未知歌曲'
  if (latest.invite.userResponded === 'declined') {
    return `[一起听·状态] 用户已拒绝你最近发出的共听邀约（《${title}》）。**禁止** \`[MUSIC_PLAY]\` / \`[MUSIC_SEEK]\` / \`[MUSIC_PLAY_NEXT]\` / \`[MUSIC_PLAY_PREV]\`；若仍想一起听，须重新发 \`[MUSIC_SYNC_INVITE]\` 并等用户接受后再播。可自然聊拒绝原因或换话题，勿假装已在共听。`
  }
  if (!latest.invite.userResponded) {
    return `[一起听·状态] 你已发出共听邀约（《${title}》），用户尚未接受/拒绝。**禁止** \`[MUSIC_PLAY]\` 直接点播；等待用户回应或换一首重新 \`[MUSIC_SYNC_INVITE]\`。`
  }
  if (latest.invite.userResponded === 'accepted') {
    return `[一起听·状态] 用户曾接受共听（《${title}》）但当前无活跃会话。再次一起听须重新发 \`[MUSIC_SYNC_INVITE]\`，不可 \`[MUSIC_PLAY]\` 直播。`
  }
  return ''
}

export const WECHAT_CHARACTER_MUSIC_SYNC_OUTPUT_BLOCK = `
---------------------
【一起听：角色侧播放控制（对用户不可见）】
---------------------
- 与用户**已建立一起听**或你想**主动邀听**时，可用以下**单独一行**机器指令（勿写进口语同句）；用户看不到指令行，播放器会静默执行。
- **前提**：\`[MUSIC_PLAY]\` / \`[MUSIC_SEEK]\` / \`[MUSIC_PLAY_NEXT]\` / \`[MUSIC_PLAY_PREV]\` **仅当用户已通过邀约卡接受、正在与你共听时**可用。未建立共听、或用户**拒绝**了邀约、或邀约**待回应**时，**只能**用 \`[MUSIC_SYNC_INVITE]\` 重新邀请，**禁止**直接点播。
- **切歌**：\`[MUSIC_PLAY_NEXT]\` 下一首；\`[MUSIC_PLAY_PREV]\` 上一首（须正在与该用户共听且用户已接受）。
- **点歌/换歌**：\`[MUSIC_PLAY]{}\` 或 \`[MUSIC_PLAY]{"trackId":歌曲id}\` 或 \`[MUSIC_PLAY]{"title":"歌名","artist":"歌手"}\`；**单独成行**，在指令前口语说完后再切歌（勿与对白同条）。可与语音/文字分条：先口语「换首安静点的」→ 再指令 → 再补「这首应该够安静」。**用户拒绝共听后再次想听，须先发 MUSIC_SYNC_INVITE，不可 MUSIC_PLAY。**
- **拉进度/强调某句歌词**：\`[MUSIC_SEEK]{"lyric":"歌词原文一句"}\` 或 \`{"time":"01:23"}\` / \`{"timeMs":83000}\` / \`{"percent":42}\`（须正在一起听且用户已接受）。**推荐分条节奏**：① 口语问「刚刚那句听到了吗」② 口语说「我拉回去再给你听一遍」③ **单独一行** \`[MUSIC_SEEK]{"lyric":"…"}\` ④ 口语接「就是这里！」。指令行对用户不可见，播放器会同步到该时刻并继续播放；**对白里仍禁止念时间码**。
- **邀请共听**：\`[MUSIC_SYNC_INVITE]{}\` 或带 \`trackId\` / \`title\`+\`artist\`；会发出**一起听邀约卡**（带封面与歌名，用户点击后选择接受/拒绝，**仅接受后**才开始播放）。用户拒绝后须重新发邀约，不可跳过。可与 1～3 句口语搭配，**指令须单独成行**，勿与对白写在同一行。
- **选歌一致**：指令里的 \`title\`+\`artist\` 须与你在同轮口语里描述的气质一致（说 emo/治愈/慢歌就不要填嗨曲/摇滚；说「有点吵的摇滚」才填对应曲目）；须为**网易云能搜到的真实歌曲**。
- **对白风格**：自然聊歌、歌词、感受即可；**禁止**报时间码、进度、副歌第几分钟、「我刚帮你切了歌」等无意义报幕；指令做了就当默契，用口语接歌感即可。
- 用户发来的共听邀约仍用 \`[MUSIC_SYNC_ACCEPT]\` / \`[MUSIC_SYNC_DECLINE]\` 回应，与本节角色侧指令不同。
`.trim()
