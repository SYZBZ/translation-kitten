export type PdfTextSide = "source" | "translation"

export interface PdfTextAlignment {
  sourceStart: number
  sourceEnd: number
  translationStart: number
  translationEnd: number
}

export interface PdfTranslationSegment {
  id: string
  source: string
  translation: string
  page?: number
  alignments?: PdfTextAlignment[]
}

export interface PdfTextSelection {
  segmentId: string
  side: PdfTextSide
  start: number
  end: number
}

export interface PdfPeerSelection extends PdfTextSelection {
  precision: "range" | "segment"
}
