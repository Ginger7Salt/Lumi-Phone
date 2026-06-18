import { motion } from 'framer-motion'
import { Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { WeChatPersonaContact } from '../../../types'
import type { WeChatSharedRecordPayload } from '../newFriendsPersona/types'
import {
  getFavoriteAudioPlayingId,
  playFavoriteAudio,
  subscribeFavoriteAudio,
} from './favoriteAudioController'
import { formatFavoriteRelativeTime, formatVoiceDuration } from './mapFavoriteToItem'
import { useSharedRecordOriginDisplayName } from './useSharedRecordOriginDisplayName'
import { useSharedRecordVoiceAudioUrl } from './useSharedRecordVoiceAudioUrl'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
}

function MiniVoiceCapsule({
  shareId,
  durationSec,
  data,
  transcript,
}: {
  shareId: string
  durationSec: number
  data: WeChatSharedRecordPayload
  transcript?: string
}) {
  const playKey = `sr-${shareId}`
  const audioUrl = useSharedRecordVoiceAudioUrl(data)
  const [playingId, setPlayingId] = useState<string | null>(() => getFavoriteAudioPlayingId())
  const playing = playingId === playKey

  useEffect(() => subscribeFavoriteAudio(() => setPlayingId(getFavoriteAudioPlayingId())), [])

  return (
    <div>
      <button
        type="button"
        disabled={!audioUrl?.trim()}
        onClick={() => {
          const src = audioUrl?.trim()
          if (src) playFavoriteAudio(playKey, src)
        }}
        className="flex w-full items-center rounded-full bg-white/80 px-3 py-2 text-left disabled:opacity-45"
      >
        <span className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-gray-800 shadow-sm">
          {playing ? (
            <Pause className="size-3" strokeWidth={2} fill="currentColor" />
          ) : (
            <Play className="ml-0.5 size-3" strokeWidth={2} fill="currentColor" />
          )}
        </span>
        <span className="flex-1 border-b border-dashed border-gray-300/70" aria-hidden />
        <span className="ml-2 shrink-0 text-[11px] tracking-wider text-gray-500">
          <ListenNumericText text={`[ ${formatVoiceDuration(durationSec)} ]`} />
        </span>
      </button>
      {transcript?.trim() ? (
        <p className="mt-1.5 text-[10px] italic leading-relaxed text-gray-400">{transcript.trim()}</p>
      ) : null}
    </div>
  )
}

type Props = {
  data: WeChatSharedRecordPayload
  personaContacts?: readonly WeChatPersonaContact[]
  playerDisplayName?: string
}

/** 聊天室 · 收藏记忆切片转发卡（档案复印件质感） */
export function SharedRecordCard({ data, personaContacts, playerDisplayName }: Props) {
  const origin = useSharedRecordOriginDisplayName(data, { personaContacts, playerDisplayName })

  return (
    <motion.div
      className="w-[min(280px,calc(100vw-120px))] overflow-hidden rounded-[16px] border border-gray-100 bg-[#F9F9FA] text-left shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
      {...CARD_MOTION}
    >
      <div className="border-l-2 border-gray-300 px-4 py-3.5">
        <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-gray-400">
          FORWARDED RECORD | 收藏切片
        </p>
        <p className="mt-2 text-[13px] font-semibold italic text-gray-900">
          Origin: {origin}
        </p>

        <div className="mt-3">
          {data.recordType === 'text' ? (
            <div className="relative px-1">
              <span className="pointer-events-none absolute -left-0.5 top-0 select-none font-serif text-[32px] leading-none text-gray-900/[0.06]" aria-hidden>
                “
              </span>
              <p
                className="relative font-serif text-[14px] leading-relaxed text-gray-800"
                style={{ fontFamily: 'var(--wx-font, "Noto Serif SC", serif)' }}
              >
                {data.contentSummary}
              </p>
              <span className="mt-1 block text-right font-serif text-[20px] leading-none text-gray-300/80" aria-hidden>
                ”
              </span>
            </div>
          ) : null}

          {data.recordType === 'voice' ? (
            <MiniVoiceCapsule
              shareId={data.shareId}
              durationSec={Math.max(1, data.voiceDurationSec ?? 1)}
              data={data}
              transcript={data.voiceTranscript || data.contentSummary}
            />
          ) : null}

          {data.recordType === 'image' && data.imageUrls?.length ? (
            <div
              className={
                data.imageUrls.length > 1
                  ? 'grid grid-cols-2 gap-1 overflow-hidden rounded-xl'
                  : 'overflow-hidden rounded-xl shadow-[inset_0_0_16px_rgba(0,0,0,0.05)]'
              }
            >
              {data.imageUrls.slice(0, 4).map((url, idx) => (
                <div
                  key={`${data.shareId}-${idx}`}
                  className={`relative overflow-hidden bg-gray-100 ${
                    data.imageUrls!.length > 1 ? 'aspect-square' : 'aspect-[4/5]'
                  }`}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-[10px] text-gray-400">
          原消息 · <ListenNumericText text={formatFavoriteRelativeTime(data.timestamp)} />
        </p>
      </div>
    </motion.div>
  )
}
