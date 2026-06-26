import type { ReactNode } from 'react'
import { CircleHelp, Clapperboard, Eye, Users, X } from 'lucide-react'

export function DirectorModeHelpButton(props: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label="叙事模式说明"
      title="叙事模式说明"
      onClick={props.onClick}
      className={
        props.className ??
        'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[#a3a3a3] transition-colors hover:bg-stone-100 hover:text-[#525252]'
      }
    >
      <CircleHelp className="size-3.5" strokeWidth={1.75} />
    </button>
  )
}

function ModeBadge(props: { children: ReactNode; tone?: 'neutral' | 'amber' | 'violet' }) {
  const tone = props.tone ?? 'neutral'
  const cls =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-800 ring-amber-100'
      : tone === 'violet'
        ? 'bg-violet-50 text-violet-800 ring-violet-100'
        : 'bg-stone-100 text-stone-600 ring-stone-200/60'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${cls}`}>
      {props.children}
    </span>
  )
}

function ModeCard(props: {
  icon: ReactNode
  title: string
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3 border-b border-stone-100 bg-gradient-to-b from-stone-50/90 to-white px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-stone-700 shadow-sm ring-1 ring-stone-200/80">
          {props.icon}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold tracking-tight text-stone-900">{props.title}</p>
            {props.badge}
          </div>
        </div>
      </div>
      <div className="space-y-2.5 px-4 py-3.5 text-[13px] leading-[1.65] text-stone-600">{props.children}</div>
    </section>
  )
}

function ModePoint(props: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-[0.35em] size-1.5 shrink-0 rounded-full bg-stone-300" aria-hidden />
      <p>
        <span className="font-medium text-stone-800">{props.label}</span>
        <span className="text-stone-600"> {props.children}</span>
      </p>
    </div>
  )
}

export function DirectorModeHelpPanel(props: { open: boolean; onClose: () => void }) {
  if (!props.open) return null
  return (
    <div
      className="absolute inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={props.onClose}
    >
      <div
        className="flex max-h-[min(88vh,680px)] w-full max-w-[400px] flex-col overflow-hidden rounded-[20px] border border-stone-200/90 bg-[#fafaf9] shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-stone-200/80 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[17px] font-semibold tracking-tight text-stone-900">叙事模式说明</p>
              <p className="mt-1 text-[12px] leading-relaxed text-stone-500">
                三种叙事视角，按需勾选；互斥与叠加关系见各卡片标签。
              </p>
            </div>
            <button
              type="button"
              className="rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
              aria-label="关闭"
              onClick={props.onClose}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 [scrollbar-width:thin]">
          <ModeCard
            icon={<Clapperboard className="size-[18px]" strokeWidth={1.75} />}
            title="导演模式"
            badge={<ModeBadge tone="neutral">可与其他模式叠加</ModeBadge>}
          >
            <ModePoint label="开启：">
              输入的是下一段剧情的生成指引，事件尚未发生；AI 从当前场面起笔当场演出，不会默认已经写完结果。
            </ModePoint>
            <ModePoint label="关闭：">
              输入视为已经发生的言行或场面，AI 从他人感知与反应续写后续。
            </ModePoint>
          </ModeCard>

          <ModeCard
            icon={<Eye className="size-[18px]" strokeWidth={1.75} />}
            title="上帝视角"
            badge={<ModeBadge tone="amber">与侧幕叙写互斥</ModeBadge>}
          >
            <p>
              只写你看不见的屏外剧情：镜头对准约会对象或 NPC 在别处的独处、与他人互动等；玩家本人不在场，不与玩家直接对话。
            </p>
            <p className="rounded-xl bg-stone-50 px-3 py-2 text-[12px] text-stone-500 ring-1 ring-stone-100">
              开启时固定不抢话（不可代写玩家当轮言行）。
            </p>
          </ModeCard>

          <ModeCard
            icon={<Users className="size-[18px]" strokeWidth={1.75} />}
            title="侧幕叙写"
            badge={<ModeBadge tone="violet">与上帝视角互斥</ModeBadge>}
          >
            <p>
              约会对象暂不出场：正文只写你与 NPC/人脉之间的对白、动作与场景；玩家可正常在场互动。
            </p>
            <p className="text-[12px] text-stone-500">适合社团、职场、路人线等主角色不在眼前的段落。</p>
          </ModeCard>

          <div className="rounded-2xl border border-dashed border-stone-200 bg-white/80 px-4 py-3 text-[12px] leading-relaxed text-stone-500">
            <p className="font-medium text-stone-600">格式提示</p>
            <p className="mt-1">
              普通模式：弯引号 / 英文引号标对白，** 标内心 OS。VN 模式须使用【旁白】/【对白】/【内心】标签。
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-stone-200/80 bg-white px-4 py-3.5">
          <button
            type="button"
            className="w-full rounded-xl bg-stone-900 px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-stone-800 active:bg-stone-950"
            onClick={props.onClose}
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  )
}
