import "@/utils/zod-config"
import type { ContentScriptContext } from "#imports"
import type { ThemeMode } from "@/types/config/theme"
import { QueryClientProvider } from "@tanstack/react-query"
import { Provider as JotaiProvider } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import ReactDOM from "react-dom/client"
import { createShadowRootUi, defineContentScript } from "#imports"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { baseThemeModeAtom } from "@/utils/atoms/theme"
import { getLocalConfig } from "@/utils/config/storage"
import { CONTENT_SCRIPT_UI_NAMES } from "@/utils/constants/app"
import { ensureIconifyBackgroundFetch } from "@/utils/iconify/setup-background-fetch"
import { onMessage } from "@/utils/message"
import { protectSelectAllShadowRoot } from "@/utils/select-all"
import { insertShadowRootUIWrapperInto } from "@/utils/shadow-root"
import { clearEffectiveSiteControlUrl, getEffectiveSiteControlUrl, isSiteEnabled } from "@/utils/site-control"
import { addStyleToShadow } from "@/utils/styles"
import { queryClient } from "@/utils/tanstack-query"
import { getLocalThemeMode } from "@/utils/theme"
import App from "./app"
import { setSelectionShadowWrapper } from "./shadow-wrapper-ref"
import "@/assets/styles/theme.css"

function HydrateAtoms({
  initialValues,
  children,
}: {
  initialValues: [[typeof baseThemeModeAtom, ThemeMode]]
  children: React.ReactNode
}) {
  useHydrateAtoms(initialValues)
  return children
}

declare global {
  interface Window {
    __READ_FROG_SELECTION_INJECTED__?: boolean
    __READ_FROG_SELECTION_READY__?: boolean
  }
}

async function mountSelectionUI(ctx: ContentScriptContext) {
  ensureIconifyBackgroundFetch()

  const themeMode = await getLocalThemeMode()

  const ui = await createShadowRootUi(ctx, {
    name: CONTENT_SCRIPT_UI_NAMES.selection,
    position: "overlay",
    anchor: "body",
    onMount: (container, shadow, shadowHost) => {
      const wrapper = insertShadowRootUIWrapperInto(container)
      setSelectionShadowWrapper(wrapper)
      addStyleToShadow(shadow)
      protectSelectAllShadowRoot(shadowHost, wrapper)

      const root = ReactDOM.createRoot(wrapper)
      root.render(
        <QueryClientProvider client={queryClient}>
          <JotaiProvider>
            <HydrateAtoms initialValues={[[baseThemeModeAtom, themeMode]]}>
              <ThemeProvider container={wrapper}>
                <TooltipProvider>
                  <App
                    uiContainer={container}
                    onReady={() => {
                      window.__READ_FROG_SELECTION_READY__ = true
                    }}
                  />
                </TooltipProvider>
              </ThemeProvider>
            </HydrateAtoms>
          </JotaiProvider>
        </QueryClientProvider>,
      )
      return root
    },
    onRemove: (root) => {
      window.__READ_FROG_SELECTION_READY__ = false
      root?.unmount()
      setSelectionShadowWrapper(null)
    },
  })

  ui.mount()
}

export default defineContentScript({
  matches: ["*://*/*", "file:///*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    // Prevent double injection (manifest-based + programmatic injection)
    if (window.__READ_FROG_SELECTION_INJECTED__)
      return
    window.__READ_FROG_SELECTION_INJECTED__ = true
    window.__READ_FROG_SELECTION_READY__ = false

    const cleanupStatusListener = onMessage("getSelectionContentScriptStatus", () => ({
      ready: window.__READ_FROG_SELECTION_READY__ === true,
    }))

    ctx.onInvalidated(() => {
      cleanupStatusListener()
      window.__READ_FROG_SELECTION_INJECTED__ = false
      window.__READ_FROG_SELECTION_READY__ = false
      clearEffectiveSiteControlUrl()
    })

    // Check global site control
    const config = await getLocalConfig()
    const siteControlUrl = getEffectiveSiteControlUrl(window.location.href)
    if (!isSiteEnabled(siteControlUrl, config)) {
      cleanupStatusListener()
      window.__READ_FROG_SELECTION_INJECTED__ = false
      window.__READ_FROG_SELECTION_READY__ = false
      clearEffectiveSiteControlUrl()
      return
    }

    void mountSelectionUI(ctx)
  },
})
