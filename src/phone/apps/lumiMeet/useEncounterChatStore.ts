import { useMemo } from 'react'
import type { EncounterNPC, EncounterSwapMeta } from './meetTypes'
import { useLumiMeetStore } from './LumiMeetStore'

/** 临时会话（遇见）切片：好感与互换状态，便于 Encounter 专用组件订阅 */
export function useEncounterChatStore(npc: EncounterNPC) {
  const {
    state,
    pushChatMessage,
    applyAffectionDelta,
    patchEncounterSwap,
    bumpIntimacy,
    getPersistedSnapshot,
  } = useLumiMeetStore()

  return useMemo(() => {
    const affection = state.intimacyByNpcId[npc.id] ?? 18
    const swap: EncounterSwapMeta = state.encounterSwapByNpcId[npc.id] ?? {
      wechatSwapStatus: 'none',
      userWechatId: '',
    }
    return {
      affection,
      wechatSwapStatus: swap.wechatSwapStatus,
      userWechatId: swap.userWechatId,
      pendingSwapNote: swap.pendingSwapNote,
      pushChatMessage,
      applyAffectionDelta,
      patchEncounterSwap,
      bumpIntimacy,
      getPersistedSnapshot,
    }
  }, [
    state.intimacyByNpcId,
    state.encounterSwapByNpcId,
    npc.id,
    pushChatMessage,
    applyAffectionDelta,
    patchEncounterSwap,
    bumpIntimacy,
    getPersistedSnapshot,
  ])
}
