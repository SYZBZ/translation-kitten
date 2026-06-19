import type { PdfRenderableSegment } from "../pdf-segments"
import { describe, expect, it } from "vitest"
import { createPdfTranslationBatches, prioritizePdfSegments } from "../pdf-translation-scheduler"

function segment(page: number, index: number): PdfRenderableSegment {
  return {
    id: `p${page}-s${index}`,
    page,
    source: `${page}:${index}`,
    translation: "",
    x: 0,
    y: 0,
    fontSize: 12,
    width: 100,
  }
}

describe("pDF translation scheduler", () => {
  it("prioritizes near pages and removes translated or duplicate segments", () => {
    const repeated = segment(3, 1)
    const result = prioritizePdfSegments(
      {
        1: [segment(1, 1)],
        2: [segment(2, 1)],
        3: [repeated, repeated],
      },
      new Set([3, 2]),
      { "p2-s1": "done" },
    )

    expect(result.map(item => item.id)).toEqual(["p3-s1", "p1-s1"])
  })

  it("creates bounded translation batches", () => {
    const batches = createPdfTranslationBatches(
      Array.from({ length: 9 }, (_, index) => segment(1, index + 1)),
      4,
    )

    expect(batches.map(batch => batch.length)).toEqual([4, 4, 1])
  })
})
