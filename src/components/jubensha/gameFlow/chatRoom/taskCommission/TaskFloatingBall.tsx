import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'

import { TASK_COMMISSION_LAYOUT_ID } from './taskCommissionTypes'
import { useTaskStore } from './useTaskStore'

import './jbs-task-commission.css'

function PocketWatchFace() {
  return (
    <svg
      className="jbs-task-ball-dial"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
    >
      <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
        const x1 = 24 + Math.cos(angle) * 16
        const y1 = 24 + Math.sin(angle) * 16
        const x2 = 24 + Math.cos(angle) * 18.5
        const y2 = 24 + Math.sin(angle) * 18.5
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(255,255,255,0.42)"
            strokeWidth={i % 3 === 0 ? 1 : 0.5}
          />
        )
      })}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '24px 24px' }}
      >
        <circle
          cx="24"
          cy="24"
          r="11"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="0.5"
          strokeDasharray="2 4"
        />
      </motion.g>
      <motion.line
        x1="24"
        y1="24"
        x2="24"
        y2="10"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1"
        strokeLinecap="round"
        animate={{ rotate: -360 }}
        transition={{ duration: 72, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '24px 24px' }}
      />
      <circle cx="24" cy="24" r="1.8" fill="rgba(255,255,255,0.85)" />
    </svg>
  )
}

function TaskChecklistSheet() {
  const { commission, sheetOpen, closeSheet, toggleTask } = useTaskStore()
  if (!commission) return null

  const completed = commission.tasks.filter((t) => t.isCompleted).length

  return (
    <AnimatePresence>
      {sheetOpen ? (
        <motion.div
          key="task-sheet-root"
          className="jbs-task-sheet-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="jbs-task-sheet-backdrop"
            onClick={closeSheet}
            aria-label="关闭任务清单"
          />
          <motion.div
            className="jbs-task-sheet-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
          >
            <div className="jbs-task-sheet-handle" aria-hidden />
            <div className="jbs-task-sheet-header">
              <div className="min-w-0 flex-1">
                <p className="jbs-task-sheet-kicker jbs-font-serif">COMMISSION LOG</p>
                <h2 className="jbs-task-sheet-title jbs-font-serif">{commission.title}</h2>
              </div>
              <button
                type="button"
                onClick={closeSheet}
                className="jbs-task-sheet-close"
                aria-label="关闭"
              >
                <X className="size-4" strokeWidth={1.25} />
              </button>
            </div>
            <p className="jbs-task-sheet-progress jbs-font-serif">
              {completed}/{commission.tasks.length} COMPLETED
            </p>
            <ul className="jbs-task-sheet-list">
              {commission.tasks.map((task, i) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className={`jbs-task-sheet-item${task.isCompleted ? ' jbs-task-sheet-item--done' : ''}`}
                    onClick={() => toggleTask(task.id)}
                  >
                    <span
                      className={`jbs-task-sheet-check${task.isCompleted ? ' jbs-task-sheet-check--on' : ''}`}
                      aria-hidden
                    >
                      {task.isCompleted ? <Check className="size-3" strokeWidth={2} /> : null}
                    </span>
                    <span className="jbs-task-sheet-item-index jbs-font-serif">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="jbs-task-sheet-item-text jbs-font-serif">{task.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function TaskFloatingBall() {
  const { commission, openSheet } = useTaskStore()

  if (!commission || commission.status !== 'accepted') return null

  return (
    <>
      <motion.button
        type="button"
        layoutId={TASK_COMMISSION_LAYOUT_ID}
        className="jbs-task-floating-ball"
        onClick={openSheet}
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28, delay: 0.05 }}
        whileTap={{ scale: 0.92 }}
        aria-label="查看本幕任务"
        style={{
          right: 'max(16px, env(safe-area-inset-right))',
          top: '33%',
        }}
      >
        <span className="jbs-task-ball-glow" aria-hidden />
        <PocketWatchFace />
        <span className="jbs-task-ball-ring" aria-hidden />
      </motion.button>
      <TaskChecklistSheet />
    </>
  )
}
