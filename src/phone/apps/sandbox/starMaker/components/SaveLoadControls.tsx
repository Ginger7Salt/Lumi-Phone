import { useState } from 'react'
import { Pressable } from '../../../../components/Pressable'
import { SimNumText } from '../components/SimNum'
import { useSimulatorStore } from '../useSimulatorStore'

export function SaveLoadToast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(100%+4px)] z-[120] flex justify-center px-4">
      <div className="sm-save-toast max-w-sm px-4 py-2 text-center text-[12px] leading-snug">
        <SimNumText text={message} />
      </div>
    </div>
  )
}

export function SaveLoadControls({
  onOpenArchive,
  onToast,
}: {
  onOpenArchive: (mode: 'save' | 'load') => void
  onToast: (message: string) => void
}) {
  const hydrated = useSimulatorStore((s) => s.hydrated)
  const restartGame = useSimulatorStore((s) => s.restartGame)
  const [busy, setBusy] = useState(false)

  if (!hydrated) return null

  async function handleRestart() {
    if (busy) return
    const ok = window.confirm('确定重开？当前进度将被清空，并回到序章。')
    if (!ok) return
    setBusy(true)
    try {
      await restartGame()
      onToast('已重开，请重新填写命运问卷')
    } catch (err) {
      onToast(err instanceof Error ? err.message : '重开失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Pressable
        disabled={busy}
        onClick={() => onOpenArchive('save')}
        className="sm-header-action"
        aria-label="保存"
      >
        保存
      </Pressable>
      <Pressable
        disabled={busy}
        onClick={() => onOpenArchive('load')}
        className="sm-header-action"
        aria-label="载入"
      >
        载入
      </Pressable>
      <Pressable
        disabled={busy}
        onClick={() => void handleRestart()}
        className="sm-header-action sm-header-action-danger"
        aria-label="重开"
      >
        重开
      </Pressable>
    </div>
  )
}
