// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { renderSubtitlesTranslateButton } from "../render-translate-button"

const adapter = {
  embedded: false,
  containerShrinkRatio: undefined,
  getControlsConfig: () => undefined,
  toggleSubtitlesManually: vi.fn(),
  downloadSourceSubtitles: vi.fn(),
  downloadTranslatedSubtitles: vi.fn(),
}

describe("renderSubtitlesTranslateButton", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.clearAllMocks()
  })

  it("stops YouTube control-bar events from bubbling in watch mode", () => {
    const controlsBar = document.createElement("div")
    const onPointerDown = vi.fn()
    const onClick = vi.fn()
    controlsBar.addEventListener("pointerdown", onPointerDown)
    controlsBar.addEventListener("click", onClick)
    document.body.appendChild(controlsBar)

    const buttonHost = renderSubtitlesTranslateButton(adapter)
    controlsBar.appendChild(buttonHost)

    buttonHost.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }))
    buttonHost.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))

    expect(onPointerDown).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
  })
})
