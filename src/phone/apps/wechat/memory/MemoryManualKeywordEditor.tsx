import { useState } from 'react'
import { Pressable } from '../../../components/Pressable'
import type { CharacterMemoryTriggerMode } from '../newFriendsPersona/types'

/** 手动编辑记忆：注入方式 + 关键词列表（输入框 + 添加 / 每条删除），不涉及模型侧维度字段 */
export function MemoryManualKeywordEditor({
  radioGroupName = 'mem-kw-mode',
  triggerMode,
  onTriggerMode,
  keywords,
  onKeywordsChange,
}: {
  radioGroupName?: string
  triggerMode: CharacterMemoryTriggerMode
  onTriggerMode: (m: CharacterMemoryTriggerMode) => void
  keywords: string[]
  onKeywordsChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const t = draft.replace(/\s+/g, ' ').trim()
    if (!t) return
    if (keywords.some((k) => k.replace(/\s+/g, ' ').trim() === t)) {
      setDraft('')
      return
    }
    onKeywordsChange([...keywords, t])
    setDraft('')
  }

  const removeAt = (index: number) => {
    onKeywordsChange(keywords.filter((_, i) => i !== index))
  }

  return (
    <>
      <p className="mt-4 text-[13px] font-medium text-black">注入方式</p>
      <div
        role="radiogroup"
        aria-label="注入方式"
        className="mt-2 flex gap-2"
      >
        <Pressable
          type="button"
          role="radio"
          aria-checked={triggerMode === 'keyword'}
          id={`${radioGroupName}-keyword`}
          onClick={() => onTriggerMode('keyword')}
          className={`min-h-[44px] flex-1 rounded-[10px] border px-3 py-2.5 text-center text-[14px] font-medium transition-colors ${
            triggerMode === 'keyword'
              ? 'border-black bg-black text-white'
              : 'border-black bg-white text-black hover:bg-neutral-100'
          }`}
        >
          关键词触发
        </Pressable>
        <Pressable
          type="button"
          role="radio"
          aria-checked={triggerMode === 'always'}
          id={`${radioGroupName}-always`}
          onClick={() => onTriggerMode('always')}
          className={`min-h-[44px] flex-1 rounded-[10px] border px-3 py-2.5 text-center text-[14px] font-medium transition-colors ${
            triggerMode === 'always'
              ? 'border-black bg-black text-white'
              : 'border-black bg-white text-black hover:bg-neutral-100'
          }`}
        >
          始终触发
        </Pressable>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
        「始终触发」：每轮参考可带上本条（受条数上限约束）。「关键词触发」：上下文中出现以下任一关键词时纳入参考。
      </p>

      {triggerMode === 'keyword' ? (
        <>
          <p className="mt-4 text-[13px] font-medium text-neutral-950">关键词</p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add()
                }
              }}
              placeholder="输入一个词或短语后点「添加」"
              className="min-w-0 flex-1 rounded-[10px] border border-neutral-100 bg-neutral-50 px-3 py-2 text-[14px] text-neutral-800 outline-none focus:border-neutral-950"
            />
            <Pressable
              type="button"
              onClick={add}
              className="shrink-0 rounded-[10px] border border-neutral-200 bg-white px-3 py-2 text-[13px] font-medium text-neutral-800 hover:bg-neutral-50"
            >
              添加
            </Pressable>
          </div>
          {keywords.length ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {keywords.map((kw, i) => (
                <li
                  key={`${i}-${kw}`}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-neutral-100 bg-neutral-50 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 break-words text-[14px] text-neutral-800">{kw}</span>
                  <Pressable
                    type="button"
                    onClick={() => removeAt(i)}
                    className="shrink-0 rounded-md px-2 py-1 text-[12px] text-red-700/80 hover:bg-red-50"
                  >
                    删除
                  </Pressable>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-neutral-400">尚未添加关键词</p>
          )}
        </>
      ) : null}
    </>
  )
}
