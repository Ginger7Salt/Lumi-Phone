import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRightCircle, CircleHelp, Copy, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { LoreEntry } from '../../worldbook/loreArchiveTypes'
import { GLOBAL_WECHAT_PLATE_LABELS } from '../../worldbook/globalWorldBookTypes'

const PLATINUM = '#C9A961'
const CARD_SHADOW = '0 4px 20px rgba(0,0,0,0.03)'

const LORE_ARCHIVE_EXAMPLES = [
  '活人感世界书：口语节奏、短句气泡、网感用语的边界与克制',
  '抗超雄世界书：禁止说教抢答、情绪暴走、脱离场景的 OOC 反应',
  '输出格式规范：群聊分行规则、禁止轮流长演讲、表情包与指令约束',
  '公共场景规则：私聊默认语气、群聊禁忌、跨板块都需遵守的礼仪',
  '跨角色公共锚点：如「{{user}} 是 XX 社团部长」等全员需知晓的设定',
] as const

function LoreArchiveIntroBanner() {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-[13px] font-medium text-neutral-700 transition hover:border-black/[0.1] hover:bg-neutral-50 active:scale-[0.99]"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <CircleHelp className="size-4 shrink-0 text-neutral-400" strokeWidth={1.75} aria-hidden />
          查看说明：档案室适合放什么
        </button>
      ) : null}

      <AnimatePresence>
        {open ? (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
            aria-labelledby="lore-archive-intro-title"
          >
            <div
              className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white"
              style={{ boxShadow: CARD_SHADOW }}
            >
              <div
                className="flex items-start gap-2 border-b border-black/[0.05] px-4 py-3"
                style={{
                  background: 'linear-gradient(180deg, rgba(250,248,242,0.95), rgba(255,255,255,0.92))',
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                    Global Worldbook · 全局世界书
                  </p>
                  <h2
                    id="lore-archive-intro-title"
                    className="mt-1 text-[15px] font-semibold tracking-tight text-neutral-900"
                  >
                    规范模型输出的全局世界书
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="收起说明"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-black/[0.05]"
                >
                  <X className="size-4" strokeWidth={1.75} />
                </button>
              </div>
              <div className="space-y-3 px-4 py-3.5">
                <p className="text-[13px] leading-relaxed text-neutral-600">
                  档案室适合放置<strong className="font-medium text-neutral-800">规范模型输出</strong>
                  的全局世界书条目——约束「怎么写、怎么回」，而不是定义「某个角色是谁」。条目会按你配置的板块与角色范围，在
                  <strong className="font-medium text-neutral-800">微信私聊、群聊、线下剧情</strong>
                  等对话中自动注入。
                </p>
                <div
                  className="rounded-xl border px-3 py-2.5 text-[12px] leading-relaxed"
                  style={{
                    borderColor: 'rgba(212, 175, 55, 0.35)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,248,242,0.75))',
                  }}
                >
                  <p className="font-medium text-neutral-800">不要放角色人设</p>
                  <p className="mt-1 text-neutral-600">
                    单个角色的性格、口癖、对你的态度、关系进展、遇见档案等，属于
                    <strong className="font-medium text-neutral-800">作用于该角色的人设世界书</strong>
                    ，请在
                    <span className="font-medium text-neutral-800"> 微信 → 人设 → 世界书 </span>
                    中编辑，不要放进档案室。
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-neutral-500">适合放在这里，例如：</p>
                  <ul className="mt-2 space-y-1.5">
                    {LORE_ARCHIVE_EXAMPLES.map((line) => (
                      <li key={line} className="flex gap-2 text-[12px] leading-snug text-neutral-600">
                        <span
                          className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: PLATINUM }}
                          aria-hidden
                        />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

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
        <LoreArchiveIntroBanner />
        {entries.length === 0 ? (
          <div className="mx-auto mt-8 max-w-[280px] text-center">
            <p className="text-[14px] text-neutral-500">尚无全局条目</p>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-400">
              适合放置活人感、抗超雄等规范模型输出的世界书；单个角色的人设请去「微信 → 人设 → 世界书」。点底部按钮添加。
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
                          {e.content.trim() || '规范模型输出的全局法则'}
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
