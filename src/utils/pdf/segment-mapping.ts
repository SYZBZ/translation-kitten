import type { PdfPeerSelection, PdfTextAlignment, PdfTextSelection, PdfTranslationSegment } from "./types"

function overlaps(start: number, end: number, candidateStart: number, candidateEnd: number): boolean {
  return start < candidateEnd && end > candidateStart
}

function mapAlignment(selection: PdfTextSelection, alignment: PdfTextAlignment): Omit<PdfPeerSelection, "segmentId"> | null {
  if (selection.side === "source" && overlaps(selection.start, selection.end, alignment.sourceStart, alignment.sourceEnd)) {
    return {
      side: "translation",
      start: alignment.translationStart,
      end: alignment.translationEnd,
      precision: "range",
    }
  }

  if (selection.side === "translation" && overlaps(selection.start, selection.end, alignment.translationStart, alignment.translationEnd)) {
    return {
      side: "source",
      start: alignment.sourceStart,
      end: alignment.sourceEnd,
      precision: "range",
    }
  }

  return null
}

export function mapSelectionToPeer(
  selection: PdfTextSelection,
  segments: PdfTranslationSegment[],
): PdfPeerSelection | null {
  const segment = segments.find(candidate => candidate.id === selection.segmentId)
  if (!segment)
    return null

  for (const alignment of segment.alignments ?? []) {
    const mapped = mapAlignment(selection, alignment)
    if (mapped)
      return { segmentId: segment.id, ...mapped }
  }

  const targetText = selection.side === "source" ? segment.translation : segment.source
  return {
    segmentId: segment.id,
    side: selection.side === "source" ? "translation" : "source",
    start: 0,
    end: targetText.length,
    precision: "segment",
  }
}
