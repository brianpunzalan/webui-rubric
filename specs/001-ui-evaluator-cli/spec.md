# Feature Specification: Web UI Evaluator CLI

**Feature Branch**: `001-ui-evaluator-cli`

**Created**: 2026-05-22

**Status**: Draft

**Input**: User description: "Deterministic CLI tool invoked by an Evaluator agent (LLM) to evaluate a live web UI against a multi-dimensional rubric. The CLI does not invoke an LLM itself; it executes deterministic checks (accessibility scanners, performance/lab tools, structural checks, and pixel-level comparison via mapbox/pixelmatch against an optional reference design image), then emits a machine-parseable evaluation artifact. The artifact is consumed by the Evaluator agent and ultimately fed back to the Generator agent (LLM) so the Generator can improve its output. The rubric remains the 10 weighted dimensions anchored in Nielsen, Shneiderman, WCAG 2.2, and Gestalt, with 0–4 Likert and anchor descriptors; every sub-criterion must be scored by a deterministic check. Output includes per-criterion evidence, severity, suggested fix, prioritized top-N issues, and a blocking flag for WCAG AA failures; configurable per project."

## Architectural Pivot (Read First)

This CLI is a **tool** invoked by an external **Evaluator agent (LLM)**. The CLI itself does **not** call any LLM. Its job is to produce a deterministic, reproducible evaluation artifact from objective measurements (accessibility scans, performance/lab metrics, structural / DOM / CSS checks, and pixel-diff against an optional reference design image). The artifact is consumed by the Evaluator agent and then fed back to a **Generator agent (LLM)** which uses the prioritized issues and blocking list to improve its UI output. The CLI's contract is therefore: deterministic in, deterministic out — no model variance, no LLM calls, no API keys for model providers.

## Clarifications

### Session 2026-05-23

- Q: Output contract — how should the JSON artifact and the one-line summary share stdout/stderr? → A: JSON to stdout, summary to stderr by default; with `--out <file>`, JSON goes to the file and the one-line summary moves to stdout.
- Q: Privacy of captured artifacts (HAR, DOM, evidence strings, debug dir) — how should the CLI handle high-risk bytes flowing into the LLM-consumed JSON and on-disk debug dir? → A: Default-on redaction with `--no-redact` opt-out (redact auth/cookie headers and write-method bodies in HAR; redact values of password/email/tel and `autocomplete=cc-*` inputs in DOM; never include raw cookie/header/form-value substrings in evidence; create debug dir with permissions 0700; reference image referenced by path, not echoed in evidence).
- Q: How is the FR-003 determinism guarantee protected against drift in third-party deterministic tools (axe-core, Lighthouse, pixelmatch, etc.)? → A: Pin exact tool versions inside the rubric definition; the CLI verifies the installed versions at startup and refuses to run on mismatch unless `--allow-tool-version-drift` is passed, in which case the drift is recorded in `meta`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Deterministic Single-Pass Evaluation of a Live URL (Priority: P1)

An Evaluator agent (or a developer testing the CLI directly) points the tool at a live web UI URL and receives a machine-parseable JSON evaluation artifact describing the UI's quality across 10 weighted dimensions, with a composite 0–100 score, per-dimension and per-sub-criterion scores, evidence drawn from the deterministic checks, severity ratings, and suggested fixes — all produced without invoking an LLM.

**Why this priority**: This is the irreducible core of the tool — without a working single-pass deterministic evaluation, none of the loop, configuration, or pixel-diff layering matters. It is the MVP that delivers immediate value: the Evaluator agent (and any human or downstream agent) can read the JSON and act on it.

**Independent Test**: Run the CLI against a known sample live URL with the default rubric. Verify the produced JSON validates against the evaluator output schema, contains a composite score in 0–100, includes scores for all 10 dimensions and all sub-criteria, that every sub-criterion entry contains evidence and a suggested fix, and that re-running the CLI against the same URL with the same configuration produces byte-identical scores (modulo timestamps).

**Acceptance Scenarios**:

1. **Given** a publicly reachable URL, **When** the operator invokes the CLI with that URL, **Then** the CLI returns within a bounded time (target: ≤ 90 seconds for capture + deterministic checks + JSON emission) a JSON document that validates against the published evaluator output schema and contains a composite score plus per-dimension scores.
2. **Given** a live URL, **When** the CLI runs, **Then** it captures the required artifacts (desktop screenshot, above-the-fold screenshot, mobile 375 px screenshot, DOM snapshot, computed styles, console errors, network HAR) and uses them — together with the configured deterministic checks — to score every sub-criterion.
3. **Given** the target URL is unreachable, returns an HTTP error, or fails to settle within the configured timeout, **When** the operator invokes the CLI, **Then** the CLI exits with a non-zero status, prints a single actionable error, and does not emit a partial JSON document.
4. **Given** a successful evaluation, **When** the operator inspects the JSON, **Then** every sub-criterion has `score`, `evidence`, `evidence_source` (tool / rule ID / pixel-diff region / structural check), `severity` (Nielsen 0–4), and `suggested_fix` populated, and **no field is populated by an LLM**.
5. **Given** identical inputs (URL, configuration, optional reference image), **When** the CLI is invoked twice, **Then** the per-sub-criterion scores and the composite score are identical between runs.

---

### User Story 2 — Generator-Consumable Prioritized Output (Priority: P1)

The Evaluator agent passes the CLI's evaluation artifact back to a Generator agent (LLM) which decides what to change. The artifact must surface a `blocking` list (e.g., WCAG AA violations) and a `top_issues` list (prioritized by dimension weight × severity, capped to a small N) so the Generator can act without parsing the full dimensions tree.

**Why this priority**: The whole point of the tool is to feed a Generator. Without prioritized, blocking-aware output, the Generator thrashes across all sub-criteria. This is what makes the evaluator–generator loop actually converge per the research (Reflexion-style loops need specific, criterion-tied critiques).

**Independent Test**: Run an evaluation on a UI with at least one synthetic WCAG AA failure (e.g., body text at #999 on #fff = 2.85 : 1 contrast). Confirm the JSON contains a non-empty `blocking` array referencing the WCAG criterion (sourced from the deterministic contrast check), and that the `top_issues` array is sorted descending by `priority_score` (= dimension_weight × severity), capped at ≤ 10 entries, with each issue carrying an actionable `fix`.

**Acceptance Scenarios**:

1. **Given** a UI with one or more WCAG AA criteria scored 0 by the deterministic scanner, **When** the CLI emits its JSON, **Then** the `blocking` array contains an entry per failure with `criterion_id`, human-readable `reason`, `wcag_ref`, and the offending element's selector or bounding box.
2. **Given** a UI with multiple issues across several dimensions, **When** the CLI emits its JSON, **Then** `top_issues` lists the highest priority_score issues first, is capped at 10, and every entry carries a concrete fix description ≤ 280 characters.
3. **Given** an evaluation with no blocking issues and composite ≥ a configurable ship threshold (default 75), **When** the CLI emits its JSON, **Then** the output includes a clear "ship-ready" indicator the Evaluator/Generator (or a wrapping loop) can use to halt iteration.

---

### User Story 3 — Per-Project Rubric Configuration (Priority: P2)

A team adjusts dimension weights, toggles which sub-criteria are blocking, swaps the deterministic check assigned to a sub-criterion, and optionally adds custom sub-criteria with their own deterministic check definitions, to fit their context (e.g., consumer marketing site vs. enterprise SaaS vs. regulated government). The configuration is a single declarative file the CLI consumes at runtime.

**Why this priority**: Different products legitimately weight Brand vs. Accessibility differently, and different teams plug in different scanners. Without configuration, the tool is a one-size-fits-all artifact teams will fight against. Configuration also enables documented overrides in the research (weight floors, plugin sub-criteria).

**Independent Test**: Provide a config that lowers Visual Design weight to 5 and boosts Accessibility to 25, plus one custom sub-criterion under Usability bound to a custom deterministic check. Run an evaluation and verify the composite reflects the new weights, the custom sub-criterion appears in the output, and the Accessibility weight floor is respected (config that tries to set Accessibility < 10 is rejected with a clear error unless an explicit signed override is present).

**Acceptance Scenarios**:

1. **Given** a project config file with non-default weights summing to 100, **When** the CLI runs, **Then** the composite score is computed using the supplied weights and the output records the effective weights in its `meta`.
2. **Given** a project config that tries to set the Accessibility dimension weight below the documented floor (10) without an explicit override flag, **When** the CLI loads it, **Then** the CLI rejects the config with an error explaining the floor and how to override.
3. **Given** a project config that adds a custom sub-criterion under an existing dimension and binds it to a named deterministic check, **When** the CLI runs, **Then** that sub-criterion appears in the artifact's output with the check's result used as its score.
4. **Given** a project config that toggles a specific WCAG criterion's `blocking_if_zero` from off to on, **When** that criterion scores 0, **Then** the criterion appears in `blocking`.

---

### User Story 4 — Pixel-Level Comparison Against a Reference Design Image (Priority: P2)

The operator (or Evaluator agent) optionally supplies a reference design image (the intended UI mock-up). The CLI captures the live UI's screenshot(s) at matching viewport(s), runs a pixel-level comparison against the reference using `pixelmatch`, and feeds the diff metrics into the rubric's visual-design / layout / consistency sub-criteria — converting otherwise subjective dimensions into reproducible measurements.

**Why this priority**: Visual fidelity to a reference is the highest-signal way to make "Visual Design", "Layout & Responsiveness", and "Consistency & Design System Adherence" deterministically scorable in a CLI that does not invoke an LLM. Without it, those dimensions either go un-scored or are stuck at static defaults. With it, the Evaluator/Generator loop can converge on visual parity with a designed target.

**Independent Test**: Provide a reference image that matches the live UI exactly (zero pixel diff expected). Confirm the corresponding sub-criteria score 4 and the artifact records `diff_ratio ≈ 0`. Then alter the reference (e.g., shift the header by 10 px) and confirm the sub-criteria scores drop and a diff PNG is persisted to the debug directory. Then omit the reference entirely and confirm the CLI still runs end-to-end with the visual-parity sub-criteria reported as "not applicable" rather than failed.

**Acceptance Scenarios**:

1. **Given** a live URL **and** a reference design image at desktop viewport, **When** the CLI runs, **Then** it produces a pixelmatch comparison with `diff_ratio` (mismatched pixels / total pixels), `diff_pixel_count`, and a persisted side-by-side diff PNG in the debug directory.
2. **Given** the pixel-diff result, **When** the CLI applies the rubric, **Then** the visual-parity sub-criteria (under Visual Design, Layout, and Consistency) are scored according to documented `diff_ratio` thresholds (anchors on the 0–4 scale, e.g., 0 % → 4, ≤ 1 % → 3, ≤ 5 % → 2, ≤ 10 % → 1, > 10 % → 0).
3. **Given** the reference image and the live screenshot differ in size or aspect ratio, **When** the CLI runs, **Then** it either resizes/letterboxes per a documented policy or fails fast with a clear message — behavior is selectable via config (default: fail fast).
4. **Given** no reference image is supplied, **When** the CLI runs, **Then** the visual-parity sub-criteria are emitted with `score = null` and `status = "not_applicable"`, the composite re-weights the remaining sub-criteria within their parent dimension, and the run still completes successfully.
5. **Given** a reference image and a `--viewports` set (e.g., desktop + mobile), **When** the CLI runs, **Then** it performs a pixelmatch pass per viewport, each contributing to its own sub-criterion finding, and the diff PNGs are persisted per viewport.

---

### User Story 5 — Iterative-Loop Metadata for Generator Convergence (Priority: P2)

The CLI accepts and emits loop-metadata fields (`iteration`, `previous_composite`, `delta`, hashed list of `attempted_fixes`) so a wrapping loop driven by the Evaluator/Generator pair can detect convergence, prevent oscillation between previously attempted fixes, and stop within the documented iteration cap.

**Why this priority**: Without this metadata the Generator (via the Evaluator) cannot tell whether it is making progress, whether to stop, or whether it is re-trying a fix that previously failed. These are the documented Reflexion failure modes (mode collapse, oscillation). Lower than configuration in priority because a single-shot evaluation is still useful without it, but the loop is unusable without it.

**Independent Test**: Run the CLI twice in sequence, feeding the first run's output `composite_score` and attempted fixes back via flags into the second run. Confirm the second run's output records `iteration = 2`, populates `previous_composite` and `delta`, and the `top_issues` list does not propose any fix whose hash appears in the supplied `attempted_fixes` list.

**Acceptance Scenarios**:

1. **Given** the operator passes loop metadata flags (`--iteration N`, `--previous-composite X`, `--attempted-fixes <path>`), **When** the CLI runs, **Then** the output's `meta` reflects iteration N, computes `delta = composite − previous_composite`, and excludes any previously hashed fix from `top_issues`.
2. **Given** delta < 3 across two consecutive iterations, **When** the CLI emits the JSON, **Then** the output includes a clear "no-progress" indicator a wrapping loop can use to halt.
3. **Given** the wrapper has reached the iteration cap (default 5), **When** the operator invokes the CLI with `--iteration 6`, **Then** the CLI refuses with a clear message referencing the cap unless `--allow-overrun` is passed.

---

### Edge Cases

- **Target unreachable / 404 / DNS failure**: CLI exits non-zero with a single clear error; no partial JSON.
- **Page requires authentication**: Out of scope for v1; CLI detects an auth wall (e.g., redirected to a login screen) and reports it as a precondition failure rather than silently scoring the login page.
- **Page renders dynamically (heavy JS / SPA)**: CLI uses a headless browser with a configurable settle timeout (default ~5 s after `networkidle`); a slow page that never settles is reported with a timeout error rather than scored against an incomplete capture.
- **Very large pages (long scroll, many components)**: CLI scores the captured viewport(s) and records that the analysis is viewport-bounded; it does not silently truncate.
- **Reference image dimensions ≠ live screenshot dimensions**: The CLI fails fast by default with a clear message, or applies a documented resize/letterbox policy when explicitly enabled in the config.
- **Reference image format unsupported by the comparison library**: CLI fails fast with a clear message listing supported formats (PNG required by `pixelmatch`; JPEG/WebP must be pre-converted or the CLI converts them transparently if config opts in).
- **Deterministic tool (e.g., accessibility scanner) returns partial results (e.g., axe-core finds rules but the page has no headings to test)**: The affected sub-criteria are recorded as `status = "not_applicable"` rather than scored 0.
- **A configured deterministic tool is unavailable at runtime (binary missing, scanner crash)**: CLI follows a configurable fallback — either mark the affected sub-criteria `status = "tool_unavailable"` (with composite re-weighted) or fail fast; defaulting to fail-fast for any blocking-eligible criterion.
- **Operator supplies a config with weights that do not sum to 100**: CLI rejects the config with a precise error pointing at the offending dimensions.
- **Operator supplies a custom sub-criterion missing anchor descriptors for one or more 0–4 levels, or missing a bound deterministic check**: CLI rejects the config until all five anchors are present and a check is bound.
- **Operator passes an attempted-fixes file that is malformed**: CLI logs a warning and treats it as empty rather than failing the run, because a malformed history file should not block evaluation.
- **Composite improves but a blocking issue appears**: The JSON still flags the run as not ship-ready regardless of composite improvement.
- **Operator passes `--no-redact`**: The CLI proceeds without redaction, records `meta.redaction = "disabled"` in the output, and writes the unredacted artifacts into the debug directory (still under mode 0700); the Evaluator agent is expected to gate or scrub on `meta.redaction` before forwarding evidence to the Generator agent.
- **Installed deterministic-tool version does not match the rubric's pin**: The CLI exits non-zero by default with an error naming the tool, the pinned version, and the resolved version; with `--allow-tool-version-drift` the CLI proceeds and records the drift in `meta.tool_version_drift` with `meta.determinism = "drifted"`, signalling to the Evaluator agent that FR-003 no longer holds for this run.

## Requirements *(mandatory)*

### Functional Requirements

#### Architecture and invocation

- **FR-001**: The CLI MUST NOT invoke any LLM, hosted model API, or other non-deterministic scoring service. All scoring decisions MUST come from deterministic checks (scanners, lab tools, structural DOM/CSS checks, pixel-diff measurements).
- **FR-002**: The CLI MUST be invocable as a standalone command from a shell and from an Evaluator agent's tool-use harness, taking all inputs via command-line flags / arguments / a config file. Default output contract: the JSON evaluation artifact is written to stdout and the one-line summary (see FR-038) is written to stderr. When `--out <file>` is supplied, the JSON artifact is written to that file and the one-line summary is written to stdout. Diagnostic / progress logs (when enabled) MUST go to stderr in both modes so they never contaminate the JSON stream.
- **FR-003**: The CLI MUST be deterministic: re-running with identical inputs (URL, config, optional reference image, optional loop metadata) MUST produce identical per-sub-criterion scores and an identical composite score (timestamps and run IDs excepted). This guarantee is scoped to runs where every bound deterministic tool's installed version matches the rubric's pinned version per FR-026a (i.e., `meta.determinism = "pinned"`). Runs that proceed under `--allow-tool-version-drift` are NOT covered by this guarantee.

#### Inputs and capture

- **FR-004**: The CLI MUST accept exactly one target form for v1: a fully qualified URL of a live, publicly reachable (or network-reachable) web UI. Local HTML files and local bundles are out of scope for v1.
- **FR-005**: The CLI MUST optionally accept a reference design image (PNG by default) and an optional viewport mapping (which viewport the image represents); when supplied it is used for pixel-level comparison against the live UI's captured screenshot at that viewport.
- **FR-006**: For every target, the CLI MUST capture, before scoring: a full desktop-viewport screenshot, an above-the-fold desktop screenshot, a mobile-width (375 CSS pixel) screenshot, the rendered DOM snapshot, a computed-styles snapshot, the page's console errors, and a network HAR.
- **FR-007**: The CLI MUST render the live URL through a headless browser with a configurable settle policy (default: wait for network idle plus a small additional delay) before capturing artifacts.
- **FR-008**: The CLI MUST detect and report (without scoring) targets that resolve to an authentication wall, a server error response, or a page that fails to settle within the configured timeout.

#### Rubric application (deterministic scoring only)

- **FR-009**: The CLI MUST apply a rubric containing 10 named dimensions (Visual Design & Aesthetics; Layout & Responsiveness; Usability & Interaction Design; Accessibility — WCAG 2.2; Content & Information Architecture; Performance & Technical Quality; Code Quality — UI relevant; Brand & Emotional Design; Consistency & Design System Adherence; Microinteractions, Motion & States) with default weights that sum to 100.
- **FR-010**: Every sub-criterion in the rubric MUST be bound to a named deterministic check (e.g., `axe.color-contrast`, `lighthouse.lcp`, `pixelmatch.viewport=desktop`, `dom.heading-order`, `css.unique-color-count`, `playwright.focus-visible`). Sub-criteria that cannot be expressed as a deterministic check are EXCLUDED from the v1 rubric — the rubric definition MUST not ship sub-criteria that require LLM judgment.
- **FR-011**: The CLI MUST score every sub-criterion on the integer scale 0–4 using documented anchor thresholds keyed to that sub-criterion's bound deterministic check (e.g., a `diff_ratio ≤ 0.01` maps to score 3 on a pixel-parity sub-criterion).
- **FR-012**: Each dimension's 0–100 score MUST be computed as the mean of its applicable sub-criterion scores multiplied by 25. Sub-criteria with `status = "not_applicable"` or `status = "tool_unavailable"` MUST be excluded from the mean (the dimension is re-weighted internally), and the count of excluded sub-criteria MUST be recorded in the output.
- **FR-013**: The CLI MUST compute a single composite 0–100 score as the weighted average of dimension scores using the effective configured weights, with dimensions whose every sub-criterion is excluded contributing zero weight (re-normalized) rather than zero score.
- **FR-014**: The CLI MUST assign a Nielsen severity rating (integer 0–4) to every sub-criterion finding deterministically from the bound check's result (e.g., axe `serious` → severity 3), per a documented mapping. No LLM is consulted.
- **FR-015**: The CLI MUST raise a `blocking` entry for every sub-criterion that fails a WCAG 2.2 Level AA criterion (score 0 on a sub-criterion flagged `blocking_if_zero`), and the blocking entry MUST cite the specific WCAG reference and the offending element's selector or bounding box where the check exposes it.
- **FR-016**: The CLI MUST produce a `top_issues` list ordered by `priority_score = dimension_weight × severity` descending, capped at a small N (default 10), with each entry carrying a concise actionable fix derived from the bound check's documented fix templates.

#### Pixel-level comparison (when reference image supplied)

- **FR-017**: When a reference design image is supplied, the CLI MUST perform pixel-level comparison between the live UI's captured screenshot and the reference, using the `pixelmatch` library (https://github.com/mapbox/pixelmatch).
- **FR-018**: The pixelmatch invocation MUST expose, in the artifact, the configured threshold, `diff_pixel_count`, `total_pixel_count`, `diff_ratio`, and the path to the persisted diff PNG (when debug-artifact persistence is enabled).
- **FR-019**: The CLI MUST map `diff_ratio` to a 0–4 score per the documented pixel-parity anchors and bind that score to the visual-parity sub-criteria under Visual Design, Layout, and Consistency dimensions.
- **FR-020**: If the reference image's dimensions do not match the live screenshot's dimensions, the CLI MUST either (a) fail fast with a clear error (default) or (b) apply a documented resize/letterbox policy when explicitly enabled in the config.
- **FR-021**: When the operator supplies a reference image per viewport (e.g., desktop + mobile), the CLI MUST run one pixelmatch pass per viewport and emit one visual-parity finding per viewport.
- **FR-022**: When no reference image is supplied, the visual-parity sub-criteria MUST be emitted with `score = null` and `status = "not_applicable"`; the run MUST still complete and produce the rest of the artifact.

#### Deterministic-tool integration

- **FR-023**: The CLI MUST integrate (at minimum) one accessibility scanner, one performance/lab tool, a set of structural DOM/CSS checks, and pixelmatch as the deterministic check families that populate sub-criterion scores. Specific tool selections are implementation decisions for `/speckit-plan`.
- **FR-024**: When a deterministic tool sets a sub-criterion score, the CLI MUST populate `evidence_source` to indicate the tool, MUST record the tool's rule identifier in the evidence field, and MUST include a structural location reference (selector, bounding box, or file:line) when the tool exposes one.
- **FR-025**: When a configured deterministic tool is unavailable at runtime (binary missing, scanner crash, network failure to a lab service), the CLI MUST follow a configurable fallback policy: either mark the affected sub-criteria `status = "tool_unavailable"` and re-weight, or fail fast — defaulting to fail-fast for any blocking-eligible criterion.
- **FR-026**: Performance sub-criteria scored from lab analysis MUST be marked as `"predicted"` rather than `"measured"` to distinguish lab signals from real-user monitoring.
- **FR-026a**: The rubric definition MUST pin an exact version (not a range) for every deterministic tool whose output backs a sub-criterion score (e.g., `axe-core@4.10.2`, `pixelmatch@7.1.0`, `lighthouse@12.2.1`). At startup, the CLI MUST resolve the installed version of each pinned tool and compare it byte-for-byte to the rubric's pin. On any mismatch the CLI MUST refuse to run and exit non-zero with an error naming the tool, the pinned version, and the resolved version — unless the operator passes `--allow-tool-version-drift`, in which case the CLI proceeds and MUST record each drifted tool in `meta.tool_version_drift` (with pinned and resolved versions) and set `meta.determinism = "drifted"`. When no drift is present, `meta.determinism` MUST be `"pinned"`. The FR-003 determinism guarantee applies only when `meta.determinism = "pinned"`.

#### Configuration

- **FR-027**: The CLI MUST accept a declarative project configuration file that can override default dimension weights, toggle `blocking_if_zero` on individual sub-criteria, add custom sub-criteria (each bound to a named deterministic check) under existing dimensions, select / configure the bound check for any sub-criterion, set viewport(s) for capture and pixel comparison, and set tool fallback policy.
- **FR-028**: The CLI MUST reject configurations whose weights do not sum to 100, whose custom sub-criteria are missing anchor descriptors for any of the score levels 0–4, whose custom sub-criteria are missing a bound deterministic check, or whose Accessibility-dimension weight falls below a documented floor (10) without an explicit, named override flag.
- **FR-029**: The CLI MUST record the effective configuration (resolved weights, blocking toggles, custom sub-criteria, bound check identifiers per sub-criterion, viewports, rubric version, both the pinned tool versions from the rubric and the resolved installed versions, and the `meta.determinism` state from FR-026a) in the output's `meta`.

#### Output and loop metadata

- **FR-030**: The CLI MUST emit its result as a single JSON document conforming to a published, versioned evaluator output schema, including `rubric_version`, `target`, `composite_score`, `blocking`, per-dimension scores and sub-criteria, `top_issues`, `pixel_comparison` (when applicable), and `meta`.
- **FR-031**: Every sub-criterion entry in the output MUST contain `score` (or `null` with a `status`), `evidence` (a verbatim tool output, rule ID, or concrete numeric measurement, ≤ 300 characters), `evidence_source` (tool / check identifier), `severity`, `suggested_fix` (≤ 280 characters), and optionally `location` and `confidence`. Evidence and suggested_fix MUST come from the deterministic check's templated outputs, never from an LLM. Evidence strings MUST be sanitized per FR-039 before emission — i.e., they MUST NOT contain raw `Set-Cookie` / `Cookie` / `Authorization` header values, raw HAR request bodies for write methods, or raw values from password / email / tel / `autocomplete=cc-*` form inputs; the reference design image MUST be referenced by path only, never base64-embedded or otherwise echoed into the evidence string.
- **FR-032**: The CLI MUST accept loop-metadata inputs (`--iteration`, `--previous-composite`, `--attempted-fixes <path>`) and populate the output's `meta.iteration`, `meta.previous_composite`, and `meta.delta` accordingly.
- **FR-033**: When an `attempted-fixes` list is supplied, the CLI MUST exclude any fix whose hash matches a prior attempt from the `top_issues` list (oscillation prevention).
- **FR-034**: The CLI MUST refuse iterations beyond a documented cap (default 5) unless an explicit override flag is supplied.
- **FR-035**: The CLI MUST emit a clear "ship-ready" indicator when `blocking` is empty and `composite_score ≥` a configurable threshold (default 75), and a "no-progress" indicator when delta < 3 across consecutive iterations.

#### Errors and observability

- **FR-036**: On any unrecoverable error (malformed config, schema-validation failure on emitted output, target unreachable, missing bound check, reference image mismatch under default policy), the CLI MUST exit non-zero with a single actionable error message and MUST NOT emit a partial evaluation JSON.
- **FR-037**: The CLI MUST optionally persist debugging artifacts (captured screenshots per viewport, reference image as captured, pixelmatch diff PNGs, raw scanner/lab-tool reports, HAR, console-error log) to a user-specified directory so that disagreements and failures are auditable. The debug directory MUST be created with restrictive permissions (mode 0700 on POSIX systems) and all persisted HAR / DOM-snapshot artifacts MUST be redacted per FR-039 before being written to disk.
- **FR-038**: The CLI MUST emit a one-line, machine-friendly summary (composite score, blocking count, top-issue count, ship-ready flag) suitable for piping into an Evaluator/Generator agent's tool-use harness or a CI pipeline. Per the output contract in FR-002, this summary is written to stderr by default and switches to stdout when `--out <file>` is used (i.e., it is always written to the stream that does NOT carry the JSON artifact).

- **FR-039**: The CLI MUST apply default-on redaction to every byte stream that flows into the emitted JSON or the debug directory. Specifically, by default the CLI MUST: (a) redact the values of `Set-Cookie`, `Cookie`, and `Authorization` headers and any header whose name matches `*-csrf-*` / `x-api-key` / `x-auth-*` (case-insensitive) in the network HAR (request and response); (b) redact request bodies of HAR entries whose method is `POST`, `PUT`, or `PATCH`; (c) redact the `value` attribute of DOM elements matching `input[type=password]`, `input[type=email]`, `input[type=tel]`, or `[autocomplete^=cc-]`; (d) ensure no evidence string (FR-031) contains a raw cookie value, raw auth-header value, or raw form-input value substring; (e) reference the supplied reference design image by path only (never embed or echo its bytes into evidence). Redaction MUST replace the offending value with a fixed placeholder (e.g., `"<redacted>"`) so that structural shape is preserved and downstream JSON parsing is unaffected. The operator MAY opt out of redaction by passing `--no-redact`; when `--no-redact` is in effect, the CLI MUST record `meta.redaction = "disabled"` in the output so the Evaluator agent can detect that sensitive bytes may be present.

### Key Entities

- **Rubric Definition**: A versioned document declaring the 10 dimensions, their default weights, and each sub-criterion's name, description, 0–4 anchor descriptors, references (Nielsen / Shneiderman / WCAG / Material / HIG / Gestalt), `blocking_if_zero` flag, and **the bound deterministic check** (check family + rule identifier + anchor-threshold mapping) that produces its score. The rubric definition is independent of any single evaluation run.
- **Project Configuration**: A per-project overlay on the rubric definition declaring effective dimension weights, blocking toggles, custom sub-criteria, bound-check overrides, viewports for capture and pixel comparison, reference-image policies, and feature flags (tool fallback policy, iteration cap, ship threshold).
- **Target Capture**: The set of artifacts captured for a single target before scoring: desktop screenshot, above-the-fold screenshot, mobile screenshot, DOM snapshot, computed-styles snapshot, console errors, network HAR, and a content hash that identifies this capture uniquely.
- **Reference Design Image**: An optional input image (PNG) representing the intended UI design at a declared viewport. When supplied, the CLI compares the captured screenshot at the matching viewport to it via `pixelmatch` and uses the resulting `diff_ratio` to score the visual-parity sub-criteria.
- **Deterministic Check**: A named, reproducible routine — an accessibility scanner rule, a lab-tool metric, a structural DOM/CSS check, or a pixel-diff operation — that takes the capture (and optionally the reference image) as input and returns a score (0–4), an evidence string, a severity, and an optional location. The set of available checks is a registry the CLI ships and the project configuration can extend.
- **Evaluation Result**: The single JSON document the CLI emits per run, conforming to the evaluator output schema and containing rubric version, target reference, composite score, blocking list, per-dimension and per-sub-criterion scored findings, top-issues priority list, pixel-comparison block (when applicable), and meta (tool versions, iteration, previous composite, delta, effective configuration).
- **Sub-criterion Finding**: A scored observation about a single sub-criterion, comprising score (0–4) or null with `status`, evidence (tool rule ID + verbatim measurement), evidence source (tool / check identifier), location reference (selector / bounding box / file:line where applicable), Nielsen severity (0–4), suggested fix, and confidence.
- **Top Issue**: A prioritized item in the `top_issues` list — references back to a sub-criterion finding, carries a `priority_score = dimension_weight × severity`, a rank, a concrete fix, and an optional expected-impact note.
- **Loop Metadata**: The set of fields linking one CLI invocation to the next in an Evaluator/Generator-driven loop: iteration index, previous composite score, delta, hashed list of previously attempted fixes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A single evaluation against a representative live URL completes end-to-end in under 90 seconds (target capture + deterministic checks + optional pixel comparison + JSON emission) on a typical broadband network.
- **SC-002**: 100 % of CLI runs that succeed emit a JSON document that validates against the published evaluator output schema; any malformed output causes a non-zero exit rather than a partial emission.
- **SC-003**: Re-running the CLI on the same URL with the same configuration and the same reference image yields 100 % identical per-sub-criterion scores and identical composite score across runs (timestamps / run IDs excepted).
- **SC-004**: For every sub-criterion in the v1 rubric, the bound deterministic check exists, runs, and produces a score on at least one representative target — verified by a rubric-completeness test.
- **SC-005**: Every emitted sub-criterion finding contains a non-empty `evidence` field (or an explicit `status` of "not_applicable" / "tool_unavailable"), a non-empty `evidence_source`, and a non-empty `suggested_fix` (when scored < 4); no finding contains LLM-generated prose.
- **SC-006**: When a WCAG 2.2 Level AA criterion fails on the target (as detected by the bound accessibility scanner), the CLI surfaces a `blocking` entry referencing the specific WCAG criterion and the offending element on 100 % of such runs.
- **SC-007**: The `top_issues` list is correctly ordered by `priority_score` (dimension_weight × severity) descending and capped at the configured N (default 10) on 100 % of runs.
- **SC-008**: A Generator agent consuming the JSON can deterministically extract the blocking list and the top issues without parsing the full dimensions tree — verifiable by a contract test that loads sample outputs and reads only those two fields.
- **SC-009**: A reviewer can configure dimension weights, add a custom sub-criterion with a bound deterministic check, and toggle a blocking flag through the project configuration file alone, without modifying the CLI source — measured by a configuration-only acceptance test.
- **SC-010**: In a wrapped Evaluator/Generator loop, the CLI's loop-metadata enables the loop to halt within at most 5 iterations on a representative target — verified by a loop test where the CLI is invoked iteratively and the loop detects either ship-readiness, no-progress, or iteration-cap exhaustion.
- **SC-011**: When a reference design image is supplied at a declared viewport, the CLI produces a pixelmatch `diff_ratio` and a persisted diff PNG, and the visual-parity sub-criteria are scored per the documented threshold mapping on 100 % of such runs.
- **SC-012**: When the reference design image is omitted, the CLI still completes successfully with the visual-parity sub-criteria reported as `not_applicable` and the composite re-weighted accordingly on 100 % of such runs.
- **SC-013**: All ten dimensions plus their full set of sub-criteria appear in every successful output, even when some sub-criteria are marked `not_applicable` — measured by a structural completeness check on the output JSON.

## Assumptions

- The CLI is a **deterministic tool**; it does not call any LLM, model API, or non-deterministic external service. The Evaluator agent (LLM) calls this CLI as a tool, and the Generator agent (LLM) consumes its output. Both agents are out of scope for this feature.
- The CLI runs in an environment where a headless browser can be launched (network egress permitting) and where one or more accessibility / performance tools can be installed alongside the CLI.
- Targets are assumed to be public or network-reachable without authentication for v1; authentication-protected flows, complex multi-step user journeys, and full SPA route enumeration are out of scope for v1. Local HTML files and bundles are also out of scope for v1.
- Reference design images are assumed to be in a format `pixelmatch` accepts (PNG); other formats (JPEG, WebP) require explicit opt-in to transparent conversion in the config.
- The rubric is versioned independently of the CLI binary so that rubric updates (anchor revisions, new sub-criteria, new bound checks, WCAG 3 transition) do not require a CLI release.
- Performance sub-criteria are scored from lab / static signals (e.g., synthetic Core Web Vitals from a headless tool) and are explicitly marked as `"predicted"` rather than real-user-monitoring measurements.
- The accessibility-weight floor and the default ship threshold are policy defaults documented in the rubric definition; teams may tune them within bounds but the WCAG-AA blocking mechanism remains on by default and cannot be silently disabled.
- A single CLI invocation scores a single page / single capture; multi-page or full-site evaluation is out of scope for v1 and can be composed by an outer orchestrator (which may itself be the Evaluator agent issuing multiple tool calls).
- Stage-4 human calibration (Cohen's kappa against senior-designer scoring) is a downstream activity informed by this CLI's outputs and is not part of the CLI's v1 surface area.
- Bias-mitigation mechanisms specific to LLM-as-judge (cross-family enforcement, two-pass evaluation, verbosity caps, temperature pinning) are **not applicable** to this CLI because it does not invoke an LLM; if the operator wants two-pass agreement, that is the Evaluator agent's responsibility, not the CLI's.
