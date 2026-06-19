import type { PdfRenderableSegment } from "./pdf-segments"
import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getProviderConfigById } from "@/utils/config/helpers"
import { getLocalConfig } from "@/utils/config/storage"
import { translatePdfText } from "@/utils/pdf/translate"
import { PdfPageRow } from "./pdf-page-row"
import { extractPdfSegments } from "./pdf-segments"
import { createPdfTranslationBatches, prioritizePdfSegments } from "./pdf-translation-scheduler"
import { usePdfDocument } from "./use-pdf-document"

type TranslationState = "idle" | "translating" | "ready" | "error"

function yieldToBrowser() {
  return new Promise<void>(resolve => setTimeout(resolve, 0))
}

function App() {
  const querySource = useMemo(() => new URLSearchParams(location.search).get("source"), [])
  const [file, setFile] = useState<File | null>(null)
  const { document, error, loading } = usePdfDocument(querySource, file)
  const [segmentsByPage, setSegmentsByPage] = useState<Record<number, PdfRenderableSegment[]>>({})
  const segmentsByPageRef = useRef(segmentsByPage)
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [nearPages, setNearPages] = useState<Set<number>>(() => new Set([1, 2]))
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)
  const [translationState, setTranslationState] = useState<TranslationState>("idle")
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [translationRequested, setTranslationRequested] = useState(false)
  const [translationProvider, setTranslationProvider] = useState<ProviderConfig | null>(null)
  const [translationLanguage, setTranslationLanguage] = useState<Config["language"] | null>(null)
  const [discoveryDone, setDiscoveryDone] = useState(false)
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)
  const [failedSegmentIds, setFailedSegmentIds] = useState<Set<string>>(() => new Set())
  const sessionIdRef = useRef(0)

  useEffect(() => {
    sessionIdRef.current += 1
    segmentsByPageRef.current = {}
    setSegmentsByPage({})
    setTranslations({})
    setActiveSegmentId(null)
    setTranslationState("idle")
    setTranslationError(null)
    setTranslationRequested(false)
    setTranslationProvider(null)
    setTranslationLanguage(null)
    setDiscoveryDone(false)
    setIsProcessingBatch(false)
    setFailedSegmentIds(new Set())
  }, [document])

  const handleSegments = useCallback((page: number, nextSegments: PdfRenderableSegment[]) => {
    setSegmentsByPage((current) => {
      if (current[page])
        return current
      const next = { ...current, [page]: nextSegments }
      segmentsByPageRef.current = next
      return next
    })
  }, [])

  const handleNearChange = useCallback((page: number, isNear: boolean) => {
    setNearPages((current) => {
      const next = new Set(current)
      if (isNear)
        next.add(page)
      else
        next.delete(page)
      return next
    })
  }, [])

  const allSegments = useMemo(
    () => Object.keys(segmentsByPage).map(Number).sort((a, b) => a - b).flatMap(page => segmentsByPage[page]),
    [segmentsByPage],
  )
  const translatedCount = useMemo(
    () => allSegments.filter(segment => Boolean(translations[segment.id])).length,
    [allSegments, translations],
  )

  const discoverDocumentSegments = useCallback(async (sessionId: number) => {
    if (!document)
      return

    setDiscoveryDone(false)
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      if (sessionIdRef.current !== sessionId)
        return
      if (!segmentsByPageRef.current[pageNumber]) {
        const page = await document.getPage(pageNumber)
        const textContent = await page.getTextContent()
        handleSegments(pageNumber, extractPdfSegments(pageNumber, textContent))
      }
      await yieldToBrowser()
    }

    if (sessionIdRef.current === sessionId)
      setDiscoveryDone(true)
  }, [document, handleSegments])

  const translateDocument = useCallback(async () => {
    if (!document)
      return

    setTranslationState("translating")
    setTranslationError(null)
    setFailedSegmentIds(new Set())
    try {
      const config = await getLocalConfig()
      if (!config)
        throw new Error("找不到翻譯設定，請先開啟擴充功能設定頁。")
      const provider = getProviderConfigById(config.providersConfig, config.translate.providerId)
      if (!provider)
        throw new Error("目前翻譯服務不可用，請重新選擇翻譯服務。")

      const sessionId = sessionIdRef.current + 1
      sessionIdRef.current = sessionId
      setTranslationProvider(provider)
      setTranslationLanguage(config.language)
      setTranslationRequested(true)
      void discoverDocumentSegments(sessionId)
    }
    catch (reason) {
      setTranslationState("error")
      setTranslationError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [discoverDocumentSegments, document])

  useEffect(() => {
    if (!translationRequested || !translationProvider || !translationLanguage || isProcessingBatch)
      return

    const pending = prioritizePdfSegments(segmentsByPage, nearPages, translations)
      .filter(segment => !failedSegmentIds.has(segment.id))
    const batch = createPdfTranslationBatches(pending, 4)[0]

    if (!batch) {
      if (discoveryDone) {
        setTranslationRequested(false)
        if (failedSegmentIds.size > 0) {
          setTranslationState("error")
          setTranslationError(`${failedSegmentIds.size} 段翻譯失敗，可按「重試翻譯」再次處理。`)
        }
        else {
          setTranslationState("ready")
        }
      }
      return
    }

    const sessionId = sessionIdRef.current
    setIsProcessingBatch(true)
    void Promise.allSettled(batch.map(segment => translatePdfText(
      segment.source,
      translationLanguage,
      translationProvider,
    )))
      .then((results) => {
        if (sessionIdRef.current !== sessionId)
          return

        const completed: Record<string, string> = {}
        const failed = new Set<string>()
        results.forEach((result, index) => {
          const segment = batch[index]
          if (result.status === "fulfilled" && result.value.trim())
            completed[segment.id] = result.value
          else
            failed.add(segment.id)
        })
        if (Object.keys(completed).length > 0)
          setTranslations(current => ({ ...current, ...completed }))
        if (failed.size > 0)
          setFailedSegmentIds(current => new Set([...current, ...failed]))
      })
      .finally(() => {
        if (sessionIdRef.current === sessionId)
          setIsProcessingBatch(false)
      })
  }, [discoveryDone, failedSegmentIds, isProcessingBatch, nearPages, segmentsByPage, translationLanguage, translationProvider, translationRequested, translations])

  const progressLabel = translationState === "translating"
    ? `翻譯中 ${translatedCount}/${allSegments.length || "…"}`
    : translationState === "ready"
      ? `已翻譯 ${translatedCount} 段`
      : translationState === "error"
        ? "重試翻譯"
        : "開始翻譯"

  return (
    <main>
      <header className="reader-header">
        <div className="brand">
          <img src="/icon/48.png" alt="" />
          <div>
            <strong>翻譯小貓</strong>
            <span>
              PDF 翻譯本
              {document ? ` · ${document.numPages} 頁` : ""}
            </span>
          </div>
        </div>
        <div className="reader-actions">
          <label className="file-button">
            選擇 PDF
            <input type="file" accept="application/pdf,.pdf" onChange={event => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <button type="button" disabled={!document || translationState === "translating"} onClick={() => void translateDocument()}>
            {progressLabel}
          </button>
        </div>
      </header>

      {(loading || error || translationError || (!querySource && !file)) && (
        <div className={`reader-notice ${error || translationError ? "error" : ""}`}>
          {loading && "正在載入 PDF…"}
          {!loading && (error || translationError)}
          {!loading && !error && !translationError && !querySource && !file && "請選擇 PDF，或從 Chrome 中的 PDF 頁面開啟翻譯小貓。"}
        </div>
      )}

      {document && (
        <>
          <div className="column-headings">
            <span>原始 PDF</span>
            <span>
              翻譯本
              {translationState === "translating" ? ` · ${translatedCount}/${allSegments.length || "載入中"}` : ""}
            </span>
          </div>
          <div className="reader-pages">
            {Array.from({ length: document.numPages }, (_, index) => {
              const pageNumber = index + 1
              return (
                <PdfPageRow
                  key={pageNumber}
                  document={document}
                  pageNumber={pageNumber}
                  segments={segmentsByPage[pageNumber] ?? []}
                  translations={translations}
                  activeSegmentId={activeSegmentId}
                  translationActive={translationState === "translating"}
                  onNearChange={handleNearChange}
                  onSegments={handleSegments}
                  onSelect={setActiveSegmentId}
                />
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}

export default App
