import { formatMomentPublishedAtAbsolute } from '../../../../components/moments/utils/timeFormat'
import { formatMomentMemoryBodyForDisplay } from './momentMemoryDisplayUtils'
import { ARCHIVE_SERIF } from './memoryArchiveTheme'
import type { MemoryEntry } from './memoryArchiveTypes'

type Props = {
  entry: MemoryEntry
  expanded: boolean
}

export function MomentMemoryArchiveCard({ entry, expanded }: Props) {
  const payload = entry.momentPayload
  if (!payload) return null

  const keywords = (entry.triggerKeywords ?? []).slice(0, 5)
  const originalText = formatMomentMemoryBodyForDisplay(payload.originalText.trim() || '（无正文）')
  const location = payload.location?.trim()
  const publishedLabel =
    typeof payload.publishedAt === 'number' && payload.publishedAt > 0
      ? formatMomentPublishedAtAbsolute(payload.publishedAt)
      : ''
  const interactionBlock =
    payload.interactionsSnapshot?.trim() || payload.socialNarrative?.trim() || ''
  const isInteractorSide = entry.momentMemoryRole === 'interactor'
  const linkedInteractors = entry.momentLinkedInteractors ?? []

  return (
    <div className="mt-3">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-[10px] font-medium tracking-wider text-gray-500">
          朋友圈
        </span>
        {keywords.length ? (
          <p className="max-w-[58%] text-right text-[10px] leading-relaxed tracking-wide text-gray-400">
            KEYWORD: [{keywords.join(', ')}]
          </p>
        ) : null}
      </div>

      {isInteractorSide && payload.publisherDisplayName?.trim() ? (
        <p className="mt-3 text-[11px] tracking-wide text-gray-500">
          发布者：{payload.publisherDisplayName.trim()}
        </p>
      ) : null}

      {isInteractorSide && payload.ownInteractionSummary?.trim() ? (
        <p className="mt-2 text-[12px] leading-relaxed text-gray-600">{payload.ownInteractionSummary.trim()}</p>
      ) : null}

      <div className="mt-4 border-l border-gray-200 pl-4">
        <p
          className={`text-[14px] leading-relaxed italic text-gray-700 ${
            expanded ? '' : 'line-clamp-3'
          }`}
          style={{ fontFamily: ARCHIVE_SERIF }}
        >
          {originalText}
        </p>
      </div>

      {publishedLabel ? (
        <p className="mt-3 text-[10px] tracking-[0.14em] text-gray-400">
          PUBLISHED: [{publishedLabel}]
        </p>
      ) : null}

      {location ? (
        <p className="mt-3 text-[10px] tracking-[0.14em] text-gray-400">
          LOCATION: [{location}]
        </p>
      ) : null}

      {interactionBlock ? (
        <div className="mt-3 rounded-2xl bg-gray-50/30 p-3">
          <p className="text-[10px] tracking-[0.14em] text-gray-400">INTERACTION</p>
          <pre
            className={`mt-2 whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-gray-600 ${
              expanded ? '' : 'line-clamp-6'
            }`}
          >
            {interactionBlock}
          </pre>
        </div>
      ) : null}

      {!isInteractorSide && linkedInteractors.length ? (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-[10px] tracking-[0.14em] text-gray-400">关联角色</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {linkedInteractors.map((person) => (
              <span
                key={person.charId}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-[11px] text-gray-600"
              >
                {person.avatarUrl ? (
                  <img
                    src={person.avatarUrl}
                    alt=""
                    className="size-4 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[9px] text-gray-500">
                    {person.displayName.slice(0, 1)}
                  </span>
                )}
                <span className="truncate">{person.displayName}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
            与以上角色私聊时，可检索到其在该条朋友圈下的互动记忆
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function isMomentMemoryEntry(entry: MemoryEntry): boolean {
  return entry.tags.includes('朋友圈') && !!entry.momentPayload
}
