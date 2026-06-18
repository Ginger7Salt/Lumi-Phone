import { useEffect, useState } from 'react'
import type { WeChatSharedRecordPayload } from '../newFriendsPersona/types'
import { loadSharedRecordVoiceAudio } from '../wechatVoiceAudioCache'

/** 转发卡语音：从 payload 短链或 KV 缓存解析可播放 URL。 */
export function useSharedRecordVoiceAudioUrl(data: WeChatSharedRecordPayload): string | undefined {
  const inline = data.voiceAudioUrl?.trim()
  const [resolved, setResolved] = useState<string | undefined>(inline || undefined)

  useEffect(() => {
    if (data.recordType !== 'voice') {
      setResolved(undefined)
      return
    }
    if (inline) {
      setResolved(inline)
      return
    }
    const kvKey = data.voiceAudioKvKey?.trim() || data.shareId.trim()
    let cancelled = false
    void loadSharedRecordVoiceAudio(kvKey).then((url) => {
      if (!cancelled) setResolved(url || undefined)
    })
    return () => {
      cancelled = true
    }
  }, [data.recordType, data.shareId, data.voiceAudioKvKey, inline])

  return resolved
}
