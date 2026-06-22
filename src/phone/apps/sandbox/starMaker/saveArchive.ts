import { normalizePlayerProfile, normalizePlayerStats, resolveIdentityTier } from './playerCareer'
import type { ProducerState } from './types'

export const SAVE_ARCHIVE_VERSION = 1 as const
/** 手动存档槽位数（橙光式多档） */
export const SAVE_SLOT_COUNT = 12
/** 存档页每页展示数量（三列 × 两行） */
export const SAVE_SLOTS_PER_PAGE = 6

export const KV_SESSION_KEY = 'star-maker-sim-session-v1'
/** 旧版单档键，仅用于迁移 */
export const KV_LEGACY_KEY = 'star-maker-sim-v1'

export function slotKvKey(slotIndex: number) {
  return `star-maker-sim-slot-${slotIndex}-v1`
}

export interface SaveArchiveFile {
  version: typeof SAVE_ARCHIVE_VERSION
  savedAt: number
  state: ProducerState
}

export interface SaveSlotInfo {
  slotIndex: number
  savedAt: number | null
  identityTitle: string
  playerName: string
  progressLabel: string
  hasValidSave: boolean
  prologueDone: boolean
}

export function formatSaveDateTime(ts: number | null) {
  if (!ts || ts <= 0) return '时间未知'
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}年${m}月${day}日 ${hh}:${mm}`
}

export function buildEmptySaveSlotInfo(slotIndex: number): SaveSlotInfo {
  return {
    slotIndex,
    savedAt: null,
    identityTitle: '空档位',
    playerName: '—',
    progressLabel: '暂无存档',
    hasValidSave: false,
    prologueDone: false,
  }
}

export function buildSaveSlotInfo(
  state: ProducerState,
  savedAt: number | null,
  slotIndex = 0,
): SaveSlotInfo {
  const player = normalizePlayerProfile(state.player)
  const playerName = player?.name ?? '未命名经纪人'
  let identityTitle = '序章进行中'

  if (player?.stats) {
    identityTitle = resolveIdentityTier(normalizePlayerStats(player.stats), state.reputation).title
  } else if (state.prologueDone) {
    identityTitle = '实习经纪人'
  }

  const progressLabel = state.prologueDone
    ? `第${state.gameYear}年${state.gameMonth}月${state.gameDay}日`
    : player
      ? `${playerName} · 序章问卷`
      : '序章未开始'

  const hasValidSave = state.prologueDone || player != null

  return {
    slotIndex,
    savedAt,
    identityTitle,
    playerName,
    progressLabel,
    hasValidSave,
    prologueDone: state.prologueDone,
  }
}

export function wrapSaveArchive(state: ProducerState, savedAt = Date.now()): SaveArchiveFile {
  return { version: SAVE_ARCHIVE_VERSION, savedAt, state }
}

/** 兼容旧版裸 ProducerState 与新版带 savedAt 的包装格式 */
export function unwrapSaveRaw(
  raw: unknown,
  normalize: (state: unknown) => ProducerState,
): { state: ProducerState; savedAt: number | null } {
  if (!raw || typeof raw !== 'object') {
    return { state: normalize(null), savedAt: null }
  }
  const record = raw as Record<string, unknown>
  if (record.version === SAVE_ARCHIVE_VERSION && record.state && typeof record.state === 'object') {
    return {
      state: normalize(record.state),
      savedAt: typeof record.savedAt === 'number' && record.savedAt > 0 ? record.savedAt : null,
    }
  }
  return { state: normalize(raw), savedAt: null }
}
