// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { isPdfContextMenuMessageForThisTab } from "../pdf-context-menu-target"

describe("pdf context menu target", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    browser.tabs.getCurrent = vi.fn().mockResolvedValue({ id: 12 })
  })

  it("accepts untargeted content-script context menu messages", async () => {
    await expect(isPdfContextMenuMessageForThisTab()).resolves.toBe(true)
  })

  it("accepts runtime messages for the current PDF reader tab", async () => {
    await expect(isPdfContextMenuMessageForThisTab(12)).resolves.toBe(true)
  })

  it("ignores runtime messages for other PDF reader tabs", async () => {
    await expect(isPdfContextMenuMessageForThisTab(13)).resolves.toBe(false)
  })
})
