import { motion } from 'framer-motion'
import { ChevronDown, Loader2, Pause, Volume2 } from 'lucide-react'
import { VNNameTag } from './VNNameTag'

type Props = {
  name: string
  loading: boolean
  innerVoice?: boolean
  showNameTag?: boolean
  canPlayVoice?: boolean
  voiceDisabled?: boolean
  voiceGenerating?: boolean
  voicePlaying?: boolean
  onToggleVoice?: () => void
  onDisabledVoiceClick?: () => void
  showContinueHint?: boolean
  onContinue: () => void
  children: string
}

export function VNDialogBox({
  name,
  loading,
  innerVoice = false,
  showNameTag = true,
  canPlayVoice = false,
  voiceDisabled = false,
  voiceGenerating = false,
  voicePlaying = false,
  onToggleVoice,
  onDisabledVoiceClick,
  showContinueHint = false,
  onContinue,
  children,
}: Props) {
  return (
    <motion.section
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="relative w-full overflow-visible"
    >
      {showNameTag ? (
        <VNNameTag
          name={name}
          innerVoice={innerVoice}
          rightNode={
            canPlayVoice ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (voiceDisabled) {
                    onDisabledVoiceClick?.()
                    return
                  }
                  onToggleVoice?.()
                }}
                className={`inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-[11px] transition-all duration-150 ${
                  voiceDisabled ? 'opacity-60' : 'hover:opacity-90'
                }`}
                style={{
                  borderColor: innerVoice ? 'rgba(231,204,143,0.7)' : 'rgba(255,255,255,0.6)',
                  color: innerVoice ? '#E7CC8F' : '#FFFFFF',
                  background: innerVoice ? 'rgba(36,28,16,0.35)' : 'rgba(255,255,255,0.12)',
                }}
                title="播放对白语音"
              >
                {voiceGenerating ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={1.9} />
                ) : voicePlaying ? (
                  <Pause className="size-3.5" strokeWidth={1.9} />
                ) : (
                  <Volume2 className="size-3.5" strokeWidth={1.9} />
                )}
              </button>
            ) : null
          }
        />
      ) : null}
      <div
        className="relative min-h-[132px] overflow-hidden px-4 pb-3 pt-8"
        style={{
          // 默认：纯白为主，轻微毛玻璃即可（不要高透强模糊）
          background: innerVoice ? 'rgba(18,18,20,0.82)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          borderTop: innerVoice
            ? '0.5px solid rgba(231,204,143,0.6)'
            : '0.5px solid rgba(255,255,255,0.95)',
          borderBottom: innerVoice
            ? '0.5px solid rgba(231,204,143,0.45)'
            : '0.5px solid rgba(226,232,240,0.9)',
          borderRadius: 10,
        }}
      >
        <button
          type="button"
          onClick={onContinue}
          className="w-full text-left"
        >
          <div
            className="min-h-[58px] whitespace-pre-wrap break-words text-[17px] leading-[1.7]"
            style={{ color: innerVoice ? '#E8D7AA' : '#1F2937' }}
          >
            {loading ? '剧情准备中...' : children}
          </div>
        </button>
        {showContinueHint ? (
          <motion.div
            animate={{ y: [0, 4, 0], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute bottom-1.5 right-2"
            style={{ color: innerVoice ? '#E8D7AA' : '#475569' }}
          >
            <ChevronDown className="size-4" strokeWidth={1.5} />
          </motion.div>
        ) : null}
      </div>
    </motion.section>
  )
}

