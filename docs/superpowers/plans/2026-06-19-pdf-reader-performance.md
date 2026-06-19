# PDF Reader Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, paired-page PDF reader that lazily renders long documents and translates visible pages first without blocking the interface.

**Architecture:** Replace independent full-document columns with lazy paired page rows. Keep layout math and translation scheduling in small pure modules, while React components own observation, PDF.js rendering, and progressive UI state.

**Tech Stack:** React 19, TypeScript, PDF.js, IntersectionObserver, ResizeObserver, Vitest, Testing Library, CSS Grid

---

### Task 1: Responsive page geometry

**Files:**
- Create: `src/entrypoints/pdf-reader/pdf-layout.ts`
- Create: `src/entrypoints/pdf-reader/__tests__/pdf-layout.test.ts`
- Modify: `src/entrypoints/pdf-reader/pdf-page.tsx`

- [ ] **Step 1: Write failing tests for a scale that fits the available column and never exceeds the preferred scale**
- [ ] **Step 2: Run `pnpm exec vitest run src/entrypoints/pdf-reader/__tests__/pdf-layout.test.ts --maxWorkers=1` and confirm the missing-module failure**
- [ ] **Step 3: Implement `getFittedPdfViewportScale(pageWidth, availableWidth, preferredScale)` with positive-input guards**
- [ ] **Step 4: Pass measured width into `PdfPage`, render at the fitted CSS size, and preserve device-pixel-ratio canvas sharpness**
- [ ] **Step 5: Rerun the focused test and confirm it passes**

### Task 2: Lazy paired page rows

**Files:**
- Create: `src/entrypoints/pdf-reader/pdf-page-row.tsx`
- Create: `src/entrypoints/pdf-reader/use-near-viewport.ts`
- Create: `src/entrypoints/pdf-reader/__tests__/pdf-page-row.test.tsx`
- Modify: `src/entrypoints/pdf-reader/app.tsx`
- Modify: `src/entrypoints/pdf-reader/pdf-reader.css`

- [ ] **Step 1: Write a component test proving an unobserved row renders a ratio-preserving placeholder without requesting its PDF page**
- [ ] **Step 2: Add a second test proving a near row renders source and translation inside the same page-pair container**
- [ ] **Step 3: Run the focused component test and confirm both behaviors fail before implementation**
- [ ] **Step 4: Implement `useNearViewport` with a `1200px` root margin and an always-mounted fallback when IntersectionObserver is unavailable**
- [ ] **Step 5: Implement `PdfPageRow` to lazily call `document.getPage(pageNumber)`, measure its source panel, and render paired source/translation panels**
- [ ] **Step 6: Replace the eager `Promise.all(document.getPage)` flow and independent columns in `App` with numbered lazy rows**
- [ ] **Step 7: Add responsive paired-grid CSS, remove `body` minimum width, and switch to stacked rows below `820px`**
- [ ] **Step 8: Run the focused component test and confirm it passes**

### Task 3: Progressive translation scheduler

**Files:**
- Create: `src/entrypoints/pdf-reader/pdf-translation-scheduler.ts`
- Create: `src/entrypoints/pdf-reader/__tests__/pdf-translation-scheduler.test.ts`
- Modify: `src/entrypoints/pdf-reader/app.tsx`
- Modify: `src/entrypoints/pdf-reader/pdf-page-row.tsx`

- [ ] **Step 1: Write failing tests proving visible pages sort before non-visible pages and each segment appears once**
- [ ] **Step 2: Write a failing test proving the scheduler returns batches no larger than the configured concurrency**
- [ ] **Step 3: Run the focused scheduler test and confirm the missing behavior**
- [ ] **Step 4: Implement pure `prioritizePdfSegments` and `createPdfTranslationBatches` helpers**
- [ ] **Step 5: Track near-page numbers in `App`, translate batches of four, and commit translation results once per batch**
- [ ] **Step 6: Allow segments discovered during an active session to enter subsequent queue passes without restarting completed work**
- [ ] **Step 7: Display discovered/translated progress and leave failed segments retryable**
- [ ] **Step 8: Run scheduler and PDF component tests and confirm they pass**

### Task 4: Verification and release

**Files:**
- Modify only if verification exposes a scoped defect

- [ ] **Step 1: Run `pnpm type-check`**
- [ ] **Step 2: Run `pnpm lint`**
- [ ] **Step 3: Run `pnpm exec vitest run --maxWorkers=4` and confirm all tests pass**
- [ ] **Step 4: Run `$env:WXT_SKIP_ENV_VALIDATION='true'; pnpm build; pnpm zip`**
- [ ] **Step 5: Inspect `.output/chrome-mv3/pdf-reader.html`, the generated PDF chunk, and the ZIP timestamp**
- [ ] **Step 6: Commit with a conventional message and push `HEAD` to `origin/main`**

