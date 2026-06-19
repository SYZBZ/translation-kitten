import { describe, expect, it } from "vitest"
import { classifyPdfSource, createPdfReaderUrl, resolvePdfSourceFromTabUrl } from "../source"

describe("classifyPdfSource", () => {
  it.each([
    ["https://example.com/paper.pdf", "remote"],
    ["https://example.com/download?id=7&format=pdf", "remote"],
    ["file:///C:/papers/demo.pdf", "local"],
  ] as const)("classifies %s as %s", (url, expected) => {
    expect(classifyPdfSource(url, url.includes("format=pdf") ? "application/pdf" : undefined)).toBe(expected)
  })

  it("rejects ordinary web pages", () => {
    expect(classifyPdfSource("https://example.com/article")).toBe("unsupported")
  })

  it("creates an encoded extension reader URL", () => {
    expect(createPdfReaderUrl("chrome-extension://abc/pdf-reader.html", "https://e.test/a b.pdf"))
      .toBe("chrome-extension://abc/pdf-reader.html?source=https%3A%2F%2Fe.test%2Fa+b.pdf")
  })

  it("extracts the original file from Chrome's built-in PDF viewer", () => {
    expect(resolvePdfSourceFromTabUrl("chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html?file=https%3A%2F%2Fe.test%2Fpaper.pdf"))
      .toBe("https://e.test/paper.pdf")
  })
})
