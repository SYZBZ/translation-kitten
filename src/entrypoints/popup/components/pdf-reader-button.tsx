import { useEffect, useState } from "react"
import { browser } from "#imports"
import { createPdfReaderUrl, resolvePdfSourceFromTabUrl } from "@/utils/pdf/source"

export function PdfReaderButton() {
  const [source, setSource] = useState<string | null>(null)

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setSource(resolvePdfSourceFromTabUrl(tab?.url ?? ""))
    })
  }, [])

  const openReader = async () => {
    const base = browser.runtime.getURL("/pdf-reader.html")
    await browser.tabs.create({
      active: true,
      url: source ? createPdfReaderUrl(base, source) : base,
    })
    window.close()
  }

  return (
    <button
      type="button"
      onClick={() => void openReader()}
      className="group flex w-full cursor-pointer items-center justify-between rounded-xl border border-amber-300/70 bg-amber-50 px-3.5 py-3 text-left text-stone-800 transition hover:-translate-y-0.5 hover:bg-amber-100 hover:shadow-sm dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:bg-amber-950/70"
    >
      <span className="flex items-center gap-3">
        <img src="/icon/32.png" alt="" className="size-8 rounded-lg" />
        <span className="grid gap-0.5">
          <strong className="text-sm">{source ? "開啟這份 PDF 的翻譯本" : "PDF 雙欄翻譯本"}</strong>
          <span className="text-xs text-stone-500 dark:text-amber-200/70">原文與譯文同步選取標示</span>
        </span>
      </span>
      <span aria-hidden="true" className="text-lg transition group-hover:translate-x-1">→</span>
    </button>
  )
}
