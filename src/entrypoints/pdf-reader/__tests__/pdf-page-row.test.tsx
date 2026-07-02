// @vitest-environment jsdom
import type { PDFDocumentProxy } from "pdfjs-dist"
import type { PdfRenderableSegment } from "../pdf-segments"
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

function segment(id: string, source: string, y: number): PdfRenderableSegment {
  return {
    id,
    page: 4,
    source,
    translation: "",
    x: 72,
    y,
    fontSize: 12,
    width: 420,
  }
}

function renderRow(
  document: PDFDocumentProxy,
  options: {
    segments?: PdfRenderableSegment[]
    translations?: Record<string, string>
    activeSegmentId?: string | null
  } = {},
) {
  return render(
    <PdfPageRow
      document={document}
      pageNumber={4}
      segments={options.segments ?? []}
      translations={options.translations ?? {}}
      activeSegmentId={options.activeSegmentId ?? null}
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

  it("renders translated reading blocks instead of one paragraph per PDF line", async () => {
    nearState.value = true
    const document = createDocument()
    renderRow(document, {
      segments: [
        segment("p4-s1", "Long English sentence wraps across the first", 720),
        segment("p4-s2", "and second visual lines of the same paragraph.", 706),
        segment("p4-s3", "A new paragraph starts after a larger vertical gap.", 675),
      ],
      translations: {
        "p4-b1": "這是一個跨越兩個視覺行的完整段落。",
        "p4-b2": "這是下一個段落。",
      },
      activeSegmentId: "p4-s2",
    })

    await waitFor(() => expect(document.getPage).toHaveBeenCalledWith(4))

    const blocks = screen.getAllByTestId("pdf-translation-block")
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toHaveTextContent("這是一個跨越兩個視覺行的完整段落。")
    expect(blocks[0]).toHaveClass("is-synced")
  })

  it("locks the desktop translation page to the fitted source page height", async () => {
    nearState.value = true
    const document = createDocument()
    renderRow(document)

    const translationPage = await screen.findByTestId("translation-page")

    await waitFor(() => {
      expect(translationPage).toHaveStyle({
        height: "800px",
        maxHeight: "800px",
        overflowY: "auto",
      })
    })
  })
})
