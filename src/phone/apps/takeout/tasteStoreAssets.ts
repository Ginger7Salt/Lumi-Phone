import type { MenuItem } from './types'

export function fileBaseName(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/')
  const name = norm.split('/').pop() ?? ''
  return name.replace(/\.(webp|png|jpe?g)$/i, '')
}

/** 去掉 Windows 短文件名后缀如 ~1 */
export function cleanItemName(base: string): string {
  return base.replace(/~\d+$/, '').trim()
}

export function slugifyWithPrefix(prefix: string, name: string): string {
  let h = 2166136261
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `${prefix}-${(h >>> 0).toString(36)}`
}

const LOGO_KEYS = ['logo', 'LOGO']
const COVER_KEYS = ['店铺背景', '背景图']

export function isLogoFile(base: string): boolean {
  const lower = base.toLowerCase()
  return LOGO_KEYS.some((k) => lower.includes(k.toLowerCase()))
}

export function isCoverFile(base: string): boolean {
  return COVER_KEYS.some((k) => base.includes(k))
}

export type AssetMenuEntry = { name: string; image: string }

export function parseStoreImageFolder(
  modules: Record<string, string>,
): { logoImage: string; coverImage: string; menuEntries: AssetMenuEntry[] } | null {
  let logoImage = ''
  let coverImage = ''
  const menuEntries: AssetMenuEntry[] = []

  for (const [filePath, url] of Object.entries(modules)) {
    if (!url) continue
    const base = fileBaseName(filePath)
    if (isLogoFile(base)) {
      if (!logoImage || base.toLowerCase().includes('logo')) logoImage = url
      continue
    }
    if (isCoverFile(base)) {
      coverImage = url
      continue
    }
    const name = cleanItemName(base)
    if (!name) continue
    menuEntries.push({ name, image: url })
  }

  if (!logoImage || !coverImage || menuEntries.length === 0) return null
  return { logoImage, coverImage, menuEntries }
}

export function sortMenuEntries(
  entries: AssetMenuEntry[],
  inferCategory: (name: string) => string,
): AssetMenuEntry[] {
  return [...entries].sort((a, b) => {
    const cat = inferCategory(a.name).localeCompare(inferCategory(b.name), 'zh-CN')
    if (cat !== 0) return cat
    return a.name.localeCompare(b.name, 'zh-CN')
  })
}

export function pickHotItemIds(menus: MenuItem[], priorityNames: string[]): string[] {
  const picked: string[] = []
  for (const name of priorityNames) {
    const hit = menus.find((m) => m.name === name)
    if (hit && !picked.includes(hit.id)) picked.push(hit.id)
    if (picked.length >= 3) break
  }
  if (picked.length < 3) {
    for (const m of menus) {
      if (!picked.includes(m.id)) picked.push(m.id)
      if (picked.length >= 3) break
    }
  }
  return picked
}
