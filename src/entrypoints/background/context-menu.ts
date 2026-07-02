import type { Browser } from "#imports"
import type { Config } from "@/types/config/config"
import { browser, i18n, storage } from "#imports"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { getTranslationStateKey, TRANSLATION_STATE_KEY_PREFIX } from "@/utils/constants/storage-keys"
import { sendMessage } from "@/utils/message"
import { ensureInitializedConfig } from "./config"
import { getPageTranslationEnabled, setPageTranslationEnabled } from "./page-translation-state"

export const MENU_ID_TRANSLATE = "read-frog-translate"
export const MENU_ID_SELECTION_TRANSLATE = "read-frog-selection-translate"
export const MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX = "read-frog-selection-custom-action:"
const HOST_CONTENT_SCRIPT_FILE = "/content-scripts/host.js"
const SELECTION_CONTENT_SCRIPT_FILE = "/content-scripts/selection.js"
const CONTENT_SCRIPT_READY_TIMEOUT_MS = 2_000
const CONTENT_SCRIPT_READY_RETRY_MS = 50

type ContentScriptMessageTarget = number | { tabId: number, frameId: number }

function isMissingContentScriptReceiver(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("Could not establish connection")
    || message.includes("Receiving end does not exist")
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForSelectionContentScriptReady(target: ContentScriptMessageTarget) {
  const deadline = Date.now() + CONTENT_SCRIPT_READY_TIMEOUT_MS
  let lastMissingReceiverError: unknown

  while (Date.now() <= deadline) {
    try {
      const status = await sendMessage("getSelectionContentScriptStatus", undefined, target)
      if (status.ready) {
        return
      }
    }
    catch (error) {
      if (!isMissingContentScriptReceiver(error)) {
        throw error
      }

      lastMissingReceiverError = error
    }

    await delay(CONTENT_SCRIPT_READY_RETRY_MS)
  }

  if (lastMissingReceiverError) {
    throw lastMissingReceiverError
  }

  throw new Error("Selection content script did not become ready after injection.")
}

async function sendWithContentScriptRecovery(
  send: () => Promise<unknown>,
  target: { tabId: number, frameId: number },
  contentScriptFile: typeof HOST_CONTENT_SCRIPT_FILE | typeof SELECTION_CONTENT_SCRIPT_FILE,
  waitUntilReady?: () => Promise<void>,
) {
  try {
    await send()
  }
  catch (error) {
    if (!isMissingContentScriptReceiver(error)) {
      throw error
    }

    await browser.scripting.executeScript({
      target: { tabId: target.tabId, frameIds: [target.frameId] },
      files: [contentScriptFile],
    })
    await waitUntilReady?.()
    await send()
  }
}

function getSelectionCustomActionMenuId(actionId: string) {
  return `${MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX}${actionId}`
}

function isPdfReaderTab(tab: Browser.tabs.Tab) {
  const url = tab.url ?? ""
  return url.startsWith(browser.runtime.getURL("/pdf-reader.html"))
}

/**
 * Register all context menu event listeners synchronously
 * This must be called during main() execution to ensure listeners are registered
 * before Chrome completes initialization
 */
export function registerContextMenuListeners() {
  // Listen for config changes to update context menu
  storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, async (newConfig) => {
    if (newConfig) {
      await updateContextMenuItems(newConfig)
    }
  })

  // Listen for tab activation to update menu title
  browser.tabs.onActivated.addListener(async (activeInfo) => {
    await updateTranslateMenuTitle(activeInfo.tabId)
  })

  // Listen for tab updates (e.g., navigation)
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
      await updateTranslateMenuTitle(tabId)
    }
  })

  // Listen for translation state changes in storage
  // This ensures menu updates when translation is toggled from any UI
  // (floating button, auto-translate, etc.) without interfering with
  // the translation logic in translation-signal.ts
  browser.storage.session.onChanged.addListener(async (changes) => {
    for (const [key, change] of Object.entries(changes)) {
      // Check if this is a translation state change
      if (key.startsWith(TRANSLATION_STATE_KEY_PREFIX.replace("session:", ""))) {
        // Extract tabId from key (format: "translationState.{tabId}")
        const parts = key.split(".")
        const tabId = Number.parseInt(parts[1])

        if (!Number.isNaN(tabId)) {
          // Only update menu if this is the active tab
          const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
          if (activeTab?.id === tabId) {
            const newValue = change.newValue as { enabled: boolean } | undefined
            await updateTranslateMenuTitle(tabId, newValue?.enabled)
          }
        }
      }
    }
  })

  // Handle menu item clicks
  browser.contextMenus.onClicked.addListener(handleContextMenuClick)
}

/**
 * Initialize context menu items based on config
 * This can be called asynchronously after listeners are registered
 */
export async function initializeContextMenu() {
  // Ensure config is initialized before setting up context menu
  const config = await ensureInitializedConfig()
  if (!config) {
    return
  }

  await updateContextMenuItems(config)
}

/**
 * Update context menu items based on config
 */
async function updateContextMenuItems(config: Config) {
  // Remove all existing menu items first
  await browser.contextMenus.removeAll()

  const { enabled: translateEnabled } = config.contextMenu
  const enabledCustomActions = config.selectionToolbar.customActions
    .filter(action => action.enabled !== false)

  if (translateEnabled) {
    browser.contextMenus.create({
      id: MENU_ID_TRANSLATE,
      title: i18n.t("contextMenu.translate"),
      contexts: ["page"],
    })

    browser.contextMenus.create({
      id: MENU_ID_SELECTION_TRANSLATE,
      title: i18n.t("contextMenu.translateSelection"),
      contexts: ["selection"],
    })

    if (enabledCustomActions.length > 0) {
      enabledCustomActions.forEach((action) => {
        browser.contextMenus.create({
          id: getSelectionCustomActionMenuId(action.id),
          title: action.name,
          contexts: ["selection"],
        })
      })
    }
  }

  // Update translate menu title for current tab
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (activeTab?.id) {
    await updateTranslateMenuTitle(activeTab.id)
  }
}

/**
 * Update translate menu title based on current translation state
 * @param tabId - The tab ID to check translation state for
 * @param enabled - Optional: if provided, use this value instead of reading from storage
 */
async function updateTranslateMenuTitle(tabId: number, enabled?: boolean) {
  const config = await ensureInitializedConfig()
  if (!config?.contextMenu.enabled) {
    return
  }

  try {
    let isTranslated: boolean
    if (enabled !== undefined) {
      isTranslated = enabled
    }
    else {
      const state = await storage.getItem<{ enabled: boolean }>(
        getTranslationStateKey(tabId),
      )
      isTranslated = state?.enabled ?? false
    }

    await browser.contextMenus.update(MENU_ID_TRANSLATE, {
      title: isTranslated
        ? i18n.t("contextMenu.showOriginal")
        : i18n.t("contextMenu.translate"),
    })
  }
  catch {
    // Menu item might not exist if translateEnabled is false
  }
}

/**
 * Handle context menu item click
 */
async function handleContextMenuClick(
  info: Browser.contextMenus.OnClickData,
  tab?: Browser.tabs.Tab,
) {
  if (!tab?.id) {
    return
  }

  if (info.menuItemId === MENU_ID_TRANSLATE) {
    await handleTranslateClick(tab.id)
    return
  }

  if (info.menuItemId === MENU_ID_SELECTION_TRANSLATE) {
    await handleSelectionTranslateClick(info, tab)
    return
  }

  if (typeof info.menuItemId === "string" && info.menuItemId.startsWith(MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX)) {
    const actionId = info.menuItemId.slice(MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX.length)
    if (!actionId) {
      return
    }

    await handleSelectionCustomActionClick(info, tab, actionId)
  }
}

/**
 * Handle translate menu click - toggle page translation
 */
async function handleTranslateClick(tabId: number) {
  const isCurrentlyTranslated = await getPageTranslationEnabled(tabId)
  const newState = !isCurrentlyTranslated

  if (!newState) {
    await setPageTranslationEnabled(tabId, false)
    void sendMessage("notifyTranslationStateChanged", { enabled: false }, tabId)
  }

  // Notify content script in that specific tab
  await sendWithContentScriptRecovery(
    () => sendMessage("askManagerToTogglePageTranslation", {
      enabled: newState,
      analyticsContext: newState
        ? createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.CONTEXT_MENU)
        : undefined,
    }, tabId),
    { tabId, frameId: 0 },
    HOST_CONTENT_SCRIPT_FILE,
  )

  // Update menu title immediately
  await updateTranslateMenuTitle(tabId, newState)
}

async function handleSelectionTranslateClick(
  info: Browser.contextMenus.OnClickData,
  tab: Browser.tabs.Tab,
) {
  const selectionText = info.selectionText?.trim()
  if (!selectionText) {
    return
  }

  const tabId = tab.id
  if (!tabId) {
    return
  }

  if (isPdfReaderTab(tab)) {
    await sendMessage("openSelectionTranslationFromContextMenu", { selectionText, tabId })
    return
  }

  const target = typeof info.frameId === "number"
    ? { tabId, frameId: info.frameId }
    : tabId

  await sendWithContentScriptRecovery(
    () => sendMessage("openSelectionTranslationFromContextMenu", { selectionText }, target),
    { tabId, frameId: info.frameId ?? 0 },
    SELECTION_CONTENT_SCRIPT_FILE,
    () => waitForSelectionContentScriptReady(target),
  )
}

async function handleSelectionCustomActionClick(
  info: Browser.contextMenus.OnClickData,
  tab: Browser.tabs.Tab,
  actionId: string,
) {
  const selectionText = info.selectionText?.trim()
  if (!selectionText) {
    return
  }

  const tabId = tab.id
  if (!tabId) {
    return
  }

  if (isPdfReaderTab(tab)) {
    await sendMessage("openSelectionCustomActionFromContextMenu", { actionId, selectionText, tabId })
    return
  }

  const target = typeof info.frameId === "number"
    ? { tabId, frameId: info.frameId }
    : tabId

  await sendWithContentScriptRecovery(
    () => sendMessage("openSelectionCustomActionFromContextMenu", { actionId, selectionText }, target),
    { tabId, frameId: info.frameId ?? 0 },
    SELECTION_CONTENT_SCRIPT_FILE,
    () => waitForSelectionContentScriptReady(target),
  )
}
