import { describe, expect, it } from "vitest"
import { APP_SLUG, CONTENT_SCRIPT_UI_NAMES } from "../app"

describe("app constants", () => {
  it("uses valid custom element names for content script shadow roots", () => {
    const customElementNamePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/

    expect(APP_SLUG).toBe("read-frog")
    expect(CONTENT_SCRIPT_UI_NAMES.side).toMatch(customElementNamePattern)
    expect(CONTENT_SCRIPT_UI_NAMES.selection).toMatch(customElementNamePattern)
  })
})
