import type { PdfRenderableSegment } from "../pdf-segments"
import { describe, expect, it } from "vitest"
import { createPdfTranslationBlocks } from "../pdf-segments"

function line(id: string, source: string, y: number, x = 72, width = 420): PdfRenderableSegment {
  return {
    id,
    page: 1,
    source,
    translation: "",
    x,
    y,
    fontSize: 12,
    width,
  }
}

describe("pdf segment grouping", () => {
  it("groups wrapped PDF text lines into readable translation blocks", () => {
    const blocks = createPdfTranslationBlocks([
      line("p1-s1", "Long English sentence wraps across the first", 720),
      line("p1-s2", "and second visual lines of the same paragraph.", 706),
      line("p1-s3", "A new paragraph starts after a larger vertical gap.", 675),
    ])

    expect(blocks).toEqual([
      {
        id: "p1-b1",
        page: 1,
        segmentIds: ["p1-s1", "p1-s2"],
        source: "Long English sentence wraps across the first and second visual lines of the same paragraph.",
      },
      {
        id: "p1-b2",
        page: 1,
        segmentIds: ["p1-s3"],
        source: "A new paragraph starts after a larger vertical gap.",
      },
    ])
  })

  it("does not merge text across column jumps", () => {
    const blocks = createPdfTranslationBlocks([
      line("p1-s1", "Left column paragraph line one", 720, 72, 180),
      line("p1-s2", "Right column starts at the same height", 720, 360, 180),
    ])

    expect(blocks.map(block => block.source)).toEqual([
      "Left column paragraph line one",
      "Right column starts at the same height",
    ])
  })

  it("starts a new block for list items", () => {
    const blocks = createPdfTranslationBlocks([
      line("p1-s1", "The paragraph introduces the following points.", 720),
      line("p1-s2", "- First item should remain readable.", 706, 90),
      line("p1-s3", "- Second item should not be appended.", 692, 90),
    ])

    expect(blocks.map(block => block.source)).toEqual([
      "The paragraph introduces the following points.",
      "- First item should remain readable.",
      "- Second item should not be appended.",
    ])
  })
})
