import { readFileSync } from "node:fs"
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
})
