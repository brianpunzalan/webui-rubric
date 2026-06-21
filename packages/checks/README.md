# @webui-rubric/checks

Deterministic check adapters for `webui-rubric`. Implements all bound checks referenced by the V1 rubric definition, grouped into four families: axe-core (accessibility), Lighthouse (performance), pixelmatch (pixel comparison), and structural DOM/CSS checks (heading hierarchy, landmark elements, link text, image alt text, form labels, viewport meta, color palette, font families, spacing consistency, console errors, and HAR resource count).

Every exported check function returns a result object containing `score` (0–4 anchor scale), `status`, `evidence` (≤300 chars), `evidence_source` (the `check_family.check_id`), `severity` (Nielsen 0–4), `suggested_fix`, and `confidence`. All scores use the anchor scale defined in `@webui-rubric/core`.

## Installation

```bash
npm install @webui-rubric/checks
# or
pnpm add @webui-rubric/checks
```

Chrome/Chromium must be available on `PATH` for Lighthouse performance checks.

## Dependencies

| Dependency              | Version       | Purpose                                                      |
| ----------------------- | ------------- | ------------------------------------------------------------ |
| `lighthouse`            | `^12.0.0`     | Core Web Vitals and lab performance metrics                  |
| `chrome-launcher`       | `^1.1.0`      | Spawns a Chrome process for Lighthouse                       |
| `pixelmatch`            | `^6.0.0`      | Pixel-level image diff algorithm                             |
| `pngjs`                 | `^7.0.0`      | PNG parsing and writing                                      |
| `@webui-rubric/core`    | `workspace:*` | Shared types (`CheckResult`, `AnchorScore`, `TargetCapture`) |
| `@webui-rubric/capture` | `workspace:*` | `ElementLocation` type (used in `mapDiffRegionsToElements`)  |

## Package Interactions

```
@webui-rubric/checks
├── @webui-rubric/core     (types: CheckResult, AnchorScore, ComputedStylesSnapshot, etc.)
└── @webui-rubric/capture  (ElementLocation — for diff-region-to-DOM-element mapping)

Consumed by:
  @webui-rubric/cli        (imports all check functions and runs them during evaluate)
```

`@webui-rubric/cli` is the only runtime caller. It imports individual check functions, runs them against captured artifacts from `@webui-rubric/capture`, maps results to rubric sub-criteria, and feeds scores into `@webui-rubric/core`'s scoring engine.

---

## API Reference

### Accessibility — axe-core (`src/accessibility/`)

#### `runAxeChecks(page): Promise<AxeCheckResult[]>`

Runs axe-core against a live Playwright page. Returns one finding per accessibility violation. If no violations are found, returns a single passing finding (`score: 4`). If axe-core cannot execute (e.g., browser error), returns `status: 'tool_unavailable'`.

**Input:** A Playwright `Page` object (the live page — must still be open).

**Returns:** `AxeCheckResult[]`

```typescript
interface AxeCheckResult {
  score: number | null; // 0 (violation) or 4 (pass)
  status: 'scored' | 'not_applicable' | 'tool_unavailable';
  evidence: string; // "{violation.id}: {violation.help}" ≤300 chars
  evidence_source: string; // "axe.{violation.id}"
  severity: number; // mapped from axe impact via AXE_IMPACT_TO_SEVERITY
  suggested_fix: string[]; // from axe failureSummary or help text
  location: {
    type: 'selector';
    selector: string | null;
    bounding_box: null;
    viewport: null;
  } | null;
  confidence: 'deterministic';
}
```

```typescript
import { runAxeChecks } from '@webui-rubric/checks';

const findings = await runAxeChecks(page);
// Each violation → { score: 0, evidence_source: "axe.color-contrast", severity: 3, ... }
// No violations  → [{ score: 4, evidence_source: "axe.all-rules", ... }]
```

#### `accessibilityAdapter`

Metadata object describing the axe-core check family:

```typescript
const accessibilityAdapter = {
  check_family: 'axe',
  check_id: 'all-rules',
  full_id: 'axe.all-rules',
};
```

#### `axeSeverity(impact?): number`

Maps an axe-core impact string to a Nielsen severity integer. Unknown or undefined impact maps to `2` (moderate).

```typescript
import { axeSeverity } from '@webui-rubric/checks';

axeSeverity('critical'); // 4
axeSeverity('serious'); // 3
axeSeverity('moderate'); // 2
axeSeverity('minor'); // 1
axeSeverity(undefined); // 2 (default)
```

#### `AXE_IMPACT_TO_SEVERITY`

```typescript
const AXE_IMPACT_TO_SEVERITY: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
};
```

---

### Performance — Lighthouse (`src/performance/`)

#### `runLighthouseChecks(url): Promise<PerformanceCheckResult[]>`

Launches Chrome via `chrome-launcher`, runs Lighthouse in performance-only mode (desktop, no CPU/network throttling), and returns findings for each tracked metric. Returns one `PerformanceCheckResult` per metric in `PERFORMANCE_METRICS`. If Lighthouse fails entirely, all metrics are returned with `status: 'tool_unavailable'`.

Lighthouse is **independent of the Playwright capture engine** — it always runs on Chromium. To keep performance metrics working even when capture uses Firefox/WebKit (and when no system Chrome is installed), `chrome-launcher` is pointed at Playwright's bundled Chromium via `chromiumExecutablePath()` from `@webui-rubric/capture`, falling back to `chrome-launcher`'s default discovery when that path can't be resolved.

Confidence is always `'predicted'` — Lighthouse measures lab (simulated) conditions, not real-user performance.

```typescript
interface PerformanceCheckResult {
  score: number | null;
  status: 'scored' | 'not_applicable' | 'tool_unavailable';
  evidence: string; // "{metric_id}: {value}{unit} (score: N/4)"
  evidence_source: string; // "lighthouse.{metric_id}"
  severity: number; // 4 - score
  suggested_fix: string[];
  location: null;
  confidence: 'predicted';
}
```

```typescript
import { runLighthouseChecks } from '@webui-rubric/checks';

const metrics = await runLighthouseChecks('https://example.com');
// [
//   { evidence_source: 'lighthouse.lcp', score: 3, evidence: 'lcp: 2100.0ms (score: 3/4)', ... },
//   { evidence_source: 'lighthouse.fcp', score: 4, ... },
//   ...
// ]
```

#### `PERFORMANCE_METRICS`

Array of metric definitions tracked by Lighthouse. Each entry describes one Core Web Vital or performance metric:

| `metric_id` | `lighthouse_audit_id`      | Unit | Score 4 threshold |
| ----------- | -------------------------- | ---- | ----------------- |
| `lcp`       | `largest-contentful-paint` | ms   | ≤1200ms           |
| `fcp`       | `first-contentful-paint`   | ms   | ≤1000ms           |
| `cls`       | `cumulative-layout-shift`  | —    | ≤0.05             |
| `tbt`       | `total-blocking-time`      | ms   | ≤150ms            |

Each entry also includes `fix_template` (a string with `{value}` placeholder) and `thresholds` (the anchor threshold map).

#### `scoreFromMetric(value, thresholds): number`

Maps a raw numeric metric value to a 0–4 anchor score by evaluating the threshold map. Used internally by `runLighthouseChecks`.

```typescript
import { scoreFromMetric, PERFORMANCE_METRICS } from '@webui-rubric/checks';

const lcpMetric = PERFORMANCE_METRICS.find((m) => m.metric_id === 'lcp')!;
scoreFromMetric(2100, lcpMetric.thresholds); // 3 (≤2500ms)
scoreFromMetric(800, lcpMetric.thresholds); // 4 (≤1200ms)
```

---

### Pixel comparison — pixelmatch (`src/pixelmatch/`)

#### `runPixelmatch(input): PixelComparisonOutput`

Synchronously compares a screenshot PNG against a reference PNG using `pixelmatch`. Optionally writes the diff PNG to disk. Returns diff statistics, detected diff regions, and the in-memory diff PNG (`diff_buffer`) so composites and region crops can be built without a disk round-trip.

```typescript
interface PixelComparisonInput {
  screenshotBuffer: Buffer; // PNG buffer from capturePage
  referenceBuffer: Buffer; // PNG buffer from loadReferenceImage
  threshold?: number; // Anti-alias tolerance 0–1. Default: 0.1
  diffOutputPath?: string | null; // Write diff PNG here if set
}

interface PixelComparisonOutput {
  diff_pixel_count: number;
  total_pixel_count: number;
  diff_ratio: number; // diff_pixel_count / total_pixel_count
  threshold: number; // threshold used
  diff_png_path: string | null;
  diff_buffer: Buffer; // in-memory diff PNG (always present)
  screenshot_dimensions: { width: number; height: number };
  reference_dimensions: { width: number; height: number };
  diff_regions: DiffRegion[];
}
```

**Precondition:** Screenshot and reference images must have identical pixel dimensions. Use `validateReferenceDimensions` from `@webui-rubric/capture` to check before calling.

```typescript
import { runPixelmatch } from '@webui-rubric/checks';
import { loadReferenceImage } from '@webui-rubric/capture';

const ref = loadReferenceImage('./designs/homepage.png');
const screenshotBuffer = captureResult.screenshots.get('desktop')!;

const result = runPixelmatch({
  screenshotBuffer,
  referenceBuffer: ref.buffer,
  threshold: 0.1,
  diffOutputPath: './debug/diff-desktop.png',
});

console.log(`Diff: ${(result.diff_ratio * 100).toFixed(2)}%`);
```

#### `scoreFromDiffRatio(ratio): number`

Maps a `diff_ratio` (0–1) to a 0–4 anchor score:

| diff_ratio | Score                 |
| ---------- | --------------------- |
| ≤ 0.5%     | 4 (Excellent)         |
| ≤ 1%       | 3 (Good)              |
| ≤ 5%       | 2 (Needs Improvement) |
| ≤ 10%      | 1 (Poor)              |
| > 10%      | 0 (Critical)          |

```typescript
import { scoreFromDiffRatio } from '@webui-rubric/checks';

scoreFromDiffRatio(0.003); // 4
scoreFromDiffRatio(0.08); // 1
scoreFromDiffRatio(0.15); // 0
```

#### `analyzeDiffRegions(diffData, width, height, diffColor): DiffRegion[]`

Segments a pixelmatch diff buffer into contiguous vertical bands of changed pixels. Used internally by `runPixelmatch`.

```typescript
interface DiffRegion {
  y_start: number;
  y_end: number;
  diff_pixel_count: number;
  pct_of_total_diff: number;
}
```

#### `mapDiffRegionsToElements(regions, elementLocations, refRgba, refWidth): MappedDiffRegion[]`

Maps pixel diff regions to the DOM elements that overlap them. Uses element bounding boxes from `captureElementLocations` and reference image RGBA data to compute style differences. Returns enriched diff regions with matching element info.

```typescript
import { mapDiffRegionsToElements } from '@webui-rubric/checks';

const mappedRegions = mapDiffRegionsToElements(
  result.diff_regions,
  captureResult.element_locations,
  refRgba, // Uint8Array of reference image RGBA data
  refWidth,
);
// Each region has .elements: [{ selector, tagName, styleDiffs: [...] }]
```

`MappedDiffRegion` and `MappedDiffElement` are re-exported from `@webui-rubric/core`.

#### `buildVisualParitySuggestedFix(input): string[]`

Generates human-readable suggested fixes based on diff region analysis. Used by `@webui-rubric/cli` to populate `SubCriterionFinding.suggested_fix` for visual parity sub-criteria.

```typescript
interface VisualParityFixInput {
  mappedRegions: MappedDiffRegion[];
  diffRatio: number;
}
```

#### `runMultiViewportComparison(inputs): ViewportComparisonResult[]`

Runs `runPixelmatch` across multiple viewports in one call. Useful when comparing several viewports against their respective reference images.

```typescript
interface ViewportComparisonInput {
  viewport: string;
  screenshotBuffer: Buffer;
  referenceBuffer: Buffer;
  threshold?: number;
  diffOutputPath?: string | null;
}
```

#### `buildSideBySide(referenceBuffer, screenshotBuffer, diffBuffer): Buffer`

Stitches the reference, screenshot, and diff PNGs horizontally into a single composite image, always in the order **reference | screenshot | diff**, with a labeled band and gutter above each panel as a visual separator. The three inputs must share identical pixel dimensions (guaranteed by the dimension-match check upstream). Returns the composite as a PNG `Buffer`. Used by `@webui-rubric/cli` to build the `composite-<viewport>.png` in the evaluation-results artifact bundle.

#### `cropStrip(sourceBuffer, yStart, yEnd): Buffer`

Crops a full-width horizontal strip `[yStart, yEnd)` from a PNG buffer, clamping the bounds to the source height. Diff regions are horizontal bands, so this isolates the rows that changed most. Returns the cropped strip as a PNG `Buffer`; used to render the per-region `regions/region-<viewport>-<n>.png` crops in the artifact bundle.

---

### Structural — DOM checks (`src/structural/dom-checks.ts`)

All DOM check functions take a raw HTML string (the output of `captureDomSnapshot`) and return a `StructuralCheckResult`:

```typescript
interface StructuralCheckResult {
  score: number; // 0–4 anchor scale
  evidence: string; // ≤300 chars
  evidence_source: string; // "dom.{check-id}"
  severity: number; // 4 - score
  suggested_fix: string[];
  location: {
    type: 'selector';
    selector: string | null;
    bounding_box: null;
    viewport: null;
  } | null;
}
```

#### `checkHeadingOrder(html): StructuralCheckResult`

Counts heading level skips (e.g., `h1` followed by `h3`). Maps to `evidence_source: 'dom.heading-order'`.

| Skips | Score |
| ----- | ----- |
| 0     | 4     |
| 1     | 3     |
| 2     | 2     |
| 3–5   | 1     |
| >5    | 0     |

#### `checkLandmarkUsage(html): StructuralCheckResult`

Counts the presence of the four core HTML5 semantic landmark elements: `<main>`, `<nav>`, `<header>`, `<footer>`. Maps to `evidence_source: 'dom.landmark-usage'`.

| Landmarks found | Score |
| --------------- | ----- |
| ≥4              | 4     |
| 3               | 3     |
| 2               | 2     |
| 1               | 1     |
| 0               | 0     |

#### `checkLinkDescriptiveness(html): StructuralCheckResult`

Measures the percentage of links containing generic text such as "click here", "read more", "learn more", "here". Maps to `evidence_source: 'dom.link-descriptiveness'`.

| Generic link % | Score |
| -------------- | ----- |
| ≤1%            | 4     |
| ≤5%            | 3     |
| ≤15%           | 2     |
| ≤50%           | 1     |
| >50%           | 0     |

#### `checkImageAlt(html): StructuralCheckResult`

Checks that `<img>` elements have non-empty `alt` attributes. Maps to `evidence_source: 'dom.image-alt'`.

#### `checkFormLabels(html): StructuralCheckResult`

Verifies that every `<input>`, `<select>`, and `<textarea>` is associated with a `<label>`. Maps to `evidence_source: 'dom.form-labels'`.

#### `checkMetaViewport(html): StructuralCheckResult`

Checks for the presence and correctness of `<meta name="viewport" content="width=device-width, initial-scale=1">`. Maps to `evidence_source: 'dom.meta-viewport'`.

---

### Structural — CSS checks (`src/structural/css-checks.ts`)

All CSS check functions take a `ComputedStylesSnapshot` (from `captureComputedStyles`) and return a `CssCheckResult`:

```typescript
interface CssCheckResult {
  score: number;
  evidence: string;
  evidence_source: string; // "css.{check-id}"
  severity: number;
  suggested_fix: string[];
  location: null;
}
```

#### `checkUniqueColorCount(styles): CssCheckResult`

Counts distinct colors across `color`, `background-color`, and `border-color` properties of all elements. Fewer colors = better design system consistency. Maps to `evidence_source: 'css.unique-color-count'`.

| Distinct colors | Score |
| --------------- | ----- |
| ≤5              | 4     |
| ≤10             | 3     |
| ≤20             | 2     |
| ≤30             | 1     |
| >30             | 0     |

#### `checkFontFamilyCount(styles): CssCheckResult`

Counts distinct primary font families across all elements. Fewer families = better typographic consistency. Maps to `evidence_source: 'css.font-family-count'`.

| Distinct font families | Score |
| ---------------------- | ----- |
| ≤2                     | 4     |
| ≤3                     | 3     |
| ≤4                     | 2     |
| ≤6                     | 1     |
| >6                     | 0     |

#### `checkSpacingConsistency(styles): CssCheckResult`

Counts distinct spacing values (`padding`, `margin` properties) across all elements. Fewer variants = more consistent spacing. Maps to `evidence_source: 'css.spacing-consistency'`.

| Spacing variants | Score |
| ---------------- | ----- |
| ≤5               | 4     |
| ≤15              | 3     |
| ≤30              | 2     |
| ≤50              | 1     |
| >50              | 0     |

---

### Structural — Runtime checks (`src/structural/runtime-checks.ts`)

#### `checkConsoleErrors(entries): RuntimeCheckResult`

Counts `console.error` and `console.warn` entries captured during page load. Takes `CapturedConsoleEntry[]` from `setupConsoleCapture`. Maps to `evidence_source: 'console.error-count'`.

| Errors | Score |
| ------ | ----- |
| 0      | 4     |
| ≤2     | 3     |
| ≤5     | 2     |
| ≤10    | 1     |
| >10    | 0     |

#### `checkResourceCount(har): RuntimeCheckResult`

Counts total network requests in the HAR. Fewer requests = better resource efficiency. Takes the raw HAR object from `readHarFile`. Maps to `evidence_source: 'har.resource-count'`.

| Resources | Score |
| --------- | ----- |
| ≤25       | 4     |
| ≤40       | 3     |
| ≤60       | 2     |
| ≤100      | 1     |
| >100      | 0     |

---

### Focus visible (`src/structural/focus-visible.ts`)

#### `checkFocusVisible(html): FocusVisibleResult`

Scans the DOM HTML for `:focus-visible` CSS rule references to estimate the percentage of interactive elements with keyboard focus indicators. Maps to `evidence_source: 'playwright.focus-visible'`.

| % with focus indicators | Score |
| ----------------------- | ----- |
| >90%                    | 4     |
| ≤90%                    | 3     |
| ≤50%                    | 2     |
| ≤25%                    | 1     |
| 0                       | 0     |

---

## Check-to-Sub-Criterion Mapping

Each rubric sub-criterion is bound to exactly one `check_family.check_id`. This table maps the check IDs exported from this package to their corresponding sub-criteria:

| `evidence_source`             | Sub-criterion ID                        | Dimension         |
| ----------------------------- | --------------------------------------- | ----------------- |
| `axe.color-contrast`          | `accessibility.color-contrast`          | accessibility     |
| `dom.image-alt`               | `accessibility.image-alt`               | accessibility     |
| `dom.form-labels`             | `accessibility.form-labels`             | accessibility     |
| `axe.aria-valid-attr`         | `accessibility.aria-valid`              | accessibility     |
| `dom.heading-order`           | `accessibility.heading-order`           | accessibility     |
| `dom.heading-order`           | `content_ia.heading-structure`          | content_ia        |
| `dom.landmark-usage`          | `content_ia.landmark-usage`             | content_ia        |
| `playwright.focus-visible`    | `usability.focus-visible`               | usability         |
| `dom.link-descriptiveness`    | `usability.link-descriptiveness`        | usability         |
| `lighthouse.lcp`              | `performance.lcp`                       | performance       |
| `lighthouse.fcp`              | `performance.fcp`                       | performance       |
| `lighthouse.cls`              | `performance.cls`                       | performance       |
| `lighthouse.tbt`              | `performance.tbt`                       | performance       |
| `har.resource-count`          | `performance.resource-efficiency`       | performance       |
| `console.error-count`         | `code_quality.console-errors`           | code_quality      |
| `css.unique-color-count`      | `visual_design.color-harmony`           | visual_design     |
| `css.unique-color-count`      | `consistency.color-count`               | consistency       |
| `css.font-family-count`       | `consistency.font-family-count`         | consistency       |
| `css.spacing-consistency`     | `layout.spacing-consistency`            | layout            |
| `dom.meta-viewport`           | `layout.viewport-meta`                  | layout            |
| `pixelmatch.viewport=desktop` | `visual_design.visual-parity-desktop`   | visual_design     |
| `pixelmatch.viewport=mobile`  | `layout.visual-parity-mobile`           | layout            |
| `pixelmatch.viewport=desktop` | `brand.visual-parity-brand`             | brand             |
| `pixelmatch.viewport=desktop` | `consistency.visual-parity-consistency` | consistency       |
| `playwright.focus-visible`    | `microinteractions.focus-states`        | microinteractions |

---

## Usage Example

```typescript
import {
  checkHeadingOrder,
  checkLandmarkUsage,
  checkUniqueColorCount,
  checkFontFamilyCount,
  checkConsoleErrors,
  checkResourceCount,
  runLighthouseChecks,
} from '@webui-rubric/checks';

// After capturePage:
const domChecks = {
  'dom.heading-order': checkHeadingOrder(captureResult.dom_snapshot),
  'dom.landmark-usage': checkLandmarkUsage(captureResult.dom_snapshot),
};

const cssChecks = {
  'css.unique-color-count': checkUniqueColorCount(captureResult.computed_styles),
  'css.font-family-count': checkFontFamilyCount(captureResult.computed_styles),
};

const runtimeChecks = {
  'console.error-count': checkConsoleErrors(captureResult.console_errors),
  'har.resource-count': checkResourceCount(captureResult.har),
};

// Lighthouse (async, launches Chrome)
const lighthouseResults = await runLighthouseChecks(url);

// Map to sub-criteria in V1_RUBRIC...
```
