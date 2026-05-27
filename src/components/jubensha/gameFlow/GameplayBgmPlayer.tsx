import { useEffect, useRef } from 'react'

/** 全局 BGM 音量（低于 DM 语音，避免抢戏） */
export const JBS_GAMEPLAY_BGM_VOLUME = 0.32

export type GameplayBgmPlayerProps = {
  url?: string
  muted: boolean
}

/**
 * 游玩 BGM 专用轨（`#jbs-gameplay-bgm`），与 `#jbs-bgm` 解耦、与 `jbsDmVoicePlayer` 分轨。
 */
export function GameplayBgmPlayer({ url, muted }: GameplayBgmPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const awaitingGestureRef = useRef(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !url) return

    audio.loop = true
    audio.volume = muted ? 0 : JBS_GAMEPLAY_BGM_VOLUME

    if (muted) {
      audio.pause()
      awaitingGestureRef.current = false
      return
    }

    void audio.play().then(
      () => {
        awaitingGestureRef.current = false
      },
      () => {
        awaitingGestureRef.current = true
      },
    )
  }, [url, muted])

  useEffect(() => {
    if (!url) return

    const resume = () => {
      if (!awaitingGestureRef.current || muted) return
      const audio = audioRef.current
      if (!audio) return
      void audio.play().then(
        () => {
          awaitingGestureRef.current = false
        },
        () => {},
      )
    }

    window.addEventListener('pointerdown', resume, { passive: true })
    window.addEventListener('keydown', resume)
    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
  }, [url, muted])

  useEffect(() => {
    return () => {
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.src = ''
      }
    }
  }, [])

  if (!url) return null

  return (
    <audio
      ref={audioRef}
      id="jbs-gameplay-bgm"
      src={url}
      preload="auto"
      loop
      aria-hidden
    />
  )
}
