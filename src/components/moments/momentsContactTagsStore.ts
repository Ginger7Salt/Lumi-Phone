import { useCallback, useEffect, useState } from 'react'

import type { ContactTag } from './newMomentTypes'

const STORAGE_KEY = 'wechat-moments-contact-tags-v1'

function normalizeTags(raw: unknown): ContactTag[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const id = typeof o.id === 'string' ? o.id.trim() : ''
      const name = typeof o.name === 'string' ? o.name.trim() : ''
      const memberIds = Array.isArray(o.memberIds)
        ? o.memberIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : []
      if (!id || !name) return null
      return { id, name, memberIds }
    })
    .filter((t): t is ContactTag => !!t)
}

export function loadMomentsContactTags(): ContactTag[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return normalizeTags(JSON.parse(raw))
  } catch {
    return []
  }
}

export function persistMomentsContactTags(tags: ContactTag[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tags))
  } catch {
    // ignore quota
  }
}

export function createContactTagId(): string {
  return `tag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useMomentsContactTags() {
  const [tags, setTags] = useState<ContactTag[]>(() => loadMomentsContactTags())

  useEffect(() => {
    persistMomentsContactTags(tags)
  }, [tags])

  const addTag = useCallback((tag: ContactTag) => {
    setTags((prev) => [...prev, tag])
  }, [])

  const updateTag = useCallback((tag: ContactTag) => {
    setTags((prev) => prev.map((t) => (t.id === tag.id ? tag : t)))
  }, [])

  return { tags, addTag, updateTag, setTags }
}
