export type SubtitleSessionStatus = "idle" | "detecting" | "loading" | "translating" | "ready" | "error"

export interface SubtitleSessionState {
  status: SubtitleSessionStatus
  videoId: string
  error?: string
}

type SubtitleWork = (signal: AbortSignal) => Promise<unknown>

export class SubtitleSession {
  state: SubtitleSessionState = { status: "idle", videoId: "" }

  private generation = 0
  private controller: AbortController | null = null
  private lastWork: SubtitleWork | null = null

  constructor(private readonly onStateChange: (state: SubtitleSessionState) => void) {}

  private publish(status: SubtitleSessionStatus, videoId: string, error?: string) {
    this.state = { status, videoId, ...(error ? { error } : {}) }
    this.onStateChange(this.state)
  }

  async run(videoId: string, work: SubtitleWork): Promise<void> {
    this.controller?.abort()
    this.controller = new AbortController()
    this.lastWork = work
    const generation = ++this.generation

    try {
      this.publish("detecting", videoId)
      await Promise.resolve()
      if (generation !== this.generation)
        return
      this.publish("loading", videoId)
      await Promise.resolve()
      if (generation !== this.generation)
        return
      this.publish("translating", videoId)
      await work(this.controller.signal)
      if (generation === this.generation)
        this.publish("ready", videoId)
    }
    catch (error) {
      if (generation === this.generation && !this.controller.signal.aborted) {
        this.publish("error", videoId, error instanceof Error ? error.message : String(error))
      }
    }
  }

  async retry(): Promise<void> {
    if (!this.lastWork || !this.state.videoId)
      return
    await this.run(this.state.videoId, this.lastWork)
  }

  cancel() {
    this.generation += 1
    this.controller?.abort()
    this.controller = null
  }
}
