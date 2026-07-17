import { Loader2, MapPin } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Pressable } from '../../components/Pressable'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { PULSE_COLORS } from './constants'
import { usePublishKeyboardInset } from './hooks/usePublishKeyboardInset'
import { PublishAiImageModal } from './components/publish/PublishAiImageModal'
import { PublishFacePickerSheet } from './components/publish/PublishFacePickerSheet'
import { PublishFloatingToolbox } from './components/publish/PublishFloatingToolbox'
import { PublishImagePickerSheet } from './components/publish/PublishImagePickerSheet'
import { PublishLocationSheet } from './components/publish/PublishLocationSheet'
import { PublishMediaMatrix } from './components/publish/PublishMediaMatrix'
import {
  PublishMentionSheet,
  type PublishMentionCandidate,
} from './components/publish/PublishMentionSheet'
import {
  PublishRichEditor,
  type PublishRichEditorHandle,
} from './components/publish/PublishRichEditor'
import { PublishUrlImageModal } from './components/publish/PublishUrlImageModal'
import { PublishVisibilitySheet } from './components/publish/PublishVisibilitySheet'
import { rewritePlainMentionsToPulseExpr } from './pulseMentionExpr'
import { schedulePlayerPostEngagementAfterPublish } from './pulsePlayerPostEngagement'
import { schedulePlayerPostCharacterEngagementAfterPublish } from './pulsePlayerPostCharacterEngagement'
import {
  normalizePulsePostVisibility,
  type PulseVisibilityCandidate,
} from './pulsePostVisibility'
import { filesToPulseImageDataUrls, MAX_PULSE_POST_IMAGES } from './pulsePublishImages'
import type { PulsePost } from './pulseTypes'
import { pulsePostReadyImageUrls } from './pulseTypes'
import { usePulseMentionDirectory } from './usePulseMentionDirectory'
import { usePulsePlayerAccount } from './usePulsePlayerAccount'
import { usePulseStore } from './usePulseStore'

type PublishPhase = 'edit' | 'publishing'

export function PublishPostPage({
  authorPovId,
  authorName,
  authorAvatarUrl,
  mentionCandidates,
  visibilityCandidates,
  editPost,
  onClose,
  onPublished,
  onToast,
  suppressAutoFocus = false,
}: {
  authorPovId: string
  authorName: string
  authorAvatarUrl?: string
  mentionCandidates?: PublishMentionCandidate[]
  /** 绑定当前身份的角色，供「谁可以看」 */
  visibilityCandidates?: PulseVisibilityCandidate[]
  /** 传入则为编辑模式 */
  editPost?: PulsePost | null
  onClose: () => void
  onPublished: () => void
  onToast?: (msg: string) => void
  /** 玩法引导打开时勿自动聚焦输入框，避免键盘挡住指引 */
  suppressAutoFocus?: boolean
}) {
  const isEditing = Boolean(editPost?.id)
  const initialVis = normalizePulsePostVisibility({
    visibility: editPost?.visibility,
    visibleToCharPovIds: editPost?.visibleToCharPovIds,
  })

  const [text, setText] = useState(() => editPost?.content ?? '')
  const [images, setImages] = useState<string[]>(() =>
    editPost ? pulsePostReadyImageUrls(editPost) : [],
  )
  const [locationLabel, setLocationLabel] = useState<string | undefined>(
    () => editPost?.locationLabel,
  )
  const [visibilityMode, setVisibilityMode] = useState<'public' | 'partial'>(
    () => initialVis.visibility,
  )
  const [visibleToCharPovIds, setVisibleToCharPovIds] = useState<string[]>(
    () => initialVis.visibleToCharPovIds ?? [],
  )
  const [addingImages, setAddingImages] = useState(false)
  const [phase, setPhase] = useState<PublishPhase>('edit')

  const [mentionOpen, setMentionOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [urlModalOpen, setUrlModalOpen] = useState(false)
  const [visibilityOpen, setVisibilityOpen] = useState(false)
  const [composerFocused, setComposerFocused] = useState(false)

  const editorRef = useRef<PublishRichEditorHandle>(null)
  const pendingInsertRef = useRef<{ text: string; offset?: number } | null>(null)
  const focusTrapRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dismissedRef = useRef(false)
  const onPublishedRef = useRef(onPublished)
  const onCloseRef = useRef(onClose)
  onPublishedRef.current = onPublished
  onCloseRef.current = onClose

  const publishPost = usePulseStore((s) => s.publishPost)
  const updatePost = usePulseStore((s) => s.updatePost)
  const apiConfig = useCurrentApiConfig('chatCard')
  const { displayName: playerDisplayName, identityRealName } = usePulsePlayerAccount()
  const mentionDirectory = usePulseMentionDirectory()
  const sheetOpen =
    mentionOpen ||
    locationOpen ||
    emojiOpen ||
    imagePickerOpen ||
    aiModalOpen ||
    urlModalOpen ||
    visibilityOpen
  const { composerRef, keyboardPadPx } = usePublishKeyboardInset(
    phase === 'edit' && composerFocused && !sheetOpen,
  )

  const canPublish = text.trim().length > 0 || images.length > 0
  const mentions = useMemo(() => mentionCandidates ?? [], [mentionCandidates])
  const visCandidates = useMemo(() => visibilityCandidates ?? [], [visibilityCandidates])

  const closeAllSheets = () => {
    setMentionOpen(false)
    setLocationOpen(false)
    setEmojiOpen(false)
    setImagePickerOpen(false)
    setAiModalOpen(false)
    setUrlModalOpen(false)
    setVisibilityOpen(false)
  }

  const blurComposer = useCallback(() => {
    editorRef.current?.blur()
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
    // iOS：先聚焦隐藏按钮再 blur，确保软键盘真正收起
    focusTrapRef.current?.focus({ preventScroll: true })
    requestAnimationFrame(() => focusTrapRef.current?.blur())
  }, [])

  useEffect(() => {
    if (!suppressAutoFocus) return
    blurComposer()
    const t = window.setTimeout(blurComposer, 80)
    return () => window.clearTimeout(t)
  }, [suppressAutoFocus, blurComposer])

  /** 立刻卸掉本页：禁止 exit 动画 / 残留 fixed 遮罩挡列表滑动 */
  const dismissPublished = () => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    blurComposer()
    closeAllSheets()
    onPublishedRef.current()
  }

  const dismissCancelled = () => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    blurComposer()
    closeAllSheets()
    onCloseRef.current()
  }

  useEffect(() => {
    return () => {
      const active = document.activeElement
      if (active instanceof HTMLElement) active.blur()
    }
  }, [])

  const flushPendingInsert = useCallback(() => {
    const pending = pendingInsertRef.current
    if (!pending) return
    pendingInsertRef.current = null
    editorRef.current?.focus()
    editorRef.current?.insertToken(pending.text, pending.offset)
  }, [])

  const applyInsert = useCallback(
    (insert: string, cursorOffsetInInsert?: number) => {
      if (sheetOpen) {
        pendingInsertRef.current = { text: insert, offset: cursorOffsetInInsert }
        return
      }
      editorRef.current?.focus()
      editorRef.current?.insertToken(insert, cursorOffsetInInsert)
    },
    [sheetOpen],
  )

  useEffect(() => {
    if (sheetOpen) return
    flushPendingInsert()
  }, [sheetOpen, flushPendingInsert])

  const openSheet = useCallback(
    (open: () => void) => {
      blurComposer()
      open()
    },
    [blurComposer],
  )

  const openImagePicker = () => {
    if (addingImages || images.length >= MAX_PULSE_POST_IMAGES || phase !== 'edit') return
    openSheet(() => setImagePickerOpen(true))
  }

  const openVisibilitySheet = () => {
    if (phase !== 'edit') return
    openSheet(() => setVisibilityOpen(true))
  }

  const pickLocalImages = () => {
    setImagePickerOpen(false)
    fileInputRef.current?.click()
  }

  const appendImage = (url: string) => {
    setImages((prev) => (prev.length >= MAX_PULSE_POST_IMAGES ? prev : [...prev, url]))
  }

  const onPickImages = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    const remaining = MAX_PULSE_POST_IMAGES - images.length
    if (remaining <= 0) return

    const files = Array.from(fileList)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, remaining)
    if (!files.length) return

    setAddingImages(true)
    try {
      const urls = await filesToPulseImageDataUrls(files)
      setImages((prev) => [...prev, ...urls].slice(0, MAX_PULSE_POST_IMAGES))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '图片处理失败，请换一张试试')
    } finally {
      setAddingImages(false)
    }
  }

  const submit = () => {
    if (!canPublish || phase !== 'edit' || addingImages) return
    if (visibilityMode === 'partial' && !visibleToCharPovIds.length) {
      onToast?.('请至少选择一位可见角色，或改为全部可见')
      setVisibilityOpen(true)
      return
    }
    const content = rewritePlainMentionsToPulseExpr(text.trim(), mentionDirectory)
    const vis = normalizePulsePostVisibility({
      visibility: visibilityMode,
      visibleToCharPovIds,
    })
    closeAllSheets()
    setPhase('publishing')

    try {
      if (isEditing && editPost) {
        const ok = updatePost(editPost.id, {
          content,
          imageUrls: images.length ? images : null,
          locationLabel: locationLabel ?? null,
          visibility: vis.visibility,
          visibleToCharPovIds: vis.visibleToCharPovIds,
        })
        if (!ok) {
          setPhase('edit')
          onToast?.('保存失败，请重试')
          return
        }
        onToast?.('已保存')
        dismissPublished()
        return
      }

      const postId = publishPost({
        authorPovId,
        authorName,
        authorAvatarUrl,
        content,
        imageUrls: images.length ? images : undefined,
        locationLabel,
        visibility: vis.visibility,
        visibleToCharPovIds: vis.visibleToCharPovIds,
        playerMentionAliases: [playerDisplayName].filter(Boolean),
      })
      if (postId) {
        try {
          schedulePlayerPostEngagementAfterPublish({
            postId,
            apiConfig,
            playerRealName: identityRealName?.trim() || undefined,
            playerWeiboNickname: authorName,
            onToast,
          })
          schedulePlayerPostCharacterEngagementAfterPublish({
            postId,
            apiConfig,
            playerDisplayName: authorName,
            onToast,
          })
        } catch {
          // 互动调度失败不挡关闭发帖页
        }
      }
      dismissPublished()
    } catch {
      setPhase('edit')
      onToast?.(isEditing ? '保存失败，请重试' : '发布失败，请重试')
    }
  }

  /**
   * portal 到 body：避开手机壳 transform 下 fixed 错位/残留挡触摸。
   * sheet 不做 AnimatePresence exit，关闭即卸，避免透明遮罩粘住。
   */
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`fixed inset-0 z-[1250] flex flex-col bg-white ${
        phase !== 'edit' ? 'pointer-events-none' : ''
      }`}
      data-pulse-publish-overlay="1"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void onPickImages(e.target.files)
          e.target.value = ''
        }}
      />
      <button
        ref={focusTrapRef}
        type="button"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none fixed opacity-0"
        style={{ width: 1, height: 1, left: -9999 }}
      />

      <header
        className="flex shrink-0 items-center justify-between bg-white px-5 py-3"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable
          type="button"
          onClick={dismissCancelled}
          disabled={phase !== 'edit'}
          className="text-[13px] text-neutral-400 disabled:opacity-40"
        >
          取消
        </Pressable>
        <span className="text-[11px] uppercase tracking-[0.28em] text-neutral-300">
          {isEditing ? 'Edit' : 'Publish'}
        </span>
        <Pressable
          type="button"
          onClick={submit}
          disabled={!canPublish || phase !== 'edit' || addingImages}
          className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors duration-300 ${
            canPublish && phase === 'edit'
              ? 'font-semibold text-white shadow-[0_2px_10px_rgba(229,152,155,0.35)]'
              : 'font-normal text-neutral-300'
          }`}
          style={
            canPublish && phase === 'edit'
              ? { backgroundColor: PULSE_COLORS.dustyRose }
              : undefined
          }
          data-pulse-coach="publish-submit"
        >
          {phase === 'publishing' ? (
            <Loader2
              className="size-4 animate-spin"
              style={{ color: '#D4AF37' }}
              strokeWidth={2}
            />
          ) : isEditing ? (
            '保存'
          ) : (
            '发布'
          )}
        </Pressable>
      </header>

      <div
        ref={composerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{
          paddingBottom: `calc(16px + env(safe-area-inset-bottom, 0px) + ${keyboardPadPx}px)`,
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div data-pulse-coach="publish-editor">
          <PublishRichEditor
            ref={editorRef}
            value={text}
            onChange={setText}
            editable={!sheetOpen}
            onFocusChange={setComposerFocused}
            autoFocus={!suppressAutoFocus}
          />
        </div>

        {phase === 'edit' ? (
          <div data-pulse-coach="publish-toolbox">
            <PublishFloatingToolbox
              onDismissKeyboard={blurComposer}
              onOpenEmoji={() => openSheet(() => setEmojiOpen(true))}
              onImage={openImagePicker}
              onHashtag={() => applyInsert('##', 1)}
              onMention={() => openSheet(() => setMentionOpen(true))}
              onLocation={() => openSheet(() => setLocationOpen(true))}
              onVisibility={openVisibilitySheet}
              visibilityPartial={visibilityMode === 'partial'}
              imageDisabled={addingImages || images.length >= MAX_PULSE_POST_IMAGES}
            />
          </div>
        ) : null}

        <PublishMediaMatrix
          urls={images}
          adding={addingImages}
          onRemove={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
        />

        {locationLabel ? (
          <div className="flex items-center gap-1.5 px-6 pb-2 text-[11px] text-neutral-400">
            <MapPin className="size-3.5 shrink-0" strokeWidth={1.5} />
            <span>{locationLabel}</span>
          </div>
        ) : null}
      </div>

      {/* 无 AnimatePresence：exit 动画会留下挡触摸的 fixed 遮罩 */}
      {mentionOpen ? (
        <PublishMentionSheet
          candidates={mentions}
          onPick={(row) => {
            // 编辑器展示微博昵称；发布时 rewritePlainMentionsToPulseExpr 再写成表达式
            applyInsert(`@${row.name} `)
            setMentionOpen(false)
          }}
          onClose={() => setMentionOpen(false)}
        />
      ) : null}
      {emojiOpen ? (
        <PublishFacePickerSheet
          onPick={(token) => {
            setEmojiOpen(false)
            applyInsert(token)
          }}
          onClose={() => setEmojiOpen(false)}
        />
      ) : null}
      {locationOpen ? (
        <PublishLocationSheet
          selected={locationLabel}
          onPick={(label) => {
            setLocationLabel(label)
            setLocationOpen(false)
          }}
          onClear={() => {
            setLocationLabel(undefined)
            setLocationOpen(false)
          }}
          onClose={() => setLocationOpen(false)}
        />
      ) : null}
      {imagePickerOpen ? (
        <PublishImagePickerSheet
          onPickLocal={pickLocalImages}
          onPickUrl={() => {
            setImagePickerOpen(false)
            setUrlModalOpen(true)
          }}
          onPickAi={() => {
            setImagePickerOpen(false)
            setAiModalOpen(true)
          }}
          onClose={() => setImagePickerOpen(false)}
        />
      ) : null}
      {aiModalOpen ? (
        <PublishAiImageModal
          onClose={() => setAiModalOpen(false)}
          onGenerated={(url) => appendImage(url)}
        />
      ) : null}
      {urlModalOpen ? (
        <PublishUrlImageModal
          onClose={() => setUrlModalOpen(false)}
          onSubmit={(url) => {
            appendImage(url)
            setUrlModalOpen(false)
          }}
        />
      ) : null}
      {visibilityOpen ? (
        <PublishVisibilitySheet
          mode={visibilityMode}
          selectedPovIds={visibleToCharPovIds}
          candidates={visCandidates}
          onChangeMode={(mode) => {
            setVisibilityMode(mode)
            if (mode === 'public') setVisibleToCharPovIds([])
          }}
          onTogglePov={(povId) => {
            setVisibleToCharPovIds((prev) =>
              prev.includes(povId) ? prev.filter((id) => id !== povId) : [...prev, povId],
            )
          }}
          onClose={() => setVisibilityOpen(false)}
        />
      ) : null}
    </div>,
    document.body,
  )
}
