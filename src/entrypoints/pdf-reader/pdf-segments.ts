import type { TextContent, TextItem } from "pdfjs-dist/types/src/display/api"
import type { PdfTranslationSegment } from "@/utils/pdf/types"

export interface PdfRenderableSegment extends PdfTranslationSegment {
  x: number
  y: number
  fontSize: number
  width: number
}

function isTextItem(item: TextContent["items"][number]): item is TextItem {
  return "str" in item
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
    if (previous && Math.abs(previous.y - y) < Math.max(2.5, fontSize * 0.22)) {
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
