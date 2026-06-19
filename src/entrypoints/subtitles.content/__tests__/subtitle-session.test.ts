import { describe, expect, it } from "vitest"
import { SubtitleSession } from "../subtitle-session"

describe("subtitleSession", () => {
  it("publishes immediate loading states and reaches ready", async () => {
    const states: string[] = []
    const session = new SubtitleSession(state => states.push(state.status))
    await session.run("video-a", async () => "done")
    expect(states).toEqual(["detecting", "loading", "translating", "ready"])
  })

  it("ignores stale completion after switching videos", async () => {
    let finishOld!: (value: string) => void
    const oldWork = new Promise<string>(resolve => (finishOld = resolve))
    const states: string[] = []
    const session = new SubtitleSession(state => states.push(`${state.videoId}:${state.status}`))
    const oldRun = session.run("old", async () => oldWork)
    await session.run("new", async () => "new result")
    finishOld("old result")
    await oldRun
    expect(states.at(-1)).toBe("new:ready")
  })

  it("exposes retry after an error", async () => {
    let attempts = 0
    const session = new SubtitleSession(() => {})
    await session.run("video", async () => {
      attempts += 1
      if (attempts === 1)
        throw new Error("caption timeout")
      return "ok"
    })
    expect(session.state.status).toBe("error")
    await session.retry()
    expect(session.state.status).toBe("ready")
    expect(attempts).toBe(2)
  })
})
