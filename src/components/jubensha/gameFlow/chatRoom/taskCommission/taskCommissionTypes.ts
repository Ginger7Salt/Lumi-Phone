export interface TaskItem {
  id: string
  text: string
  isCompleted: boolean
}

export interface ActiveCommission {
  scriptId: string
  actId: 'act1' | 'act2' | 'act3'
  title: string
  tasks: TaskItem[]
  status: 'locked' | 'unveiled' | 'accepted'
}

/** framer-motion 形变：密函 ↔ 悬浮怀表 */
export const TASK_COMMISSION_LAYOUT_ID = 'jbs-task-commission-anchor'

export type SerializableActiveCommission = Omit<ActiveCommission, 'status'> & {
  status: 'accepted'
}
