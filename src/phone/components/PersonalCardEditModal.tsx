import { X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { canonicalPublicImagePath } from '../../publicAssetUrl'
import { compressAvatarDataUrl, MAX_AVATAR_DATA_URL_LEN } from '../apps/wechat/avatarCompress'
import { ImageCropperModal } from './ImageCropperModal'
import { Pressable } from './Pressable'
import type { Profile } from '../types'
import {
  DEFAULT_PERSONAL_CARD_BG_PATH,
  DEFAULT_PUBLIC_AVATAR_PATH,
} from '../types'
import { normalizeProfileAvatarForSave, resolveProfileAvatarPreviewUrl } from '../utils/characterAvatarUrl'
import {
  normalizePersonalCardBackgroundForSave,
  resolvePersonalCardBackgroundUrl,
} from '../utils/personalCardAssets'

const MAX_CARD_BG_DATA_URL_LEN = 650_000

type Props = {
  open: boolean
  onClose: () => void
  profile: Profile
  backgroundUrl: string
  onSave: (patch: {
    profile: Partial<Profile>
    backgroundUrl: string
  }) => void
}

export function PersonalCardEditModal({
  open,
  onClose,
  profile,
  backgroundUrl,
  onSave,
}: Props) {
  const titleId = useId()
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [signature, setSignature] = useState(profile.signature)
  const [avatarImageUrl, setAvatarImageUrl] = useState(profile.avatarImageUrl)
  const [bgUrl, setBgUrl] = useState(backgroundUrl)
  const [bgUrlDraft, setBgUrlDraft] = useState('')
  const [avatarCropSrc, setAvatarCropSrc] = useState('')
  const [bgCropSrc, setBgCropSrc] = useState('')

  useEffect(() => {
    if (!open) return
    setDisplayName(profile.displayName)
    setSignature(profile.signature)
    setAvatarImageUrl(profile.avatarImageUrl)
    setBgUrl(backgroundUrl)
    setBgUrlDraft('')
    setAvatarCropSrc('')
    setBgCropSrc('')
  }, [open, profile, backgroundUrl])

  const avatarPreview = useMemo(
    () => resolveProfileAvatarPreviewUrl(avatarImageUrl),
    [avatarImageUrl],
  )
  const bgPreview = useMemo(() => resolvePersonalCardBackgroundUrl(bgUrl), [bgUrl])

  if (!open) return null

  const onPickAvatar = (file: File | null) => {
    if (!file?.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (src) setAvatarCropSrc(src)
    }
    reader.readAsDataURL(file)
  }

  const onPickBackground = (file: File | null) => {
    if (!file?.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (src) setBgCropSrc(src)
    }
    reader.readAsDataURL(file)
  }

  const applyBgUrlDraft = () => {
    const next = bgUrlDraft.trim()
    if (!next) return
    setBgUrl(canonicalPublicImagePath(next) || next)
    setBgUrlDraft('')
  }

  const save = () => {
    onSave({
      profile: {
        displayName: displayName.trim() || profile.displayName,
        signature: signature.trim(),
        avatarImageUrl: normalizeProfileAvatarForSave(avatarImageUrl),
      },
      backgroundUrl: normalizePersonalCardBackgroundForSave(bgUrl),
    })
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center px-4 py-6 sm:px-8"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-hidden />
      <ImageCropperModal
        open={!!avatarCropSrc}
        imageSrc={avatarCropSrc}
        title="裁剪头像"
        aspect={1}
        maxSide={1080}
        objectFit="horizontal-cover"
        onCancel={() => setAvatarCropSrc('')}
        onConfirm={async (dataUrl) => {
          const next = await compressAvatarDataUrl(dataUrl, MAX_AVATAR_DATA_URL_LEN)
          if (next.length > MAX_AVATAR_DATA_URL_LEN) {
            window.alert('头像图片过大，请换一张较小的图片。')
            return
          }
          setAvatarImageUrl(next)
          setAvatarCropSrc('')
        }}
      />
      <ImageCropperModal
        open={!!bgCropSrc}
        imageSrc={bgCropSrc}
        title="裁剪背景图"
        aspect={2}
        maxSide={1600}
        objectFit="horizontal-cover"
        onCancel={() => setBgCropSrc('')}
        onConfirm={async (dataUrl) => {
          const next = await compressAvatarDataUrl(dataUrl, MAX_CARD_BG_DATA_URL_LEN)
          if (next.length > MAX_CARD_BG_DATA_URL_LEN) {
            window.alert('背景图过大，请换一张较小的图片。')
            return
          }
          setBgUrl(next)
          setBgCropSrc('')
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] flex max-h-[min(92vh,720px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[20px] border bg-white shadow-[0_24px_60px_rgba(28,28,30,0.18)]"
        style={{ borderColor: '#e5e5e5' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-[#eee] px-5 pb-3 pt-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-[18px] font-semibold text-[#111]">
                编辑桌面个人名片
              </h2>
              <p className="mt-1 text-[12px] text-[#888]">与微信资料独立 · 仅影响主屏名片</p>
            </div>
            <Pressable
              type="button"
              onClick={onClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#e5e5e5] text-[#666] transition-colors hover:bg-[#f5f5f5]"
              aria-label="关闭"
            >
              <X className="size-4" strokeWidth={1.75} aria-hidden />
            </Pressable>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin]">

        <div className="mt-4">
          <p className="text-[12px] text-[#666]">背景图预览</p>
          <div
            className="mt-2 h-24 w-full overflow-hidden rounded-[12px] border"
            style={{
              borderColor: '#e5e5e5',
              backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.2) 100%), url(${JSON.stringify(bgPreview)})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }}
          />
          <label className="mt-2 block">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                onPickBackground(e.target.files?.[0] ?? null)
                e.currentTarget.value = ''
              }}
            />
            <span className="flex w-full items-center justify-center rounded-[10px] border border-[#e5e5e5] py-2 text-[12px] text-[#333]">
              本地上传背景
            </span>
          </label>
          <div className="mt-2 flex gap-2">
            <input
              value={bgUrlDraft}
              onChange={(e) => setBgUrlDraft(e.target.value)}
              placeholder="背景图 URL（http/https）"
              className="min-w-0 flex-1 rounded-[10px] border border-[#e5e5e5] px-3 py-2 text-[13px] outline-none"
            />
            <Pressable
              type="button"
              className="shrink-0 rounded-[10px] border border-[#e5e5e5] px-3 py-2 text-[12px]"
              onClick={applyBgUrlDraft}
            >
              应用
            </Pressable>
          </div>
          <Pressable
            type="button"
            className="mt-2 w-full text-center text-[11px] text-[#888]"
            onClick={() => setBgUrl(DEFAULT_PERSONAL_CARD_BG_PATH)}
          >
            恢复默认背景
          </Pressable>
        </div>

        <div className="mt-5 flex flex-col items-center gap-2">
          <label className="relative block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                onPickAvatar(e.target.files?.[0] ?? null)
                e.currentTarget.value = ''
              }}
            />
            <img
              src={avatarPreview}
              alt=""
              className="size-20 rounded-full border border-[#e5e5e5] object-cover"
            />
            <span className="mt-1 block text-center text-[12px] text-[#666]">点击更换头像</span>
          </label>
          <Pressable
            type="button"
            className="text-[11px] text-[#888]"
            onClick={() => setAvatarImageUrl(DEFAULT_PUBLIC_AVATAR_PATH)}
          >
            恢复默认头像
          </Pressable>
        </div>

        <label className="mt-4 block">
          <span className="text-[12px] text-[#666]">昵称</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={32}
            className="mt-1 w-full rounded-[10px] border border-[#e5e5e5] px-3 py-2 text-[15px] outline-none"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-[12px] text-[#666]">个性签名</span>
          <textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            maxLength={120}
            rows={3}
            className="mt-1 w-full resize-none rounded-[10px] border border-[#e5e5e5] px-3 py-2 text-[14px] outline-none"
            placeholder="桌面名片上显示的签名"
          />
        </label>

        </div>

        <footer className="shrink-0 flex gap-2 border-t border-[#eee] px-5 py-4">
          <Pressable
            type="button"
            onClick={onClose}
            className="flex-1 rounded-[12px] border border-[#e5e5e5] py-2.5 text-[15px]"
          >
            取消
          </Pressable>
          <Pressable
            type="button"
            onClick={save}
            className="flex-1 rounded-[12px] border border-[#111] bg-[#111] py-2.5 text-[15px] font-semibold text-white"
          >
            保存
          </Pressable>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
