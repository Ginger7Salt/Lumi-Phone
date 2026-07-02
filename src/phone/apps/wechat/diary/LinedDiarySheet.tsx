import {
  DIARY_BODY_FONT_SIZE,
  DIARY_BODY_LINE_HEIGHT,
  DIARY_BOTTOM_BLANK_LINES,
  DIARY_SHEET_PADDING_LEFT,
  DIARY_SHEET_PADDING_RIGHT,
  diaryContentLineCapacity,
  type DiaryVirtualPage,
} from './diaryPageLayout'
import { DiaryHandwritingContent } from './diaryHandwritingContent'
import { diaryFontStack } from './diaryFonts'

const RULE_COLOR = 'rgba(0,0,0,0.07)'
const MARGIN_LINE_COLOR = 'rgba(220, 100, 100, 0.35)'

function RuledBackground({ lineCount }: { lineCount: number }) {
  const height = lineCount * DIARY_BODY_LINE_HEIGHT
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0"
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(
          to bottom,
          transparent 0,
          transparent ${DIARY_BODY_LINE_HEIGHT - 1}px,
          ${RULE_COLOR} ${DIARY_BODY_LINE_HEIGHT - 1}px,
          ${RULE_COLOR} ${DIARY_BODY_LINE_HEIGHT}px
        )`,
      }}
      aria-hidden
    />
  )
}

export function LinedDiarySheet({
  page,
  fontFamily,
  signatureName,
}: {
  page: DiaryVirtualPage
  fontFamily: string | null
  /** 日记署名：角色真实姓名 */
  signatureName: string
}) {
  const hand = diaryFontStack(fontFamily)
  const bodyLineCount = page.bodyLineCount
  const contentCapacity = diaryContentLineCapacity(bodyLineCount)
  const textLines = page.body.split('\n').slice(0, contentCapacity)
  while (textLines.length < contentCapacity) textLines.push('')
  const bodyLines = [
    ...textLines,
    ...Array.from({ length: DIARY_BOTTOM_BLANK_LINES }, () => ''),
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-3">
      <div
        className="relative mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col overflow-hidden rounded-[2px] border border-black/[0.07] bg-[#fffef9] shadow-[0_2px_16px_rgba(0,0,0,0.04)]"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6)' }}
      >
        <div
          className="pointer-events-none absolute bottom-3 top-3 w-px"
          style={{ left: 28, background: MARGIN_LINE_COLOR }}
          aria-hidden
        />

        <div
          className="relative flex min-h-0 flex-1 flex-col"
          style={{
            paddingLeft: DIARY_SHEET_PADDING_LEFT,
            paddingRight: DIARY_SHEET_PADDING_RIGHT,
            fontFamily: hand,
          }}
        >
          {page.isFirstChunk ? (
            <header className="relative z-[1] shrink-0 pb-1 pt-2">
              <div className="flex items-start justify-between gap-3">
                <h2
                  className="min-w-0 flex-1 text-left text-gray-800"
                  style={{ fontSize: 20, lineHeight: `${DIARY_BODY_LINE_HEIGHT}px` }}
                >
                  {page.title}
                </h2>
                <time
                  className="shrink-0 text-gray-500"
                  style={{ fontSize: 14, lineHeight: `${DIARY_BODY_LINE_HEIGHT}px` }}
                >
                  {page.inUniverseTime}
                </time>
              </div>
              <div
                className="text-gray-400"
                style={{ fontSize: 15, lineHeight: `${DIARY_BODY_LINE_HEIGHT}px` }}
              >
                {signatureName}
                {page.chunkCount > 1 ? (
                  <span className="ml-2 text-gray-300">
                    · 第 {page.chunkIndex + 1}/{page.chunkCount} 页
                  </span>
                ) : null}
              </div>
            </header>
          ) : (
            <div
              className="relative z-[1] shrink-0 text-gray-400"
              style={{
                height: DIARY_BODY_LINE_HEIGHT,
                fontSize: 14,
                lineHeight: `${DIARY_BODY_LINE_HEIGHT}px`,
              }}
            >
              {page.title} · 续 {page.chunkIndex + 1}/{page.chunkCount}
            </div>
          )}

          <div
            className="relative z-[1] shrink-0"
            style={{ height: bodyLineCount * DIARY_BODY_LINE_HEIGHT }}
          >
            <RuledBackground lineCount={bodyLineCount} />
            <article className="relative text-gray-800">
              {bodyLines.map((line, i) => (
                <div
                  key={i}
                  className="overflow-hidden"
                  style={{
                    height: DIARY_BODY_LINE_HEIGHT,
                    fontSize: DIARY_BODY_FONT_SIZE,
                    lineHeight: `${DIARY_BODY_LINE_HEIGHT}px`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <DiaryHandwritingContent content={line} />
                </div>
              ))}
            </article>
          </div>
        </div>
      </div>
    </div>
  )
}
