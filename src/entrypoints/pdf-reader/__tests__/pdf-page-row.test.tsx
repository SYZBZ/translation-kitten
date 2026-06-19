// @vitest-environment jsdom
import type { PDFDocumentProxy } from "pdfjs-dist"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { PdfPageRow } from "../pdf-page-row"

const nearState = vi.hoisted(() => ({ value: false }))

vi.mock("../use-near-viewport", () => ({
  useNearViewport: () => ({
    isNear: nearState.value,
    nearRef: vi.fn(),
  }),
}))

vi.mock("../pdf-page", () => ({
  PdfPage: ({ page }: { page: { pageNumber: number } }) => (
    <div data-testid="mounted-pdf-page">
      Source page
      {page.pageNumber}
    </div>
  ),
}))

function createDocument() {
  return {
    getPage: vi.fn().mockResolvedValue({
      pageNumber: 4,
      getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
    }),
  } as unknown as PDFDocumentProxy
}

function renderRow(document: PDFDocumentProxy) {
  return render(
    <PdfPageRow
      document={document}
      pageNumber={4}
      segments={[]}
      translations={{}}
      activeSegmentId={null}
      translationActive={false}
      onNearChange={vi.fn()}
      onSegments={vi.fn()}
      onSelect={vi.fn()}
    />,
  )
}

describe("pdfPageRow", () => {
  const originalResizeObserver = globalThis.ResizeObserver

  beforeAll(() => {
    globalThis.ResizeObserver = class ResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() {
        this.callback([{ contentRect: { width: 600 } } as ResizeObserverEntry], this)
      }

      disconnect() {}
      unobserve() {}
    }
  })

  beforeEach(() => {
    nearState.value = false
  })

  afterEach(cleanup)

  afterAll(() => {
    globalThis.ResizeObserver = originalResizeObserver
  })

  it("keeps a lightweight placeholder before the row approaches the viewport", () => {
    const document = createDocument()
    renderRow(document)

    expect(screen.getByTestId("pdf-page-placeholder")).toBeInTheDocument()
    expect(document.getPage).not.toHaveBeenCalled()
  })

  it("mounts the source and translation in the same paired row when near", async () => {
    nearState.value = true
    const document = createDocument()
    renderRow(document)

    await waitFor(() => expect(document.getPage).toHaveBeenCalledWith(4))
    const pair = screen.getByTestId("pdf-page-pair")
    expect(pair).toContainElement(screen.getByTestId("mounted-pdf-page"))
    expect(pair).toContainElement(screen.getByTestId("translation-page"))
  })
})
