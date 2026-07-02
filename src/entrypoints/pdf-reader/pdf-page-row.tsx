import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"
import type { PdfRenderableSegment } from "./pdf-segments"
import { useEffect, useMemo, useRef, useState } from "react"
import { getFittedPdfViewportScale } from "./pdf-layout"
import { PdfPage } from "./pdf-page"
import { createPdfTranslationBlocks } from "./pdf-segments"
import { useNearViewport } from "./use-near-viewport"

interface PdfPageRowProps {
  document: PDFDocumentProxy
  pageNumber: number
  segments: PdfRenderableSegment[]
  translations: Record<string, string>
  activeSegmentId: string | null
  translationActive: boolean
  onNearChange: (page: number, isNear: boolean) => void
  onSegments: (page: number, segments: PdfRenderableSegment[]) => void
  onSelect: (segmentId: string) => void
}

function useElementWidth() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element)
      return

    const update = () => setWidth(element.clientWidth)
    update()
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update)
      return () => window.removeEventListener("resize", update)
    }

    const observer = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? element.clientWidth))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}

export function PdfPageRow({
  document,
  pageNumber,
  segments,
  translations,
  activeSegmentId,
  translationActive,
  onNearChange,
  onSegments,
  onSelect,
}: PdfPageRowProps) {
  const { isNear, nearRef } = useNearViewport(pageNumber <= 2)
  const { ref: sourceRef, width: sourceWidth } = useElementWidth()
  const [page, setPage] = useState<PDFPageProxy | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  useEffect(() => onNearChange(pageNumber, isNear), [isNear, onNearChange, pageNumber])

  useEffect(() => {
    if (!isNear || page)
      return
    let cancelled = false
    void document.getPage(pageNumber)
      .then((nextPage) => {
        if (!cancelled)
          setPage(nextPage)
      })
      .catch((reason) => {
        if (!cancelled)
          setPageError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => {
      cancelled = true
    }
  }, [document, isNear, page, pageNumber])

  const fittedHeight = useMemo(() => {
    if (!page)
      return 0
    const viewport = page.getViewport({ scale: 1 })
    return viewport.height * getFittedPdfViewportScale(viewport.width, sourceWidth, 1.35)
  }, [page, sourceWidth])
  const translationBlocks = useMemo(() => createPdfTranslationBlocks(segments), [segments])

  if (!isNear) {
    return (
      <section ref={nearRef} className="pdf-page-placeholder" data-testid="pdf-page-placeholder" aria-label={`第 ${pageNumber} 頁尚未接近畫面`}>
        <span>
          第
          {pageNumber}
          頁
        </span>
      </section>
    )
  }

  return (
    <section ref={nearRef} className="pdf-page-pair" data-testid="pdf-page-pair" data-page-number={pageNumber}>
      <div ref={sourceRef} className="source-page-slot">
        {page && sourceWidth > 0
          ? (
              <PdfPage
                page={page}
                availableWidth={sourceWidth}
                initialSegments={segments}
                activeSegmentId={activeSegmentId}
                onSelect={onSelect}
                onSegments={onSegments}
              />
            )
          : (
              <div className="page-loading-card">
                {pageError || `正在讀取第 ${pageNumber} 頁...`}
              </div>
            )}
      </div>

      <section
        className="translation-page"
        data-testid="translation-page"
        style={fittedHeight > 0
          ? { height: fittedHeight, maxHeight: fittedHeight, overflowY: "auto" }
          : undefined}
        onMouseUp={(event) => {
          const target = (event.target as HTMLElement).closest<HTMLElement>("[data-segment-id]")
          if (target?.dataset.segmentId)
            onSelect(target.dataset.segmentId)
        }}
      >
        <div className="page-number">
          第
          {pageNumber}
          頁譯文
        </div>
        {segments.length === 0 && (
          <div className="translation-empty">原文接近畫面時會自動擷取內容</div>
        )}
        {translationBlocks.map((block) => {
          const isSynced = activeSegmentId ? block.segmentIds.includes(activeSegmentId) : false
          return (
            <p
              key={block.id}
              data-testid="pdf-translation-block"
              data-block-id={block.id}
              data-segment-id={block.segmentIds[0]}
              className={isSynced ? "is-synced" : ""}
            >
              {translations[block.id] || (
                <span className="pending">{translationActive ? "正在翻譯..." : "尚未翻譯"}</span>
              )}
            </p>
          )
        })}
      </section>
    </section>
  )
}
