import type { PDFDocumentProxy } from "pdfjs-dist"
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { useEffect, useState } from "react"
import { backgroundFetch } from "@/utils/content-script/background-fetch-client"

GlobalWorkerOptions.workerSrc = workerUrl

async function loadPdfBytes(source: string): Promise<Uint8Array> {
  if (source.startsWith("file://")) {
    const response = await fetch(source)
    if (!response.ok)
      throw new Error(`無法讀取本機 PDF（${response.status}）`)
    return new Uint8Array(await response.arrayBuffer())
  }

  const response = await backgroundFetch(source, undefined, {
    credentials: "include",
    responseType: "base64",
  })
  if (!response.ok)
    throw new Error(`無法下載 PDF（${response.status}）`)
  return new Uint8Array(await response.arrayBuffer())
}

export function usePdfDocument(source: string | null, file: File | null) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!source && !file)
      return
    let disposed = false
    const task = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = file
          ? new Uint8Array(await file.arrayBuffer())
          : await loadPdfBytes(source!)
        const pdf = await getDocument({ data }).promise
        if (!disposed)
          setDocument(pdf)
      }
      catch (reason) {
        if (!disposed)
          setError(reason instanceof Error ? reason.message : String(reason))
      }
      finally {
        if (!disposed)
          setLoading(false)
      }
    }
    void task()
    return () => {
      disposed = true
    }
  }, [file, source])

  return { document, error, loading }
}
