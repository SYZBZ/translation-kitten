// @vitest-environment jsdom
import type { HTMLAttributes, ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PdfSelectionOverlay } from "../pdf-selection-overlay"

vi.mock("@/entrypoints/selection.content/selection-toolbar", () => ({
  SelectionToolbar: () => <div data-testid="selection-toolbar" />,
}))

vi.mock("@/entrypoints/selection.content/selection-toolbar/translate-button/provider", () => ({
  SelectionTranslationProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="selection-translation-provider">{children}</div>
  ),
}))

vi.mock("@/entrypoints/selection.content/selection-toolbar/custom-action-button/provider", () => ({
  SelectionCustomActionProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="selection-custom-action-provider">{children}</div>
  ),
}))

vi.mock("sonner", () => ({
  Toaster: (props: HTMLAttributes<HTMLDivElement>) => <div data-testid="selection-toaster" {...props} />,
}))

describe("pdfSelectionOverlay", () => {
  it("mounts the selection toolbar stack inside the PDF reader", () => {
    render(<PdfSelectionOverlay />)

    expect(screen.getByTestId("selection-translation-provider")).toContainElement(
      screen.getByTestId("selection-custom-action-provider"),
    )
    expect(screen.getByTestId("selection-custom-action-provider")).toContainElement(screen.getByTestId("selection-toolbar"))
    expect(screen.getByTestId("selection-toaster")).toBeInTheDocument()
  })
})
