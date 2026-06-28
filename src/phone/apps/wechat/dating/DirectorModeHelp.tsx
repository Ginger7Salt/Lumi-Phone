import type { ReactNode } from 'react'
import { CircleHelp, Clapperboard, Eye, GitBranch, Layers, Users, X } from 'lucide-react'

export function DirectorModeHelpButton(props: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label="玩法说明"
      title="玩法说明"
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
              <p className="text-[17px] font-semibold tracking-tight text-stone-900">玩法说明</p>
              <p className="mt-1 text-[12px] leading-relaxed text-stone-500">
                下面几个开关可以单独开，也可以组合用；不能同时开的会标在卡片上。
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
            badge={<ModeBadge tone="neutral">可和其他开关一起用</ModeBadge>}
          >
            <ModePoint label="开启：">
              你写的是「接下来想怎么演」的提示，事情还没发生；AI 从当前场面接着写，不会默认你已经做完结果。
            </ModePoint>
            <ModePoint label="关闭：">
              你写的是已经说过、做过的事；AI 从别人的反应接着写。
            </ModePoint>
          </ModeCard>

          <ModeCard
            icon={<Eye className="size-[18px]" strokeWidth={1.75} />}
            title="上帝视角"
            badge={<ModeBadge tone="amber">不能和侧幕叙写一起开</ModeBadge>}
          >
            <p>
              只写「你看不见的地方」：约会对象或路人在别处干什么；这一轮里没有你本人，也不会直接跟你说话。
            </p>
            <p className="rounded-xl bg-stone-50 px-3 py-2 text-[12px] text-stone-500 ring-1 ring-stone-100">
              开着的时候，AI 不会替你写你这一轮说了什么、做了什么。
            </p>
          </ModeCard>

          <ModeCard
            icon={<Users className="size-[18px]" strokeWidth={1.75} />}
            title="侧幕叙写"
            badge={<ModeBadge tone="violet">不能和上帝视角一起开</ModeBadge>}
          >
            <p>
              这一轮约会对象先不出场，只写你和其他人脉、路人之间的对话和场面；你可以正常在场互动。
            </p>
            <p className="text-[12px] text-stone-500">适合社团、上班、偶遇路人等「对象不在眼前」的段落。</p>
          </ModeCard>

          <ModeCard
            icon={<Layers className="size-[18px]" strokeWidth={1.75} />}
            title="平行事件"
            badge={<ModeBadge tone="violet">可选 · 可和其他开关一起用</ModeBadge>}
          >
            <ModePoint label="是什么：">
              同一条剧情正在发生的那个时刻，在另一个地方同时还在发生什么——像「镜头切到隔壁房间」。用旁白写，不是当前这条线里谁的视角。
            </ModePoint>
            <ModePoint label="怎么用：">
              发剧情前勾选，会跟这一轮一起生成；也可以点某条 AI 剧情右边的「平行事件」单独补写，还能填想写什么、写多长。
            </ModePoint>
            <ModePoint label="存到哪里：">
              全文在卡片里能看；还会记进剧情时间轴：约会对象那边只记「不知道的事」，平行里出现的人脉各记一条（他们的打算、伏笔只写本人相关的）。
            </ModePoint>
            <ModePoint label="注意：">
              这条剧情里已经在场的人，不能又出现在平行那边；不能写之前或之后的事，也不能改掉主线已经定下来的情节。
            </ModePoint>
            <p className="rounded-xl bg-violet-50/60 px-3 py-2 text-[12px] text-violet-900/80 ring-1 ring-violet-100">
              平行正文不会整段塞进下一轮参考；续写主线时，对象只能看到时间轴上的简短记录。
            </p>
          </ModeCard>

          <ModeCard
            icon={<GitBranch className="size-[18px]" strokeWidth={1.75} />}
            title="IF 线"
            badge={<ModeBadge tone="violet">可选 · 可和其他开关一起用</ModeBadge>}
          >
            <ModePoint label="是什么：">
              「要是当时选了另一条路会怎样」的假想小片段，纯脑洞，不算真正发生过的事。
            </ModePoint>
            <ModePoint label="怎么用：">
              发剧情前勾选会一起生成；也可以点剧情卡片右边的「IF线」单独写。
            </ModePoint>
            <ModePoint label="存到哪里：">
              只存在这张卡片里，自己看；不进剧情时间轴，也不影响后面 AI 怎么写主线。
            </ModePoint>
            <p className="rounded-xl bg-stone-50 px-3 py-2 text-[12px] text-stone-500 ring-1 ring-stone-100">
              比如试写「要是当时没追问，转身走了会怎样」；和平行事件（同时别处发生的事）不是一回事。
            </p>
          </ModeCard>

          <div className="rounded-2xl border border-dashed border-stone-200 bg-white/80 px-4 py-3 text-[12px] leading-relaxed text-stone-500">
            <p className="font-medium text-stone-600">格式提示</p>
            <p className="mt-1">
              平时：弯引号或英文引号是说话，** 是心里想法。VN 模式要用【旁白】【对白】【内心】标签。
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
