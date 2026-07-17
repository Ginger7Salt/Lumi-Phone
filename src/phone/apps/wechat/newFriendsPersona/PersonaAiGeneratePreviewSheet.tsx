import { motion } from 'framer-motion'
import { Check, RefreshCw, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { PersonaAiGenerateResult } from './personaAiGenerate'
import type { Character } from './types'

export type PersonaAiPreviewEntry = {
  id: string
  /** 勾选键：世界书用条目标题；顶层用 bio / openingLines 等 */
  selectKey: string
  title: string
  body: string
  kind: 'top' | 'wb'
}

function collectPreviewEntries(
  result: PersonaAiGenerateResult,
): PersonaAiPreviewEntry[] {
  const out: PersonaAiPreviewEntry[] = []
  const snap = result.parsedSnapshot
  const ch = result.character

  const pushTop = (selectKey: string, title: string, raw: unknown, fallback?: string) => {
    const body =
      (typeof raw === 'string' ? raw.trim() : '') ||
      (fallback ?? '').trim() ||
      '（空）'
    out.push({
      id: `top-${selectKey}`,
      selectKey,
      title,
      body,
      kind: 'top',
    })
  }

  pushTop('realName', '真实姓名', snap.realName, ch.name)
  pushTop('wechatNickname', '微信昵称', snap.wechatNickname, ch.wechatNickname)
  pushTop('bio', '简介', snap.bio, ch.bio)

  const book = ch.worldBooks?.[0]
  const fromChar =
    book?.items
      ?.map((it) => ({
        name: String(it.name ?? '').trim(),
        content: String(it.content ?? '').trim(),
      }))
      .filter((e) => e.name) ?? []

  const fromSnap: { name: string; content: string }[] = []
  if (Array.isArray(snap.worldBookEntries)) {
    for (const x of snap.worldBookEntries) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const name = String(o.name ?? '').trim()
      const content = String(o.content ?? '').trim()
      if (!name) continue
      fromSnap.push({ name, content })
    }
  }

  const seen = new Set<string>()
  for (const e of [...fromChar, ...fromSnap]) {
    if (seen.has(e.name)) continue
    seen.add(e.name)
    const content =
      fromChar.find((x) => x.name === e.name)?.content ||
      fromSnap.find((x) => x.name === e.name)?.content ||
      '（空）'
    out.push({
      id: `wb-${e.name}`,
      selectKey: e.name,
      title: e.name,
      body: content,
      kind: 'wb',
    })
  }

  return out
}

/** 生成完成后的世界书预览：可整卷重生成，或勾选条目 + 改写要求局部重写 */
export function PersonaAiGeneratePreviewSheet({
  result,
  busy,
  onClose,
  onAdopt,
  onRegenerateAll,
  onRegenerateSelected,
}: {
  result: PersonaAiGenerateResult
  busy: boolean
  onClose: () => void
  onAdopt: () => void
  onRegenerateAll: () => void
  onRegenerateSelected: (selectedKeys: string[], guidance: string) => void
}) {
  const entries = useMemo(() => collectPreviewEntries(result), [result])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [expandedId, setExpandedId] = useState<string | null>(entries[0]?.id ?? null)
  const [guidance, setGuidance] = useState('')

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectAllWb = () => {
    setSelected(new Set(entries.filter((e) => e.kind === 'wb').map((e) => e.selectKey)))
  }

  const clearSel = () => setSelected(new Set())

  const character: Character = result.character
  const displayName = character.name?.trim() || character.wechatNickname?.trim() || '角色'

  return (
    <div className="fixed inset-0 z-[1360] flex items-end justify-center bg-black/40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-6 backdrop-blur-[2px] sm:items-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex max-h-[min(88dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
      >
        <div className="shrink-0 border-b border-neutral-100 px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
            Preview
          </p>
          <p className="mt-1 text-[17px] font-semibold text-neutral-900">世界书预览 · {displayName}</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">
            勾选不满意的条目，写下改写要求后局部重写；也可整卷重新生成，或直接采用。
          </p>
          {result.issues.length > 0 ? (
            <p className="mt-2 text-[11px] text-amber-700/90">
              仍有 {result.issues.length} 项质量提示（可先采用再改，或勾选重写）。
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-neutral-500">条目列表</p>
            <div className="flex gap-2 text-[11px]">
              <button
                type="button"
                disabled={busy}
                onClick={selectAllWb}
                className="text-neutral-500 disabled:opacity-40"
              >
                全选世界书
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={clearSel}
                className="text-neutral-500 disabled:opacity-40"
              >
                清空勾选
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {entries.map((entry) => {
              const active = selected.has(entry.selectKey)
              const open = expandedId === entry.id
              return (
                <div
                  key={entry.id}
                  className={`overflow-hidden rounded-2xl border ${
                    active ? 'border-neutral-800/25 bg-neutral-50' : 'border-neutral-100 bg-[#FAFAFA]'
                  }`}
                >
                  <div className="flex items-stretch gap-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggle(entry.selectKey)}
                      className="flex w-10 shrink-0 items-center justify-center disabled:opacity-40"
                      aria-label={active ? '取消勾选' : '勾选重写'}
                    >
                      <span
                        className={`flex size-4 items-center justify-center rounded border ${
                          active
                            ? 'border-neutral-900 bg-neutral-900 text-white'
                            : 'border-neutral-300 bg-white text-transparent'
                        }`}
                      >
                        <Check className="size-2.5" strokeWidth={2.6} />
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setExpandedId(open ? null : entry.id)}
                      className="min-w-0 flex-1 py-2.5 pr-3 text-left disabled:opacity-40"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-neutral-900">
                          {entry.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-neutral-400">
                          {entry.kind === 'wb' ? '世界书' : '名片'} · {entry.body.length} 字
                        </span>
                      </span>
                      {!open ? (
                        <span className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-neutral-400">
                          {entry.body}
                        </span>
                      ) : null}
                    </button>
                  </div>
                  {open ? (
                    <div className="border-t border-neutral-100/80 px-3 py-2.5">
                      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-neutral-600">
                        {entry.body}
                      </pre>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="mt-4">
            <label className="text-[11px] font-medium text-neutral-500" htmlFor="persona-regen-guidance">
              改写要求（局部重写时生效）
            </label>
            <textarea
              id="persona-regen-guidance"
              disabled={busy}
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              rows={3}
              placeholder="例如：性格内核更冷淡克制；对你现在不要写成暗恋；亲密条目语气更日常…"
              className="mt-1.5 w-full resize-none rounded-2xl border border-neutral-200 bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-neutral-400 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-neutral-100 px-4 py-4">
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => onRegenerateSelected([...selected], guidance)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-40"
          >
            <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            {busy ? '重写中…' : `重写所选 ${selected.size || ''} 项`}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRegenerateAll}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[14px] font-semibold text-neutral-900 disabled:opacity-40"
          >
            <Sparkles className="size-4" strokeWidth={1.5} />
            全部重新生成
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onAdopt}
            className="w-full rounded-xl bg-neutral-100 py-3 text-[14px] font-semibold text-neutral-900 disabled:opacity-40"
          >
            采用此稿
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="w-full py-2 text-[13px] text-neutral-400 disabled:opacity-40"
          >
            返回继续改种子
          </button>
        </div>
      </motion.div>
    </div>
  )
}
