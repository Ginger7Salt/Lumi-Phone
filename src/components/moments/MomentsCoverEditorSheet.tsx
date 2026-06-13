import { useEffect, useId, useRef, useState } from 'react'

import { ImageCropperModal } from '../../phone/components/ImageCropperModal'
import { Pressable } from '../../phone/components/Pressable'

import {
  DEFAULT_MOMENTS_COVER_CANONICAL,
  defaultMomentsCoverDisplayUrl,
  MOMENTS_COVER_ASPECT,
  resolveMomentsCoverDisplayUrl,
} from './momentsCoverDefaults'

type Props = {
  open: boolean
  coverUrl?: string | null
  onClose: () => void
  onSave: (url: string) => void | Promise<void>
}

export function MomentsCoverEditorSheet({ open, coverUrl, onClose, onSave }: Props) {
  const titleId = useId()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [urlDraft, setUrlDraft] = useState('')
  const [cropSrc, setCropSrc] = useState('')
  const [previewSrc, setPreviewSrc] = useState('')
  const fallbackPreviewUrl = defaultMomentsCoverDisplayUrl()
  const previewUrl = resolveMomentsCoverDisplayUrl(coverUrl)

  useEffect(() => {
    if (!open) return
    const raw = coverUrl?.trim() ?? ''
    setUrlDraft(raw.startsWith('data:') ? '' : raw)
    setCropSrc('')
    setPreviewSrc(previewUrl || fallbackPreviewUrl)
  }, [open, coverUrl, previewUrl, fallbackPreviewUrl])

  if (!open) return null

  const openCropperWithSrc = (src: string) => {
    const t = src.trim()
    if (!t) return
    setCropSrc(t)
  }

  const onPickFile = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (src) openCropperWithSrc(src)
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <ImageCropperModal
        open={!!cropSrc}
        imageSrc={cropSrc}
        title="裁剪朋友圈背景"
        aspect={MOMENTS_COVER_ASPECT}
        maxSide={1440}
        objectFit="horizontal-cover"
        onCancel={() => setCropSrc('')}
        onConfirm={(dataUrl) => {
          void onSave(dataUrl)
          setCropSrc('')
          onClose()
        }}
      />

      <div
        className="absolute inset-0 z-[410] flex items-end justify-center bg-black/45 px-3 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-3"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="w-full max-w-[560px] overflow-hidden rounded-[16px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="border-b border-[#ececec] px-4 py-3">
            <h2 id={titleId} className="text-[17px] font-semibold text-[#111827]">
              更换朋友圈背景
            </h2>
            <p className="mt-1 text-[12px] text-[#8e8e8e]">
              支持本地上传或 URL，裁剪比例为 {MOMENTS_COVER_ASPECT}:1
            </p>
          </div>

          <div className="px-4 py-4">
            <div
              className="overflow-hidden rounded-[12px] border border-[#e5e5e5] bg-[#f7f7f7]"
              style={{ aspectRatio: `${MOMENTS_COVER_ASPECT} / 1` }}
            >
              <img
                src={previewSrc}
                alt=""
                className="h-full w-full object-cover"
                onError={() => {
                  if (previewSrc !== fallbackPreviewUrl) setPreviewSrc(fallbackPreviewUrl)
                }}
              />
            </div>

            <label className="mt-4 block text-[13px] font-medium text-[#111827]">图片地址（URL）</label>
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://… 粘贴图片链接"
              className="mt-2 h-11 w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3 text-[13px] text-[#111827] outline-none"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <Pressable
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-black bg-black px-4 text-[13px] text-white"
              >
                本地上传并裁剪
              </Pressable>
              <Pressable
                type="button"
                disabled={!urlDraft.trim()}
                onClick={() => openCropperWithSrc(urlDraft)}
                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#d0d0d0] bg-white px-4 text-[13px] text-[#111827] disabled:opacity-45"
              >
                从 URL 裁剪
              </Pressable>
              <Pressable
                type="button"
                onClick={() => {
                  void onSave(DEFAULT_MOMENTS_COVER_CANONICAL)
                  onClose()
                }}
                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#d0d0d0] bg-white px-4 text-[13px] text-[#111827]"
              >
                恢复默认背景
              </Pressable>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onPickFile(e.target.files?.[0] ?? null)
                e.currentTarget.value = ''
              }}
            />
          </div>

          <div className="border-t border-[#ececec] px-4 py-3">
            <Pressable
              type="button"
              onClick={onClose}
              className="flex h-11 w-full items-center justify-center rounded-[10px] bg-[#f5f5f5] text-[14px] font-medium text-[#111827]"
            >
              取消
            </Pressable>
          </div>
        </div>
      </div>
    </>
  )
}
