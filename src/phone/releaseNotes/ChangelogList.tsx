import { RELEASE_CHANGELOG, formatChangelogDateZh, formatVersionLabel, type ChangelogEntry } from './changelog'

function EntryBlock({ entry, emphasize }: { entry: ChangelogEntry; emphasize?: boolean }) {
  return (
    <section
      className={emphasize ? 'rounded-xl border border-[#C5A880]/40 bg-white/60 px-3 py-3' : 'border-b border-black/[0.06] py-3 last:border-0'}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold tabular-nums text-[#1C1C1E]">{formatVersionLabel(entry.version)}</span>
        <span className="text-[11px] tabular-nums text-[#8E8E93]">{formatChangelogDateZh(entry.releasedAtMs)}</span>
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-[1.1rem] text-[12px] leading-relaxed text-[#3C3C43]">
        {entry.messages.map((line, i) => (
          <li key={`${entry.version}-${i}`}>{line}</li>
        ))}
      </ul>
    </section>
  )
}

/** 完整历史列表（新 → 旧） */
export function ChangelogFullList() {
  return (
    <div className="flex flex-col">
      {RELEASE_CHANGELOG.map((entry) => (
        <EntryBlock key={entry.version} entry={entry} />
      ))}
    </div>
  )
}

/** 仅最新一条（用于「本次更新」提示） */
export function ChangelogLatestOnly() {
  const entry = RELEASE_CHANGELOG[0]
  if (!entry) return null
  return <EntryBlock entry={entry} emphasize />
}
