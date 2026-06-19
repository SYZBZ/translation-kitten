# Translation Kitten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a locally installable Chrome extension named 翻譯小貓 with side-by-side PDF translation, synchronized source/translation highlighting, reliable YouTube subtitle activation, and optimized context-specific LLM prompts.

**Architecture:** Keep Read Frog's WXT/React provider and translation infrastructure. Add a focused PDF reader entrypoint with pure segment/highlight mapping utilities, and harden the existing subtitle runtime with an explicit generation-safe state machine. Rebrand only the user-facing extension shell and assets while preserving GPL notices.

**Tech Stack:** TypeScript, React 19, WXT, Vitest, Chrome Manifest V3, PDF.js, Tailwind CSS.

---

### Task 1: Rebrand the extension

**Files:**
- Modify: `src/locales/en.yml`
- Modify: `src/locales/zh-TW.yml`
- Modify: `src/locales/zh-CN.yml`
- Modify: `package.json`
- Create: `src/assets/translation-kitten-source.png`
- Modify: `public/icon/*.png`

- [ ] Generate an original reading kitten asset with image2 and copy it into `src/assets`.
- [ ] Change extension name and description strings to 翻譯小貓 / Translation Kitten.
- [ ] Create 16, 32, 48, 96, 128 and 256 px icon files from the generated source.
- [ ] Run the locale and build checks, then commit the branding files.

### Task 2: Add PDF segment mapping with TDD

**Files:**
- Create: `src/utils/pdf/types.ts`
- Create: `src/utils/pdf/segment-mapping.ts`
- Create: `src/utils/pdf/__tests__/segment-mapping.test.ts`

- [ ] Write failing tests showing exact word-range mapping, sentence fallback and unmapped selection behavior.
- [ ] Run `pnpm vitest run src/utils/pdf/__tests__/segment-mapping.test.ts` and confirm failure because the module is missing.
- [ ] Implement `mapSelectionToPeer(selection, segments)` with stable segment ids and optional character ranges.
- [ ] Rerun the focused test and confirm all cases pass.

### Task 3: Add PDF source loading with TDD

**Files:**
- Create: `src/utils/pdf/source.ts`
- Create: `src/utils/pdf/__tests__/source.test.ts`
- Modify: `wxt.config.ts`

- [ ] Write failing tests for HTTP PDF detection, query-string URLs, `file://` URLs, object URLs and non-PDF pages.
- [ ] Implement source classification and safe reader URL construction.
- [ ] Add only the manifest permissions needed for the extension PDF reader and file URL path.
- [ ] Run focused tests and type-check.

### Task 4: Build the PDF reader

**Files:**
- Create: `src/entrypoints/pdf-reader/index.html`
- Create: `src/entrypoints/pdf-reader/main.tsx`
- Create: `src/entrypoints/pdf-reader/app.tsx`
- Create: `src/entrypoints/pdf-reader/pdf-reader.css`
- Create: `src/entrypoints/pdf-reader/use-pdf-document.ts`
- Create: `src/entrypoints/pdf-reader/use-pdf-translation.ts`
- Create: `src/entrypoints/pdf-reader/selection-sync.ts`
- Create: `src/entrypoints/pdf-reader/__tests__/selection-sync.test.ts`

- [ ] Write a failing selection synchronization test before the selection controller exists.
- [ ] Add PDF.js and render page text layers with stable `data-segment-id` attributes.
- [ ] Render a translation column aligned by page and segment, translating visible pages first through the existing provider queue.
- [ ] Apply synchronized highlight ranges in either direction and paragraph fallback for non-bijective model output.
- [ ] Add loading, partial, cancelled and retry states; run focused tests.

### Task 5: Connect PDF actions to the popup

**Files:**
- Create: `src/utils/pdf/open-reader.ts`
- Create: `src/utils/pdf/__tests__/open-reader.test.ts`
- Modify: `src/entrypoints/popup/app.tsx`
- Modify: `src/entrypoints/background/index.ts`

- [ ] Write failing tests for supported PDF tabs and reader URL creation.
- [ ] Add an immediate popup action that opens the extension reader for HTTP/file PDFs.
- [ ] Add a local file picker fallback when direct file access is unavailable.
- [ ] Show actionable unsupported/permission errors instead of leaving clicks unanswered.

### Task 6: Harden YouTube subtitle activation with TDD

**Files:**
- Create: `src/entrypoints/subtitles.content/subtitle-session.ts`
- Create: `src/entrypoints/subtitles.content/__tests__/subtitle-session.test.ts`
- Modify: `src/entrypoints/subtitles.content/runtime.ts`
- Modify: `src/entrypoints/subtitles.content/init-youtube-subtitles.ts`
- Modify: `src/entrypoints/subtitles.content/ui/subtitles-translate-button.tsx`
- Modify: `src/entrypoints/subtitles.content/ui/state-message.tsx`

- [ ] Write failing tests for state transitions, duplicate clicks, stale generations, timeout errors and retry.
- [ ] Implement the session state machine and abort/generation guards.
- [ ] Reinitialize on YouTube SPA navigation and player replacement without duplicate mounts.
- [ ] Make every click show detecting/loading/translating/ready/error and expose retry.
- [ ] Run subtitle-focused tests.

### Task 7: Optimize context-specific prompts with TDD

**Files:**
- Create: `src/utils/prompts/pdf.ts`
- Modify: `src/utils/prompts/translate.ts`
- Modify: `src/utils/prompts/subtitles.ts`
- Create: `src/utils/prompts/__tests__/context-prompts.test.ts`

- [ ] Write failing tests requiring segment preservation, translation-only output, subtitle brevity and no invented explanations.
- [ ] Implement separate webpage, PDF and subtitle prompt builders with explicit token contracts.
- [ ] Validate segment completeness and retry only missing ids.
- [ ] Run prompt and translation processor tests.

### Task 8: Verify and publish

**Files:**
- Modify: `README.md`
- Preserve: `LICENSE`

- [ ] Document local Chrome installation, file URL permission, PDF workflow, YouTube modes, providers and privacy.
- [ ] Run `pnpm test`, `pnpm type-check`, `pnpm lint` and `pnpm build` fresh.
- [ ] Inspect the final manifest and unpacked Chrome output for name, icons, permissions and entrypoints.
- [ ] Commit the complete intended diff, create a private GitHub repository under the authenticated account, push the branch, and report the repository and build artifact paths.

