export type PdfSourceKind = "remote" | "local" | "unsupported"

const PDF_HINT_PATTERN = /\.pdf(?:$|[?#])|[?&](?:format|type|filetype)=pdf(?:&|$)/i

export function classifyPdfSource(url: string, contentType?: string): PdfSourceKind {
  if (!url)
    return "unsupported"
  if (url.startsWith("file://"))
    return PDF_HINT_PATTERN.test(url) ? "local" : "unsupported"
  if (/^https?:\/\//i.test(url) && (PDF_HINT_PATTERN.test(url) || contentType?.toLowerCase().includes("application/pdf")))
    return "remote"
  return "unsupported"
}

export function createPdfReaderUrl(readerUrl: string, sourceUrl: string): string {
  const url = new URL(readerUrl)
  url.searchParams.set("source", sourceUrl)
  return url.toString()
}

export function resolvePdfSourceFromTabUrl(tabUrl: string): string | null {
  try {
    const url = new URL(tabUrl)
    const viewerFile = url.searchParams.get("file")
    if (viewerFile && classifyPdfSource(viewerFile) !== "unsupported")
      return viewerFile
    return classifyPdfSource(tabUrl) !== "unsupported" ? tabUrl : null
  }
  catch {
    return null
  }
}
