import { YOUTUBE_EMBED_PATH_PATTERN, YOUTUBE_NAVIGATE_FINISH_EVENT, YOUTUBE_SHORTS_PATH_PATTERN, YOUTUBE_WATCH_URL_PATTERN } from "@/utils/constants/subtitles"
import { createYoutubeSubtitlesAdapter } from "./platforms/youtube"
import { createYoutubeCaptionTrackListener } from "./platforms/youtube/caption-track-listener"
import { getYoutubeConfig } from "./platforms/youtube/config"
import { watchShortsActiveReel } from "./platforms/youtube/shorts-active-reel-watcher"
import { mountSubtitlesUI } from "./renderer/mount-subtitles-ui"

function isYoutubeWatch(): boolean {
  return window.location.href.includes(YOUTUBE_WATCH_URL_PATTERN)
}

function isYoutubeEmbed(): boolean {
  return YOUTUBE_EMBED_PATH_PATTERN.test(window.location.pathname)
}

function isYoutubeShorts(): boolean {
  return YOUTUBE_SHORTS_PATH_PATTERN.test(window.location.pathname)
}

export function initYoutubeSubtitles() {
  let initialized = false
  let adapter: ReturnType<typeof createYoutubeSubtitlesAdapter> | null = null
  let currentMode: "watch" | "shorts" | "embed" | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let observerTimer: ReturnType<typeof setTimeout> | null = null

  const getMode = () => isYoutubeShorts() ? "shorts" : isYoutubeEmbed() ? "embed" : isYoutubeWatch() ? "watch" : null

  const tryInit = async () => {
    const mode = getMode()
    if (!mode) {
      return
    }

    const config = getYoutubeConfig({ mode })

    if (!adapter || currentMode !== mode) {
      adapter = createYoutubeSubtitlesAdapter(config)
      currentMode = mode
      initialized = false
    }

    if (!adapter) {
      return
    }

    await mountSubtitlesUI({ adapter, config })

    if (initialized) {
      await adapter.ensureMounted()
      return
    }

    initialized = true
    const trackListener = createYoutubeCaptionTrackListener({
      playerContainerSelector: config.selectors.playerContainer,
      onTrackChanged: () => {
        void adapter?.handleSourceTrackChanged()
      },
    })
    trackListener.start()
    void adapter.initialize()

    if (mode === "shorts") {
      const shortsAdapter = adapter
      watchShortsActiveReel(() => shortsAdapter.notifyNavigation())
    }
  }

  const scheduleInit = (delay = 80) => {
    if (retryTimer)
      clearTimeout(retryTimer)
    retryTimer = setTimeout(() => {
      retryTimer = null
      void tryInit()
    }, delay)
  }

  void tryInit()

  window.addEventListener(YOUTUBE_NAVIGATE_FINISH_EVENT, () => scheduleInit())

  // YouTube frequently rebuilds the player controls without changing the URL.
  // Debounced remounting keeps the translation button responsive after those swaps.
  const observer = new MutationObserver(() => {
    if (observerTimer)
      clearTimeout(observerTimer)
    observerTimer = setTimeout(() => {
      observerTimer = null
      scheduleInit(0)
    }, 250)
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
