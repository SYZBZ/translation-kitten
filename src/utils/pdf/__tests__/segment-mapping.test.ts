import { describe, expect, it } from "vitest"
import { mapSelectionToPeer } from "../segment-mapping"

const segments = [
  {
    id: "p1-s1",
    source: "The curious cat reads a book.",
    translation: "好奇的小貓正在讀一本書。",
    alignments: [
      { sourceStart: 4, sourceEnd: 15, translationStart: 0, translationEnd: 5 },
      { sourceStart: 16, sourceEnd: 19, translationStart: 5, translationEnd: 7 },
    ],
  },
]

describe("mapSelectionToPeer", () => {
  it("maps a source word range to the aligned translated range", () => {
    expect(mapSelectionToPeer({ segmentId: "p1-s1", side: "source", start: 4, end: 11 }, segments)).toEqual({
      segmentId: "p1-s1",
      side: "translation",
      start: 0,
      end: 5,
      precision: "range",
    })
  })

  it("maps a translated range back to source", () => {
    expect(mapSelectionToPeer({ segmentId: "p1-s1", side: "translation", start: 5, end: 7 }, segments)).toMatchObject({
      side: "source",
      start: 16,
      end: 19,
      precision: "range",
    })
  })

  it("falls back to the whole segment when no exact alignment overlaps", () => {
    expect(mapSelectionToPeer({ segmentId: "p1-s1", side: "source", start: 22, end: 26 }, segments)).toEqual({
      segmentId: "p1-s1",
      side: "translation",
      start: 0,
      end: 12,
      precision: "segment",
    })
  })

  it("returns null for an unknown segment", () => {
    expect(mapSelectionToPeer({ segmentId: "missing", side: "source", start: 0, end: 2 }, segments)).toBeNull()
  })
})
