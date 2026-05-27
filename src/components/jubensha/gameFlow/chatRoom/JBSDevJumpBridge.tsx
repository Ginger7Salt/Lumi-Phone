/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import type { DevFlowNodeId } from './jbsDevFlowNodes'

export type JBSDevJumpBridgeValue = {
  currentFlowNodeId: DevFlowNodeId | null
  jumpToFlowNode: (nodeId: DevFlowNodeId) => void
  registerEngineJump: (fn: ((nodeId: DevFlowNodeId) => void) | null) => void
}

const JBSDevJumpBridgeContext = createContext<JBSDevJumpBridgeValue | null>(null)

export type JBSDevJumpBridgeProviderProps = {
  children: ReactNode
  /** 跳转「开场白」：回到 Shell DM 语音页 */
  onOpening?: () => void
  /** 未进入演绎暗室时尝试跳转其它节点 */
  onRequestPlaying?: () => void
}

export function JBSDevJumpBridgeProvider({
  children,
  onOpening,
  onRequestPlaying,
}: JBSDevJumpBridgeProviderProps) {
  const engineJumpRef = useRef<((nodeId: DevFlowNodeId) => void) | null>(null)
  const pendingNodeRef = useRef<DevFlowNodeId | null>(null)
  const [currentFlowNodeId, setCurrentFlowNodeId] = useState<DevFlowNodeId | null>(null)

  const registerEngineJump = useCallback((fn: ((nodeId: DevFlowNodeId) => void) | null) => {
    engineJumpRef.current = fn
    if (fn && pendingNodeRef.current) {
      const pending = pendingNodeRef.current
      pendingNodeRef.current = null
      fn(pending)
    }
  }, [])

  const jumpToFlowNode = useCallback(
    (nodeId: DevFlowNodeId) => {
      setCurrentFlowNodeId(nodeId)
      if (nodeId === 'opening') {
        pendingNodeRef.current = null
        onOpening?.()
        return
      }
      if (engineJumpRef.current) {
        pendingNodeRef.current = null
        engineJumpRef.current(nodeId)
        return
      }
      pendingNodeRef.current = nodeId
      onRequestPlaying?.()
    },
    [onOpening, onRequestPlaying],
  )

  const value = useMemo<JBSDevJumpBridgeValue>(
    () => ({
      currentFlowNodeId,
      jumpToFlowNode,
      registerEngineJump,
    }),
    [currentFlowNodeId, jumpToFlowNode, registerEngineJump],
  )

  return (
    <JBSDevJumpBridgeContext.Provider value={value}>{children}</JBSDevJumpBridgeContext.Provider>
  )
}

export function useJBSDevJumpBridge(): JBSDevJumpBridgeValue | null {
  return useContext(JBSDevJumpBridgeContext)
}
