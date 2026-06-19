import { describe, expect, it } from "vitest"
import { buildPdfPrompt, parsePdfTranslation } from "../pdf"

describe("pDF prompts", () => {
  it("requires translation-only JSON with stable segment ids", () => {
    const prompt = buildPdfPrompt("Traditional Chinese", [
      { id: "p1-s1", text: "A first sentence." },
      { id: "p1-s2", text: "A second sentence." },
    ])
    expect(prompt.systemPrompt).toContain("Do not summarize")
    expect(prompt.systemPrompt).toContain("valid JSON")
    expect(prompt.prompt).toContain("\"id\":\"p1-s1\"")
  })

  it("reports missing ids without discarding valid translations", () => {
    expect(parsePdfTranslation("[{\"id\":\"p1-s1\",\"translation\":\"第一句\"}]", ["p1-s1", "p1-s2"])).toEqual({
      translations: new Map([["p1-s1", "第一句"]]),
      missingIds: ["p1-s2"],
    })
  })
})
