import { motion } from 'framer-motion'
import { ArrowRightCircle, Copy, Plus, Trash2 } from 'lucide-react'
import type { LoreEntry } from '../../worldbook/loreArchiveTypes'
import { GLOBAL_WECHAT_PLATE_LABELS } from '../../worldbook/globalWorldBookTypes'

const PLATINUM = '#C9A961'
const CARD_SHADOW = '0 4px 20px rgba(0,0,0,0.03)'

export type LoreListPickTarget = { id: string; avatarUrl: string; name: string }

type Props = {
  entries: LoreEntry[]
  resolveTargets: (ids: string[]) => LoreListPickTarget[]
  onOpenEntry: (id: string) => void
  onCreate: () => void
  /** 在列表中快速启用/停用条目（不写详情页） */
  onSetEntryEnabled: (id: string, enabled: boolean) => void
  /** 复制为副本并进入编辑（微博等板块迁移预留） */
  onDuplicateEntry: (id: string) => void
  /** 预留：后续移至微博板块 */
  onMoveToWeiboReserved: () => void
  onDeleteEntry: (id: string) => void
}

function EntryEnableSwitch({
  enabled,
  titleLabel,
  onToggle,
}: {
  enabled: boolean
  titleLabel: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`启用本条：${titleLabel}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className="relative h-8 w-[52px] shrink-0 rounded-full transition-all duration-200 ease-out"
      style={{ background: enabled ? '#000000' : '#e5e5e5' }}
    >
      <span
        className="pointer-events-none absolute top-0.5 h-7 w-7 rounded-full bg-white shadow-sm transition-all duration-200 ease-out"
        style={{ left: enabled ? 'calc(100% - 1.75rem - 2px)' : '2px' }}
      />
    </button>
  )
}

const listVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
  },
}

function plateShort(entry: LoreEntry): string {
  if (entry.plateScope.mode === 'all') return '全部板块'
  return entry.plateScope.plates.map((p) => GLOBAL_WECHAT_PLATE_LABELS[p]).join('·')
}

function ScopeTags({
  entry,
  resolveTargets,
}: {
  entry: LoreEntry
  resolveTargets: (ids: string[]) => LoreListPickTarget[]
}) {
  const plate = plateShort(entry)
  if (entry.characterScope.mode === 'all') {
    return (
      <div className="flex max-w-[140px] flex-col items-end gap-1.5">
        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] text-neutral-600">
          {plate}
        </span>
        <span
          className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-wide text-neutral-700"
          style={{
            borderColor: 'rgba(212, 175, 55, 0.45)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(250,248,242,0.9))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          全部角色
        </span>
      </div>
    )
  }

  const ids = (entry.characterScope.mode === 'characters' ? entry.characterScope.ids : []).filter(Boolean)
  const picks = resolveTargets(ids)
  const maxStack = 3

  return (
    <div className="flex max-w-[140px] flex-col items-end gap-1.5">
      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] text-neutral-600">
        {plate}
      </span>
      {!picks.length ? (
        <span className="text-[11px] text-neutral-400">未指定角色</span>
      ) : picks.length > maxStack ? (
        <span className="text-[11px] font-medium tabular-nums text-neutral-500">指定 {picks.length} 人</span>
      ) : (
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {picks.slice(0, maxStack).map((p) => (
              <span
                key={p.id}
                className="relative inline-flex h-8 w-8 overflow-hidden rounded-full border border-white bg-neutral-100 ring-1 ring-black/[0.06]"
                title={p.name}
              >
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
                    {p.name.slice(0, 1)}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function LoreArchiveList({
  entries,
  resolveTargets,
  onOpenEntry,
  onCreate,
  onSetEntryEnabled,
  onDuplicateEntry,
  onMoveToWeiboReserved,
  onDeleteEntry,
}: Props) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#fafafa]">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-28 pt-3">
        {entries.length === 0 ? (
          <div className="mx-auto mt-16 max-w-[280px] text-center">
            <p className="text-[14px] text-neutral-500">尚无条目</p>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-400">
              点底部居中按钮添加设定；列表右侧开关可快速启用或停用条目。
            </p>
          </div>
        ) : (
          <motion.ul
            className="mx-auto flex max-w-md flex-col gap-3"
            variants={listVariants}
            initial="hidden"
            animate="show"
          >
            {entries.map((e) => {
              const enabledOn = e.enabled !== false
              const titleLabel = e.title.trim() || '未命名法则'
              return (
                <motion.li key={e.id} variants={itemVariants} layout>
                  <div
                    className={`flex w-full flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white transition hover:border-black/[0.1] ${
                      e.enabled === false ? 'opacity-55' : ''
                    }`}
                    style={{ boxShadow: CARD_SHADOW }}
                  >
                    <div className="flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenEntry(e.id)}
                        className="min-w-0 flex-1 p-4 text-left outline-none"
                      >
                        <div className="text-[15px] font-medium tracking-tight text-neutral-900">{titleLabel}</div>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-neutral-500">
                          {e.content.trim() || '为你的世界注入额外的规则'}
                        </p>
                      </button>
                      <div className="flex shrink-0 flex-col items-end justify-center gap-2 py-4 pr-4 pl-1">
                        <EntryEnableSwitch
                          enabled={enabledOn}
                          titleLabel={titleLabel}
                          onToggle={() => onSetEntryEnabled(e.id, !enabledOn)}
                        />
                        <ScopeTags entry={e} resolveTargets={resolveTargets} />
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-1 border-t border-black/[0.06] px-2 py-1.5">
                      <button
                        type="button"
                        aria-label="复制条目"
                        title="复制"
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 active:scale-95"
                        onClick={(ev) => {
                          ev.preventDefault()
                          ev.stopPropagation()
                          onDuplicateEntry(e.id)
                        }}
                      >
                        <Copy className="h-[19px] w-[19px]" strokeWidth={1.65} />
                      </button>
                      <button
                        type="button"
                        aria-label="移至微博（预留）"
                        title="移动"
                        className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-neutral-100 active:scale-95"
                        style={{ color: 'rgba(82, 82, 82, 0.85)' }}
                        onClick={(ev) => {
                          ev.preventDefault()
                          ev.stopPropagation()
                          onMoveToWeiboReserved()
                        }}
                      >
                        <ArrowRightCircle className="h-[19px] w-[19px]" strokeWidth={1.65} />
                      </button>
                      <button
                        type="button"
                        aria-label="删除条目"
                        title="删除"
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-red-600/90 transition hover:bg-red-50 active:scale-95"
                        onClick={(ev) => {
                          ev.preventDefault()
                          ev.stopPropagation()
                          onDeleteEntry(e.id)
                        }}
                      >
                        <Trash2 className="h-[19px] w-[19px]" strokeWidth={1.65} />
                      </button>
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
      </div>

      <motion.button
        type="button"
        aria-label="新建条目"
        onClick={onCreate}
        className="fixed left-1/2 z-20 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full shadow-lg"
        style={{
          backgroundColor: '#0a0a0a',
          color: PLATINUM,
          bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
        }}
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.03 }}
      >
        <Plus className="h-7 w-7" strokeWidth={1.25} />
      </motion.button>
    </div>
  )
}
