# @webui-rubric/cli

End-user CLI for `webui-rubric`. Orchestrates the full evaluation pipeline: loads and validates the project config, runs the Playwright capture pipeline (`@webui-rubric/capture`), runs all deterministic checks (`@webui-rubric/checks`), scores dimensions and computes the composite using the V1 rubric (`@webui-rubric/core`), assembles and validates the `EvaluationResult` JSON artifact, and routes output to stdout or a file. Also provides `version`, `validate-config`, and `check-tools` utility commands.

## Installation

```bash
# Global install
npm install -g @webui-rubric/cli

# Or run directly with npx
npx @webui-rubric/cli evaluate https://example.com
```

### Prerequisites

- **Node.js** >= 20 LTS
- **Playwright Chromium** (for browser capture): `npx playwright install chromium`
- **Chrome/Chromium** on `PATH` (for Lighthouse performance checks)
- _Optional:_ to capture with a non-Chromium engine, install it once with
  `npx playwright install firefox` (or `webkit`) and pass `--browser firefox`.
  Lighthouse performance metrics always run on Chromium regardless of the
  capture engine; if Chromium is unavailable, those metrics are excluded and the
  CLI logs a degradation warning (the performance dimension is then scored from
  resource-efficiency only).

## Dependencies

| Dependency              | Version       | Purpose                                                                                  |
| ----------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| `commander`             | `^13.0.0`     | CLI argument parsing and command definitions                                             |
| `yaml`                  | `^2.6.0`      | Parses `.webui-rubric.yml` configuration files                                           |
| `@webui-rubric/core`    | `workspace:*` | Rubric definition, scoring math, config validation, redaction, output validation, logger |
| `@webui-rubric/capture` | `workspace:*` | Headless browser pipeline (screenshots, DOM, HAR, styles)                                |
| `@webui-rubric/checks`  | `workspace:*` | All deterministic check adapters                                                         |

## Package Interactions

```
@webui-rubric/cli
├── @webui-rubric/core     (V1_RUBRIC, scoring, validateProjectConfig, validateOutput,
│                            redactHarHeaders, redactDomSnapshot, logger, loop utilities)
├── @webui-rubric/capture  (capturePage, loadReferenceImage, inferDpr)
└── @webui-rubric/checks   (checkHeadingOrder, checkLandmarkUsage, ..., runAxeChecks,
                             runLighthouseChecks, runPixelmatch, mapDiffRegionsToElements, ...)
```

`@webui-rubric/cli` is the only package that has no consumers — it is the end-user entry point. All imports from the other packages are done lazily (dynamic `import()`) inside command handlers to avoid circular dependency issues at module load time.

---

## Commands

### `evaluate <url>` (default command)

Runs a full deterministic evaluation of a live web UI against the 10-dimension rubric.

```bash
webui-rubric evaluate https://example.com [options]
```

`<url>` must be a fully qualified, publicly reachable URL.

#### Options

| Flag                          | Type    | Default             | Description                                                                     |
| ----------------------------- | ------- | ------------------- | ------------------------------------------------------------------------------- |
| `--config <path>`             | string  | `.webui-rubric.yml` | Project configuration file path                                                 |
| `--out <path>`                | string  | —                   | Write JSON artifact to file (default: stdout)                                   |
| `--reference <path>`          | string  | —                   | Reference design PNG for pixel comparison                                       |
| `--reference-viewport <name>` | string  | `desktop`           | Viewport the reference image represents                                         |
| `--viewports <list>`          | string  | `desktop,mobile`    | Comma-separated viewport names to capture                                       |
| `--browser <engine>`          | string  | `chromium`          | Playwright capture engine: `chromium`, `firefox`, or `webkit`                   |
| `--debug-dir <path>`          | string  | —                   | Persist raw debug artifacts (screenshots, reference image, DOM, HAR, diff PNGs) |
| `--artifact-dir <path>`       | string  | —                   | Write a curated evaluation-results bundle (requires `--reference`)              |
| `--iteration <n>`             | integer | —                   | Loop iteration index (for Evaluator/Generator loops)                            |
| `--previous-composite <n>`    | float   | —                   | Previous run's composite score (for delta computation)                          |
| `--attempted-fixes <path>`    | string  | —                   | Path to JSON array of attempted fix hashes (oscillation prevention)             |
| `--allow-overrun`             | boolean | `false`             | Permit iterations beyond `iteration_cap`                                        |
| `--allow-tool-version-drift`  | boolean | `false`             | Proceed when installed tool versions differ from rubric pins                    |
| `--no-redact`                 | boolean | `false`             | Disable HAR/DOM/evidence redaction                                              |
| `--log-level <level>`         | string  | `info`              | Log verbosity: `debug`, `info`, `warn`, `error`                                 |
| `-q, --quiet`                 | boolean | `false`             | Suppress all logs below `error`                                                 |

#### Exit codes

| Code | Meaning                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------- |
| `0`  | Success — JSON artifact emitted                                                                    |
| `1`  | Runtime error (target unreachable, tool crash, schema validation failure)                          |
| `2`  | Configuration error (invalid config, weights don't sum to 100, missing anchors)                    |
| `3`  | Tool version mismatch (installed version ≠ rubric pin; use `--allow-tool-version-drift` to bypass) |
| `4`  | Iteration cap exceeded (use `--allow-overrun` to bypass)                                           |
| `5`  | Precondition failure (auth wall detected, server returned 4xx/5xx, page settlement timeout)        |

---

### `version [--json]`

Prints the CLI version, rubric version, and pinned tool versions.

```bash
webui-rubric version
# CLI: 0.1.7  Rubric: 1.0.0
# axe-core: 4.10.2  lighthouse: 12.2.1  pixelmatch: 7.1.0  playwright: 1.52.0

webui-rubric version --json
# { "cli": "0.1.7", "rubric": "1.0.0", "tools": { ... } }
```

---

### `validate-config [--config <path>]`

Validates a `.webui-rubric.yml` project configuration file without running an evaluation. Reports all validation errors to stderr.

```bash
webui-rubric validate-config
# ✓ Config valid

webui-rubric validate-config --config custom.yml
# ✗ weights: Weights must sum to 100, got 95
```

Exit codes: `0` (valid), `2` (invalid).

---

### `check-tools [--json]`

Verifies that the installed versions of axe-core, Lighthouse, pixelmatch, and playwright match the rubric's pinned versions. Use this to diagnose exit-code `3` from `evaluate`.

```bash
webui-rubric check-tools
# ✓ axe-core:    pinned=4.10.2 resolved=4.10.2
# ✓ lighthouse:  pinned=12.2.1 resolved=12.2.1
# ✗ pixelmatch:  pinned=7.1.0  resolved=6.0.0

webui-rubric check-tools --json
# { "axe-core": { "pinned": "4.10.2", "resolved": "4.10.2", "match": true }, ... }
```

Exit codes: `0` (all match), `3` (one or more mismatches).

---

## Output Routing

The routing contract depends on whether `--out` is specified:

| Mode                | stdout            | stderr                  |
| ------------------- | ----------------- | ----------------------- |
| No `--out`          | **JSON artifact** | Logs + one-line summary |
| With `--out <file>` | One-line summary  | Logs only               |

**One-line summary format:**

```
score=82 blocking=0 issues=5 ship_ready=true
```

---

## Evaluation-results artifact (`--artifact-dir`)

When `--artifact-dir <path>` is supplied **and** a reference-image comparison ran (`--reference`), the CLI writes a self-contained bundle the Evaluator/Generator agent can both read and view. The directory is created at mode `0700`, and the result JSON gains an optional `artifact` block whose paths are relative to the bundle directory.

Per compared viewport the bundle contains:

```
<artifact-dir>/
  reference-<viewport>.png           # the supplied reference image
  screenshot-<viewport>.png          # the captured screenshot it was compared against
  diff-<viewport>.png                # pixelmatch diff output
  composite-<viewport>.png           # side-by-side: reference | screenshot | diff
  regions/region-<viewport>-<n>.png  # crops of the largest diff regions
  manifest.json                      # scores + verdict, top issues + fixes, pixel-diff metrics, iteration context
  report.html                        # offline HTML report binding the visuals to the data
```

`--debug-dir` is a raw dump; `--artifact-dir` is the curated, manifest-described bundle. The two flags are independent and may be used together. If `--artifact-dir` is set without `--reference`, bundle generation is skipped silently. The bundle is assembled by the `@webui-rubric/cli` artifact module (`writeArtifact` / `buildManifest` / `buildReportHtml`), reusing `buildSideBySide` and `cropStrip` from `@webui-rubric/checks`.

---

## Configuration File

Create `.webui-rubric.yml` in your project root (or pass `--config <path>`). All fields are optional — unset fields use the defaults shown below.

```yaml
# Dimension weights — must sum to 100
# Accessibility has a weight floor of 10; include it in weight_overrides_ack to override
weights:
  visual_design: 10
  layout: 10
  usability: 12
  accessibility: 15 # floor: 10
  content_ia: 8
  performance: 12
  code_quality: 8
  brand: 5
  consistency: 10
  microinteractions: 10

# Include a dimension ID here to acknowledge overriding its weight floor
weight_overrides_ack: []

# Toggle blocking status of individual sub-criteria
blocking_overrides:
  accessibility.color-contrast: true # default is already true for WCAG sub-criteria

# Viewport dimensions (pixels)
viewports:
  desktop:
    width: 1280
    height: 800
  mobile:
    width: 375
    height: 812
  custom:
    tablet:
      width: 768
      height: 1024

# Reference images for pixel comparison (viewport name → PNG path)
reference_images:
  desktop: ./designs/homepage-desktop.png
  mobile: ./designs/homepage-mobile.png

# What to do when reference dimensions don't match the screenshot
reference_image_mismatch_policy: fail-fast # or "resize"

# pixelmatch anti-alias tolerance (0–1)
pixelmatch_threshold: 0.1

# What to do when a check tool is not available
tool_fallback_policy: fail-fast # or "mark-unavailable"

# Maximum evaluation loop iterations before CLI refuses to proceed
iteration_cap: 5

# Composite score threshold for ship_ready = true
ship_threshold: 75

# Maximum entries in top_issues array
top_issues_cap: 10

# Network idle + navigation timeout in ms
settle_timeout_ms: 30000

# Default true — redacts HAR headers, POST bodies, and input values
redaction: true

# Capture configuration
capture:
  # Playwright engine: chromium (default), firefox, or webkit.
  # Non-default engines require a one-time `npx playwright install <engine>`.
  browser: chromium
  # Cookie consent banner handling
  auto_dismiss: true
  dismiss_selectors:
    - '[aria-label*="accept" i][aria-label*="cookie" i]'
    - '#onetrust-accept-btn-handler'

# Pixel comparison configuration
pixel_comparison:
  mask_selectors:
    - '.dynamic-carousel'
    - '[data-ad]'
  mask_color: '#FF00FF'
  device_pixel_ratio: auto # or a number: 1, 2, etc.

# Add custom sub-criteria to existing dimensions
custom_sub_criteria:
  - dimension: usability
    id: usability.custom-form-validation
    name: Custom Form Validation Check
    description: Checks for inline validation patterns
    bound_check:
      check_family: dom
      check_id: custom-form-validation
      full_id: dom.custom-form-validation
    anchors:
      - score: 0
        label: Critical
        description: No validation present
        threshold: { operator: eq, value: 0, min: null, max: null }
      - score: 1
        label: Poor
        description: Minimal validation
        threshold: { operator: eq, value: 1, min: null, max: null }
      - score: 2
        label: Needs Improvement
        description: Basic validation
        threshold: { operator: eq, value: 2, min: null, max: null }
      - score: 3
        label: Good
        description: Good validation patterns
        threshold: { operator: eq, value: 3, min: null, max: null }
      - score: 4
        label: Excellent
        description: Comprehensive validation
        threshold: { operator: eq, value: 4, min: null, max: null }
    blocking_if_zero: false
```

---

## Evaluation Pipeline

When `evaluate` runs, it follows this sequence:

1. **Load and validate config** — Reads `.webui-rubric.yml`, validates with `validateProjectConfig`, merges with rubric defaults, and validates weight constraints.

2. **Check iteration cap** — If `--iteration` is set and exceeds `iteration_cap`, exit code `4` (unless `--allow-overrun`).

3. **Resolve DPR** — If `--reference` is supplied, reads the reference image and calls `inferDpr` to determine the device scale factor. Falls back to the config value or `1`.

4. **Capture phase** — Calls `capturePage(url, options)` which:
   - Launches the headless Playwright engine selected by `--browser` / `capture.browser` (default Chromium)
   - Navigates, settles, dismisses consent banners
   - Injects stabilization CSS
   - Captures screenshots at each viewport
   - Extracts DOM, computed styles, element locations, console errors, HAR

5. **Apply redaction** — If enabled (default), calls `redactHarHeaders` and `redactDomSnapshot` on the captured artifacts.

6. **Run structural and runtime checks** — Synchronously on the captured artifacts:
   - DOM: `checkHeadingOrder`, `checkLandmarkUsage`, `checkLinkDescriptiveness`, `checkImageAlt`, `checkFormLabels`, `checkMetaViewport`
   - CSS: `checkUniqueColorCount`, `checkFontFamilyCount`, `checkSpacingConsistency`
   - Runtime: `checkConsoleErrors`, `checkResourceCount`

7. **Run Lighthouse** — Async. Launches Chrome, runs performance audit, extracts LCP, FCP, CLS, TBT metrics. Failure is non-fatal (findings marked `tool_unavailable`).

8. **Run pixel comparison** — If `--reference` is supplied, calls `runPixelmatch` and `mapDiffRegionsToElements`. Dimension mismatch triggers `tool_unavailable` for visual-parity sub-criteria.

9. **Score dimensions** — Maps check results to rubric sub-criteria, calls `buildDimensionResult` for each dimension, then `computeCompositeScore`.

10. **Build blocking list** — Collects sub-criteria with `score === 0` and `blocking_if_zero: true`.

11. **Build top issues** — Ranks all imperfect findings by `priority_score = dimension_weight × severity`, filters out hashes in `--attempted-fixes`, caps at `top_issues_cap`.

12. **Detect loop state** — Computes `delta = composite - previousComposite` and sets `no_progress = |delta| < 3`.

13. **Validate output** — Calls `validateOutput` against the Zod schema. Exits code `1` if invalid — no partial JSON.

14. **Persist debug artifacts** — If `--debug-dir` is set, writes screenshots, the reference image (`reference-<viewport>.png`), `dom-snapshot.html`, `recording.har`, `console-errors.json`, and diff PNGs to the directory at mode `0700`.

15. **Write evaluation-results bundle** — If `--artifact-dir` is set **and** `--reference` ran, calls `writeArtifact` to emit the curated bundle (see [Evaluation-results artifact](#evaluation-results-artifact---artifact-dir)) and embeds an `artifact` block in the result JSON.

16. **Route output** — `routeJsonOutput` (to stdout or `--out` file) and `routeSummary` (to stderr or stdout per routing contract).

---

## Usage Examples

### Basic evaluation

```bash
webui-rubric evaluate https://example.com
# JSON artifact → stdout
# score=72 blocking=2 issues=8 ship_ready=false → stderr
```

### Save JSON to file

```bash
webui-rubric evaluate https://example.com --out result.json
# JSON → result.json
# score=72 blocking=2 issues=8 ship_ready=false → stdout
```

### Pixel comparison against a reference design

```bash
webui-rubric evaluate https://example.com \
  --reference ./designs/homepage.png \
  --reference-viewport desktop
```

### Capture debug artifacts

```bash
webui-rubric evaluate https://example.com --debug-dir ./debug
# Saves: debug/screenshot-desktop.png, debug/screenshot-mobile.png, debug/reference-desktop.png,
#        debug/dom-snapshot.html, debug/recording.har, debug/console-errors.json
```

### Generate an evaluation-results artifact bundle

```bash
webui-rubric evaluate https://example.com \
  --reference ./designs/homepage.png \
  --artifact-dir ./eval-results
# Writes ./eval-results/{reference,screenshot,diff,composite}-desktop.png,
#        ./eval-results/regions/*.png, manifest.json, and report.html.
# The emitted JSON gains an `artifact` block referencing these files.
```

### Iterative loop mode

```bash
# Iteration 1 (initial run)
webui-rubric evaluate https://example.com \
  --out iter1.json \
  --iteration 1

# Iteration 2 (after Generator has applied fixes)
webui-rubric evaluate https://example.com \
  --out iter2.json \
  --iteration 2 \
  --previous-composite 68.5 \
  --attempted-fixes iter1-fixes.json
# meta.delta and no_progress are now set in output
```

### Custom configuration

```bash
webui-rubric evaluate https://example.com --config ./ci/webui-rubric.yml
```

### Suppress logs (machine-readable mode)

```bash
webui-rubric evaluate https://example.com --quiet --out result.json
# Only errors → stderr; no info/warn logs
```

### Validate config without running

```bash
webui-rubric validate-config --config staging.yml
```

### Check tool versions

```bash
webui-rubric check-tools
webui-rubric check-tools --json | jq '.lighthouse'
```
