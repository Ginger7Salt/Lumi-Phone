import { useEffect, useRef, useState } from 'react'

type CommitOnReleaseRangeInputProps = {
  value: number
  onCommit: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  'aria-label'?: string
  /** 拖动中同步草稿（用于旁边百分比文案） */
  onDraftChange?: (value: number) => void
  /** 按下开始拖动 / 松手或取消结束拖动 */
  onDragStateChange?: (dragging: boolean) => void
}

/**
 * `<input type="range">`：拖动只更新本地值，松手（或非拖动的键盘微调）才回调 onCommit，
 * 避免每 1% 写 IndexedDB / 广播导致设置页卡顿。
 */
export function CommitOnReleaseRangeInput({
  value,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  className,
  'aria-label': ariaLabel,
  onDraftChange,
  onDragStateChange,
}: CommitOnReleaseRangeInputProps) {
  const [draft, setDraft] = useState(value)
  const draggingRef = useRef(false)

  useEffect(() => {
    if (draggingRef.current) return
    setDraft(value)
  }, [value])

  const applyDraft = (next: number) => {
    setDraft(next)
    onDraftChange?.(next)
  }

  const setDragging = (next: boolean) => {
    if (draggingRef.current === next) return
    draggingRef.current = next
    onDragStateChange?.(next)
  }

  const commit = (next: number) => {
    applyDraft(next)
    if (next !== value) onCommit(next)
  }

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={draft}
      className={className}
      aria-label={ariaLabel}
      onPointerDown={() => {
        setDragging(true)
      }}
      onChange={(e) => {
        const next = Number(e.target.value)
        applyDraft(next)
        // 键盘微调没有 pointer 拖动：立刻提交
        if (!draggingRef.current) commit(next)
      }}
      onPointerUp={(e) => {
        if (!draggingRef.current) return
        const next = Number(e.currentTarget.value)
        commit(next)
        setDragging(false)
      }}
      onPointerCancel={() => {
        setDragging(false)
        applyDraft(value)
      }}
    />
  )
}
