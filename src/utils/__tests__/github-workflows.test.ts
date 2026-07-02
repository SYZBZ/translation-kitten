import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

function readWorkflow(name: string) {
  return readFileSync(join(process.cwd(), ".github", "workflows", name), "utf8")
}

function expectWorkflowPermission(
  workflow: string,
  permission: string,
  access: "read" | "write",
) {
  expect(workflow).toMatch(new RegExp(`^\\s{2}${permission}: ${access}\\s*$`, "m"))
}

describe("github workflow hardening", () => {
  it("grants stale action access to mark issues and pull requests", () => {
    const workflow = readWorkflow("stale-issue-pr.yml")

    expectWorkflowPermission(workflow, "contents", "read")
    expectWorkflowPermission(workflow, "issues", "write")
    expectWorkflowPermission(workflow, "pull-requests", "write")
  })

  it("uses the WXT validation bypass that wxt.config.ts reads in release CI", () => {
    const workflow = readWorkflow("release.yml")

    expectWorkflowPermission(workflow, "contents", "write")
    expectWorkflowPermission(workflow, "pull-requests", "write")
    expect(workflow).toMatch(/^ {6}WXT_SKIP_ENV_VALIDATION: true\s*$/m)
    expect(workflow).not.toMatch(/^ {6}SKIP_ENV_VALIDATION: true\s*$/m)
  })

  it("keeps changeset package names aligned with package.json", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { name: string }
    const changesetDir = join(process.cwd(), ".changeset")
    const changesetFiles = readdirSync(changesetDir).filter(file => file.endsWith(".md"))

    for (const file of changesetFiles) {
      const changeset = readFileSync(join(changesetDir, file), "utf8")
      const packageEntries = Array.from(changeset.matchAll(/^"([^"]+)":\s+(patch|minor|major)$/gm))

      for (const [, packageName] of packageEntries) {
        expect(packageName, `${file} targets a package outside this workspace`).toBe(packageJson.name)
      }
    }
  })

  it("does not generate fork release notes from the upstream repository", () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), ".changeset", "config.json"), "utf8")) as {
      changelog: unknown
    }

    expect(config.changelog).toBe(false)
    expect(JSON.stringify(config)).not.toContain("mengxi-ream/read-frog")
  })
})
