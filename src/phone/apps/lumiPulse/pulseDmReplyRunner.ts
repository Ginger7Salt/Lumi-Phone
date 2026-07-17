import type { ApiConfig } from '../api/types'
import { computeRevealDelayMs } from '../wechat/chatRoom/computeRevealDelayMs'
import { aiGeneratePulseDmReply } from './lumiPulseAi'
import { usePulseStore } from './usePulseStore'

type DmReplyJobInput = {
  threadId: string
  apiConfig: ApiConfig | null
  playerRealName: string
  playerWeiboNickname?: string
  fanName: string
  history: Array<{ fromFan: boolean; content: string }>
  refCharacterNames?: string[]
}

type JobState = {
  /** AI 请求中，或气泡尚未全部落库 */
  busy: boolean
  /** 待逐条揭示的气泡 */
  queue: string[]
  timerId: number | null
  /** 防重复并发：同一会话一次只跑一轮 */
  generationId: number
}

const jobs = new Map<string, JobState>()
const listeners = new Set<(threadId: string, busy: boolean) => void>()

function getOrCreate(threadId: string): JobState {
  let j = jobs.get(threadId)
  if (!j) {
    j = { busy: false, queue: [], timerId: null, generationId: 0 }
    jobs.set(threadId, j)
  }
  return j
}

function emit(threadId: string, busy: boolean) {
  for (const fn of listeners) {
    try {
      fn(threadId, busy)
    } catch {
      /* ignore */
    }
  }
}

function setBusy(threadId: string, busy: boolean) {
  const j = getOrCreate(threadId)
  if (j.busy === busy) return
  j.busy = busy
  emit(threadId, busy)
}

function clearTimer(j: JobState) {
  if (j.timerId != null) {
    window.clearTimeout(j.timerId)
    j.timerId = null
  }
}

function drainReveal(threadId: string) {
  const j = jobs.get(threadId)
  if (!j) return
  if (j.timerId != null) return

  const next = j.queue[0]
  if (!next) {
    setBusy(threadId, false)
    return
  }

  const delay = computeRevealDelayMs({ text: next })
  j.timerId = window.setTimeout(() => {
    j.timerId = null
    const text = j.queue.shift()
    if (text) {
      usePulseStore.getState().appendDmMessages(threadId, [{ fromFan: true, content: text }])
    }
    if (j.queue.length === 0) {
      setBusy(threadId, false)
      return
    }
    drainReveal(threadId)
  }, delay)
}

function enqueueBubbles(threadId: string, rows: string[]) {
  const bubbles = rows.map((r) => r.trim()).filter(Boolean)
  if (!bubbles.length) {
    setBusy(threadId, false)
    return
  }
  const j = getOrCreate(threadId)
  j.queue.push(...bubbles)
  setBusy(threadId, true)
  drainReveal(threadId)
}

export function isPulseDmReplyBusy(threadId: string): boolean {
  return jobs.get(threadId)?.busy === true
}

/** 订阅某会话回复繁忙态（进房 / 出房都不取消后台任务） */
export function subscribePulseDmReplyBusy(
  listener: (threadId: string, busy: boolean) => void,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 启动网友私信回复：AI 异步请求 + 气泡揭示均与聊天室生命周期解耦。
 * 出房不会清队列；回到列表后未读仍会累计。
 * @returns false 表示该会话已有进行中的任务
 */
export function startPulseDmReplyJob(input: DmReplyJobInput): boolean {
  const threadId = input.threadId.trim()
  if (!threadId) return false
  const j = getOrCreate(threadId)
  if (j.busy) return false

  j.generationId += 1
  const gen = j.generationId
  setBusy(threadId, true)

  void (async () => {
    try {
      const rows = await aiGeneratePulseDmReply({
        apiConfig: input.apiConfig,
        playerRealName: input.playerRealName,
        playerWeiboNickname: input.playerWeiboNickname,
        fanName: input.fanName,
        history: input.history,
        refCharacterNames: input.refCharacterNames,
      })
      // 被更新一轮覆盖时丢弃过期结果
      if (jobs.get(threadId)?.generationId !== gen) return
      enqueueBubbles(threadId, rows)
    } catch (e) {
      if (jobs.get(threadId)?.generationId !== gen) return
      clearTimer(j)
      j.queue = []
      setBusy(threadId, false)
      window.alert(e instanceof Error ? e.message : '回复生成失败')
    }
  })()

  return true
}
