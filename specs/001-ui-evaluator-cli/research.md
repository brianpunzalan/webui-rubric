# Research: Web UI Evaluator CLI

**Date**: 2026-05-23 | **Plan**: `specs/001-ui-evaluator-cli/plan.md`

## R1 — Headless Browser: Playwright

**Decision**: Use Playwright (Chromium channel only) for all browser-based capture.

**Rationale**: Playwright provides native HAR recording (`BrowserContext({ recordHar })`), built-in network idle detection, first-class TypeScript support, and the `@axe-core/playwright` integration for in-browser accessibility scanning without a separate process. Using a single browser for capture + axe minimizes the 90-second time budget. Chromium-only channel avoids installing Firefox/WebKit binaries that will never be used.

**Alternatives considered**:
- **Puppeteer**: Similar capability but narrower ecosystem. No native axe integration package. HAR recording requires third-party libraries. Playwright's API is a superset.
- **Chrome DevTools Protocol (CDP) directly**: Maximum control but requires building all abstractions (navigation, screenshot, HAR, settle detection) from scratch. Not justified for v1.

## R2 — Accessibility Scanner: axe-core via @axe-core/playwright

**Decision**: Use `@axe-core/playwright` which injects axe-core into Playwright's browser context and returns structured rule results.

**Rationale**: axe-core is the industry standard for automated WCAG 2.2 testing. `@axe-core/playwright` runs entirely in-process — no separate binary, no network call, no non-determinism from an external service. Each rule result includes `id`, `impact` (minor/moderate/serious/critical), `description`, `help`, `helpUrl`, and `nodes[]` with CSS selectors and bounding boxes. This maps directly to the spec's evidence, evidence_source, severity, location, and suggested_fix fields.

**Severity mapping** (axe impact → Nielsen severity):
| axe impact | Nielsen severity | Rationale |
|---|---|---|
| `critical` | 4 (catastrophe) | Prevents task completion for affected users |
| `serious` | 3 (major) | Significant barrier, difficult workaround |
| `moderate` | 2 (minor) | Inconvenient but workaround exists |
| `minor` | 1 (cosmetic) | Low-impact issue |
| pass / inapplicable | 0 (not a problem) | No issue detected |

**Alternatives considered**:
- **pa11y**: Wraps HTML_CodeSniffer. Fewer rules than axe-core, less granular impact ratings. Less active maintenance.
- **Lighthouse accessibility audit**: Uses axe-core internally but reports only a subset of rules and conflates accessibility with other audits. Better to use axe-core directly for full rule coverage.

## R3 — Performance Lab Metrics: Lighthouse via chrome-launcher

**Decision**: Use the `lighthouse` Node API with `chrome-launcher` to run a local-only, Lighthouse-controlled Chrome navigation for Core Web Vitals (LCP, CLS, TBT, FCP, SI, TTI).

**Rationale**: Lighthouse's trace-based metric collection requires controlling the browser navigation with throttling and clean-profile conditions that Playwright's shared browser cannot provide. Running a separate Lighthouse pass ensures lab-grade metrics. `chrome-launcher` manages the Chromium lifecycle locally — no PageSpeed Insights API call, satisfying FR-026b. Lighthouse returns structured JSON with per-metric `numericValue` and `score`, which maps to the 0–4 anchor thresholds. All performance sub-criteria will carry `confidence: "predicted"` per FR-026.

**Two-browser approach**: The CLI launches Playwright first for capture + axe (one navigation), then launches Lighthouse for performance (second navigation to the same URL). This adds ~20–30s to the time budget but keeps each tool's measurement conditions clean. Total estimated time: ~15s (Playwright capture) + ~5s (axe) + ~30s (Lighthouse) + ~5s (checks + scoring) + ~5s (pixelmatch, if applicable) ≈ 60s, well within the 90s target.

**Metric → score anchor mapping** (example for LCP):
| LCP (ms) | Score | Anchor |
|---|---|---|
| ≤ 1200 | 4 | Excellent — well under CWV "good" threshold |
| ≤ 2500 | 3 | Good — meets CWV "good" threshold |
| ≤ 4000 | 2 | Needs improvement — CWV "needs improvement" |
| ≤ 6000 | 1 | Poor — beyond CWV threshold |
| > 6000 | 0 | Critical — severely impaired |

Similar anchors for FCP, CLS, TBT, SI, TTI derived from Google's documented CWV thresholds.

**Alternatives considered**:
- **Running Lighthouse through Playwright's Chrome**: Fragile — Lighthouse expects a clean profile and controlled network conditions. Sharing Playwright's browser context introduces non-determinism.
- **Web Vitals library (RUM)**: Measures real-user metrics, not lab metrics. Cannot run in a headless context reliably. Not applicable for deterministic lab scoring.
- **WebPageTest API**: Hosted service — violates FR-026b (local-only runtime egress).

## R4 — Pixel Comparison: pixelmatch + pngjs

**Decision**: Use `pixelmatch` (specified in spec) with `pngjs` for PNG decode/encode.

**Rationale**: pixelmatch is the spec-mandated library (FR-017). It operates on raw RGBA pixel buffers, is fast (~150ms for a 1920×1080 comparison), and returns the count of mismatched pixels. `pngjs` handles PNG file I/O. The CLI computes `diff_ratio = diff_pixel_count / total_pixel_count`, maps it to a 0–4 score via the documented anchors, and persists the diff PNG to the debug directory.

**diff_ratio → score anchor mapping** (from spec):
| diff_ratio | Score | Anchor |
|---|---|---|
| 0% (exact match) | 4 | Pixel-perfect fidelity |
| ≤ 1% | 3 | Minor sub-pixel differences |
| ≤ 5% | 2 | Noticeable deviations |
| ≤ 10% | 1 | Significant divergence |
| > 10% | 0 | Major mismatch |

**pixelmatch threshold parameter**: Default `0.1` (tolerance for anti-aliased pixels). Configurable via project config to tune sensitivity.

**Alternatives considered**: None — pixelmatch is spec-mandated.

## R5 — Config File Format: YAML

**Decision**: Use YAML for the project configuration file, parsed with the `yaml` npm package.

**Rationale**: YAML supports inline comments (operators can annotate weight rationale), is more readable than JSON for deeply nested rubric configuration, and is the standard format for CI/CD and tool configuration in the JavaScript ecosystem. The `yaml` package (formerly `js-yaml` rewrite) has excellent TypeScript support and handles YAML 1.2. The parsed config is validated with zod against the ProjectConfig schema before use.

**Config file name**: `.webui-rubric.yml` (root of evaluated project) or `--config <path>` flag.

**Alternatives considered**:
- **JSON**: No comments — operators can't document weight choices inline. More verbose for nested structures.
- **TOML**: Less common in JS ecosystem, fewer battle-tested parsers, unfamiliar to many users.
- **JS/TS config**: Turing-complete configs are a security risk and break determinism if they import modules.

## R6 — Schema Validation: zod

**Decision**: Use `zod` for both config validation and output schema validation.

**Rationale**: zod is TypeScript-native, generates static types from schemas (`z.infer<typeof schema>`), provides structured error messages with exact path to the failing field, and runs at runtime without code generation. Used for: (1) validating the parsed YAML config against the ProjectConfig schema (weight sum = 100, anchor completeness, weight-floor enforcement); (2) validating the emitted JSON artifact against the EvaluatorOutput schema before emission (FR-036 — no partial JSON); (3) defining the Rubric Definition schema with sub-criterion shape, bound-check references, and visual_parity flag.

**Alternatives considered**:
- **ajv (JSON Schema)**: More standard but requires maintaining separate JSON Schema files and TypeScript types in parallel. zod co-locates both.
- **io-ts**: Functional style, steeper learning curve, less ergonomic error messages.

## R7 — Build: Vite Library Mode

**Decision**: Each package builds with Vite in library mode, outputting ESM (primary) and CJS (fallback) bundles. The CLI package additionally produces a Node.js executable entry point.

**Rationale**: User specified Vite. Vite's library mode (`build.lib`) uses Rollup under the hood for tree-shaking and bundle optimization. Each package declares its own `vite.config.ts` with `entry` pointing to `src/index.ts` and `formats: ['es', 'cjs']`. The CLI package sets `build.ssr: true` for Node.js-optimized output and a `bin` entry in package.json.

**Alternatives considered**: None — user specified Vite.

## R8 — Monorepo: Yarn Workspaces

**Decision**: Yarn workspaces (Yarn 4 / Berry with `nodeLinker: node-modules`) for monorepo management.

**Rationale**: User specified Yarn workspaces. Each package is declared in root `package.json` under `"workspaces": ["packages/*"]`. Cross-package dependencies use `workspace:*` protocol. Root-level scripts orchestrate build/test/lint across all packages via `yarn workspaces foreach`.

**node-modules linker**: Chosen over PnP because Playwright and chrome-launcher rely on binary resolution patterns that PnP can break. `nodeLinker: node-modules` in `.yarnrc.yml` avoids these issues.

**Alternatives considered**: None — user specified Yarn workspaces.

## R9 — Release: Changesets

**Decision**: Use `@changesets/cli` for version management and semantic versioning, with a GitHub Actions release workflow.

**Rationale**: User specified Changesets. Each PR that changes a package includes a changeset file (`.changeset/*.md`) describing the change and its semver bump type (patch/minor/major). The release workflow (`release.yml`) runs `changeset version` to bump package.json versions and update CHANGELOG.md, then `changeset publish` to publish to npm (when configured). The GitHub Action (`changesets/action@v1`) automates the "Version Packages" PR pattern.

**Alternatives considered**: None — user specified Changesets.

## R10 — Logger

**Decision**: Custom lightweight logger in `packages/core/src/logger.ts` with configurable log levels (debug, info, warn, error), writing exclusively to stderr.

**Rationale**: FR-002 requires all diagnostic output on stderr to avoid contaminating the stdout JSON stream. Existing logging libraries (winston, pino) are feature-rich but heavyweight for a CLI that needs a simple leveled logger. The logger supports: (1) log level set via `--log-level` flag or `LOG_LEVEL` env var (default: `info`); (2) structured prefix with timestamp + level + optional context tag; (3) stderr-only output; (4) quiet mode (`--quiet` / `-q`) that suppresses everything below `error`. The logger is a singleton exported from `@webui-rubric/core`.

**Alternatives considered**:
- **winston / pino**: Heavyweight transports, file rotation, and formatting features that a single-run CLI does not need. Adds dependency weight.
- **debug**: Namespace-based, no structured levels, outputs to stderr by default (good) but lacks the level filtering we need for `--quiet` and `--log-level`.
- **console.error**: No level filtering, no structured output, but the simplest option. Not sufficient for the `--log-level` requirement.

## R11 — CI Workflow

**Decision**: Two GitHub Actions workflows: `ci.yml` (PR gate) and `release.yml` (publish).

**Rationale**: User requires all PRs to pass build, test, lint, and formatting checks.

**ci.yml** triggers on `pull_request` and `push` to `main`:
1. `yarn install --immutable` (deterministic lockfile)
2. `yarn workspaces foreach -Apt run build` (build all packages in dependency order)
3. `yarn workspaces foreach -Apt run lint` (ESLint)
4. `yarn prettier --check .` (formatting)
5. `yarn workspaces foreach -Apt run test` (Vitest)

**release.yml** triggers on `push` to `main`:
1. Uses `changesets/action@v1` to detect pending changesets
2. If changesets exist: opens a "Version Packages" PR (bumps versions, updates changelogs)
3. When the version PR merges: publishes packages to npm, creates GitHub releases with tags

**Alternatives considered**: None — user specified the CI/CD requirements.

## R12 — Structural DOM/CSS Checks

**Decision**: Implement a library of structural checks in `packages/checks/src/structural/` that operate on the captured DOM snapshot and computed-styles snapshot.

**Rationale**: Sub-criteria that cannot be covered by axe-core, Lighthouse, or pixelmatch (e.g., heading order, unique color count, focus-visible presence, semantic landmark usage, consistent spacing, font-family count) need custom deterministic checks that parse the DOM and CSS. These are pure functions: DOM string in → score + evidence out. No browser required at check time (they operate on the captured artifacts).

**Planned structural checks** (v1 — each bound to specific sub-criteria in the rubric):
| Check ID | Input | Measurement | Dimension |
|---|---|---|---|
| `dom.heading-order` | DOM snapshot | Heading levels skip no more than 1 level | Content & IA |
| `dom.landmark-usage` | DOM snapshot | Presence of main, nav, header, footer landmarks | Content & IA |
| `dom.link-descriptiveness` | DOM snapshot | Links with generic text ("click here", "read more") | Usability |
| `css.unique-color-count` | Computed styles | Number of distinct colors (fewer = more consistent) | Consistency |
| `css.font-family-count` | Computed styles | Number of distinct font families | Consistency |
| `css.spacing-consistency` | Computed styles | Variance in margin/padding values across siblings | Layout |
| `dom.image-alt` | DOM snapshot | Images with missing or empty alt text | Accessibility |
| `dom.form-labels` | DOM snapshot | Form inputs with associated labels | Accessibility |
| `dom.meta-viewport` | DOM snapshot | Viewport meta tag with proper mobile config | Layout |
| `playwright.focus-visible` | Live page (Playwright) | Tab through interactive elements, verify :focus-visible | Usability |
| `console.error-count` | Console errors | Count of console errors during page load | Code Quality |
| `har.resource-count` | Network HAR | Total requests, large asset count, uncompressed responses | Performance |

**Alternatives considered**:
- **Cheerio for DOM parsing**: Viable for static DOM checks but doesn't handle computed styles. Would need a separate approach for style-based checks. Using the raw DOM + styles snapshots from capture is simpler.

## R13 — HAR Recording

**Decision**: Use Playwright's native `BrowserContext({ recordHar: { path, omitContent: true } })` for HAR capture.

**Rationale**: Native Playwright HAR recording produces a standard HAR 1.2 JSON file with all request/response metadata. `omitContent: true` avoids capturing response bodies (which can be large and are not needed for structural analysis), keeping the HAR file manageable. The HAR is then redacted per FR-039 (removing sensitive headers and POST/PUT/PATCH bodies) before being persisted to the debug directory.

**Alternatives considered**:
- **Manual network event recording**: `page.on('request')` / `page.on('response')` to build HAR manually. More work, same result, higher chance of format bugs.
- **chrome-har**: Third-party package that converts CDP network events to HAR. Unnecessary when Playwright provides native support.

## R14 — Two-Browser Lifecycle Orchestration

**Decision**: Sequential execution — Playwright first (capture + axe), then Lighthouse (performance). Both targeting the same URL.

**Rationale**: Playwright and Lighthouse each need control of their browser instance. Running them sequentially avoids port conflicts and resource contention. The execution order is:

1. **Playwright phase** (~20s): launch Chromium → navigate to URL → wait for settle → capture screenshots (desktop, above-fold, mobile 375px) → record HAR → extract DOM + computed styles + console errors → run axe-core scan → close browser
2. **Lighthouse phase** (~30s): chrome-launcher launches Chrome → Lighthouse navigates to URL → collects performance traces → computes CWV metrics → returns JSON → close Chrome
3. **Check phase** (~10s): run structural DOM/CSS checks on captured artifacts → run pixelmatch if reference image supplied → score all sub-criteria → compute dimension and composite scores → build output JSON

The two navigations hit the same URL but with different browser instances and profiles, which is intentional: Lighthouse requires a clean profile for accurate metrics, while Playwright needs an unconstrained profile for realistic capture (e.g., cookie banners, consent dialogs that affect the visual result).

**Alternatives considered**:
- **Parallel Playwright + Lighthouse**: Saves ~20s but risks port conflicts and doubles memory usage. The 60s sequential estimate is well within the 90s budget.
- **Single browser for both**: Lighthouse's throttling and trace-based metrics are unreliable when sharing a browser context with other operations.
