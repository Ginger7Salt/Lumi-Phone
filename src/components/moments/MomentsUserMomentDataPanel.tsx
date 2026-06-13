import { Pencil, Pin, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { PHONE_NUM_FONT_FAMILY } from '../../phone/types'
import {
  applyUserMomentDistributionKeywordsEdit,
  deleteUserMomentDistributionForMoment,
} from './userMomentDistributionArchiveService'
import {
  loadUserMomentDistributionRecords,
  type UserMomentDistributionCommentRef,
  type UserMomentDistributionRecord,
} from './userMomentDistributionStorage'
import { formatMomentPublishedAtAbsolute } from './utils/timeFormat'

const numStyle = { fontFamily: PHONE_NUM_FONT_FAMILY } as const

type Props = {
  accountId?: string | null
}

function CharacterChipList({
  label,
  items,
  tone,
}: {
  label: string
  items: Array<{ charId: string; displayName: string }>
  tone: 'visible' | 'hidden'
}) {
  if (!items.length) return null
  const chipClass =
    tone === 'visible'
      ? 'border-[#D1FAE5] bg-[#ECFDF5] text-[#065F46]'
      : 'border-[#FEE2E2] bg-[#FEF2F2] text-[#991B1B]'
  return (
    <div className="mt-3">
      <p className="text-[11px] font-medium text-[#6B7280]">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((c) => (
          <span
            key={c.charId}
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${chipClass}`}
          >
            {c.displayName}
          </span>
        ))}
      </div>
    </div>
  )
}

function formatCommentLine(c: UserMomentDistributionCommentRef): string {
  if (c.replyToName?.trim()) {
    return `${c.authorName} 回复 ${c.replyToName}：${c.content}`
  }
  return `${c.authorName}：${c.content}`
}

function normalizeKeywordDraft(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function KeywordEditor({
  keywords,
  onSave,
  onCancel,
  saving,
}: {
  keywords: string[]
  onSave: (next: string[]) => void
  onCancel: () => void
  saving: boolean
}) {
  const [draftKeywords, setDraftKeywords] = useState(keywords)
  const [newDraft, setNewDraft] = useState('')

  const addKeyword = () => {
    const t = normalizeKeywordDraft(newDraft)
    if (!t || t.length > 16) return
    if (draftKeywords.some((k) => normalizeKeywordDraft(k) === t)) {
      setNewDraft('')
      return
    }
    if (draftKeywords.length >= 5) return
    setDraftKeywords((prev) => [...prev, t])
    setNewDraft('')
  }

  const updateKeywordAt = (index: number, raw: string) => {
    const t = normalizeKeywordDraft(raw)
    if (!t || t.length > 16) {
      setDraftKeywords((prev) => prev.filter((_, i) => i !== index))
      return
    }
    setDraftKeywords((prev) => prev.map((k, i) => (i === index ? t : k)))
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={newDraft}
          onChange={(e) => setNewDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addKeyword()
            }
          }}
          placeholder="输入新关键词后点「添加」"
          className="min-w-0 flex-1 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] text-[#111827] outline-none focus:border-[#9CA3AF]"
        />
        <button
          type="button"
          disabled={saving || draftKeywords.length >= 5}
          onClick={addKeyword}
          className="shrink-0 rounded-full border border-[#E5E7EB] px-3 py-1.5 text-[11px] text-[#374151] disabled:opacity-40"
        >
          添加
        </button>
      </div>
      <p className="text-[10px] text-[#9CA3AF]">
        最多 <span style={numStyle}>5</span> 个，每条不超过 <span style={numStyle}>16</span> 字；保存后同步到各角色的观众记忆。
      </p>
      {draftKeywords.length ? (
        <ul className="space-y-1.5">
          {draftKeywords.map((kw, i) => (
            <li key={`${kw}-${i}`} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 ring-1 ring-[#F3F4F6]">
              <input
                type="text"
                value={kw}
                onChange={(e) => updateKeywordAt(i, e.target.value)}
                onBlur={(e) => updateKeywordAt(i, e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[12px] text-[#111827] outline-none"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => setDraftKeywords((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 text-[11px] text-[#9CA3AF] hover:text-[#991B1B]"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-[#9CA3AF]">尚未添加关键词</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(draftKeywords)}
          className="rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-40"
        >
          {saving ? '保存中…' : '保存关键词'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="rounded-full border border-[#E5E7EB] px-3 py-1.5 text-[11px] text-[#6B7280]"
        >
          取消
        </button>
      </div>
    </div>
  )
}

function DistributionRecordCard({
  record,
  accountId,
  personaNames,
  onChanged,
}: {
  record: UserMomentDistributionRecord
  accountId?: string | null
  personaNames: Map<string, string>
  onChanged: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingKeywords, setEditingKeywords] = useState(false)
  const [savingKeywords, setSavingKeywords] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const publishedLabel = formatMomentPublishedAtAbsolute(record.publishedAt)
  const updatedLabel = formatMomentPublishedAtAbsolute(record.updatedAt)
  const likeCount = record.likes?.length ?? 0
  const commentCount = record.comments?.length ?? 0

  const handleDelete = () => {
    if (!accountId?.trim() || deleting) return
    const ok = window.confirm(
      `确定删除这条个人朋友圈分发记录吗？\n\n将同时移除各可见角色记忆库中对应的观众记忆，动态本身不会被删除。`,
    )
    if (!ok) return
    setDeleting(true)
    void deleteUserMomentDistributionForMoment({ accountId, momentId: record.momentId })
      .then(() => onChanged())
      .finally(() => setDeleting(false))
  }

  const handleSaveKeywords = (next: string[]) => {
    if (!accountId?.trim() || savingKeywords) return
    setSavingKeywords(true)
    void applyUserMomentDistributionKeywordsEdit({
      accountId,
      momentId: record.momentId,
      memoryKeywords: next,
    })
      .then((ok) => {
        if (!ok) {
          window.alert('保存失败，请稍后重试。')
          return
        }
        setEditingKeywords(false)
        onChanged()
      })
      .finally(() => setSavingKeywords(false))
  }

  const resolveCharacterName = (ref: { charId: string; displayName: string }) =>
    personaNames.get(ref.charId)?.trim() || ref.displayName

  const visibleCharacters = record.visibleTo.map((ref) => ({
    ...ref,
    displayName: resolveCharacterName(ref),
  }))
  const hiddenCharacters = record.hiddenFrom.map((ref) => ({
    ...ref,
    displayName: resolveCharacterName(ref),
  }))

  return (
    <article className="rounded-2xl border border-[#F3F4F6] bg-[#FAFAFA] px-4 py-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left outline-none"
        >
          <div className="flex flex-wrap items-center gap-2">
            {record.isPinned ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-medium text-[#92400E]">
                <Pin className="size-2.5" strokeWidth={2} />
                置顶
              </span>
            ) : null}
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-[#6B7280] ring-1 ring-[#E5E7EB]">
              {record.visibilityLabel || record.privacyMode || '公开'}
            </span>
            {likeCount || commentCount ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-[#6B7280] ring-1 ring-[#E5E7EB]">
                {likeCount ? (
                  <>
                    <span style={numStyle}>{likeCount}</span>
                    {' 赞'}
                  </>
                ) : null}
                {likeCount && commentCount ? ' · ' : ''}
                {commentCount ? (
                  <>
                    <span style={numStyle}>{commentCount}</span>
                    {' 评论'}
                  </>
                ) : null}
              </span>
            ) : null}
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[#111827]">
            {record.previewText || '（无文字预览）'}
          </p>
          <p className="mt-1 text-[10px] text-[#9CA3AF]" style={numStyle}>
            发布 {publishedLabel || '—'}
            {updatedLabel && updatedLabel !== publishedLabel ? ` · 更新 ${updatedLabel}` : ''}
          </p>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-[#9CA3AF] outline-none"
          >
            {expanded ? '收起' : '展开'}
          </button>
          <button
            type="button"
            disabled={!accountId?.trim() || deleting}
            onClick={handleDelete}
            className="flex size-7 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-[#FEE2E2] hover:text-[#991B1B] disabled:opacity-40"
            aria-label="删除分发记录"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 border-t border-[#E5E7EB]/80 pt-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-[#6B7280]">记忆关键词</p>
              {!editingKeywords ? (
                <button
                  type="button"
                  onClick={() => setEditingKeywords(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-[#6B7280] outline-none hover:text-[#111827]"
                >
                  <Pencil className="size-3" strokeWidth={1.75} />
                  编辑
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingKeywords(false)}
                  className="inline-flex items-center gap-1 text-[11px] text-[#9CA3AF] outline-none"
                >
                  <X className="size-3" strokeWidth={1.75} />
                  关闭
                </button>
              )}
            </div>
            {editingKeywords ? (
              <KeywordEditor
                keywords={record.memoryKeywords}
                saving={savingKeywords}
                onSave={handleSaveKeywords}
                onCancel={() => setEditingKeywords(false)}
              />
            ) : record.memoryKeywords.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {record.memoryKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex rounded-full border border-[#E0E7FF] bg-[#EEF2FF] px-2 py-0.5 text-[10px] text-[#3730A3]"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-[#9CA3AF]">尚未提取到关键词（刻录后会出现，也可手动添加）</p>
            )}
          </div>

          <div className="mt-4">
            <p className="text-[11px] font-medium text-[#6B7280]">点赞与评论</p>
            {likeCount ? (
              <p className="mt-2 text-[12px] leading-relaxed text-[#374151]">
                {record.likes.join(' / ')}
              </p>
            ) : null}
            {commentCount ? (
              <ul className="mt-2 space-y-1.5">
                {record.comments.map((c, i) => (
                  <li
                    key={`${c.authorName}-${i}`}
                    className="rounded-lg bg-white px-2.5 py-2 text-[12px] leading-relaxed text-[#374151] ring-1 ring-[#F3F4F6]"
                  >
                    {formatCommentLine(c)}
                  </li>
                ))}
              </ul>
            ) : null}
            {!likeCount && !commentCount ? (
              <p className="mt-2 text-[11px] text-[#9CA3AF]">暂无点赞或评论</p>
            ) : null}
          </div>

          <CharacterChipList label="可见角色" items={visibleCharacters} tone="visible" />
          <CharacterChipList label="不可见角色" items={hiddenCharacters} tone="hidden" />
          <p className="mt-3 text-[9px] text-[#D1D5DB]" style={numStyle}>
            ID · {record.momentId}
          </p>
        </div>
      ) : null}
    </article>
  )
}

export function MomentsUserMomentDataPanel({ accountId }: Props) {
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<UserMomentDistributionRecord[]>([])
  const [personaNames, setPersonaNames] = useState<Map<string, string>>(() => new Map())

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await loadUserMomentDistributionRecords(accountId)
      setRecords(rows)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const onEvt = () => void reload()
    window.addEventListener('wechat-storage-changed', onEvt)
    return () => window.removeEventListener('wechat-storage-changed', onEvt)
  }, [reload])

  useEffect(() => {
    const charIds = new Set<string>()
    for (const record of records) {
      for (const ref of [...record.visibleTo, ...record.hiddenFrom]) {
        if (ref.charId.trim()) charIds.add(ref.charId.trim())
      }
    }
    if (!charIds.size) {
      setPersonaNames(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      const { personaDb } = await import('../../phone/apps/wechat/newFriendsPersona/idb')
      const next = new Map<string, string>()
      await Promise.all(
        [...charIds].map(async (charId) => {
          try {
            const ch = await personaDb.getCharacter(charId)
            const name = ch?.name?.trim()
            if (name) next.set(charId, name)
          } catch {
            /* 静默 */
          }
        }),
      )
      if (!cancelled) setPersonaNames(next)
    })()
    return () => {
      cancelled = true
    }
  }, [records])

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white px-5 py-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#9CA3AF]">USER FEED MEMORY</p>
        <h2 className="mt-1 text-[16px] font-semibold tracking-[0.01em] text-[#111827]">个人朋友圈数据</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-[#9CA3AF]">
          记录你发布并分发给角色的朋友圈摘要、可见范围、点赞评论与记忆关键词。可编辑关键词或删除单条分发记录（不会删除动态本身）；不会出现在记忆管理页。
        </p>
      </section>

      {loading ? (
        <p className="py-8 text-center text-[13px] text-[#9CA3AF]">加载中…</p>
      ) : records.length ? (
        <div className="space-y-3">
          {records.map((record) => (
            <DistributionRecordCard
              key={record.momentId}
              record={record}
              accountId={accountId}
              personaNames={personaNames}
              onChanged={() => void reload()}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-[#F9FAFB] px-4 py-10 text-center text-[13px] text-[#9CA3AF]">
          暂无已刻录的个人朋友圈分发记录。发布动态后，系统会在后台为可见角色写入记忆并在此展示。
        </p>
      )}
    </div>
  )
}
