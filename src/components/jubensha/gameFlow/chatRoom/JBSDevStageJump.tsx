import { AnimatePresence, motion } from 'framer-motion'
import { Bug, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useJBSDevJumpBridge } from './JBSDevJumpBridge'
import { useJBSFlowOptional } from './JBSFlowEngine'
import { DEV_FLOW_NODES, type DevFlowNodeId } from './jbsDevFlowNodes'

const IS_DEV = import.meta.env.DEV

export function JBSDevStageJump() {
  const bridge = useJBSDevJumpBridge()
  const flow = useJBSFlowOptional()
  const [open, setOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const currentNodeId = flow?.devFlowNodeId ?? bridge?.currentFlowNodeId ?? null
  const currentNode = currentNodeId
    ? DEV_FLOW_NODES.find((n) => n.id === currentNodeId)
    : null

  const jump = useCallback(
    (nodeId: DevFlowNodeId) => {
      bridge?.jumpToFlowNode(nodeId)
      setOpen(false)
    },
    [bridge],
  )

  const updateMenuAnchor = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setMenuAnchor({
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuAnchor(null)
      return
    }
    updateMenuAnchor()
    window.addEventListener('resize', updateMenuAnchor)
    window.addEventListener('scroll', updateMenuAnchor, true)
    return () => {
      window.removeEventListener('resize', updateMenuAnchor)
      window.removeEventListener('scroll', updateMenuAnchor, true)
    }
  }, [open, updateMenuAnchor])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!IS_DEV || !bridge) return null

  const menuPortal =
    open && menuAnchor
      ? createPortal(
          <AnimatePresence>
            <motion.div
              key="dev-stage-menu"
              ref={menuRef}
              role="menu"
              className="jbs-dev-stage-jump-menu jbs-dev-stage-jump-menu--portal jbs-dev-stage-jump-menu--flow jbs-font-serif"
              style={{ top: menuAnchor.top, right: menuAnchor.right }}
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="jbs-dev-stage-jump-kicker">DEV · 阶段流程</p>
              <p className="jbs-dev-stage-jump-current">
                {currentNode
                  ? `当前 · ${currentNode.index}. ${currentNode.label}`
                  : flow
                    ? `引擎 · Step ${flow.currentStep}${flow.currentStep === 7 ? ` · Loop ${flow.loopRound}` : ''}`
                    : '当前 · 未入局'}
              </p>
              <ul className="jbs-dev-stage-jump-list">
                {DEV_FLOW_NODES.map((node) => {
                  const active = currentNodeId === node.id
                  return (
                    <li key={node.id}>
                      <button
                        type="button"
                        role="menuitem"
                        className={`jbs-dev-stage-jump-item${active ? ' jbs-dev-stage-jump-item--active' : ''}`}
                        onClick={() => jump(node.id)}
                      >
                        <span className="jbs-dev-stage-jump-step">{node.index}</span>
                        <span className="jbs-dev-stage-jump-label">{node.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null

  return (
    <>
      <div className="jbs-dev-stage-jump relative shrink-0">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="jbs-dev-stage-jump-btn jbs-font-serif flex size-9 items-center justify-center gap-0.5 rounded-full"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="开发调试 · 阶段流程跳转"
          title="DEV · 阶段流程"
        >
          <Bug className="size-3.5" strokeWidth={1.35} />
          <ChevronDown
            className={`size-2.5 transition-transform duration-200${open ? ' rotate-180' : ''}`}
            strokeWidth={2}
          />
        </button>
      </div>
      {menuPortal}
    </>
  )
}
