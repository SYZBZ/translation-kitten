import { Toaster } from "sonner"
import {
  SELECTION_CONTENT_OVERLAY_LAYERS,
  SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE,
} from "@/entrypoints/selection.content/overlay-layers"
import { SelectionToolbar } from "@/entrypoints/selection.content/selection-toolbar"
import { SelectionCustomActionProvider } from "@/entrypoints/selection.content/selection-toolbar/custom-action-button/provider"
import { SelectionTranslationProvider } from "@/entrypoints/selection.content/selection-toolbar/translate-button/provider"

export function PdfSelectionOverlay() {
  return (
    <>
      <SelectionTranslationProvider>
        <SelectionCustomActionProvider>
          <SelectionToolbar />
        </SelectionCustomActionProvider>
      </SelectionTranslationProvider>
      <Toaster
        richColors
        className={`${SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay} notranslate`}
        {...{ [SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE]: "" }}
      />
    </>
  )
}
