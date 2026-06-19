import { browser } from "#imports"

export const APP_NAME = "翻譯小貓"
const manifest = browser.runtime.getManifest()
export const EXTENSION_VERSION = manifest.version
