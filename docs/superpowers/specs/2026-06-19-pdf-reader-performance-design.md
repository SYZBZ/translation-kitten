# PDF Reader Performance and Responsive Layout Design

## Goal

Make long academic PDFs remain responsive while keeping each source page aligned with its translated page at every supported viewport size.

## Root causes

- Every PDF page proxy and every full-resolution canvas is created at startup.
- Canvas scale is fixed at `1.35`, so the rendered page can be wider than its column and is clipped.
- Source and translation pages live in independent columns, so their vertical positions diverge as translated text grows.
- Translation is started for every extracted line in the document, causing a large request burst and frequent whole-reader React updates.

## Reader architecture

The reader renders an ordered list of paired page rows. Each row owns one source page and its translation panel, so later pages begin after the taller side and remain aligned. A `ResizeObserver` supplies the available source-column width and PDF.js chooses a scale that fits that width without upscaling beyond a comfortable reading size.

Each page row has a lightweight placeholder with the PDF aspect ratio. `IntersectionObserver` promotes rows near the viewport into the mounted set. Mounted rows fetch their page proxy, render their canvas, and extract text. Rows far from the viewport release their canvas and text-layer DOM while retaining extracted segments and translations in the parent state.

## Translation scheduling

The translate button starts a progressive document session. Pages already visible are translated first, followed by extracted pages in page order. Pages not yet extracted enter the queue when their lazy page row becomes ready. Translation concurrency is bounded, results are committed once per page batch, and progress is reported as translated segments over discovered segments. Failures remain retryable and do not stop other pages.

## Responsive behavior

- At wide widths, paired rows use two resizable-looking equal columns with a stable gap.
- At medium widths, the source column receives slightly more space while both sides remain visible.
- Below tablet width, each page row stacks source above translation and the sticky headings collapse into a compact status strip.
- The document never requires a fixed minimum viewport width or horizontal page clipping.

## Experience details

The header shows PDF loading, page discovery, translation progress, completion, and failure states. Translation placeholders identify pages waiting to enter the queue. The existing source/translation synchronized highlight remains available after a page is remounted. Motion is restrained to progress and page-entry feedback so scientific reading stays calm.

## Testing

Unit tests cover responsive scale calculation, near-viewport mount decisions, queue page priority, bounded concurrency inputs, and progressive queue completion. Component tests verify that page pairs share a row and that placeholders render before a page proxy is requested. Existing PDF source and segment-mapping tests remain unchanged.

