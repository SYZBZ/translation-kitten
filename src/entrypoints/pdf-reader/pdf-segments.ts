import type { TextContent, TextItem } from "pdfjs-dist/types/src/display/api"
import type { PdfTranslationSegment } from "@/utils/pdf/types"

export interface PdfRenderableSegment extends PdfTranslationSegment {
  page: number
  x: number
  y: number
  fontSize: number
  width: number
}

export interface PdfTranslationBlock {
  id: string
  page: number
  segmentIds: string[]
  source: string
}

function isTextItem(item: TextContent["items"][number]): item is TextItem {
  return "str" in item
}

function appendPdfLineText(current: string, next: string) {
  const trimmedNext = next.trim()
  if (!trimmedNext)
    return current

  if (/-\s*$/.test(current))
    return `${current.replace(/-\s*$/, "")}${trimmedNext}`

  const needsSpace = !current.endsWith(" ") && !/^[,.;:!?)]/.test(trimmedNext)
  return `${current}${needsSpace ? " " : ""}${trimmedNext}`
}

function isListItem(text: string) {
  return /^\s*(?:[-*•‣]|\d+[.)]|[a-z][.)])\s+/i.test(text)
}

function isColumnJump(previous: PdfRenderableSegment, current: PdfRenderableSegment) {
  const xDelta = Math.abs(current.x - previous.x)
  const fontSize = Math.max(previous.fontSize, current.fontSize, 8)
  return xDelta > Math.max(150, fontSize * 12)
}

function isParagraphIndentShift(previous: PdfRenderableSegment, current: PdfRenderableSegment) {
  const xDelta = Math.abs(current.x - previous.x)
  const fontSize = Math.max(previous.fontSize, current.fontSize, 8)
  return xDelta > fontSize * 2.8 && !/-\s*$/.test(previous.source)
}

function shouldStartNewBlock(previous: PdfRenderableSegment, current: PdfRenderableSegment) {
  const lineGap = Math.abs(previous.y - current.y)
  const fontSize = Math.max(previous.fontSize, current.fontSize, 8)
  return lineGap > Math.max(18, fontSize * 1.45)
    || isColumnJump(previous, current)
    || isParagraphIndentShift(previous, current)
    || isListItem(current.source)
}

export function extractPdfSegments(page: number, textContent: TextContent): PdfRenderableSegment[] {
  const lines: Array<{ text: string, x: number, y: number, fontSize: number, width: number }> = []

  for (const item of textContent.items) {
    if (!isTextItem(item) || !item.str.trim())
      continue
    const x = item.transform[4]
    const y = item.transform[5]
    const fontSize = Math.max(Math.abs(item.transform[3]), 8)
    const previous = lines.at(-1)
    const horizontalGap = previous ? x - (previous.x + previous.width) : 0
    const isSameVisualLine = previous
      && Math.abs(previous.y - y) < Math.max(2.5, fontSize * 0.22)
      && horizontalGap >= -fontSize
      && horizontalGap <= Math.max(48, fontSize * 4)

    if (isSameVisualLine) {
      const needsSpace = !previous.text.endsWith(" ") && !/^\s|^[,.;:!?)]/.test(item.str)
      previous.text += `${needsSpace ? " " : ""}${item.str}`
      previous.width = Math.max(previous.width, x + item.width - previous.x)
    }
    else {
      lines.push({ text: item.str, x, y, fontSize, width: item.width })
    }
  }

  return lines.map((line, index) => ({
    id: `p${page}-s${index + 1}`,
    page,
    source: line.text,
    translation: "",
    x: line.x,
    y: line.y,
    fontSize: line.fontSize,
    width: line.width,
  }))
}

export function createPdfTranslationBlocks(segments: PdfRenderableSegment[]): PdfTranslationBlock[] {
  const blocks: PdfTranslationBlock[] = []
  let previousSegment: PdfRenderableSegment | null = null

  for (const segment of segments) {
    const currentBlock = blocks.at(-1)

    if (!currentBlock || !previousSegment || shouldStartNewBlock(previousSegment, segment)) {
      blocks.push({
        id: `p${segment.page}-b${blocks.length + 1}`,
        page: segment.page,
        segmentIds: [segment.id],
        source: segment.source.trim(),
      })
      previousSegment = segment
      continue
    }

    currentBlock.segmentIds.push(segment.id)
    currentBlock.source = appendPdfLineText(currentBlock.source, segment.source)
    previousSegment = segment
  }

  return blocks.filter(block => block.source)
}
