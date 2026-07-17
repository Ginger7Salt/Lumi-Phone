import { Sparkles } from 'lucide-react'

import { Pressable } from '../../components/Pressable'
import { TrendingItem } from './components/TrendingItem'
import { PULSE_COLORS } from './constants'
import type { PulseTrendingTopic } from './pulseTypes'

/** 发现页热搜榜单区块 */
export function TrendingBoard({
  trending,
  loading,
  onGenerate,
  onOpenTopic,
}: {
  trending: PulseTrendingTopic[]
  loading: boolean
  onGenerate: () => void
  onOpenTopic: (topic: PulseTrendingTopic) => void
}) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold text-[#1C1C1E]">热搜榜</h2>
        <Pressable
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] tracking-wide text-neutral-600 shadow-[0_2px_15px_rgba(0,0,0,0.03)] disabled:opacity-60"
          style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
          data-pulse-coach="discover-trending-btn"
        >
          <Sparkles className="size-3.5" strokeWidth={1.4} style={{ color: PULSE_COLORS.lightGold }} />
          {loading ? '演化中…' : '演化新的热搜'}
        </Pressable>
      </div>

      {loading && !trending.length ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
            >
              <div className="h-5 w-7 animate-pulse rounded bg-neutral-100" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-[70%] animate-pulse rounded-full bg-neutral-100" />
                <div className="h-2.5 w-[45%] animate-pulse rounded-full bg-neutral-50" />
              </div>
              <div className="h-5 w-8 animate-pulse rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : trending.length ? (
        <div className="space-y-2.5">
          {trending.map((topic, i) => (
            <TrendingItem key={topic.id} topic={topic} index={i} onPress={() => onOpenTopic(topic)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="font-serif text-[14px] text-neutral-500">舆论场尚未启动</p>
          <p className="mt-2 text-[12px] text-neutral-400">点击上方按钮，让 AI 演化热搜与讨论</p>
        </div>
      )}
    </>
  )
}
