# Checks API Reference

`@webui-rubric/checks` — deterministic check adapters: axe-core accessibility,
Lighthouse performance, pixelmatch visual diff, and structural DOM/CSS/runtime checks.

**Source:** `packages/checks/src/`

---

## Exports overview

### Accessibility (`accessibility/index.ts`)

| Export | Description |
|---|---|
| `runAxeChecks(page)` | Run axe-core on a Playwright page; returns an `AxeCheckResult[]` for each violation found. |
| `accessibilityAdapter` | Pre-built `CheckAdapter` that wires `runAxeChecks` into the check registry. |
| `axeSeverity(impact)` | Map an axe impact string (`critical`, `serious`, etc.) to a Nielsen severity integer (0–4). |
| `AXE_IMPACT_TO_SEVERITY` | Record mapping axe impact labels to severity integers. |
| `AxeCheckResult` | Result type with `score`, `status`, `evidence`, `severity`, `suggested_fix`, and `location`. |

`runAxeChecks` returns one `AxeCheckResult` per axe rule violation, with
`confidence: 'deterministic'` and `evidence_source: 'axe-core'`.

---

### Performance (`performance/index.ts`)

| Export | Description |
|---|---|
| `runLighthouseChecks(url)` | Launch Chrome headless, run Lighthouse, and return `PerformanceCheckResult[]` per Core Web Vital. |
| `PERFORMANCE_METRICS` | Map of Lighthouse audit IDs to their metric definitions (thresholds, fix templates). |
| `scoreFromMetric(auditId, value)` | Translate a raw Lighthouse numeric value to an anchor score (0–4) via the metric's threshold map. |
| `PerformanceCheckResult` | Result type with `score`, `status`, `evidence`, `severity`, `suggested_fix`; `confidence: 'predicted'`. |

Covered metrics: LCP (≤1200ms = 4), FCP (≤1000ms = 4), CLS (≤0.05 = 4),
TBT (≤150ms = 4), and resource efficiency via HAR.

---

### Structural — DOM (`structural/dom-checks.ts`)

| Export | Description |
|---|---|
| `checkHeadingOrder(html)` | Count skipped heading levels; returns `StructuralCheckResult` with 0–4 score. |
| `checkLandmarkUsage(html)` | Count HTML5 landmark elements (`header`, `nav`, `main`, `footer`). |
| `checkLinkDescriptiveness(html)` | Measure percentage of links with generic text ("click here", "read more", etc.). |
| `checkImageAlt(html)` | Verify all `<img>` elements carry non-empty `alt` attributes. |
| `checkFormLabels(html)` | Verify all form controls have associated `<label>` elements. |
| `checkMetaViewport(html)` | Verify presence and correctness of the `<meta name="viewport">` tag. |
| `StructuralCheckResult` | `{ score, evidence, evidence_source, severity, suggested_fix, location }` |

All DOM checks operate on raw HTML strings (no live browser required).

---

### Structural — CSS (`structural/css-checks.ts`)

| Export | Description |
|---|---|
| `checkUniqueColorCount(styles)` | Count distinct color values across computed styles; returns `StructuralCheckResult`. |
| `checkFontFamilyCount(styles)` | Count distinct `font-family` values; returns `StructuralCheckResult`. |
| `checkSpacingConsistency(styles)` | Count distinct margin/padding values to assess design-token adherence. |

---

### Structural — Runtime (`structural/runtime-checks.ts`)

| Export | Description |
|---|---|
| `checkConsoleErrors(entries)` | Count `error`-level console entries captured during page load. |
| `checkResourceCount(har)` | Count total network requests from a HAR log. |

---

### Focus Visible (`structural/focus-visible.ts`)

| Export | Description |
|---|---|
| `checkFocusVisible(page)` | Measure the percentage of interactive elements that have visible `:focus-visible` styles. |

Requires a live Playwright `Page`; returns a `StructuralCheckResult` with the
percentage value as evidence.

---

### Pixel Comparison (`pixelmatch/`)

| Export | Description |
|---|---|
| `runPixelmatch(input)` | Compare two PNG buffers and return diff pixel count and ratio. |
| `runMultiViewportComparison(inputs)` | Run `runPixelmatch` across multiple viewports; returns per-viewport results. |
| `scoreFromDiffRatio(ratio)` | Map a diff ratio (0–1) to an anchor score (0–4). |
| `buildVisualParitySuggestedFix(viewport, ratio)` | Generate a human-readable fix string for a given viewport and diff ratio. |
| `analyzeDiffRegions(diffBuffer, width, height)` | Segment the diff image into horizontal bands of changed pixels. |
| `mapDiffRegionsToElements(regions, page)` | Match diff regions to DOM elements for element-level evidence. |
| `PixelComparisonInput` | `{ referenceBuffer, screenshotBuffer, threshold? }` |
| `PixelComparisonOutput` | `{ diffPixelCount, totalPixelCount, diffRatio, diffBuffer }` |
| `DiffRegion` | `{ y_start, y_end, diff_pixel_count, pct_of_total_diff }` |
| `MappedDiffRegion` | `DiffRegion` extended with `elements: MappedDiffElement[]` |

---

## Usage example

```ts
import {
  runAxeChecks,
  runLighthouseChecks,
  checkHeadingOrder,
  runPixelmatch,
} from '@webui-rubric/checks';

// Accessibility
const axeResults = await runAxeChecks(playwrightPage);

// Performance (Core Web Vitals)
const perfResults = await runLighthouseChecks('https://example.com');

// Structural (from HTML string)
const headingResult = checkHeadingOrder(domSnapshotHtml);

// Visual diff
const diff = await runPixelmatch({ referenceBuffer, screenshotBuffer, threshold: 0.1 });
```

**Source:** `packages/checks/src/`
