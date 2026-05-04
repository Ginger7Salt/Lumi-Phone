import type { CharacterMemoryTriggerMode } from '../newFriendsPersona/types'

/** 列表/详情：每条记忆旁「始终触发」与「关键词触发」的黑白高亮标签，便于检阅 */
export function MemoryTriggerModeBadge({
  mode,
  className = '',
}: {
  mode?: CharacterMemoryTriggerMode
  className?: string
}) {
  const always = mode === 'always'
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[6px] border border-black px-2 py-[3px] text-[10px] font-bold leading-none shadow-sm ${
        always ? 'bg-black text-white' : 'bg-white text-black'
      } ${className}`.trim()}
      title={always ? '始终触发：每轮参考可带上本条（仍受条数上限约束）' : '关键词触发：上下文命中关键词时纳入参考'}
    >
      {always ? '始终' : '关键词'}
    </span>
  )
}
