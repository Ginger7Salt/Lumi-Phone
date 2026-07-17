import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, SendHorizontal } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'

import { Pressable } from '../../../components/Pressable'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { PULSE_COLORS, PULSE_MODAL_SPRING } from '../constants'
import { usePulseCommentKeyboardLayout } from '../hooks/usePulseCommentKeyboardLayout'
import {
  isPulseDmReplyBusy,
  startPulseDmReplyJob,
  subscribePulseDmReplyBusy,
} from '../pulseDmReplyRunner'
import {
  pickStablePulseNetizenAvatarPath,
  resolvePulseAuthorAvatarUrl,
} from '../pulseNetizenAvatar'
import type { PulseDmThread } from '../pulseTypes'
import { usePulseStore } from '../usePulseStore'
import { PulseBubble } from './PulseBubble'
import {
  PulseWeiboFaceComposer,
  type PulseWeiboFaceComposerHandle,
} from './PulseWeiboFaceComposer'
import { PulseWeiboFacePicker } from './PulseWeiboFacePicker'

function FanAvatar({
  url,
  fallbackSeed,
  className = 'size-8',
}: {
  url?: string
  fallbackSeed?: string
  className?: string
}) {
  const src =
    resolvePulseAuthorAvatarUrl(url) ||
    (fallbackSeed
      ? resolvePulseAuthorAvatarUrl(pickStablePulseNetizenAvatarPath(fallbackSeed))
      : undefined)
  if (src) {
    return <img src={src} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />
  }
  return <div className={`shrink-0 rounded-full bg-[#EFEDEC] ${className}`} />
}

/**
 * 微博广场专属私信聊天室 —— 云朵气泡 + 柔和输入舱，与微信聊天室样式隔离。
 */
export function PulseDMRoom({
  thread,
  onBack,
  playerRealName,
  playerWeiboNickname,
  selfAvatarUrl,
  refCharacterNames,
}: {
  thread: PulseDmThread
  onBack: () => void
  playerRealName: string
  playerWeiboNickname?: string
  /** 用户微博头像 */
  selfAvatarUrl?: string
  refCharacterNames?: string[]
}) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const markDmRead = usePulseStore((s) => s.markDmThreadRead)
  const setActiveDmThreadId = usePulseStore((s) => s.setActiveDmThreadId)
  const appendDmMessages = usePulseStore((s) => s.appendDmMessages)
  const [draft, setDraft] = useState('')
  const [replying, setReplying] = useState(() => isPulseDmReplyBusy(thread.id))
  const composerRef = useRef<PulseWeiboFaceComposerHandle>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const inputBarRef = useRef<HTMLDivElement>(null)
  const scrollBottomTimersRef = useRef<number[]>([])

  /** 键盘/新消息时：把最后一条气泡贴到输入栏上方，避免被挡住 */
  const scrollListToBottom = useCallback(() => {
    const run = () => {
      const list = listRef.current
      if (!list) return
      list.scrollTop = list.scrollHeight
    }
    for (const id of scrollBottomTimersRef.current) window.clearTimeout(id)
    scrollBottomTimersRef.current = []
    run()
    requestAnimationFrame(() => {
      run()
      requestAnimationFrame(run)
    })
    for (const ms of [60, 140, 260, 420]) {
      scrollBottomTimersRef.current.push(window.setTimeout(run, ms))
    }
  }, [])

  const { sheetStyle, barLiftPx, scrollPadPx } = usePulseCommentKeyboardLayout(
    sheetRef,
    inputBarRef,
    scrollListToBottom,
  )

  const fanAvatarStored = thread.fanAvatarUrl?.trim()
  const fanAvatarSeed = `dm:${thread.fanName}`
  const lastMsg = thread.messages[thread.messages.length - 1]
  const canNudgeFanReply = Boolean(lastMsg && !lastMsg.fromFan && !draft.trim() && !replying)
  const showStrangerNotice = thread.isUserFan !== true
  const planeCanAct = Boolean((draft.trim() || canNudgeFanReply) && !replying)

  useEffect(() => {
    return () => {
      for (const id of scrollBottomTimersRef.current) window.clearTimeout(id)
      scrollBottomTimersRef.current = []
    }
  }, [])

  useEffect(() => {
    setActiveDmThreadId(thread.id)
    markDmRead(thread.id)
    return () => {
      setActiveDmThreadId(null)
    }
  }, [markDmRead, setActiveDmThreadId, thread.id])

  // 进房同步后台任务忙碌态；出房不取消 AI / 揭示队列
  useEffect(() => {
    setReplying(isPulseDmReplyBusy(thread.id))
    return subscribePulseDmReplyBusy((id, busy) => {
      if (id === thread.id) setReplying(busy)
    })
  }, [thread.id])

  // 新消息、键盘抬升垫高、全页贴合可视区高度变化时，都贴底
  useEffect(() => {
    scrollListToBottom()
  }, [
    thread.messages.length,
    replying,
    scrollPadPx,
    barLiftPx,
    sheetStyle?.height,
    sheetStyle?.top,
    scrollListToBottom,
  ])

  // 聚焦输入框唤起键盘时再贴底一轮（等 visualViewport 动画）
  useEffect(() => {
    const bar = inputBarRef.current
    if (!bar) return
    const onFocusIn = () => scrollListToBottom()
    bar.addEventListener('focusin', onFocusIn)
    return () => bar.removeEventListener('focusin', onFocusIn)
  }, [scrollListToBottom])

  const requestFanReply = useCallback(
    (history: Array<{ fromFan: boolean; content: string }>) => {
      const started = startPulseDmReplyJob({
        threadId: thread.id,
        apiConfig,
        playerRealName,
        playerWeiboNickname,
        fanName: thread.fanName,
        history,
        refCharacterNames,
      })
      if (started) setReplying(true)
    },
    [
      apiConfig,
      playerRealName,
      playerWeiboNickname,
      refCharacterNames,
      thread.fanName,
      thread.id,
    ],
  )

  const sendSelf = useCallback(
    (text: string) => {
      const content = text.trim()
      if (!content || isPulseDmReplyBusy(thread.id)) return false
      appendDmMessages(thread.id, [{ fromFan: false, content }])
      setDraft('')
      return true
    },
    [appendDmMessages, thread.id],
  )

  const triggerFanReply = useCallback(() => {
    if (isPulseDmReplyBusy(thread.id)) return
    const latest = thread.messages[thread.messages.length - 1]
    if (!latest || latest.fromFan) {
      window.alert('请先发送一条私信，再请求网友回复')
      return
    }
    requestFanReply(thread.messages.map((m) => ({ fromFan: m.fromFan, content: m.content })))
  }, [requestFanReply, thread.id, thread.messages])

  const onSendClick = useCallback(() => {
    if (isPulseDmReplyBusy(thread.id)) return
    const text = draft.trim()
    if (text) {
      if (!sendSelf(text)) return
      requestFanReply([
        ...thread.messages.map((m) => ({ fromFan: m.fromFan, content: m.content })),
        { fromFan: false, content: text },
      ])
      return
    }
    triggerFanReply()
  }, [draft, requestFanReply, sendSelf, thread.id, thread.messages, triggerFanReply])

  const onComposerKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Enter' || e.shiftKey) return
      const ne = e.nativeEvent
      if (ne.isComposing || e.repeat) return
      if (isPulseDmReplyBusy(thread.id)) return
      const text = draft.trim()
      if (text) {
        sendSelf(text)
        queueMicrotask(() => composerRef.current?.focus())
        return
      }
      if (canNudgeFanReply) triggerFanReply()
    },
    [canNudgeFanReply, draft, sendSelf, thread.id, triggerFanReply],
  )

  const insertDmToken = useCallback((token: string) => {
    composerRef.current?.insertToken(token)
  }, [])

  // 必须 portal 到 body：外层 tab motion 带 transform，fixed 会相对该层定位，
  // 键盘弹出时 visualViewport 一滚就像整页被拽到底部。
  return createPortal(
    <motion.div
      ref={sheetRef}
      className="fixed inset-0 z-[1190] flex flex-col bg-[#FCFCFD]"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={PULSE_MODAL_SPRING}
      style={sheetStyle}
    >
      <header
        className="relative flex shrink-0 items-center justify-center px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable
          type="button"
          onClick={onBack}
          className="absolute left-2 flex size-10 items-center justify-center text-[#2D2422]"
          aria-label="返回"
        >
          <ChevronLeft className="size-6" strokeWidth={1.5} />
        </Pressable>
        <div className="flex max-w-[70%] items-center gap-2">
          <FanAvatar url={fanAvatarStored} fallbackSeed={fanAvatarSeed} className="size-7" />
          <h1 className="truncate text-[16px] font-medium tracking-tight text-[#2D2422]">
            {thread.fanName}
          </h1>
        </div>
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
        style={{ paddingBottom: `calc(1rem + ${scrollPadPx}px)` }}
      >
        {showStrangerNotice ? (
          <div className="mx-auto my-4 w-fit max-w-[92%] rounded-full bg-gray-50 px-4 py-1.5 text-center text-[10px] leading-relaxed text-gray-400">
            你们尚未互相关注，请注意保护个人隐私。
          </div>
        ) : (
          <div className="mx-auto my-4 w-fit max-w-[92%] rounded-full bg-gray-50 px-4 py-1.5 text-center text-[10px] leading-relaxed text-gray-400">
            对方是你的粉丝，仍请留意隐私边界。
          </div>
        )}

        {thread.messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 ${m.fromFan ? '' : 'flex-row-reverse'}`}
          >
            {m.fromFan ? (
              <FanAvatar
                url={fanAvatarStored}
                fallbackSeed={fanAvatarSeed}
                className="mt-0.5 size-8 shrink-0"
              />
            ) : (
              <FanAvatar url={selfAvatarUrl} className="mt-0.5 size-8 shrink-0" />
            )}
            <div className={`min-w-0 max-w-[78%] ${m.fromFan ? '' : 'ml-auto'}`}>
              <PulseBubble fromSelf={!m.fromFan} content={m.content} timestamp={m.createdAt} />
            </div>
          </div>
        ))}

        <AnimatePresence>
          {replying ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-3 text-center text-[12px] text-neutral-300"
            >
              对方正在输入…
            </motion.p>
          ) : null}
        </AnimatePresence>
        <div className="h-px w-full shrink-0" aria-hidden />
      </div>

      <div
        ref={inputBarRef}
        className="shrink-0 border-t border-black/[0.03] bg-white/80 px-3 pt-2.5 backdrop-blur-xl"
        style={{
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
          transform: barLiftPx > 0 ? `translate3d(0, -${barLiftPx}px, 0)` : undefined,
          willChange: barLiftPx > 0 ? 'transform' : undefined,
        }}
      >
        <div className="flex items-end gap-2.5">
          <div className="flex min-h-[42px] min-w-0 flex-1 items-center gap-0.5 rounded-full bg-gray-100/50 py-1 pl-1.5 pr-3">
            <PulseWeiboFacePicker onPick={insertDmToken} panelMode="page" />
            <PulseWeiboFaceComposer
              ref={composerRef}
              value={draft}
              onChange={setDraft}
              disabled={replying}
              placeholder={replying ? '对方回复中…' : '发送私信…'}
              onKeyDown={onComposerKeyDown}
            />
          </div>
          <Pressable
            type="button"
            disabled={!planeCanAct}
            onClick={onSendClick}
            className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-35"
            aria-label={draft.trim() ? '发送' : '请求回复'}
          >
            <SendHorizontal
              className="size-5"
              strokeWidth={1.6}
              style={{ color: planeCanAct ? PULSE_COLORS.dustyRose : '#C4C4C4' }}
            />
          </Pressable>
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}
