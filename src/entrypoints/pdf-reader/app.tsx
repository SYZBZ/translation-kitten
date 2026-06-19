import type { PDFPageProxy } from "pdfjs-dist"
import type { PdfRenderableSegment } from "./pdf-segments"
import { useCallback, useEffect, useMemo, useState } from "react"
import { getProviderConfigById } from "@/utils/config/helpers"
import { getLocalConfig } from "@/utils/config/storage"
import { translatePdfText } from "@/utils/pdf/translate"
import { PdfPage } from "./pdf-page"
import { usePdfDocument } from "./use-pdf-document"

type TranslationState = "idle" | "translating" | "ready" | "error"

function App() {
  const querySource = useMemo(() => new URLSearchParams(location.search).get("source"), [])
  const [file, setFile] = useState<File | null>(null)
  const { document, error, loading } = usePdfDocument(querySource, file)
  const [pages, setPages] = useState<PDFPageProxy[]>([])
  const [segmentsByPage, setSegmentsByPage] = useState<Record<number, PdfRenderableSegment[]>>({})
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)
  const [translationState, setTranslationState] = useState<TranslationState>("idle")
  const [translationError, setTranslationError] = useState<string | null>(null)

  useEffect(() => {
    if (!document)
      return
    let cancelled = false
    void Promise.all(Array.from({ length: document.numPages }, (_, index) => document.getPage(index + 1)))
      .then((loaded) => {
        if (!cancelled)
          setPages(loaded)
      })
    return () => {
      cancelled = true
    }
  }, [document])

  const handleSegments = useCallback((page: number, next: PdfRenderableSegment[]) => {
    setSegmentsByPage(current => current[page] ? current : { ...current, [page]: next })
  }, [])

  const allSegments = useMemo(
    () => Object.keys(segmentsByPage).map(Number).sort((a, b) => a - b).flatMap(page => segmentsByPage[page]),
    [segmentsByPage],
  )

  const translateDocument = async () => {
    if (!allSegments.length)
      return
    setTranslationState("translating")
    setTranslationError(null)
    try {
      const config = await getLocalConfig()
      if (!config)
        throw new Error("尚未完成翻譯設定，請先在擴充功能選項中選擇翻譯服務。")
      const provider = getProviderConfigById(config.providersConfig, config.translate.providerId)
      if (!provider)
        throw new Error("找不到目前的翻譯服務，請重新選擇供應商。")

      const pending = allSegments.filter(segment => !translations[segment.id])
      for (let index = 0; index < pending.length; index += 6) {
        const batch = pending.slice(index, index + 6)
        const results = await Promise.allSettled(batch.map(segment => translatePdfText(segment.source, config.language, provider)))
        setTranslations(current => ({
          ...current,
          ...Object.fromEntries(results.flatMap((result, resultIndex) => result.status === "fulfilled"
            ? [[batch[resultIndex].id, result.value]]
            : [])),
        }))
      }
      setTranslationState("ready")
    }
    catch (reason) {
      setTranslationState("error")
      setTranslationError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  return (
    <main>
      <header className="reader-header">
        <div className="brand">
          <img src="/icon/48.png" alt="" />
          <div>
            <strong>翻譯小貓</strong>
            <span>PDF 翻譯本</span>
          </div>
        </div>
        <div className="reader-actions">
          <label className="file-button">
            選擇 PDF
            <input type="file" accept="application/pdf,.pdf" onChange={event => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <button type="button" disabled={!allSegments.length || translationState === "translating"} onClick={() => void translateDocument()}>
            {translationState === "translating" ? "正在翻譯…" : translationState === "ready" ? "補齊未翻譯內容" : "建立翻譯本"}
          </button>
        </div>
      </header>

      {(loading || error || translationError || (!querySource && !file)) && (
        <div className={`reader-notice ${error || translationError ? "error" : ""}`}>
          {loading && "正在載入 PDF…"}
          {!loading && (error || translationError)}
          {!loading && !error && !translationError && !querySource && !file && "請選擇本機 PDF，或從 PDF 分頁點擊擴充功能開啟。"}
        </div>
      )}

      <div className="column-headings">
        <span>原始 PDF</span>
        <span>翻譯本</span>
      </div>
      <div className="reader-grid">
        <div className="source-column">
          {pages.map(page => (
            <PdfPage key={page.pageNumber} page={page} activeSegmentId={activeSegmentId} onSelect={setActiveSegmentId} onSegments={handleSegments} />
          ))}
        </div>
        <div
          className="translation-column"
          onMouseUp={(event) => {
            const target = (event.target as HTMLElement).closest<HTMLElement>("[data-segment-id]")
            if (target?.dataset.segmentId)
              setActiveSegmentId(target.dataset.segmentId)
          }}
        >
          {Object.keys(segmentsByPage).map(Number).sort((a, b) => a - b).map(page => (
            <section className="translation-page" key={page}>
              <div className="page-number">
                第
                {page}
                {" "}
                頁
              </div>
              {segmentsByPage[page].map(segment => (
                <p key={segment.id} data-segment-id={segment.id} className={activeSegmentId === segment.id ? "is-synced" : ""}>
                  {translations[segment.id] || <span className="pending">{translationState === "translating" ? "翻譯中…" : "等待翻譯"}</span>}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}

export default App
