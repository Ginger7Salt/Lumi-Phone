import { Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  collectDatingNetworkMentionIds,
  insertDatingNetworkMentionAtCursor,
  listDatingNetworkMentions,
  migrateLegacyDatingNetworkMentions,
  removeDatingNetworkMentionById,
} from './datingNetworkMentionInput'
import { loadDatingNetworkPeerOptions, type DatingNetworkPeerOption } from './datingNetworkPeerMention'

function PeerAvatar({ peer, size = 'md' }: { peer: DatingNetworkPeerOption; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-5 w-5' : 'h-9 w-9'
  const text = size === 'sm' ? 'text-[9px]' : 'text-[11px]'
  return (
    <span className={`${box} shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200/80`}>
      {peer.avatarUrl ? (
        <img src={peer.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={`flex h-full w-full items-center justify-center font-medium text-stone-400 ${text}`}>
          {peer.displayName.slice(0, 2)}
        </span>
      )}
    </span>
  )
}

type Props = {
  datingCharacterId: string
  text: string
  onTextChange: (value: string) => void
  inputRef: RefObject<HTMLTextAreaElement | null>
  disabled?: boolean
  className?: string
}

export function DatingNetworkMentionControls({
  datingCharacterId,
  text,
  onTextChange,
  inputRef,
  disabled,
  className,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<DatingNetworkPeerOption[]>([])
  const [loadError, setLoadError] = useState('')

  const reloadOptions = useCallback(async () => {
    const cid = datingCharacterId.trim()
    if (!cid) {
      setOptions([])
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      setOptions(await loadDatingNetworkPeerOptions(cid))
    } catch {
      setOptions([])
      setLoadError('人脉列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [datingCharacterId])

  useEffect(() => {
    void reloadOptions()
  }, [reloadOptions])

  useEffect(() => {
    const migrated = migrateLegacyDatingNetworkMentions(text)
    if (migrated !== text) onTextChange(migrated)
  }, [text, onTextChange])

  const mentionSpans = useMemo(() => listDatingNetworkMentions(text), [text])
  const selectedIds = useMemo(() => collectDatingNetworkMentionIds(text), [text])

  const selectedOptions = selectedIds
    .map((id) => {
      const fromSpan = mentionSpans.find((m) => m.id === id)
      const fromOpt = options.find((o) => o.id === id)
      if (fromOpt) return fromOpt
      return {
        id,
        displayName: fromSpan?.displayName || '未命名',
        roleLabel: '人脉子角色' as const,
      }
    })
    .filter((o) => o.id.trim())

  const insertPeer = (peer: DatingNetworkPeerOption) => {
    const el = inputRef.current
    const { nextText, cursor } = insertDatingNetworkMentionAtCursor({
      text,
      id: peer.id,
      displayName: peer.displayName,
      selectionStart: el?.selectionStart,
      selectionEnd: el?.selectionEnd,
    })
    onTextChange(nextText)
    setPickerOpen(false)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  const removePeer = (id: string) => {
    onTextChange(removeDatingNetworkMentionById(text, id))
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <>
      <div className={className}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[13px] text-[#262626] transition-all duration-200 hover:border-stone-400 disabled:opacity-50"
            title="植入人脉角色"
          >
            <Users className="size-4" strokeWidth={1.75} />
            人脉
          </button>
          {selectedOptions.map((peer) => (
            <span
              key={peer.id}
              className="inline-flex max-w-[180px] items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/80 py-1 pl-1 pr-1.5 text-[12px] text-indigo-900"
              title={peer.displayName}
            >
              <PeerAvatar peer={peer} size="sm" />
              <span className="truncate">{peer.displayName}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removePeer(peer.id)}
                className="shrink-0 rounded p-0.5 text-indigo-500 hover:bg-indigo-100/80 hover:text-indigo-800"
                aria-label={`移除 ${peer.displayName}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {pickerOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-end justify-center bg-black/35 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-label="选择人脉角色"
              onClick={() => setPickerOpen(false)}
            >
              <div
                className="flex max-h-[min(70dvh,520px)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                  <p className="text-[15px] font-semibold text-stone-900">植入人脉角色</p>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-[13px] text-stone-500 hover:bg-stone-50"
                    onClick={() => setPickerOpen(false)}
                  >
                    关闭
                  </button>
                </div>
                <p className="border-b border-stone-50 px-4 py-2 text-[12px] leading-relaxed text-stone-500">
                  选中后输入框只显示角色姓名；发送时后台会按角色 id 注入出场指令。
                </p>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                  {loading ? (
                    <p className="px-2 py-6 text-center text-[13px] text-stone-400">加载人脉…</p>
                  ) : loadError ? (
                    <p className="px-2 py-6 text-center text-[13px] text-red-500">{loadError}</p>
                  ) : options.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[13px] leading-relaxed text-stone-400">
                      暂无可植入人脉。请在主角「人脉关系」中生成 NPC 或绑定其它主角。
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {options.map((peer) => {
                        const picked = selectedIds.includes(peer.id)
                        return (
                          <li key={peer.id}>
                            <button
                              type="button"
                              onClick={() => insertPeer(peer)}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                                picked ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-stone-50'
                              }`}
                            >
                              <PeerAvatar peer={peer} size="md" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-medium">{peer.displayName}</span>
                                <span className="mt-0.5 block text-[11px] text-stone-400">{peer.roleLabel}</span>
                              </span>
                              {picked ? (
                                <span className="shrink-0 text-[11px] text-indigo-600">已选</span>
                              ) : null}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
