import type { PdfRenderableSegment } from "./pdf-segments"
import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getProviderConfigById } from "@/utils/config/helpers"
import { getLocalConfig } from "@/utils/config/storage"
import { translatePdfText } from "@/utils/pdf/translate"
import { PdfPageRow } from "./pdf-page-row"
import { createPdfTranslationBlocks, extractPdfSegments } from "./pdf-segments"
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
  const [failedBlockIds, setFailedBlockIds] = useState<Set<string>>(() => new Set())
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
    setFailedBlockIds(new Set())
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

  const translationBlocksByPage = useMemo(
    () => Object.fromEntries(
      Object.keys(segmentsByPage)
        .map(Number)
        .sort((a, b) => a - b)
        .map(page => [page, createPdfTranslationBlocks(segmentsByPage[page] ?? [])]),
    ),
    [segmentsByPage],
  )
  const allTranslationBlocks = useMemo(
    () => Object.keys(translationBlocksByPage)
      .map(Number)
      .sort((a, b) => a - b)
      .flatMap(page => translationBlocksByPage[page]),
    [translationBlocksByPage],
  )
  const translatedCount = useMemo(
    () => allTranslationBlocks.filter(block => Boolean(translations[block.id])).length,
    [allTranslationBlocks, translations],
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
    setFailedBlockIds(new Set())
    try {
      const config = await getLocalConfig()
      if (!config)
        throw new Error("找不到翻譯設定，請先完成擴充功能設定。")
      const provider = getProviderConfigById(config.providersConfig, config.translate.providerId)
      if (!provider)
        throw new Error("找不到可用的 PDF 翻譯服務，請先在設定中啟用翻譯提供者。")

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

    const pending = prioritizePdfSegments(translationBlocksByPage, nearPages, translations)
      .filter(block => !failedBlockIds.has(block.id))
    const batch = createPdfTranslationBatches(pending, 4)[0]

    if (!batch) {
      if (discoveryDone) {
        setTranslationRequested(false)
        if (failedBlockIds.size > 0) {
          setTranslationState("error")
          setTranslationError(`${failedBlockIds.size} 個段落翻譯失敗；其餘段落已保留。`)
        }
        else {
          setTranslationState("ready")
        }
      }
      return
    }

    const sessionId = sessionIdRef.current
    setIsProcessingBatch(true)
    void Promise.allSettled(batch.map(block => translatePdfText(
      block.source,
      translationLanguage,
      translationProvider,
    )))
      .then((results) => {
        if (sessionIdRef.current !== sessionId)
          return

        const completed: Record<string, string> = {}
        const failed = new Set<string>()
        results.forEach((result, index) => {
          const block = batch[index]
          if (result.status === "fulfilled" && result.value.trim())
            completed[block.id] = result.value
          else
            failed.add(block.id)
        })
        if (Object.keys(completed).length > 0)
          setTranslations(current => ({ ...current, ...completed }))
        if (failed.size > 0)
          setFailedBlockIds(current => new Set([...current, ...failed]))
      })
      .finally(() => {
        if (sessionIdRef.current === sessionId)
          setIsProcessingBatch(false)
      })
  }, [discoveryDone, failedBlockIds, isProcessingBatch, nearPages, translationBlocksByPage, translationLanguage, translationProvider, translationRequested, translations])

  const progressLabel = translationState === "translating"
    ? `翻譯中 ${translatedCount}/${allTranslationBlocks.length || "讀取中"}`
    : translationState === "ready"
      ? `已翻譯 ${translatedCount} 段`
      : translationState === "error"
        ? "重新翻譯"
        : "翻譯 PDF"

  return (
    <main>
      <header className="reader-header">
        <div className="brand">
          <img src="/icon/48.png" alt="" />
          <div>
            <strong>翻譯小貓</strong>
            <span>
              PDF 翻譯
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
          {loading && "正在讀取 PDF..."}
          {!loading && (error || translationError)}
          {!loading && !error && !translationError && !querySource && !file && "請選擇 PDF，或從 Chrome 的 PDF 頁面用翻譯小貓開啟。"}
        </div>
      )}

      {document && (
        <>
          <div className="column-headings">
            <span>原始 PDF</span>
            <span>
              翻譯結果
              {translationState === "translating" ? ` · ${translatedCount}/${allTranslationBlocks.length || "讀取中"}` : ""}
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
