import type { PDFPageProxy } from "pdfjs-dist"
import type { PdfRenderableSegment } from "./pdf-segments"
import { useEffect, useRef, useState } from "react"
import { extractPdfSegments } from "./pdf-segments"

interface PdfPageProps {
  page: PDFPageProxy
  activeSegmentId: string | null
  onSelect: (segmentId: string) => void
  onSegments: (page: number, segments: PdfRenderableSegment[]) => void
}

export function PdfPage({ page, activeSegmentId, onSelect, onSegments }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [segments, setSegments] = useState<PdfRenderableSegment[]>([])
  const [size, setSize] = useState({ width: 0, height: 0, scale: 1.35 })

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      const viewport = page.getViewport({ scale: 1.35 })
      setSize({ width: viewport.width, height: viewport.height, scale: 1.35 })
      const canvas = canvasRef.current
      if (!canvas)
        return
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * ratio)
      canvas.height = Math.floor(viewport.height * ratio)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      const context = canvas.getContext("2d")!
      await page.render({ canvasContext: context, canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] }).promise
      const textContent = await page.getTextContent()
      if (cancelled)
        return
      const next = extractPdfSegments(page.pageNumber, textContent)
      setSegments(next)
      onSegments(page.pageNumber, next)
    }
    void render()
    return () => {
      cancelled = true
    }
  }, [onSegments, page])

  return (
    <section className="pdf-page" style={{ width: size.width, height: size.height }}>
      <canvas ref={canvasRef} />
      <div
        className="pdf-text-layer"
        onMouseUp={(event) => {
          const target = (event.target as HTMLElement).closest<HTMLElement>("[data-segment-id]")
          if (target?.dataset.segmentId)
            onSelect(target.dataset.segmentId)
        }}
      >
        {segments.map(segment => (
          <span
            key={segment.id}
            data-segment-id={segment.id}
            className={activeSegmentId === segment.id ? "is-synced" : ""}
            style={{
              left: segment.x * size.scale,
              top: size.height - segment.y * size.scale - segment.fontSize * size.scale,
              fontSize: segment.fontSize * size.scale,
              minWidth: segment.width * size.scale,
            }}
          >
            {segment.source}
          </span>
        ))}
      </div>
    </section>
  )
}
