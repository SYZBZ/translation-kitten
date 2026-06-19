import type { PdfRenderableSegment } from "./pdf-segments"

function getSegmentPage(segment: PdfRenderableSegment) {
  return segment.page ?? Number.parseInt(/^p(\d+)-/.exec(segment.id)?.[1] ?? "0", 10)
}

export function prioritizePdfSegments(
  segmentsByPage: Record<number, PdfRenderableSegment[]>,
  nearPages: ReadonlySet<number>,
  translations: Readonly<Record<string, string>>,
) {
  const nearPageRank = new Map([...nearPages].map((page, index) => [page, index]))
  const seen = new Set<string>()

  return Object.values(segmentsByPage)
    .flat()
    .filter((segment) => {
      if (seen.has(segment.id) || translations[segment.id]) {
        return false
      }
      seen.add(segment.id)
      return true
    })
    .sort((left, right) => {
      const leftPage = getSegmentPage(left)
      const rightPage = getSegmentPage(right)
      const leftRank = nearPageRank.get(leftPage)
      const rightRank = nearPageRank.get(rightPage)
      if (leftRank !== undefined || rightRank !== undefined) {
        if (leftRank === undefined)
          return 1
        if (rightRank === undefined)
          return -1
        if (leftRank !== rightRank)
          return leftRank - rightRank
      }
      return leftPage - rightPage
    })
}

export function createPdfTranslationBatches<T>(items: T[], batchSize: number): T[][] {
  const safeBatchSize = Math.max(1, Math.floor(batchSize))
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += safeBatchSize) {
    batches.push(items.slice(index, index + safeBatchSize))
  }
  return batches
}
