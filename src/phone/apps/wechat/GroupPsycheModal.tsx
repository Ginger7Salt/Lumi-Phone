import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import type { CharacterPsyche, GroupPsycheArchive } from './newFriendsPersona/types'

function ArchiveMetricRow({ en, zh, value }: { en: string; zh: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] gap-x-5 gap-y-0.5 border-b border-gray-200/40 py-3.5 last:border-b-0">
      <div>
        <span className="block text-[10px] font-medium uppercase tracking-widest text-gray-400">{en}</span>
        <span className="mt-1 block text-[10px] uppercase tracking-widest text-gray-400">{zh}</span>
      </div>
      <p className="self-center text-[14px] font-normal leading-relaxed text-[#1C1C1E]">{value.trim() ? value : '—'}</p>
    </div>
  )
}

function TabSkeleton() {
  return (
    <div className="space-y-6 px-1 py-2">
      <div className="h-3 w-32 animate-pulse rounded bg-gray-200/60" />
      <div className="space-y-3">
        <div className="h-10 w-full animate-pulse rounded bg-gray-100/80" />
        <div className="h-10 w-full animate-pulse rounded bg-gray-100/80" />
        <div className="h-10 w-full animate-pulse rounded bg-gray-100/80" />
      </div>
      <div className="h-24 w-full animate-pulse rounded bg-gray-100/70" />
    </div>
  )
}

export function GroupPsycheModal({
  open,
  loading,
  archive,
  onClose,
  onGenerate,
}: {
  open: boolean
  loading: boolean
  archive: GroupPsycheArchive | null
  onClose: () => void
  onGenerate: () => void
}) {
  const list = archive?.characters ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (!list.length) {
      setSelectedId(null)
      return
    }
    setSelectedId((prev) => {
      if (prev && list.some((c) => c.charId === prev)) return prev
      return list[0]?.charId ?? null
    })
  }, [open, list])

  const active = useMemo(() => list.find((c) => c.charId === selectedId) ?? null, [list, selectedId])

  const selectChar = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="group-psyche-mask"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            key="group-psyche-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-psyche-title"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-h-[min(88vh,820px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border-[0.5px] border-gray-200/60 bg-white/85 shadow-[0_20px_60px_rgba(0,0,0,0.05)] backdrop-blur-2xl"
            style={{
              WebkitBackdropFilter: 'blur(24px)',
              /** 与 WeChatApp 根节点一致：微信主题字族，未定义时回退手机全局 `--phone-font` */
              fontFamily: 'var(--wx-font, var(--phone-font, system-ui))',
              fontSize: 'var(--wx-font-size, 14px)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200/50 px-5 pb-3 pt-4">
              <div id="group-psyche-title" className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-widest text-gray-400">GROUP INNER VOICE</p>
                <h2 className="mt-1 text-[17px] font-semibold tracking-tight text-[#1C1C1E]">群聊心语</h2>
                <p className="mt-0.5 text-[10px] uppercase tracking-widest text-gray-400">ARCHIVE · 本轮档案</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Pressable
                  type="button"
                  onClick={onGenerate}
                  disabled={loading}
                  className="rounded-lg border border-gray-300/80 bg-white/60 px-3 py-1.5 text-[11px] font-medium tracking-wide text-[#1C1C1E] transition-colors hover:border-[#D4AF37]/50 hover:bg-white disabled:opacity-45"
                >
                  {loading ? '生成中…' : '生成 / 刷新'}
                </Pressable>
                <Pressable
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100/80 hover:text-[#1C1C1E]"
                  aria-label="关闭"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                  </svg>
                </Pressable>
              </div>
            </div>

            <div className="shrink-0 border-b border-gray-100/80 px-2 pt-2">
              <p className="px-3 pb-1 text-[10px] uppercase tracking-widest text-gray-400">ROSTER · 成员</p>
              <div
                className="flex gap-3 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {list.map((c) => {
                  const sel = c.charId === selectedId
                  return (
                    <Pressable
                      key={c.charId}
                      type="button"
                      onClick={() => selectChar(c.charId)}
                      className="flex w-[56px] shrink-0 flex-col items-center gap-1.5 outline-none"
                    >
                      <span
                        className={`relative block h-12 w-12 rounded-full transition-all duration-200 ${
                          sel
                            ? 'ring-1 ring-[#D4AF37] ring-offset-2 ring-offset-white/90 opacity-100 grayscale-0'
                            : 'opacity-50 grayscale-[50%]'
                        }`}
                      >
                        {c.avatarUrl.trim() ? (
                          <img src={c.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-200/90 text-[11px] font-medium text-gray-500">
                            {(c.name || c.charId).slice(0, 1)}
                          </span>
                        )}
                      </span>
                      <span
                        className={`line-clamp-2 w-full text-center text-[10px] leading-tight ${
                          sel ? 'font-medium text-[#1C1C1E]' : 'text-gray-500'
                        }`}
                      >
                        {c.name || c.charId}
                      </span>
                    </Pressable>
                  )
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">
              {loading ? (
                <TabSkeleton />
              ) : !list.length ? (
                <p className="py-10 text-center text-[13px] leading-relaxed text-gray-500">
                  暂无档案。点击「生成 / 刷新」基于当前群聊与每名 NPC 写入本轮心语。
                </p>
              ) : (
                <>
                  <div className="flex justify-end pt-2">
                    <span className="text-[10px] tabular-nums uppercase tracking-widest text-gray-400">
                      {archive?.timestamp?.trim() ? archive.timestamp : '—'}
                    </span>
                  </div>

                  <AnimatePresence mode="wait">
                    {active ? (
                      <motion.div
                        key={active.charId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="pb-2 pt-3"
                      >
                        <section className="rounded-xl border border-gray-200/40 bg-white/40 px-4 py-1">
                          <p className="py-2 text-[10px] font-medium uppercase tracking-widest text-gray-400">
                            PHYSICAL STATE · 物理测写
                          </p>
                          <ArchiveMetricRow en="LOCATION" zh="所在地点" value={active.location} />
                          <ArchiveMetricRow en="OUTFIT" zh="着装" value={active.clothing} />
                          <ArchiveMetricRow en="POSTURE" zh="动作姿态" value={active.posture} />
                        </section>

                        <section className="my-6 rounded-xl border border-gray-200/40 bg-white/40 px-4 py-3">
                          <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-gray-400">
                            MONOLOGUE · 内心独白
                          </p>
                          <p className="text-[14px] font-normal leading-relaxed text-[#1C1C1E]">
                            {active.monologue.trim() ? active.monologue : '—'}
                          </p>
                        </section>

                        <section>
                          <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-gray-400">
                            THOUGHTS ON YOU · 对你
                          </p>
                          <p className="mb-2 text-[13px] font-medium leading-snug text-[#1C1C1E]">
                            {active.name || '该成员'} 对你的看法
                          </p>
                          <div className="rounded-lg bg-gray-50/50 p-4">
                            <p className="text-[14px] font-normal leading-relaxed text-[#1C1C1E]">
                              {active.impressionOnUser.trim() ? active.impressionOnUser : '—'}
                            </p>
                          </div>
                        </section>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
