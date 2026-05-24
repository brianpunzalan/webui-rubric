# Tasks: Web UI Evaluator CLI

**Input**: Design documents from `/specs/001-ui-evaluator-cli/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not included — tests were not explicitly requested in the feature specification. Add test tasks separately if TDD is desired.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/<name>/src/` for source, `packages/<name>/tests/` for tests
- Root-level config: `package.json`, `tsconfig.base.json`, `eslint.config.mjs`, etc.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize Yarn workspaces monorepo with four packages and shared tooling

- [x] T001 Initialize root package.json with Yarn workspaces (`"workspaces": ["packages/*"]`), create .yarnrc.yml with `nodeLinker: node-modules`, and install root dev dependencies (typescript, vite, vitest, eslint, prettier, @changesets/cli) in package.json
- [x] T002 Create shared TypeScript base config in tsconfig.base.json (target ES2022, module NodeNext, strict: true, composite: true) to be extended by each package
- [x] T003 [P] Scaffold packages/core with package.json (name: @webui-rubric/core, dependencies: zod), tsconfig.json extending base, vite.config.ts in library mode, and empty src/index.ts
- [x] T004 [P] Scaffold packages/cli with package.json (name: @webui-rubric/cli, bin entry for webui-rubric, dependencies: commander, yaml, workspace:* refs to core/capture/checks), tsconfig.json, vite.config.ts with SSR mode, and empty src/index.ts
- [x] T005 [P] Scaffold packages/capture with package.json (name: @webui-rubric/capture, dependencies: playwright, @axe-core/playwright, workspace:* ref to core), tsconfig.json, vite.config.ts, and empty src/index.ts
- [x] T006 [P] Scaffold packages/checks with package.json (name: @webui-rubric/checks, dependencies: lighthouse, chrome-launcher, pixelmatch, pngjs, workspace:* refs to core/capture), tsconfig.json, vite.config.ts, and empty src/index.ts
- [x] T007 [P] Configure ESLint flat config in eslint.config.mjs, Prettier in .prettierrc, and Vitest workspace in vitest.workspace.ts covering all four packages
- [x] T008 [P] Initialize Changesets in .changeset/config.json with linked versioning for the monorepo
- [x] T009 [P] Create GitHub Actions CI workflow in .github/workflows/ci.yml (build, test, lint, format on PR + push to main) and release workflow in .github/workflows/release.yml (changesets version + publish)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, rubric engine, scoring math, config validation, redaction, and output schema that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T010 Define all shared TypeScript types and interfaces per data-model.md in packages/core/src/types/index.ts — RubricDefinition, Dimension, SubCriterion, BoundCheck, AnchorDescriptor, ThresholdRange, SeverityMapping, ProjectConfig, ViewportConfig, TargetCapture, ConsoleEntry, EvaluationResult, TargetReference, DimensionResult, SubCriterionFinding, LocationReference, BlockingEntry, TopIssue, PixelComparisonResult, PixelComparisonViewport, EvaluationMeta, EffectiveConfig
- [x] T011 [P] Implement leveled logger (debug/info/warn/error) writing exclusively to stderr, with --log-level and --quiet support, in packages/core/src/logger.ts per research R10
- [x] T012 [P] Define v1 rubric with all 10 dimensions, their default weights (per data-model.md), sub-criteria with bound checks (axe, lighthouse, pixelmatch, dom, css, playwright, console, har families), anchor descriptors (0-4 per sub-criterion), blocking_if_zero flags, visual_parity flags, references, severity mappings, fix templates, and pinned tool versions in packages/core/src/rubric/definition.ts and packages/core/src/rubric/index.ts — anchor thresholds per research R2 (axe severity map), R3 (LCP/FCP/CLS/TBT/SI/TTI anchors), R4 (diff_ratio anchors), R12 (structural check definitions)
- [x] T013 [P] Implement check registry abstract interface (CheckAdapter interface, registration, lookup by check_family + check_id, execution contract returning SubCriterionFinding) in packages/core/src/registry/index.ts
- [x] T014 Implement scoring engine in packages/core/src/scoring/index.ts — dimension score = mean of applicable sub-criterion scores times 25 (FR-012), composite = weighted average of dimension scores with re-normalization when all sub-criteria in a dimension are excluded (FR-013), Nielsen severity assignment from bound check results (FR-014)
- [x] T015 [P] Implement redaction engine in packages/core/src/redaction/index.ts — redact Set-Cookie/Cookie/Authorization and sensitive headers in HAR (FR-039a), redact POST/PUT/PATCH request bodies in HAR (FR-039b), redact input[type=password/email/tel] and autocomplete=cc-* values in DOM (FR-039c), sanitize evidence strings (FR-039d), placeholder replacement preserving JSON shape
- [x] T016 Implement config validation with zod schemas in packages/core/src/config/schema.ts (ProjectConfig zod schema) and packages/core/src/config/validate.ts (weight sum=100, Accessibility weight floor >= 10 unless acknowledged, anchor completeness for custom sub-criteria, bound check requirement) and packages/core/src/config/index.ts per FR-028
- [x] T017 Implement output schema construction and zod validation in packages/core/src/output/schema.ts (EvaluationResult zod schema matching contracts/evaluator-output-schema.json) and packages/core/src/output/index.ts — validate the complete result before emission, exit non-zero on validation failure per FR-036
- [x] T018 Export all core modules (types, logger, rubric, registry, scoring, redaction, config, output) from packages/core/src/index.ts

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Deterministic Single-Pass Evaluation of a Live URL (Priority: P1) MVP

**Goal**: Point the CLI at a live URL and receive a JSON evaluation artifact with composite score, per-dimension and per-sub-criterion scores, evidence, severity, and suggested fixes — all from deterministic checks, no LLM

**Independent Test**: Run `webui-rubric evaluate https://example.com` and verify the JSON validates against evaluator-output-schema.json, contains a composite 0-100 score, all 10 dimensions, all sub-criteria with evidence and suggested_fix, and re-running produces identical scores

### Capture Package

- [x] T019 [P] [US1] Implement Playwright browser lifecycle management (launch Chromium-only, create context with HAR recording config, page creation, graceful close) in packages/capture/src/browser.ts
- [x] T020 [P] [US1] Implement page settle detection (wait for networkidle + configurable additional delay, timeout handling with actionable error) in packages/capture/src/settle.ts
- [x] T021 [P] [US1] Implement authentication wall detection (detect redirect to login page, detect HTTP 401/403 responses, report precondition failure with exit code 5) in packages/capture/src/auth-detect.ts per FR-008
- [x] T022 [US1] Implement screenshot capture with CSS stabilization injection (animation-duration/delay: 0s, transition-duration/delay: 0s, caret-color: transparent, scroll-behavior: auto on `*, *::before, *::after` all !important, hide scrollbars, scroll to top) and multi-viewport support (desktop 1280x800, above-fold, mobile 375x812) in packages/capture/src/screenshot.ts per FR-007
- [x] T023 [P] [US1] Implement DOM snapshot extraction via page.content() in packages/capture/src/dom.ts
- [x] T024 [P] [US1] Implement HAR recording completion and extraction (close context to finalize HAR, parse HAR 1.2 JSON, apply redaction before output) in packages/capture/src/har.ts per research R13
- [x] T025 [P] [US1] Implement computed styles extraction via page.evaluate (gather element styles for CSS structural checks) in packages/capture/src/styles.ts
- [x] T026 [P] [US1] Implement console error/warning capture via page.on('console') filtering to error and warning levels in packages/capture/src/console.ts
- [x] T027 [US1] Implement capture pipeline orchestrator in packages/capture/src/index.ts — sequence: launch browser → navigate to URL → settle → auto-dismiss consent banners (click first match from default dismiss-button selectors per FR-007a, wait up to 2s for overlay to disappear, support capture.dismiss_selectors and capture.auto_dismiss config overrides) → detect auth wall → inject stabilization CSS → capture screenshots at all viewports → extract DOM → extract computed styles → capture console → finalize HAR → compute content hash (SHA-256) → close browser → return TargetCapture

### Checks Package

- [x] T028 [P] [US1] Implement axe-core accessibility adapter in packages/checks/src/accessibility/index.ts — inject axe via @axe-core/playwright during Playwright session, collect rule violations, map axe impact (critical/serious/moderate/minor) to Nielsen severity (4/3/2/1) per severity-map in packages/checks/src/accessibility/severity-map.ts, produce SubCriterionFinding per rule with evidence (rule ID + description), evidence_source (axe.<rule-id>), location (CSS selector from axe nodes), and fix from axe help text per research R2
- [x] T029 [P] [US1] Implement Lighthouse performance adapter in packages/checks/src/performance/index.ts — launch Chrome via chrome-launcher, run lighthouse Node API against target URL, extract CWV lab metrics (LCP, FCP, CLS, TBT, SI, TTI), map each metric to 0-4 score via anchor thresholds per research R3, produce SubCriterionFinding per metric with confidence: "predicted" per FR-026, evidence_source (lighthouse.<metric>), and metric-specific fix templates; define metric-to-anchor mapping in packages/checks/src/performance/metric-map.ts
- [x] T030 [P] [US1] Implement structural DOM checks in packages/checks/src/structural/dom-checks.ts — dom.heading-order (heading levels skip no more than 1), dom.landmark-usage (main/nav/header/footer presence), dom.link-descriptiveness (detect generic "click here"/"read more" link text), dom.image-alt (images with missing/empty alt), dom.form-labels (inputs with associated labels), dom.meta-viewport (proper mobile viewport meta) per research R12
- [x] T031 [P] [US1] Implement structural CSS checks in packages/checks/src/structural/css-checks.ts — css.unique-color-count (distinct colors used), css.font-family-count (distinct font families), css.spacing-consistency (margin/padding variance across siblings) per research R12
- [x] T032 [P] [US1] Implement console and HAR runtime checks in packages/checks/src/structural/runtime-checks.ts — console.error-count (count of console errors during page load), har.resource-count (total requests, large asset count, uncompressed responses) per research R12
- [x] T033 [P] [US1] Implement playwright.focus-visible check in packages/checks/src/structural/focus-visible.ts — tab through interactive elements in the live Playwright page, verify :focus-visible outline is present, run during Playwright capture session (before browser close) per research R12
- [x] T034 [US1] Register all check adapters (accessibility, performance, structural DOM, structural CSS, runtime, focus-visible) in the check registry and export unified interface from packages/checks/src/index.ts

### CLI Package

- [x] T035 [US1] Implement YAML config file loader in packages/cli/src/config/loader.ts — load .webui-rubric.yml (or --config path), parse YAML, validate against ProjectConfig zod schema from core, merge with rubric defaults; export from packages/cli/src/config/index.ts
- [x] T036 [US1] Implement output routing in packages/cli/src/output/router.ts — default mode: JSON to stdout + summary to stderr; --out mode: JSON to file + summary to stdout; all logs always to stderr per FR-002; export from packages/cli/src/output/index.ts
- [x] T037 [US1] Implement evaluate command in packages/cli/src/commands/evaluate.ts — commander command definition with all flags from contracts/cli-commands.md, full orchestration: parse args → load config → verify pinned tool versions (FR-026a: resolve installed versions, compare to rubric pins, exit code 3 on mismatch unless --allow-tool-version-drift, record drift in meta) → run capture pipeline → run axe during Playwright session → close Playwright → run Lighthouse → run structural/runtime checks on captured artifacts → apply rubric scoring → build EvaluationResult → validate against output schema → route output → exit 0; persist debug artifacts to --debug-dir (screenshots, DOM, HAR, console, raw tool reports) with directory mode 0700 and redacted content per FR-037
- [x] T038 [P] [US1] Implement version command (print CLI version, rubric version, pinned tool versions; --json flag for JSON output) in packages/cli/src/commands/version.ts and check-tools command (verify installed vs pinned tool versions, exit 0 if match, exit 3 on mismatch) in packages/cli/src/commands/check-tools.ts
- [x] T039 [US1] Implement CLI entry point with commander program setup (register evaluate, version, check-tools commands) and bin configuration in packages/cli/src/index.ts

**Checkpoint**: User Story 1 is fully functional — CLI evaluates a live URL and emits a complete JSON artifact with all 10 dimensions scored by deterministic checks

---

## Phase 4: User Story 2 — Generator-Consumable Prioritized Output (Priority: P1)

**Goal**: The evaluation artifact surfaces a blocking list (WCAG AA failures), a top_issues list (prioritized by dimension_weight x severity), and a ship-ready indicator so a Generator agent can act without parsing the full dimensions tree

**Independent Test**: Evaluate a URL with a known WCAG AA contrast failure, verify blocking contains the violation with wcag_ref, top_issues is sorted descending by priority_score and capped at 10, and ship_ready reflects the blocking/composite state

- [x] T040 [US2] Implement blocking list construction in packages/core/src/output/blocking.ts — for every sub-criterion with score=0 and blocking_if_zero=true, emit a BlockingEntry with criterion_id, human-readable reason, wcag_ref (specific WCAG 2.2 section), evidence from the sub-criterion finding, location (offending element selector/bounding box), and severity=4 per FR-015
- [x] T041 [US2] Implement top issues list construction in packages/core/src/output/top-issues.ts — collect all sub-criteria with score < 4, compute priority_score = dimension_weight x severity, sort descending, cap at top_issues_cap (default 10), populate rank, fix from bound check fix_template (max 280 chars), fix_hash (SHA-256 of fix text for oscillation prevention), and expected_impact per FR-016
- [x] T042 [P] [US2] Implement ship-ready indicator logic in packages/core/src/output/ship-ready.ts — ship_ready = true when blocking array is empty AND composite_score >= ship_threshold (default 75, configurable) per FR-035
- [x] T043 [P] [US2] Implement one-line summary emission in packages/cli/src/output/summary.ts — format: `score=X blocking=Y issues=Z ship_ready=bool` per FR-038
- [x] T044 [US2] Wire blocking list, top issues, ship-ready, and summary into the evaluate command output pipeline in packages/cli/src/commands/evaluate.ts and packages/core/src/output/index.ts

**Checkpoint**: Generator agents can extract blocking[] and top_issues[] from the JSON without parsing the full dimensions tree; the one-line summary enables quick CI pipeline decisions

---

## Phase 5: User Story 3 — Per-Project Rubric Configuration (Priority: P2)

**Goal**: Teams customize dimension weights, toggle blocking flags, add custom sub-criteria with bound checks, and override check bindings via a declarative YAML config file

**Independent Test**: Provide a config that sets Accessibility weight to 25, Visual Design to 5, adds a custom Usability sub-criterion with a playwright check, and verify the composite uses custom weights, the custom sub-criterion appears in output, and a config with Accessibility < 10 (without ack) is rejected

- [x] T045 [US3] Implement weight override application in packages/core/src/config/weights.ts — apply config weight overrides to rubric dimensions, enforce sum=100, enforce Accessibility weight floor >= 10 (reject with clear error explaining the floor and how to use weight_overrides_ack to override) per FR-027, FR-028
- [x] T046 [US3] Implement custom sub-criteria registration in packages/core/src/config/custom-sub-criteria.ts — parse custom_sub_criteria from config, validate each has complete anchors (all 5 score levels) and a bound check with valid check_family and check_id, add to the appropriate dimension, register bound check in the check registry per FR-027, FR-028
- [x] T047 [P] [US3] Implement blocking toggle overrides in packages/core/src/config/blocking-toggles.ts — apply blocking_overrides from config to set or unset blocking_if_zero on individual sub-criteria per FR-027
- [x] T048 [P] [US3] Implement effective config recording in packages/core/src/output/effective-config.ts — capture resolved weights, blocking toggles, viewports, ship_threshold, iteration_cap, top_issues_cap, tool_fallback_policy, pixelmatch_threshold, bound check identifiers per sub-criterion, rubric version, and determinism state into EvaluationMeta.effective_config per FR-029
- [x] T049 [US3] Implement validate-config CLI command in packages/cli/src/commands/validate-config.ts — validate a project config file without running an evaluation, exit 0 if valid, exit 2 with error details on stderr if invalid; register in CLI entry point
- [x] T050 [US3] Wire config overrides into evaluate command — apply weight overrides, custom sub-criteria, and blocking toggles before scoring, pass effective config to output construction in packages/cli/src/commands/evaluate.ts

**Checkpoint**: Teams can customize the rubric via .webui-rubric.yml without modifying CLI source; validate-config enables CI-time config validation

---

## Phase 6: User Story 4 — Pixel-Level Comparison Against a Reference Design Image (Priority: P2)

**Goal**: When a reference design image (PNG) is supplied, the CLI runs pixelmatch against the live screenshot to score visual-parity sub-criteria with a reproducible diff_ratio; when no reference is supplied, visual-parity sub-criteria are marked not_applicable

**Independent Test**: Supply a reference image matching the live UI exactly and verify diff_ratio near 0 with visual-parity sub-criteria scoring 4; alter the reference and verify scores drop with a diff PNG persisted; omit the reference and verify visual-parity sub-criteria are not_applicable with the composite re-weighted

- [x] T051 [P] [US4] Implement reference image loading and contract validation in packages/capture/src/reference-image.ts — load PNG via pngjs, validate 8-bit PNG format, check pixel dimensions against expected viewport at effective DPR, infer DPR from reference dimensions when pixel_comparison.device_pixel_ratio is "auto" (e.g., 2560x1600 ref for 1280x800 viewport implies DPR 2, default to DPR 1 when no reference), normalize RGB to RGBA (fill alpha to 255), composite transparent pixels onto white (#FFFFFF), report capture characteristics (device_pixel_ratio, viewport, color_space: srgb) per FR-005, FR-005a, FR-020
- [x] T052 [P] [US4] Implement mask selector resolution in packages/capture/src/mask.ts — resolve pixel_comparison.mask_selectors CSS selectors against the live page DOM to obtain bounding boxes, paint bounding boxes with mask_color (default #FF00FF) on the live screenshot, apply identical masks at same coordinates on the reference image, report masked pixel count and effective compared-pixel count per FR-017a
- [x] T053 [US4] Implement pixelmatch adapter in packages/checks/src/pixelmatch/index.ts — decode PNG buffers, apply masks from T052, invoke pixelmatch with configured threshold (default 0.1), compute diff_pixel_count, total_pixel_count (unmasked only), diff_ratio, generate and persist diff PNG to debug directory, return PixelComparisonViewport result per FR-017, FR-018, research R4
- [x] T054 [US4] Implement visual-parity scoring in packages/checks/src/pixelmatch/scoring.ts — map diff_ratio to 0-4 score per anchor thresholds (0%=4, <=1%=3, <=5%=2, <=10%=1, >10%=0), bind score to every sub-criterion flagged visual_parity: true in the rubric per FR-019
- [x] T055 [US4] Implement not_applicable handling for missing reference image in packages/core/src/scoring/visual-parity.ts — when no reference is supplied, mark all sub-criteria with visual_parity: true as status="not_applicable" with score=null, exclude from dimension mean, re-weight dimensions per FR-012/FR-013/FR-022
- [x] T056 [US4] Implement multi-viewport pixel comparison in packages/checks/src/pixelmatch/multi-viewport.ts — when multiple viewports are configured (--viewports desktop,mobile) and reference images are supplied per viewport, run one pixelmatch pass per viewport, emit one PixelComparisonViewport per viewport, viewports without a reference image get not_applicable per FR-021
- [x] T057 [US4] Wire pixel comparison into evaluate command and output — handle --reference and --reference-viewport flags, pass DPR to screenshot capture (Playwright deviceScaleFactor), integrate PixelComparisonResult into EvaluationResult JSON, construct pixel_comparison output block in packages/core/src/output/pixel-comparison.ts, update packages/cli/src/commands/evaluate.ts

**Checkpoint**: Visual-parity sub-criteria are deterministically scored from pixel diffs when a reference is supplied; the CLI still runs end-to-end without a reference

---

## Phase 7: User Story 5 — Iterative-Loop Metadata for Generator Convergence (Priority: P2)

**Goal**: The CLI accepts and emits loop-metadata fields (iteration, previous_composite, delta, attempted_fixes) so a wrapping Evaluator/Generator loop can detect convergence, prevent oscillation, and respect the iteration cap

**Independent Test**: Run the CLI twice, feed the first run's composite and attempted fixes into the second via flags, verify iteration=2, delta is computed, and top_issues excludes previously attempted fixes

- [x] T058 [US5] Implement loop metadata input parsing in packages/core/src/loop/input.ts — parse --iteration (integer), --previous-composite (number), --attempted-fixes (path to JSON file of fix hashes), handle malformed attempted-fixes gracefully (log warning, treat as empty per edge case) per FR-032
- [x] T059 [US5] Implement loop metadata output construction in packages/core/src/loop/output.ts — populate EvaluationMeta fields: iteration, previous_composite, delta (composite minus previous_composite), attempted_fixes_count per FR-032
- [x] T060 [US5] Implement oscillation prevention in packages/core/src/loop/oscillation.ts — hash each fix in top_issues (SHA-256), compare against supplied attempted_fixes hashes, exclude matching fixes from the emitted top_issues list per FR-033
- [x] T061 [P] [US5] Implement no-progress detection in packages/core/src/loop/progress.ts — set no_progress=true when delta < 3 across consecutive iterations per FR-035
- [x] T062 [P] [US5] Implement iteration cap enforcement in packages/core/src/loop/cap.ts — refuse to run when iteration > iteration_cap (default 5) with exit code 4 and clear error message referencing the cap, allow --allow-overrun to bypass per FR-034
- [x] T063 [US5] Wire loop metadata into evaluate command — parse loop flags, enforce iteration cap before evaluation, apply oscillation prevention to top_issues after scoring, emit loop metadata in output, export from packages/core/src/loop/index.ts, update packages/cli/src/commands/evaluate.ts

**Checkpoint**: The Evaluator/Generator loop can detect convergence, avoid oscillation, and halt within the iteration cap

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation per constitution, code quality, security hardening, and end-to-end validation

**Documentation tasks are MANDATORY per the project constitution (Principles I-V) and MUST land with the feature.**

- [ ] T064 [P] **[Principle I]** Verify and update per-feature quickstart guide in specs/001-ui-evaluator-cli/quickstart.md — confirm all code samples work, cover primary user journeys (single-pass evaluation, generator-consumable output, pixel comparison, custom config, loop convergence), document limitations
- [ ] T065 [P] **[Principle II]** Create API reference documentation in docs/api/core.md (rubric engine, scoring, check registry, config validation, redaction, loop metadata, output schema), docs/api/cli.md (CLI commands, flags, output routing, config loading), docs/api/capture.md (browser capture pipeline, screenshot, DOM, HAR, styles, console), docs/api/checks.md (axe adapter, Lighthouse adapter, pixelmatch adapter, structural checks)
- [ ] T066 [P] **[Principle V]** Add JSDoc blocks to every public symbol across all four packages — each exported function, class, type, interface, and constant gets `/** */` with @param, @returns, @throws, @example; module files get top-level @module blocks linking to docs/api/<module>.md
- [ ] T067 [P] **[Principle IV]** Audit code for intent comments on policy-bearing constants — rubric weight floors and default weights cite their source (Nielsen/Shneiderman/WCAG), anchor thresholds cite CWV or WCAG thresholds, axe severity mapping cites Nielsen severity definitions, diff_ratio anchors cite rationale, redaction header patterns explain why each header is redacted, composite re-weighting formula explains the math
- [ ] T068 **[Principle III]** Create repository root README.md as project reference hub — link to specs/, docs/api/, quickstart, examples, constitution; describe installation, usage, architecture overview
- [ ] T069 [P] Harden error handling across all packages — ensure non-zero exits with actionable error messages for all failure modes (target unreachable, config invalid, tool version mismatch, schema validation failure, reference image mismatch, auth wall, settle timeout), verify no partial JSON is emitted on any error path per FR-036
- [ ] T070 [P] Security hardening — verify redaction covers all sensitive paths (HAR headers, DOM inputs, evidence strings), verify debug directory permissions (mode 0700), verify reference images are referenced by path only in evidence, verify no raw cookie/header/form values leak into output per FR-039
- [ ] T071 [P] Implement configurable tool fallback policy in packages/core/src/registry/fallback.ts — when a deterministic tool is unavailable at runtime, either mark affected sub-criteria status="tool_unavailable" and re-weight (mark-unavailable policy), or fail fast (fail-fast policy, default for blocking-eligible criteria) per FR-025
- [ ] T072 Run quickstart.md validation — execute every code sample, verify outputs match documented examples, cross-reference all CLI flags and config options
- [ ] T073 End-to-end integration validation — run `webui-rubric evaluate` against a sample URL, validate output against contracts/evaluator-output-schema.json, verify all 10 dimensions and sub-criteria are present, verify determinism (two runs produce identical scores), verify exit codes for error cases

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational completion — MVP delivery
- **US2 (Phase 4)**: Depends on US1 completion (needs scoring results to build blocking/top_issues)
- **US3 (Phase 5)**: Depends on Foundational completion — can run in parallel with US1 if needed, but logically sequenced after US1
- **US4 (Phase 6)**: Depends on Foundational + US1 capture pipeline (needs screenshot capture working)
- **US5 (Phase 7)**: Depends on Foundational + US2 (needs top_issues for oscillation prevention)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P1)**: Depends on US1 (needs the scoring pipeline to produce findings for blocking/top_issues construction)
- **US3 (P2)**: Can start after Foundational — independent of US1/US2 at the config layer, but integrates into evaluate command
- **US4 (P2)**: Depends on US1 capture pipeline (screenshot capture) — independent of US2/US3
- **US5 (P2)**: Depends on US2 (top_issues list exists for oscillation prevention) — independent of US3/US4

### Within Each User Story

- Capture modules marked [P] can be built in parallel (different files)
- Check adapters marked [P] can be built in parallel (different files)
- Pipeline orchestrator depends on individual capture modules
- Check registry depends on individual check adapters
- CLI evaluate command depends on capture pipeline + check registry + scoring engine
- Output wiring depends on all scoring components

### Parallel Opportunities

**Phase 1** — T003, T004, T005, T006, T007, T008, T009 can all run in parallel after T001 + T002

**Phase 2** — T011, T012, T013, T015 can run in parallel after T010; T014 depends on T010 + T012; T016 depends on T010; T017 depends on T010; T018 depends on all

**US1 Capture** — T019, T020, T021, T023, T024, T025, T026 can all run in parallel; T022 depends on T019 + T020; T027 depends on all capture modules

**US1 Checks** — T028, T029, T030, T031, T032, T033 can all run in parallel; T034 depends on all check adapters

**US1 CLI** — T035 and T036 can run in parallel; T037 depends on capture + checks + output; T038 can run in parallel with T037

**US2** — T040 and T041 depend on scoring; T042 and T043 can run in parallel; T044 depends on all US2 tasks

**US3** — T047 and T048 can run in parallel; T045 and T046 are sequential; T049 depends on config validation; T050 depends on all US3 tasks

**US4** — T051 and T052 can run in parallel; T053 depends on T051 + T052; T054 depends on T053; T055 can run in parallel with T053; T056 depends on T053; T057 depends on all US4 tasks

**US5** — T061 and T062 can run in parallel; T058 → T059 → T060 are sequential; T063 depends on all US5 tasks

---

## Parallel Example: User Story 1

```text
# Launch all capture modules in parallel:
T019: "Browser lifecycle in packages/capture/src/browser.ts"
T020: "Page settle detection in packages/capture/src/settle.ts"
T021: "Auth wall detection in packages/capture/src/auth-detect.ts"
T023: "DOM snapshot in packages/capture/src/dom.ts"
T024: "HAR recording in packages/capture/src/har.ts"
T025: "Computed styles in packages/capture/src/styles.ts"
T026: "Console capture in packages/capture/src/console.ts"

# Then screenshot (depends on browser + settle):
T022: "Screenshot capture in packages/capture/src/screenshot.ts"

# Then orchestrator (depends on all capture modules):
T027: "Capture pipeline orchestrator in packages/capture/src/index.ts"

# Launch all check adapters in parallel:
T028: "Axe-core accessibility adapter"
T029: "Lighthouse performance adapter"
T030: "Structural DOM checks"
T031: "Structural CSS checks"
T032: "Console and HAR runtime checks"
T033: "Focus-visible check"

# Then check registry (depends on all adapters):
T034: "Check family registry in packages/checks/src/index.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup — monorepo scaffold
2. Complete Phase 2: Foundational — core engine (types, rubric, scoring, config, output schema)
3. Complete Phase 3: User Story 1 — end-to-end single-pass evaluation
4. **STOP and VALIDATE**: Run `webui-rubric evaluate https://example.com`, verify JSON output
5. Complete Phase 4: User Story 2 — blocking/top_issues/ship-ready/summary
6. **STOP and VALIDATE**: Verify blocking list, priority ordering, and generator-consumable output
7. Deploy/demo MVP — the Evaluator/Generator loop can operate with US1 + US2

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Single-pass evaluation works → Deploy/Demo (MVP core)
3. US2 → Prioritized output for Generator → Deploy/Demo (MVP complete)
4. US3 → Per-project configuration → Deploy/Demo (customizable)
5. US4 → Pixel comparison → Deploy/Demo (visual fidelity scoring)
6. US5 → Loop metadata → Deploy/Demo (convergence tracking)
7. Polish → Documentation, hardening, validation → Release

### Suggested MVP Scope

**US1 + US2** — these two P1 stories deliver the complete value proposition: a deterministic evaluation with generator-consumable prioritized output. US3-US5 (all P2) add configurability, visual comparison, and loop convergence that enhance but are not required for initial operation.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [USn] label maps task to specific user story for traceability
- Each user story is independently testable after its checkpoint
- The rubric definition (T012) is the largest single task — it defines all 10 dimensions, ~30+ sub-criteria, bound checks, anchors, severity maps, and fix templates
- Playwright.focus-visible (T033) runs during the live Playwright session, not on captured artifacts — coordinate with capture pipeline timing
- Lighthouse requires a separate Chrome instance (research R14) — the evaluate command orchestrates two browser lifecycles sequentially
- All file paths follow the monorepo structure in plan.md: packages/{core,cli,capture,checks}/src/
