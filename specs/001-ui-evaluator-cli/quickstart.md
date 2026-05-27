# Quickstart: Web UI Evaluator CLI

**Audience**: Developers invoking the CLI directly, and Evaluator-agent implementers wiring it into an LLM tool-use harness.

## What It Does

`webui-rubric` is a deterministic CLI tool that evaluates a live web UI against a 10-dimension rubric and emits a machine-parseable JSON evaluation artifact. It does **not** invoke an LLM — all scoring comes from automated checks (accessibility scanners, performance lab tools, structural DOM/CSS analysis, and pixel-level comparison against an optional reference design image).

The artifact is designed for consumption by an Evaluator/Generator agent loop: it surfaces blocking issues (WCAG AA failures), a prioritized top-issues list, and loop-convergence metadata so a Generator agent can act on the most impactful issues first.

## Install

```bash
# Install globally
npm install -g @webui-rubric/cli

# Or run directly
npx @webui-rubric/cli evaluate https://example.com
```

### Prerequisites

- Node.js ≥ 20 LTS
- Playwright's Chromium browser (installed automatically by `npx playwright install chromium`)
- Chrome/Chromium for Lighthouse (installed via `chrome-launcher` or system Chrome)

## Example 1: Single-Pass Evaluation (User Story 1 — P1)

Evaluate a live URL with default settings. The JSON artifact goes to stdout.

```bash
webui-rubric evaluate https://example.com
```

Output (stdout): a JSON document containing:

- `composite_score`: 0–100 weighted average
- `dimensions`: all 10 dimensions with per-sub-criterion scores, evidence, and suggested fixes
- `blocking`: WCAG AA failures (empty if compliant)
- `top_issues`: up to 10 highest-priority issues
- `ship_ready`: boolean indicating if the UI passes the ship threshold

Summary (stderr):

```
score=82 blocking=0 issues=5 ship_ready=true
```

### Save to file

```bash
webui-rubric evaluate https://example.com --out result.json
```

When `--out` is used, the JSON goes to `result.json` and the one-line summary prints to stdout — useful for piping into CI scripts.

### With debug artifacts

```bash
webui-rubric evaluate https://example.com --debug-dir ./debug-output
```

Persists screenshots (desktop, above-fold, mobile), DOM snapshot, HAR, console errors, and raw tool reports to `./debug-output/` (created with mode 0700).

## Example 2: Generator-Consumable Output (User Story 2 — P1)

The Evaluator agent calls the CLI as a tool and passes the artifact to a Generator agent. The Generator reads `blocking` and `top_issues` without parsing the full dimensions tree.

```bash
# Evaluator agent's tool invocation
RESULT=$(webui-rubric evaluate https://my-app.dev --out /tmp/eval.json)

# $RESULT contains the one-line summary for quick decisions:
# score=67 blocking=2 issues=8 ship_ready=false

# Generator reads /tmp/eval.json, focuses on:
#   .blocking[]     — must-fix WCAG AA failures
#   .top_issues[]   — prioritized by dimension_weight × severity
```

### Contract test

To verify the JSON structure without a live URL, validate sample output against the schema:

```bash
# The evaluator-output-schema.json is published with the CLI
npx ajv validate -s node_modules/@webui-rubric/core/schema/evaluator-output-schema.json -d result.json
```

## Example 3: Pixel Comparison with Reference Image

```bash
webui-rubric evaluate https://my-app.dev \
  --reference ./design/homepage-desktop.png \
  --reference-viewport desktop \
  --debug-dir ./debug-output
```

The CLI captures a desktop screenshot, runs `pixelmatch` against `homepage-desktop.png`, and:

- Scores visual-parity sub-criteria based on `diff_ratio` thresholds (≤ 0.5% → 4, ≤ 1% → 3, ≤ 5% → 2, ≤ 10% → 1, > 10% → 0)
- Persists a side-by-side diff PNG to `./debug-output/`
- Includes `pixel_comparison` in the JSON with `diff_ratio`, `diff_pixel_count`, and paths

### Multiple viewports

```bash
webui-rubric evaluate https://my-app.dev \
  --reference ./design/homepage-desktop.png \
  --reference-viewport desktop \
  --viewports desktop,mobile \
  --debug-dir ./debug-output
```

When only a desktop reference is supplied, the mobile viewport's visual-parity sub-criteria are marked `not_applicable` and the composite re-weights accordingly.

## Example 4: Custom Configuration

Create `.webui-rubric.yml` in your project root:

```yaml
# Boost accessibility weight for a government site
weights:
  visual_design: 5
  layout: 10
  usability: 10
  accessibility: 25
  content_ia: 10
  performance: 12
  code_quality: 8
  brand: 5
  consistency: 10
  microinteractions: 5

# Ship threshold: must score ≥ 80
ship_threshold: 80

# Tighter settle timeout for a fast SPA
settle_timeout_ms: 3000
```

```bash
webui-rubric evaluate https://my-gov-site.gov --config .webui-rubric.yml
```

The output's `meta.effective_config.weights` records the custom weights used.

## Example 5: Evaluator/Generator Loop with Convergence Tracking

```bash
# Iteration 1
webui-rubric evaluate https://my-app.dev --out iter1.json

# Iteration 2 — feed back previous composite and attempted fixes
webui-rubric evaluate https://my-app.dev \
  --out iter2.json \
  --iteration 2 \
  --previous-composite 67 \
  --attempted-fixes ./attempted-fixes.json

# The output includes:
#   meta.iteration: 2
#   meta.delta: 15  (82 - 67)
#   top_issues: excludes fixes whose hash matches attempted-fixes.json
```

The loop halts when `ship_ready` is `true`, `no_progress` is `true`, or the iteration cap (default 5) is reached.

## Limitations and Known Caveats (v1)

- **Single page only**: Each invocation evaluates one URL. Multi-page or full-site evaluation must be orchestrated externally (e.g., the Evaluator agent issues multiple tool calls).
- **No authentication**: v1 targets public or network-reachable URLs without authentication. If a login wall is detected, the CLI reports a precondition failure rather than scoring the login page.
- **No local HTML files**: v1 requires a live URL. Local `.html` files and bundled apps are out of scope.
- **Lab metrics, not RUM**: Performance sub-criteria are scored from synthetic lab measurements (Lighthouse in a headless Chrome) and marked as `confidence: "predicted"`. They do not reflect real-user conditions.
- **PNG references only**: `pixelmatch` requires PNG images. JPEG/WebP references are not supported by default (conversion can be enabled in config but is not built in for v1).
- **Two browser launches**: The CLI launches Playwright (for capture + accessibility) and a separate Lighthouse Chrome instance (for performance). This adds ~20s to the evaluation time but ensures accurate lab metrics.
- **Determinism scoped to pinned tool versions**: FR-003 guarantees identical scores only when installed tool versions match the rubric's exact pins. Upgrading axe-core or Lighthouse may change scores. Use `webui-rubric check-tools` to verify.
- **No SPA route enumeration**: The CLI evaluates the page at the given URL after initial navigation + settle. It does not click through SPA routes or simulate multi-step user journeys.
