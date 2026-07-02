import { browser } from "#imports"

export async function isPdfContextMenuMessageForThisTab(tabId?: number) {
  if (tabId === undefined) {
    return true
  }

  try {
    const tab = await browser.tabs.getCurrent()
    return tab?.id === tabId
  }
  catch {
    return false
  }
}
