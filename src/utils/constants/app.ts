import { browser } from "#imports"

export const APP_NAME = "翻譯小貓"
export const APP_SLUG = "read-frog"
export const CONTENT_SCRIPT_UI_NAMES = {
  side: APP_SLUG,
  selection: `${APP_SLUG}-selection`,
} as const

const manifest = browser.runtime.getManifest()
export const EXTENSION_VERSION = manifest.version
