import { AnimatePresence, motion } from 'framer-motion'
import { Image as ImageIcon, Link as LinkIcon, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useCustomization } from '../../CustomizationContext'
import { Pressable } from '../../components/Pressable'
import type { WeChatImageMime } from './newFriendsPersona/types'
import { compressChatImageToJpeg, loadImageFromFile } from './wechatChatImageCompress'
import { stickerUrlToImagePayload } from './wechatStickerImagePayload'

export const MAX_CHAT_PHOTO_BATCH = 9

export type WeChatChatImagePayload = { base64: string; mime: WeChatImageMime }

type LocalDraft = { id: string; file: File; previewUrl: string }

type Props = {
  open: boolean
  onClose: () => void
  onToast: (msg: string) => void
  onSend: (payloads: WeChatChatImagePayload[]) => void | Promise<void>
}

function isLikelyImageUrl(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  if (/^data:image\//i.test(t)) return true
  if (/^https?:\/\//i.test(t)) return true
  return t.startsWith('/')
}

function parseImageUrlLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => isLikelyImageUrl(line))
}

async function fileToChatImagePayload(file: File): Promise<WeChatChatImagePayload> {
  const img = await loadImageFromFile(file)
  const base64 = await compressChatImageToJpeg({
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
  })
  return { base64, mime: 'image/jpeg' }
}

export function WeChatChatPhotoPickerSheet({ open, onClose, onToast, onSend }: Props) {
  const { state } = useCustomization()
  const disableTransitions = state.ui.disablePageTransitions
  const [tab, setTab] = useState<'album' | 'url'>('album')
  const [localDrafts, setLocalDrafts] = useState<LocalDraft[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const localDraftsRef = useRef(localDrafts)

  useEffect(() => {
    localDraftsRef.current = localDrafts
  }, [localDrafts])

  const urlRows = useMemo(() => parseImageUrlLines(urlInput).slice(0, MAX_CHAT_PHOTO_BATCH), [urlInput])
  const selectedCount = tab === 'album' ? localDrafts.length : urlRows.length
  const canSend = !busy && selectedCount > 0

  const resetDraft = useCallback(() => {
    for (const row of localDraftsRef.current) {
      URL.revokeObjectURL(row.previewUrl)
    }
    setLocalDrafts([])
    setUrlInput('')
    setTab('album')
  }, [])

  useEffect(() => {
    if (open) return
    resetDraft()
    setBusy(false)
  }, [open, resetDraft])

  const appendLocalFiles = (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX_CHAT_PHOTO_BATCH - localDrafts.length
    if (room <= 0) {
      onToast(`最多选择 ${MAX_CHAT_PHOTO_BATCH} 张图片`)
      return
    }
    const next: LocalDraft[] = []
    Array.from(files)
      .slice(0, room)
      .forEach((file) => {
        if (!file.type.startsWith('image/')) return
        next.push({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })
      })
    if (!next.length) {
      onToast('未识别到有效图片')
      return
    }
    setLocalDrafts((prev) => [...prev, ...next].slice(0, MAX_CHAT_PHOTO_BATCH))
  }

  const removeLocalDraft = (id: string) => {
    setLocalDrafts((prev) => {
      const target = prev.find((row) => row.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((row) => row.id !== id)
    })
  }

  const handleSend = async () => {
    if (!canSend) return
    setBusy(true)
    try {
      const payloads: WeChatChatImagePayload[] = []
      if (tab === 'album') {
        for (const row of localDrafts) {
          payloads.push(await fileToChatImagePayload(row.file))
        }
      } else {
        for (const url of urlRows) {
          payloads.push(await stickerUrlToImagePayload(url))
        }
      }
      if (!payloads.length) {
        onToast('没有可发送的图片')
        return
      }
      await onSend(payloads)
      resetDraft()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '图片处理失败'
      onToast(msg.includes('fetch') || msg.includes('load') ? '图片加载失败，请检查链接或重试' : '图片处理失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={disableTransitions ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={disableTransitions ? { opacity: 1 } : { opacity: 0 }}
          transition={disableTransitions ? { duration: 0 } : undefined}
          className="absolute inset-0 z-[255] flex flex-col justify-end bg-black/35"
        >
          <Pressable type="button" className="min-h-0 flex-1" onClick={onClose}>
            <span className="sr-only">关闭</span>
          </Pressable>
          <motion.div
            initial={disableTransitions ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={disableTransitions ? { y: 0 } : { y: '100%' }}
            transition={disableTransitions ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="max-h-[88dvh] overflow-hidden rounded-t-[20px] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.12)]"
          >
            <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-3">
              <button type="button" className="text-[16px] text-[#576b95]" onClick={onClose}>
                取消
              </button>
              <p className="text-[16px] font-medium text-[#111827]">发送图片</p>
              <button
                type="button"
                disabled={!canSend}
                className="text-[16px] font-medium text-[#576b95] disabled:opacity-35"
                onClick={() => void handleSend()}
              >
                {busy ? '处理中…' : selectedCount > 0 ? `发送(${selectedCount})` : '发送'}
              </button>
            </div>

            <div className="flex gap-2 px-4 pt-3">
              <Pressable
                type="button"
                onClick={() => setTab('album')}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] ${
                  tab === 'album'
                    ? 'border-black bg-white text-black'
                    : 'border-transparent bg-[#f5f5f5] text-[#4b5563]'
                }`}
              >
                <ImageIcon className="size-3.5" aria-hidden />
                手机相册
              </Pressable>
              <Pressable
                type="button"
                onClick={() => setTab('url')}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] ${
                  tab === 'url'
                    ? 'border-black bg-white text-black'
                    : 'border-transparent bg-[#f5f5f5] text-[#4b5563]'
                }`}
              >
                <LinkIcon className="size-3.5" aria-hidden />
                图片链接
              </Pressable>
            </div>

            <div className="max-h-[58dvh] overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-3">
              {tab === 'album' ? (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {localDrafts.map((row) => (
                      <div key={row.id} className="relative aspect-square overflow-hidden rounded-[8px] bg-[#f3f4f6]">
                        <img src={row.previewUrl} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          aria-label="移除"
                          className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/55 text-white"
                          onClick={() => removeLocalDraft(row.id)}
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </div>
                    ))}
                    {localDrafts.length < MAX_CHAT_PHOTO_BATCH ? (
                      <Pressable
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="flex aspect-square flex-col items-center justify-center rounded-[8px] border border-dashed border-[#d1d5db] bg-[#fafafa] text-[#9ca3af]"
                      >
                        <Plus className="size-5" aria-hidden />
                        <span className="mt-1 text-[11px]">添加</span>
                      </Pressable>
                    ) : null}
                  </div>
                  {localDrafts.length === 0 ? (
                    <Pressable
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="mt-3 flex h-28 w-full items-center justify-center rounded-[12px] border border-dashed border-[#d1d5db] bg-[#fafafa] text-[13px] text-[#6b7280]"
                    >
                      从相册选择图片（可多选，最多 {MAX_CHAT_PHOTO_BATCH} 张）
                    </Pressable>
                  ) : (
                    <p className="mt-3 text-center text-[12px] text-[#9ca3af]">
                      已选 {localDrafts.length}/{MAX_CHAT_PHOTO_BATCH} 张，发送后不会自动触发对方回复
                    </p>
                  )}
                </>
              ) : (
                <>
                  <textarea
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder={'每行一个图片链接，最多 9 行\nhttps://example.com/a.png\nhttps://example.com/b.webp\ndata:image/png;base64,...'}
                    rows={5}
                    className="w-full resize-y rounded-[12px] border border-[#e5e7eb] bg-[#fafafa] px-3 py-2.5 text-[13px] text-[#111827] outline-none placeholder:text-[#9ca3af]"
                  />
                  <p className="mt-2 text-[12px] leading-relaxed text-[#9ca3af]">
                    支持 http(s) 链接、站内相对路径与 data URL；批量时每行一张，最多 {MAX_CHAT_PHOTO_BATCH} 张。
                  </p>
                  {urlRows.length > 0 ? (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {urlRows.map((url, index) => (
                        <div
                          key={`${index}-${url}`}
                          className="aspect-square overflow-hidden rounded-[8px] border border-[#eee] bg-[#fafafa]"
                        >
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                appendLocalFiles(e.target.files)
                e.currentTarget.value = ''
              }}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
