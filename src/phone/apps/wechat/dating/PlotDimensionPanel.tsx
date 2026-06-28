import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PlotRichParagraph } from './plotRichText'
import { PLOT_DIMENSION_LABELS } from './datingPlotDimensionAi'
import { parsePlotDimensionLengthTarget, type PlotDimensionArtifact, type PlotDimensionKind } from './types'

type Props = {
  open: boolean
  kind: PlotDimensionKind
  artifact: PlotDimensionArtifact | null | undefined
  defaultLengthTarget: number
  loading: boolean
  error: string | null
  onClose: () => void
  onGenerate: (writingGuide: string, lengthTargetChars: number) => void
}

export function PlotDimensionPanel({
  open,
  kind,
  artifact,
  defaultLengthTarget,
  loading,
  error,
  onClose,
  onGenerate,
}: Props) {
  const label = PLOT_DIMENSION_LABELS[kind]
  const [writingGuide, setWritingGuide] = useState('')
  const [lengthTargetDraft, setLengthTargetDraft] = useState(String(defaultLengthTarget))

  useEffect(() => {
    if (!open) return
    setWritingGuide(artifact?.writingGuide ?? '')
    const n = artifact?.lengthTargetChars ?? defaultLengthTarget
    setLengthTargetDraft(String(n))
  }, [open, artifact?.writingGuide, artifact?.lengthTargetChars, defaultLengthTarget])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key={`plot-dimension-${kind}`}
          className="fixed inset-0 z-[1280] flex items-end justify-center bg-black/40 px-0 sm:items-center sm:px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="flex max-h-[min(92vh,720px)] w-full max-w-[560px] flex-col overflow-hidden rounded-t-2xl border border-stone-200 bg-white shadow-xl sm:rounded-2xl"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-3">
              <div>
                <p className="text-[16px] font-semibold text-stone-900">{label}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-stone-500">
                  {kind === 'parallel'
                    ? '勾选后随发送同轮生成；写入时间轴摘要（主角色非全知，NPC 在场全知）。卡片按钮可补生成。'
                    : '勾选后随发送同轮生成；仅卡片阅读，不进剧情参考。卡片按钮可手动补生成。'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                aria-label="关闭"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
              {artifact?.content?.trim() ? (
                <div className="mb-4 rounded-xl border border-stone-100 bg-stone-50/80 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">已生成正文</p>
                  <div className="mt-2 text-[16px] font-normal leading-[1.85] text-[#262626]">
                    <PlotRichParagraph content={artifact.content} />
                  </div>
                  {artifact.updatedAt ? (
                    <p className="mt-2 text-right text-[10px] text-stone-400">
                      更新于 {new Date(artifact.updatedAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mb-4 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 px-3 py-4 text-center text-[12px] text-stone-400">
                  尚未生成；填写下方引导后点击生成。
                </p>
              )}

              <label className="block text-[12px] font-medium text-stone-700">写作引导（内容偏向）</label>
              <textarea
                value={writingGuide}
                onChange={(e) => setWritingGuide(e.target.value.slice(0, 480))}
                rows={4}
                maxLength={480}
                placeholder={
                  kind === 'parallel'
                    ? '例：锚点里用户在排练室时，同时刻后勤组在另一层楼搬设备——不出现排练室里的任何人。'
                    : '例：假设玩家当时没有追问，而是直接转身离开，写接下来五分钟的 IF 片段。'
                }
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-stone-800 outline-none transition-colors focus:border-stone-400"
              />
              <p className="mt-1 text-right text-[11px] text-stone-400">{writingGuide.length}/480</p>

              <label className="mt-3 block text-[12px] font-medium text-stone-700">目标字数（汉字）</label>
              <input
                type="text"
                inputMode="numeric"
                value={lengthTargetDraft}
                onChange={(e) => {
                  const next = e.target.value.replace(/[^\d]/g, '')
                  setLengthTargetDraft(next)
                }}
                placeholder={String(defaultLengthTarget)}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] text-stone-800 outline-none focus:border-stone-400"
              />
              <p className="mt-1 text-[11px] text-stone-400">可自由输入任意正整数；留空则使用默认 {defaultLengthTarget} 字。</p>
              {kind === 'parallel' ? (
                <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
                  手动生成会写入卡片并同步时间轴摘要（主角色非全知行 + NPC 在场行）。
                </p>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
                  IF 线仅保存在本卡片供阅读，不会注入 AI 剧情参考。
                </p>
              )}

              {error ? (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-stone-100 px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-[13px] text-stone-700 hover:bg-stone-50"
              >
                关闭
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  onGenerate(
                    writingGuide.trim(),
                    parsePlotDimensionLengthTarget(lengthTargetDraft, defaultLengthTarget),
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-stone-800 disabled:opacity-60"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {artifact?.content?.trim() ? '重新生成' : '生成'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
