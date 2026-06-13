import { canonicalPublicImagePath, publicAssetUrl, resolvePublicImageUrl } from '../../publicAssetUrl'

/** 朋友圈封面宽高比（宽 / 高） */
export const MOMENTS_COVER_ASPECT = 1.08

export const DEFAULT_MOMENTS_COVER_CANONICAL = '/image/朋友圈默认背景图.png'

export const DEFAULT_MOMENTS_CONTENT_BG_CANONICAL = '/image/朋友圈默认内容区域背景图.png'

/** 站内默认图：走规范路径 + base，避免 dev/preview 子路径下 `/image/...` 404 */
function resolveBuiltInMomentsImageUrl(canonical: string): string {
  const resolved = resolvePublicImageUrl(canonical).trim()
  if (resolved) return resolved
  const rel = canonical.startsWith('/') ? canonical.slice(1) : canonical
  return publicAssetUrl(rel)
}

const DEFAULT_MOMENTS_COVER_DISPLAY = resolveBuiltInMomentsImageUrl(DEFAULT_MOMENTS_COVER_CANONICAL)

const DEFAULT_MOMENTS_CONTENT_BG_DISPLAY = resolveBuiltInMomentsImageUrl(DEFAULT_MOMENTS_CONTENT_BG_CANONICAL)

export function defaultMomentsCoverDisplayUrl(): string {
  return DEFAULT_MOMENTS_COVER_DISPLAY
}

export function isDefaultMomentsCoverUrl(url?: string | null): boolean {
  const raw = url?.trim()
  if (!raw) return true
  const canon = canonicalPublicImagePath(raw)
  return canon === DEFAULT_MOMENTS_COVER_CANONICAL
}

export function resolveMomentsCoverDisplayUrl(url?: string | null): string {
  const raw = url?.trim()
  if (!raw || isDefaultMomentsCoverUrl(raw)) return DEFAULT_MOMENTS_COVER_DISPLAY
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw
  const resolved = resolvePublicImageUrl(raw).trim()
  return resolved || DEFAULT_MOMENTS_COVER_DISPLAY
}

export function resolveMomentsContentBackgroundUrl(): string {
  return DEFAULT_MOMENTS_CONTENT_BG_DISPLAY
}

export function normalizeMomentsCoverForSave(raw: string): string {
  const t = raw.trim()
  if (!t || isDefaultMomentsCoverUrl(t)) return ''
  if (t.startsWith('data:') || t.startsWith('blob:')) return t
  const canon = canonicalPublicImagePath(t)
  return canon || t
}
