import type { Store, StoreReview } from './types'

const STORAGE_PREFIX = 'lumi-taste-user-reviews-v1'

function storageKey(accountId: string): string {
  return `${STORAGE_PREFIX}:${accountId}`
}

function readAll(accountId: string): Record<string, StoreReview[]> {
  try {
    const raw = window.localStorage.getItem(storageKey(accountId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, StoreReview[]>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(accountId: string, data: Record<string, StoreReview[]>) {
  try {
    window.localStorage.setItem(storageKey(accountId), JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function readUserStoreReviews(accountId: string, storeId: string): StoreReview[] {
  return readAll(accountId)[storeId] ?? []
}

export function appendUserStoreReview(
  accountId: string,
  storeId: string,
  review: StoreReview,
): StoreReview[] {
  const all = readAll(accountId)
  const existing = all[storeId] ?? []
  const next = [review, ...existing]
  writeAll(accountId, { ...all, [storeId]: next })
  return next
}

export function getMergedStoreReviews(accountId: string | null | undefined, store: Store): StoreReview[] {
  const userRows = accountId ? readUserStoreReviews(accountId, store.id) : []
  return [...userRows, ...store.reviews]
}

export function getMergedStoreReviewCount(accountId: string | null | undefined, store: Store): number {
  return getMergedStoreReviews(accountId, store).length
}

export function getMergedStoreRating(accountId: string | null | undefined, store: Store): number {
  const reviews = getMergedStoreReviews(accountId, store)
  if (!reviews.length) return store.rating
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  return Math.round((sum / reviews.length) * 10) / 10
}
