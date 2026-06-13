import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Image as ImageIcon } from 'lucide-react'

import { Pressable } from '../../components/Pressable'
import { logConsole } from './consoleLogger'
import { compressChatImageToJpeg, loadImageFromFile } from './wechatChatImageCompress'

function defaultCameraFacing(): 'user' | 'environment' {
  if (typeof navigator === 'undefined') return 'environment'
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  return mobile ? 'environment' : 'user'
}

type Stage = 'camera' | 'preview'

export function WeChatChatCameraScreen({
  open,
  onClose,
  onSend,
  onToast,
}: {
  open: boolean
  onClose: () => void
  onSend: (payload: { base64: string; mime: 'image/jpeg' }) => void
  onToast: (msg: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const openRef = useRef(open)
  const onCloseRef = useRef(onClose)
  const onToastRef = useRef(onToast)
  const startSeqRef = useRef(0)
  const startStreamRef = useRef<() => void>(() => {})
  const [facing, setFacing] = useState<'user' | 'environment'>(defaultCameraFacing)
  const [stage, setStage] = useState<Stage>('camera')
  const stageRef = useRef<Stage>(stage)
  const [previewBase64, setPreviewBase64] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const retryAbortRef = useRef(0)

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    onToastRef.current = onToast
  }, [onToast])

  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  useEffect(() => {
    if (open) return
    setStage('camera')
    setPreviewBase64('')
    setFacing(defaultCameraFacing())
  }, [open])

  const stopStream = useCallback(() => {
    const s = streamRef.current
    if (s) {
      s.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    const v = videoRef.current
    if (v) v.srcObject = null
  }, [])

  const bindStreamToVideo = useCallback(async (stream: MediaStream) => {
    const v = videoRef.current
    if (!v) return false
    if (v.srcObject !== stream) {
      v.srcObject = stream
    }
    v.muted = true
    v.playsInline = true
    v.autoplay = true
    v.setAttribute('playsinline', 'true')
    v.setAttribute('webkit-playsinline', 'true')

    for (let i = 0; i < 4; i += 1) {
      try {
        await v.play()
        if (v.videoWidth > 0 && v.videoHeight > 0) {
          logConsole('frontend', `相机预览就绪：${v.videoWidth}x${v.videoHeight}`)
          return true
        }
      } catch (pe) {
        const perr = pe as { name?: string; message?: string }
        logConsole(
          'frontend',
          `video.play retry ${i + 1}/4 failed: ${perr?.name || 'Error'} ${perr?.message || ''}`.trim(),
        )
      }
      await new Promise<void>((r) => window.setTimeout(r, 120))
    }
    return v.videoWidth > 0 && v.videoHeight > 0
  }, [])

  const startStream = useCallback(async () => {
    const seq = (startSeqRef.current += 1)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('NotSupportedError 当前环境不支持相机')
      }

      logConsole(
        'frontend',
        `getUserMedia: secure=${String(window.isSecureContext)} origin=${window.location.origin} facing=${facing}`,
      )

      const tryStart = async (constraints: MediaStreamConstraints) => {
        return await navigator.mediaDevices.getUserMedia(constraints)
      }

      let s: MediaStream
      try {
        s = await tryStart({
          video: { facingMode: facing },
          audio: false,
        })
      } catch (e) {
        const err = e as { name?: string; message?: string }
        logConsole('error', `getUserMedia(primary) failed: ${err?.name || 'Error'} ${err?.message || ''}`.trim())
        s = await tryStart({ video: true, audio: false })
        logConsole('frontend', 'getUserMedia: fallback video=true ok')
      }

      if (seq !== startSeqRef.current || !openRef.current || stageRef.current !== 'camera') {
        s.getTracks().forEach((t) => t.stop())
        return
      }

      const prev = streamRef.current
      streamRef.current = s
      if (prev) prev.getTracks().forEach((t) => t.stop())

      const bound = await bindStreamToVideo(s)
      if (!bound) {
        await new Promise<void>((resolve) => {
          const v = videoRef.current
          if (!v) {
            resolve()
            return
          }
          const onMeta = () => {
            v.removeEventListener('loadedmetadata', onMeta)
            void bindStreamToVideo(s).finally(resolve)
          }
          v.addEventListener('loadedmetadata', onMeta)
          window.setTimeout(() => {
            v.removeEventListener('loadedmetadata', onMeta)
            resolve()
          }, 1200)
        })
      }
    } catch (e) {
      const err = e as { name?: string; message?: string }
      const name = err?.name || (e instanceof Error ? e.name : 'Error')
      const msg = err?.message || (e instanceof Error ? e.message : String(e ?? 'unknown'))
      if (name === 'AbortError' && (seq !== startSeqRef.current || !openRef.current || stageRef.current !== 'camera')) {
        logConsole('frontend', `getUserMedia aborted (stale): ${name} ${msg}`.trim())
        return
      }
      logConsole('error', `getUserMedia failed: ${name} ${msg}`.trim())

      if (name === 'AbortError' && openRef.current && stageRef.current === 'camera') {
        const n = retryAbortRef.current + 1
        retryAbortRef.current = n
        if (n <= 2) {
          logConsole('frontend', `AbortError: 将在 220ms 后重试（第 ${n} 次）`)
          window.setTimeout(() => {
            if (!openRef.current) return
            startStreamRef.current()
          }, 220)
          return
        }
      }

      const lower = `${name} ${msg}`.toLowerCase()
      const tip =
        lower.includes('notallowed') || lower.includes('permission') || lower.includes('denied')
          ? '无法访问相机，请在系统设置中允许应用使用相机'
          : lower.includes('notfound') || lower.includes('devicesnotfound')
            ? '无法访问相机：未检测到摄像头设备'
            : lower.includes('notreadable') || lower.includes('trackstart')
              ? '无法访问相机：可能被其它应用占用，请关闭占用相机的应用后重试'
              : lower.includes('overconstrained')
                ? '无法访问相机：当前设备不支持所选摄像头，请尝试切换摄像头'
                : !window.isSecureContext
                  ? '无法访问相机：需要 HTTPS 或 localhost 才能使用相机'
                  : '无法访问相机，请检查设备'
      onToastRef.current(tip)
      onCloseRef.current()
    }
  }, [bindStreamToVideo, facing])

  useEffect(() => {
    startStreamRef.current = () => {
      void startStream()
    }
  }, [startStream])

  useEffect(() => {
    if (!open) return
    retryAbortRef.current = 0
    logConsole('frontend', '相机页打开：开始请求 getUserMedia')
    void startStream()
    return () => stopStream()
  }, [open, facing, startStream, stopStream])

  // video 节点晚于 getUserMedia 完成时，补绑一次预览流
  useLayoutEffect(() => {
    if (!open || stage !== 'camera') return
    const stream = streamRef.current
    if (!stream) return
    void bindStreamToVideo(stream)
  }, [bindStreamToVideo, open, stage])

  // 权限已开但 preview 仍黑屏：短周期重试绑定，避免 StrictMode / 重渲染竞态
  useEffect(() => {
    if (!open || stage !== 'camera') return
    let cancelled = false
    let attempts = 0

    const retryBind = async () => {
      if (cancelled || attempts >= 20) return
      attempts += 1
      const stream = streamRef.current
      const v = videoRef.current
      if (!stream || !v) {
        window.setTimeout(() => void retryBind(), 120)
        return
      }
      if (v.videoWidth > 0 && v.videoHeight > 0) return
      await bindStreamToVideo(stream)
      if (cancelled) return
      if (videoRef.current && videoRef.current.videoWidth > 0) return
      window.setTimeout(() => void retryBind(), 150)
    }

    void retryBind()
    return () => {
      cancelled = true
    }
  }, [bindStreamToVideo, facing, open, stage])

  const capture = useCallback(async () => {
    const v = videoRef.current
    if (!v) return
    let w = v.videoWidth
    let h = v.videoHeight
    if (!w || !h) {
      for (let i = 0; i < 8; i += 1) {
        await new Promise<void>((r) => window.setTimeout(r, 120))
        w = v.videoWidth
        h = v.videoHeight
        if (w && h) break
        if (streamRef.current) await bindStreamToVideo(streamRef.current)
      }
    }
    if (!w || !h) {
      onToastRef.current('无法访问相机，请检查设备')
      return
    }
    const root = v.closest('[data-wx-camera-root]') as HTMLElement | null
    if (root) {
      root.dataset.flash = '1'
      window.setTimeout(() => {
        if (root.dataset.flash) delete root.dataset.flash
      }, 90)
    }
    try {
      const base64 = await compressChatImageToJpeg({ source: v, width: w, height: h })
      logConsole('frontend', `拍摄得到 base64 长度=${base64.length}`)
      setPreviewBase64(base64)
      setStage('preview')
      stopStream()
    } catch {
      onToastRef.current('图片处理失败，请重试')
    }
  }, [bindStreamToVideo, stopStream])

  const pickFromAlbum = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onPickFile = useCallback(
    async (f: File | null) => {
      if (!f) return
      try {
        logConsole('frontend', `相册选择：name=${f.name} type=${f.type} bytes=${f.size}`)
        const img = await loadImageFromFile(f)
        const base64 = await compressChatImageToJpeg({ source: img, width: img.naturalWidth, height: img.naturalHeight })
        logConsole('frontend', `相册得到 base64 长度=${base64.length}`)
        setPreviewBase64(base64)
        setStage('preview')
        stopStream()
      } catch {
        onToastRef.current('图片处理失败，请重试')
      }
    },
    [stopStream],
  )

  const previewUrl = useMemo(() => (previewBase64 ? `data:image/jpeg;base64,${previewBase64}` : ''), [previewBase64])

  if (!open) return null

  return (
    <motion.div
      className="absolute inset-0 z-[260] flex min-h-0 min-w-0 flex-col bg-black"
      initial={false}
      data-wx-camera-root
    >
      <style>{`
        [data-wx-camera-root][data-flash='1']::after{
          content:'';
          position:absolute;
          inset:0;
          background:#ffffff;
          opacity:0.55;
          pointer-events:none;
        }
      `}</style>

      <div className="relative z-20 flex shrink-0 items-center justify-between bg-black px-4 py-3">
        {stage === 'camera' ? (
          <button type="button" className="text-[16px] text-white" onClick={onClose}>
            取消
          </button>
        ) : (
          <button
            type="button"
            className="text-[16px] text-white"
            onClick={() => {
              setStage('camera')
              setPreviewBase64('')
              void startStream()
            }}
          >
            重拍
          </button>
        )}

        {stage === 'camera' ? (
          <button
            type="button"
            aria-label="切换摄像头"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            onClick={() => setFacing((p) => (p === 'environment' ? 'user' : 'environment'))}
          >
            <Camera size={24} strokeWidth={2} className="text-white" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className="rounded-[16px] bg-black px-4 py-2 text-[14px] font-medium text-white"
            style={{ border: '1px solid rgba(255,255,255,0.22)' }}
            onClick={() => {
              if (!previewBase64) return
              onSend({ base64: previewBase64, mime: 'image/jpeg' })
            }}
          >
            发送
          </button>
        )}
      </div>

      <div className="relative z-0 min-h-0 flex-1 overflow-hidden bg-black">
        {stage === 'camera' ? (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
            muted
            autoPlay
            onLoadedMetadata={() => {
              if (streamRef.current) void bindStreamToVideo(streamRef.current)
            }}
          />
        ) : previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-contain" />
        ) : null}
      </div>

      {stage === 'camera' ? (
        <div
          className="flex shrink-0 items-center justify-center bg-black"
          style={{ height: 120, paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex w-full items-center justify-center px-6">
            <button
              type="button"
              aria-label="相册"
              className="mr-auto flex h-10 w-10 items-center justify-center rounded-full"
              onClick={pickFromAlbum}
            >
              <ImageIcon size={24} strokeWidth={2} className="text-white" aria-hidden />
            </button>

            <Pressable
              type="button"
              aria-label="拍摄"
              onClick={() => void capture()}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
              style={{ border: '3px solid #ffffff' }}
            >
              <div className="h-[54px] w-[54px] rounded-full bg-white" aria-hidden />
            </Pressable>

            <div className="ml-auto h-10 w-10" aria-hidden />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              e.currentTarget.value = ''
              void onPickFile(f)
            }}
          />
        </div>
      ) : null}
    </motion.div>
  )
}
