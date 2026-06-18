/** MemoryRouter 内跳转编辑页：对 id 做 URI 编码，避免特殊字符导致路由匹配失败 */
export function apiPresetEditPath(presetId: string): string {
  const id = presetId.trim()
  if (!id) return '/new'
  return `/edit/${encodeURIComponent(id)}`
}

export function decodeApiPresetRouteId(raw: string | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  try {
    return decodeURIComponent(t)
  } catch {
    return t
  }
}
