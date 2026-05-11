import type { AppSlot } from '../../types'

/** sessionStorage：从遇见等模块跳转档案室并定位到指定条目 id */
export const LORE_ARCHIVE_FOCUS_ENTRY_SESSION_KEY = 'lumi-lore-focus-entry-id'

/** 写入待打开条目并拉起「档案室」应用（由 LoreArchiveApp 消费） */
export function requestOpenLoreArchiveEntry(entryId: string): void {
  const id = entryId.trim()
  if (!id) return
  try {
    sessionStorage.setItem(LORE_ARCHIVE_FOCUS_ENTRY_SESSION_KEY, id)
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent<{ id: AppSlot['id'] }>('phone:open-app', { detail: { id: 'loreArchive' } }),
  )
}
