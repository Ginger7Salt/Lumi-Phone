import { Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { MockContact } from '../../../../components/anonymousQa/types'
import type { CharacterDiaryBook } from './diaryTypes'
import { DIARY_AUTO_INTERVAL_PRESETS } from './diaryTypes'
import { useDiaryStore } from './useDiaryStore'

type DiaryArchiveHomeProps = {
  contacts: MockContact[]
  onOpenPreview: (charId: string, displayName: string, avatarUrl?: string) => void
}

function IntervalSettingsSheet({
  open,
  charName,
  currentMs,
  onClose,
  onSelect,
}: {
  open: boolean
  charName: string
  currentMs: number
  onClose: () => void
  onSelect: (ms: number) => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[1400] flex items-end bg-black/20 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <div className="text-[15px] font-medium text-gray-900">自动记录频率</div>
        <div className="mt-1 text-[12px] text-gray-400">{charName} 的潜意识碎片</div>
        <ul className="mt-4 space-y-1">
          {DIARY_AUTO_INTERVAL_PRESETS.map((preset) => {
            const active = preset.ms === currentMs
            return (
              <li key={preset.ms}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(preset.ms)
                    onClose()
                  }}
                  className={`flex w-full items-center rounded-xl px-3 py-3 text-left text-[14px] transition-colors ${
                    active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {preset.label}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function SpineCard({
  contact,
  book,
  onOpenPreview,
  onConfigure,
}: {
  contact: MockContact
  book: CharacterDiaryBook
  onOpenPreview: () => void
  onConfigure: () => void
}) {
  const count = book.entries.length
  return (
    <div className="group flex w-full items-center gap-4 rounded-2xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        aria-label={`打开 ${contact.remarkName} 的日记预览`}
        onClick={onOpenPreview}
        className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-1 ring-black/5 transition-transform active:scale-[0.97]"
      >
        {contact.avatarUrl ? (
          <img
            src={contact.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[18px] text-gray-400">
            {contact.remarkName.slice(0, 1)}
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onOpenPreview}
        className="min-w-0 flex-1 text-left"
      >
        <div className="truncate text-[17px] font-semibold tracking-tight text-gray-950">
          {contact.remarkName}
        </div>
        <div className="mt-1 text-[11px] italic text-gray-400">
          {count > 0 ? `已收录 ${count} 篇潜意识碎片` : '尚未窥探任何思绪'}
        </div>
      </button>
      <button
        type="button"
        aria-label="配置生成频率"
        onClick={onConfigure}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-600"
      >
        <Settings2 className="size-3.5" strokeWidth={1.5} />
      </button>
    </div>
  )
}

export function DiaryArchiveHome({ contacts, onOpenPreview }: DiaryArchiveHomeProps) {
  const ensureBook = useDiaryStore((s) => s.ensureBook)
  const setAutoWriteInterval = useDiaryStore((s) => s.setAutoWriteInterval)
  const getBook = useDiaryStore((s) => s.getBook)

  const personaContacts = useMemo(
    () => contacts.filter((c) => c.id !== 'self' && c.characterId?.trim()),
    [contacts],
  )

  const [settingsCharId, setSettingsCharId] = useState<string | null>(null)
  const settingsContact = personaContacts.find((c) => c.characterId === settingsCharId)
  const settingsBook = settingsCharId ? getBook(settingsCharId) : null

  useEffect(() => {
    for (const c of personaContacts) {
      if (c.characterId) ensureBook(c.characterId)
    }
  }, [ensureBook, personaContacts])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/50 px-4 pb-10 pt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto max-w-[560px] space-y-3">
        {personaContacts.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-[15px] text-gray-700">藏书阁尚无角色档案</p>
            <p className="mt-2 text-[12px] leading-relaxed text-gray-400">
              在通讯录添加角色后，他们的潜意识日记本将在此陈列。
            </p>
          </div>
        ) : (
          personaContacts.map((contact) => {
            const charId = contact.characterId!
            const book = getBook(charId) ?? ensureBook(charId)
            return (
              <SpineCard
                key={charId}
                contact={contact}
                book={book}
                onOpenPreview={() => onOpenPreview(charId, contact.remarkName, contact.avatarUrl)}
                onConfigure={() => setSettingsCharId(charId)}
              />
            )
          })
        )}
      </div>

      <IntervalSettingsSheet
        open={!!settingsCharId && !!settingsContact}
        charName={settingsContact?.remarkName ?? ''}
        currentMs={settingsBook?.autoWriteInterval ?? 0}
        onClose={() => setSettingsCharId(null)}
        onSelect={(ms) => {
          if (settingsCharId) setAutoWriteInterval(settingsCharId, ms)
        }}
      />
    </div>
  )
}
