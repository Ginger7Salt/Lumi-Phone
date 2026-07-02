import type { DiaryEntry } from './diaryTypes'
import { diaryFontStack } from './diaryFonts'
/** 正文手写字号（px） */
export const DIARY_BODY_FONT_SIZE = 21
/** 与横线间距对齐的行高（px） */
export const DIARY_BODY_LINE_HEIGHT = 46
/** 横线区域左侧留白（px），对齐红线 */
export const DIARY_SHEET_PADDING_LEFT = 36
export const DIARY_SHEET_PADDING_RIGHT = 20
/** 首页：标题区占用的正文行数（标题+时间后才开始写正文） */
export const DIARY_FIRST_PAGE_BODY_LINES = 9
/** 续页：整页可写行数 */
export const DIARY_CONTINUATION_BODY_LINES = 13
/** 首页标题区高度（px），与 LinedDiarySheet header 对齐：pt-2 + 2 行 + pb-1 */
export const DIARY_FIRST_PAGE_HEADER_PX = 8 + DIARY_BODY_LINE_HEIGHT * 2 + 4
/** 续页顶栏高度（px） */
export const DIARY_CONT_PAGE_HEADER_PX = DIARY_BODY_LINE_HEIGHT
/** 纸页上下内边距（px） */
export const DIARY_SHEET_VERTICAL_PADDING_PX = 20
/** 每页正文底部预留空白行数（横线仍绘制，不写字） */
export const DIARY_BOTTOM_BLANK_LINES = 2

export function diaryContentLineCapacity(pageBodyLines: number): number {
  return Math.max(1, pageBodyLines - DIARY_BOTTOM_BLANK_LINES)
}

export type DiaryPageLayoutConfig = {
  firstPageBodyLines: number
  continuationBodyLines: number
}

export function computeDiaryPageLayout(sheetInnerHeight: number): DiaryPageLayoutConfig {
  const usable = Math.max(
    DIARY_BODY_LINE_HEIGHT * 8,
    sheetInnerHeight - DIARY_SHEET_VERTICAL_PADDING_PX,
  )
  const firstPageBodyLines = Math.max(
    8,
    Math.floor((usable - DIARY_FIRST_PAGE_HEADER_PX) / DIARY_BODY_LINE_HEIGHT),
  )
  const continuationBodyLines = Math.max(
    10,
    Math.floor((usable - DIARY_CONT_PAGE_HEADER_PX) / DIARY_BODY_LINE_HEIGHT),
  )
  return { firstPageBodyLines, continuationBodyLines }
}

export type DiaryVirtualPage = {
  entryId: string
  entryIndex: number
  chunkIndex: number
  chunkCount: number
  isFirstChunk: boolean
  bodyLineCount: number
  title: string
  inUniverseTime: string
  body: string
}

function getMeasureContext(fontFamily: string | null): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.font = `${DIARY_BODY_FONT_SIZE}px ${diaryFontStack(fontFamily)}`
  return ctx
}

/** 拼音连写或分隔音节（如 xiàng quān、nán过）视为一个不可断行 token */
const PINYIN_TOKEN_RE =
  /[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+(?:\s+[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+)*(?:[\u4e00-\u9fff])?/g

function tokenizeDiaryParagraph(paragraph: string): Array<{ raw: string; widthText: string }> {
  const tokens: Array<{ raw: string; widthText: string }> = []
  const re = new RegExp(
    `\\[涂\\]([^|]+)\\|([^\\[\\]]+)|${PINYIN_TOKEN_RE.source}|.`,
    'gs',
  )
  let match: RegExpExecArray | null
  while ((match = re.exec(paragraph)) !== null) {
    if (match[1] !== undefined && match[2] !== undefined) {
      tokens.push({ raw: match[0], widthText: `${match[1]}${match[2]}··` })
    } else {
      tokens.push({ raw: match[0], widthText: match[0] })
    }
  }
  return tokens
}

function wrapParagraphToLines(paragraph: string, maxWidth: number, ctx: CanvasRenderingContext2D): string[] {
  const trimmed = paragraph.trimEnd()
  if (!trimmed) return ['']

  const tokens = tokenizeDiaryParagraph(trimmed)
  const lines: string[] = []
  let line = ''
  let lineWidth = 0

  for (const token of tokens) {
    const w = ctx.measureText(token.widthText).width
    if (line && lineWidth + w > maxWidth) {
      lines.push(line)
      line = token.raw
      lineWidth = w
    } else {
      line += token.raw
      lineWidth += w
    }
  }
  if (line) lines.push(line)
  return lines
}

export function wrapDiaryContentToLines(
  content: string,
  contentWidth: number,
  fontFamily: string | null,
): string[] {
  const width = Math.max(120, Math.round(contentWidth))
  const ctx = getMeasureContext(fontFamily)
  if (!ctx) {
    const approxChars = Math.max(8, Math.floor(width / DIARY_BODY_FONT_SIZE))
    return content
      .split('\n')
      .flatMap((para) => {
        if (!para.trim()) return ['']
        const lines: string[] = []
        for (let i = 0; i < para.length; i += approxChars) {
          lines.push(para.slice(i, i + approxChars))
        }
        return lines
      })
  }

  const lines: string[] = []
  const paragraphs = content.split('\n')
  for (let i = 0; i < paragraphs.length; i += 1) {
    const para = paragraphs[i] ?? ''
    if (!para.trim() && i < paragraphs.length - 1) {
      lines.push('')
      continue
    }
    lines.push(...wrapParagraphToLines(para, width, ctx))
  }
  return lines.length ? lines : ['']
}

function chunkLines(lines: string[], perPage: number): string[][] {
  if (!lines.length) return [['']]
  const chunks: string[][] = []
  for (let i = 0; i < lines.length; i += perPage) {
    chunks.push(lines.slice(i, i + perPage))
  }
  return chunks
}

export function buildDiaryVirtualPages(
  entries: DiaryEntry[],
  contentWidth: number,
  fontFamily: string | null,
  layout: DiaryPageLayoutConfig = {
    firstPageBodyLines: DIARY_FIRST_PAGE_BODY_LINES,
    continuationBodyLines: DIARY_CONTINUATION_BODY_LINES,
  },
): DiaryVirtualPage[] {
  const pages: DiaryVirtualPage[] = []

  entries.forEach((entry, entryIndex) => {
    const lines = wrapDiaryContentToLines(entry.content, contentWidth, fontFamily)
    const firstCapacity = diaryContentLineCapacity(layout.firstPageBodyLines)
    const contCapacity = diaryContentLineCapacity(layout.continuationBodyLines)
    const firstPageLines = lines.slice(0, firstCapacity)
    const restLines = lines.slice(firstCapacity)
    const restChunks = restLines.length ? chunkLines(restLines, contCapacity) : []
    const allChunks = [firstPageLines, ...restChunks].filter((chunk) => chunk.length > 0)
    const chunkCount = allChunks.length

    allChunks.forEach((chunkLinesSlice, chunkIndex) => {
      const bodyLineCount = chunkIndex === 0 ? layout.firstPageBodyLines : layout.continuationBodyLines
      pages.push({
        entryId: entry.id,
        entryIndex,
        chunkIndex,
        chunkCount,
        isFirstChunk: chunkIndex === 0,
        bodyLineCount,
        title: entry.title,
        inUniverseTime: entry.inUniverseTime,
        body: chunkLinesSlice.join('\n'),
      })
    })
  })

  return pages
}
