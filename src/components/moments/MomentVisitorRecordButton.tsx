import { Eye, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { MomentInteraction } from './momentInteractionTypes'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import {
  buildMomentVisitorRecords,
  countMomentVisitorRecords,
  type MomentVisitorRecord,
} from './momentVisitorRecordUtils'
import {
  MomentsSerifNumericText,
  MomentsSerifNumericValue,
} from './ArchiveTimelineDateColumn'
import { formatNoticeTimestamp } from './utils/noticeTimeFormat'

type MomentVisitorRecordButtonProps = {
  interactions?: MomentInteraction[]
  now: number
  contactDirectory: MomentsContactDirectory
}

function findMomentsPageShell(start: HTMLElement | null): HTMLElement | null {
  let el = start
  while (el) {
    if (el.hasAttribute('data-moments-page-shell')) return el
    el = el.parentElement
  }
  return null
}

function findMomentsFeedScroller(start: HTMLElement | null): HTMLElement | null {
  let el = start
  while (el) {
    if (el.hasAttribute('data-moments-feed-scroller')) return el
    el = el.parentElement
  }
  return null
}

function VisitorActionLabel({ record }: { record: MomentVisitorRecord }) {
  if (record.commented && record.liked) return <>赞了并评论了</>
  if (record.commented) return <>评论了</>
  if (record.liked) return <>赞了</>
  return (
    <>
      浏览了{' '}
      <MomentsSerifNumericValue value={record.dwellSeconds ?? 12} className="tabular-nums" />
      {' '}
      秒
    </>
  )
}

export function MomentVisitorRecordButton({
  interactions,
  now,
  contactDirectory,
}: MomentVisitorRecordButtonProps) {
  const [open, setOpen] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const count = useMemo(
    () => countMomentVisitorRecords(interactions, now),
    [interactions, now],
  )
  const records = useMemo(
    () => buildMomentVisitorRecords(interactions, now, contactDirectory),
    [contactDirectory, interactions, now],
  )

  const pageShell = portalTarget

  useEffect(() => {
    if (!open) return
    const scroller = findMomentsFeedScroller(wrapRef.current)
    if (!scroller) return

    const prevOverflow = scroller.style.overflow
    const prevTouchAction = scroller.style.touchAction
    scroller.style.overflow = 'hidden'
    scroller.style.touchAction = 'none'

    return () => {
      scroller.style.overflow = prevOverflow
      scroller.style.touchAction = prevTouchAction
    }
  }, [open])

  const overlay = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="absolute inset-0 z-[520] flex items-end justify-center bg-black/35 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="访客记录"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="mx-auto flex max-h-[min(78vh,640px)] w-full max-w-[560px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.12)] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-black/5 px-5 py-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                  VISITORS
                </p>
                <h2 className="mt-0.5 text-[17px] font-semibold text-[#111827]">访客记录</h2>
              </div>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setOpen(false)}
                className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-black/[0.04]"
              >
                <X className="size-5 text-[#6B7280]" strokeWidth={1.75} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {records.length ? (
                <ul className="divide-y divide-black/[0.05]">
                  {records.map((record) => (
                    <li key={record.charId} className="flex items-start gap-3 py-3.5">
                      {record.avatarUrl ? (
                        <img
                          src={record.avatarUrl}
                          alt=""
                          className="size-10 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-[13px] text-[#9CA3AF]">
                          {record.displayName.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[14px] font-semibold text-[#111827]">
                            {record.displayName}
                          </p>
                          <span className="shrink-0 text-[11px] tabular-nums text-[#9CA3AF]">
                            <MomentsSerifNumericText
                              text={formatNoticeTimestamp(record.visitedAt, now)}
                            />
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-[#6B7280]">
                          <VisitorActionLabel record={record} />
                        </p>
                        {record.commentPreview ? (
                          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#374151]">
                            「{record.commentPreview}」
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-16 text-center text-[13px] leading-relaxed text-[#9CA3AF]">
                  还没有访客记录
                  <br />
                  <span className="text-[12px]">解锁后将显示浏览、点赞与评论的角色</span>
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={() => {
          setPortalTarget(findMomentsPageShell(wrapRef.current))
          setOpen(true)
        }}
        className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] text-[#6B7280] transition-colors hover:bg-black/[0.04]"
        aria-label="查看访客记录"
      >
        <Eye className="size-3.5" />
        <span className="flex items-center gap-0.5">
          访客
          {count > 0 ? (
            <MomentsSerifNumericValue value={count} className="tabular-nums" />
          ) : null}
        </span>
      </motion.button>

      {pageShell ? createPortal(overlay, pageShell) : overlay}
    </div>
  )
}
