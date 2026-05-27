/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { buildActCommission } from './buildActCommission'
import type {
  ActiveCommission,
  SerializableActiveCommission,
  TaskItem,
} from './taskCommissionTypes'
import type { YuyeActId } from '../../yuyeRoleScriptText'

type TaskStoreContextValue = {
  commission: ActiveCommission | null
  modalOpen: boolean
  sheetOpen: boolean
  /** 开启密函接取仪式 */
  beginAcceptRitual: (scriptId: string, roleName: string, actId: YuyeActId) => void
  /** 仪式完成：密函凝结为悬浮球 */
  sealAndProceed: () => void
  /** 从存档恢复已接取任务 */
  restoreCommission: (saved: SerializableActiveCommission) => void
  toggleTask: (taskId: string) => void
  openSheet: () => void
  closeSheet: () => void
  /** DEV 阶段跳转：清空已接取任务 */
  clearCommission: () => void
}

const TaskStoreContext = createContext<TaskStoreContextValue | null>(null)

export type TaskCommissionProviderProps = {
  children: ReactNode
  initialCommission?: SerializableActiveCommission | null
  onCommissionChange?: (commission: SerializableActiveCommission | null) => void
}

export function TaskCommissionProvider({
  children,
  initialCommission = null,
  onCommissionChange,
}: TaskCommissionProviderProps) {
  const [commission, setCommission] = useState<ActiveCommission | null>(() =>
    initialCommission
      ? { ...initialCommission, status: 'accepted' as const }
      : null,
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const emitAccepted = useCallback(
    (next: ActiveCommission) => {
      if (next.status !== 'accepted') return
      onCommissionChange?.({
        scriptId: next.scriptId,
        actId: next.actId,
        title: next.title,
        tasks: next.tasks.map((t) => ({ ...t })),
        status: 'accepted',
      })
    },
    [onCommissionChange],
  )

  const beginAcceptRitual = useCallback(
    (scriptId: string, roleName: string, actId: YuyeActId) => {
      const built = buildActCommission(scriptId, roleName, actId)
      setCommission({ ...built, status: 'unveiled' })
      setModalOpen(true)
      setSheetOpen(false)
    },
    [],
  )

  const sealAndProceed = useCallback(() => {
    setCommission((prev) => {
      if (!prev) return prev
      const accepted = { ...prev, status: 'accepted' as const }
      emitAccepted(accepted)
      return accepted
    })
    setModalOpen(false)
  }, [emitAccepted])

  const restoreCommission = useCallback(
    (saved: SerializableActiveCommission) => {
      setCommission({ ...saved, status: 'accepted' })
      setModalOpen(false)
    },
    [],
  )

  const toggleTask = useCallback((taskId: string) => {
    setCommission((prev) => {
      if (!prev || prev.status !== 'accepted') return prev
      const tasks = prev.tasks.map((t) =>
        t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t,
      )
      const next = { ...prev, tasks }
      emitAccepted(next)
      return next
    })
  }, [emitAccepted])

  const openSheet = useCallback(() => setSheetOpen(true), [])
  const closeSheet = useCallback(() => setSheetOpen(false), [])

  const clearCommission = useCallback(() => {
    setCommission(null)
    setModalOpen(false)
    setSheetOpen(false)
    onCommissionChange?.(null)
  }, [onCommissionChange])

  const value = useMemo<TaskStoreContextValue>(
    () => ({
      commission,
      modalOpen,
      sheetOpen,
      beginAcceptRitual,
      sealAndProceed,
      restoreCommission,
      toggleTask,
      openSheet,
      closeSheet,
      clearCommission,
    }),
    [
      commission,
      modalOpen,
      sheetOpen,
      beginAcceptRitual,
      sealAndProceed,
      restoreCommission,
      toggleTask,
      openSheet,
      closeSheet,
      clearCommission,
    ],
  )

  return <TaskStoreContext.Provider value={value}>{children}</TaskStoreContext.Provider>
}

export function useTaskStore(): TaskStoreContextValue {
  const ctx = useContext(TaskStoreContext)
  if (!ctx) throw new Error('useTaskStore must be used within TaskCommissionProvider')
  return ctx
}

export type { ActiveCommission, TaskItem }
