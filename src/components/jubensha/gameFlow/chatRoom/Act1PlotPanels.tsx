import { motion } from 'framer-motion'

import {
  compactDmNarrationLines,
  renderDmBubbleText,
  resolveDmHighlightForDisplay,
} from './dmBubbleText'
import type { DmTextHighlightRange } from './jbsFlowTypes'

export type NarrationPlotPanelProps = {
  body: string
  isTyping?: boolean
  highlight?: DmTextHighlightRange
}

/** 公共剧情 · 旁白面板（居中宽条） */
export function NarrationPlotPanel({ body, isTyping = false, highlight }: NarrationPlotPanelProps) {
  const displayBody = compactDmNarrationLines(body)
  const displayHighlight = resolveDmHighlightForDisplay(displayBody, highlight)

  if (!displayBody.trim() && !isTyping) return null

  return (
    <motion.div
      className="jbs-act1-plot-line mb-4 w-full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p className="jbs-act1-plot-label jbs-font-serif mb-2 text-center">旁白</p>
      <div className="flex justify-center px-1">
        <div className="jbs-gf-chat-narration-bubble w-full max-w-[94%] px-4 py-3.5">
          <p className="jbs-font-kai jbs-gf-chat-narration-bubble-text whitespace-pre-wrap text-[16px] leading-loose">
            {renderDmBubbleText(displayBody, displayHighlight, isTyping)}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

