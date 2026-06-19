import { describe, expect, it } from "vitest"
import { getFittedPdfViewportScale } from "../pdf-layout"

describe("pDF reader layout", () => {
  it("shrinks a page to fit the available source column", () => {
    expect(getFittedPdfViewportScale(800, 600, 1.35)).toBe(0.75)
  })

  it("does not upscale a narrow page beyond the preferred scale", () => {
    expect(getFittedPdfViewportScale(400, 900, 1.35)).toBe(1.35)
  })

  it("uses a safe scale while the container has not been measured", () => {
    expect(getFittedPdfViewportScale(800, 0, 1.35)).toBe(1)
  })
})
