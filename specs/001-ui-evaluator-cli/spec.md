# Feature Specification: Web UI Evaluator CLI

**Feature Branch**: `001-ui-evaluator-cli`

**Created**: 2026-05-22

**Status**: Draft

**Input**: User description: "CLI tool for the Evaluator agent that evaluates the web UI with a multi-dimensional rubric. The output is consumed by a Generator agent to improve its output. Based on the provided research: 10 weighted dimensions anchored in Nielsen, Shneiderman, WCAG 2.2, and Gestalt; 0–4 Likert with anchor descriptors; bias-mitigated LLM-as-judge; structured JSON output with per-criterion evidence, severity, and suggested fix; prioritized top-N issues; blocking flag for WCAG AA failures; configurable per project."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Single Evaluation Pass on a Target UI (Priority: P1)

A developer or designer points the CLI at a web UI (live URL, local rendered file, or HTML+CSS bundle) and receives a machine-parseable JSON report describing the UI's quality across 10 weighted dimensions, with a composite 0–100 score, per-dimension and per-sub-criterion scores, evidence quotes, severity ratings, and suggested fixes.

**Why this priority**: This is the irreducible core of the tool — without a working single-pass evaluation, none of the loop, configuration, or objective-tool integrations matter. It is the MVP that delivers immediate value: any human or downstream agent can read the JSON and act on it. All other stories layer on top.

**Independent Test**: Run the CLI against a known sample page (e.g., a local static HTML file) with default rubric and a configured evaluator model. Verify the produced JSON validates against the evaluator output schema, contains a composite score in 0–100, includes scores for all 10 dimensions and all sub-criteria, and that every sub-criterion entry contains evidence and a suggested fix.

**Acceptance Scenarios**:

1. **Given** a publicly reachable URL and a valid evaluator-model credential, **When** the operator invokes the CLI with that URL, **Then** the CLI returns within a bounded time (target: ≤ 3 minutes) a JSON document that validates against the published evaluator output schema and contains a composite score plus per-dimension scores.
2. **Given** a local HTML+CSS bundle on disk, **When** the operator invokes the CLI with that path, **Then** the CLI renders the bundle in a headless viewport, captures the required artifacts (desktop screenshot, above-the-fold screenshot, mobile 375 px screenshot, DOM snapshot, computed styles), and produces the same JSON shape as the URL case.
3. **Given** the evaluator model is unavailable or credentials are missing, **When** the operator invokes the CLI, **Then** the CLI exits with a non-zero status, prints a single actionable error, and does not emit a partial JSON document.
4. **Given** a successful evaluation, **When** the operator inspects the JSON, **Then** every sub-criterion has `score`, `evidence`, `severity` (Nielsen 0–4), and `suggested_fix` populated; rationale length per sub-criterion does not exceed 2 sentences.

---

### User Story 2 — Generator-Consumable Prioritized Output (Priority: P1)

A Generator agent reads the Evaluator's JSON and decides what to change. The output must surface a `blocking` list (e.g., WCAG AA violations) and a `top_issues` list (prioritized by dimension weight × severity, capped to a small N) so the Generator can act without parsing the full dimensions tree.

**Why this priority**: The whole point of the tool is to feed a Generator. Without prioritized, blocking-aware output, the Generator thrashes across all 47 sub-criteria. This is what makes the evaluator–generator loop actually converge per the research (Reflexion-style loops need specific, criterion-tied critiques).

**Independent Test**: Run an evaluation on a UI with at least one synthetic WCAG AA failure (e.g., body text at #999 on #fff = 2.85:1 contrast). Confirm the JSON contains a non-empty `blocking` array referencing the WCAG criterion, and that the `top_issues` array is sorted descending by `priority_score` (= dimension_weight × severity), capped at ≤ 10 entries, and each issue has an actionable `fix`.

**Acceptance Scenarios**:

1. **Given** a UI with one or more WCAG AA criteria scored 0, **When** the CLI emits its JSON, **Then** the `blocking` array contains an entry per failure with `criterion_id`, human-readable `reason`, and `wcag_ref`.
2. **Given** a UI with multiple issues across several dimensions, **When** the CLI emits its JSON, **Then** `top_issues` lists the highest priority_score issues first, is capped at 10, and every entry carries a concrete fix description ≤ 280 characters.
3. **Given** an evaluation with no blocking issues and composite ≥ a configurable ship threshold (default 75), **When** the CLI emits its JSON, **Then** the output includes a clear "ship-ready" indicator the Generator (or a wrapping loop) can use to halt iteration.

---

### User Story 3 — Per-Project Rubric Configuration (Priority: P2)

A team adjusts dimension weights, toggles which sub-criteria are blocking, and optionally adds custom sub-criteria to fit their context (e.g., consumer marketing site vs. enterprise SaaS vs. regulated government). The configuration is a single declarative file the CLI consumes at runtime.

**Why this priority**: Different products legitimately weight Brand vs. Accessibility differently. Without configuration, the tool is a one-size-fits-all artifact teams will fight against. Configuration also enables the documented overrides in the research (weight floors, plugin sub-criteria).

**Independent Test**: Provide a config that lowers Visual Design weight to 5 and boosts Accessibility to 25, plus one custom sub-criterion under Usability. Run an evaluation and verify the composite reflects the new weights, the custom sub-criterion appears in the output with its anchors applied, and the Accessibility weight floor is respected (config that tries to set Accessibility < 10 is rejected with a clear error unless an explicit signed override is present).

**Acceptance Scenarios**:

1. **Given** a project config file with non-default weights summing to 100, **When** the CLI runs, **Then** the composite score is computed using the supplied weights and the output records the effective weights in its `meta`.
2. **Given** a project config that tries to set the Accessibility dimension weight below the documented floor (10) without an explicit override flag, **When** the CLI loads it, **Then** the CLI rejects the config with an error explaining the floor and how to override.
3. **Given** a project config that adds a custom sub-criterion under an existing dimension, **When** the CLI runs, **Then** that sub-criterion appears in the evaluator's output with its supplied anchors used during scoring.
4. **Given** a project config that toggles a specific WCAG AAA criterion's `blocking_if_zero` from off to on, **When** that criterion scores 0, **Then** the criterion appears in `blocking`.

---

### User Story 4 — Objective-Tool Integration for High-Confidence Criteria (Priority: P2)

For criteria with well-defined automated checks (WCAG contrast and structure, Core Web Vitals), the CLI invokes objective tooling (accessibility scanner, performance lab tool) and uses their results to set the corresponding sub-criterion scores deterministically — bypassing LLM judgment where a measurable answer exists.

**Why this priority**: The research is explicit that VLMs are imperfect at fine UI detail; the WebAIM Million 2026 contrast-failure rate (83.9 %) is the single highest-yield check; deterministic tools eliminate LLM variance on the criteria that matter most. This story makes scores trustworthy on the most-failed dimensions.

**Independent Test**: Run with objective tools enabled on a UI known to fail an automated accessibility check. Confirm the corresponding sub-criterion score is set deterministically (not by the LLM), the evidence cites the tool's rule ID, and re-running the CLI yields the identical score for that sub-criterion.

**Acceptance Scenarios**:

1. **Given** objective tools are enabled in the config and a target with a measurable contrast failure, **When** the CLI runs, **Then** the contrast sub-criterion's score and evidence come from the automated tool, the `evidence_source` field reflects the tool, and the LLM's opinion on that sub-criterion is not used.
2. **Given** objective tools are enabled and the target's Core Web Vitals are measured by the performance tool, **When** the CLI runs, **Then** the corresponding sub-criteria are scored using the documented thresholds (LCP ≤ 2.5 s = "good", INP ≤ 200 ms, CLS ≤ 0.1) and marked as "predicted" if measurement is lab-only.
3. **Given** a configured objective tool is unavailable at runtime, **When** the CLI runs, **Then** the CLI either falls back to LLM judgment for the affected sub-criterion (with a `confidence` reduction recorded) or fails fast — behavior is selectable via config.

---

### User Story 5 — Iterative-Loop Metadata for Generator Convergence (Priority: P2)

The CLI accepts and emits loop-metadata fields (`iteration`, `previous_composite`, `delta`, hashed list of `attempted_fixes`) so a wrapping Generator loop can detect convergence, prevent oscillation between previously attempted fixes, and stop within the documented iteration cap.

**Why this priority**: Without this metadata the Generator cannot tell whether it is making progress, whether to stop, or whether it is re-trying a fix that previously failed. These are the documented Reflexion failure modes (mode collapse, oscillation). Lower than configuration in priority because a single-shot evaluation is still useful without it, but the loop is unusable without it.

**Independent Test**: Run the CLI twice in sequence, feeding the first run's output `composite_score` and attempted fixes back via flags into the second run. Confirm the second run's output records `iteration = 2`, populates `previous_composite` and `delta`, and the `top_issues` list does not propose any fix whose hash appears in the supplied `attempted_fixes` list.

**Acceptance Scenarios**:

1. **Given** the operator passes loop metadata flags (`--iteration N`, `--previous-composite X`, `--attempted-fixes <path>`), **When** the CLI runs, **Then** the output's `meta` reflects iteration N, computes `delta = composite − previous_composite`, and excludes any previously hashed fix from `top_issues`.
2. **Given** delta < 3 across two consecutive iterations, **When** the CLI emits the JSON, **Then** the output includes a clear "no-progress" indicator a wrapping loop can use to halt.
3. **Given** the wrapper has reached the iteration cap (default 5), **When** the operator invokes the CLI with `--iteration 6`, **Then** the CLI refuses with a clear message referencing the cap unless `--allow-overrun` is passed.

---

### User Story 6 — Bias-Mitigated Two-Pass Evaluation (Priority: P3)

For higher-stakes runs, the operator opts into a second independent evaluator pass. The CLI checks dimension-score consistency between passes (within ±1 point), flags disagreements, and on conflict takes the lower (more conservative) score. The CLI also enforces cross-family selection — refusing to use the same model family as the configured Generator unless explicitly overridden.

**Why this priority**: This is the documented LLM-as-judge bias mitigation (self-preference, sycophancy, verbosity). It materially improves trust in the score but is not required to ship the basic single-pass MVP — it is a hardening story for stage 2/3 of the research's recommended rollout.

**Independent Test**: Run the CLI with `--passes 2` against the same UI. Verify two independent evaluations occur (different random seeds or independent calls), the final JSON records both raw passes plus the reconciled scores, and any sub-criterion whose two scores differ by > 1 point appears in a `disagreements` list. Then attempt to configure the same model family as evaluator and generator; verify the CLI refuses unless `--allow-same-family` is set.

**Acceptance Scenarios**:

1. **Given** `--passes 2` is requested, **When** the CLI runs, **Then** two independent evaluator invocations occur, the lower score is taken on disagreements > 1 point, and a `disagreements` list is included in the output.
2. **Given** the configured evaluator model belongs to the same family as the declared generator model, **When** the CLI starts, **Then** it refuses to run with an actionable error unless an explicit override flag is supplied.
3. **Given** the evaluator's rationale per sub-criterion exceeds 2 sentences, **When** the CLI post-processes the response, **Then** it truncates / re-asks (configurable) so the verbosity cap is enforced.

---

### Edge Cases

- **Target unreachable / 404 / DNS failure**: CLI exits non-zero with a single clear error; no partial JSON.
- **Page requires authentication**: Out of scope for v1; CLI detects an auth wall (e.g., redirected to a login screen) and reports it as a precondition failure rather than silently scoring the login page.
- **Page renders dynamically (heavy JS / SPA)**: CLI uses a headless browser with a configurable settle timeout (default ~5 s after `networkidle`); a slow page that never settles is reported with a timeout error rather than scored against an incomplete capture.
- **Very large pages (long scroll, many components)**: CLI scores the captured viewport(s) and records that the analysis is viewport-bounded; it does not silently truncate.
- **LLM returns malformed JSON**: CLI retries with a stricter prompt up to a small bounded number of times (e.g., 2), then fails with a clear error and the raw response saved to a debug artifact.
- **Objective tool returns partial results (e.g., axe-core finds rules but page has no headings to test)**: The affected sub-criteria are recorded as "not applicable" rather than scored 0.
- **Operator supplies a config with weights that do not sum to 100**: CLI rejects the config with a precise error pointing at the offending dimensions.
- **Operator supplies a custom sub-criterion missing anchor descriptors for one or more 0–4 levels**: CLI rejects the config until all five anchors are present.
- **Operator passes an attempted-fixes file that is malformed**: CLI logs a warning and treats it as empty rather than failing the run, because a malformed history file should not block evaluation.
- **Composite improves but a blocking issue appears**: The JSON still flags the run as not ship-ready regardless of composite improvement.

## Requirements *(mandatory)*

### Functional Requirements

#### Inputs and capture

- **FR-001**: The CLI MUST accept a target web UI specified as either (a) a fully qualified URL, (b) a path to a local HTML file, or (c) a path to a directory containing an entry HTML file plus referenced assets.
- **FR-002**: For every target, the CLI MUST capture, before scoring, the following artifacts: a full desktop-viewport screenshot, an above-the-fold desktop screenshot, a mobile-width (375 CSS pixel) screenshot, the rendered DOM snapshot, and a computed-styles snapshot.
- **FR-003**: When the target is a local file or directory, the CLI MUST render it through a headless browser with a configurable settle policy (default: wait for network idle plus a small additional delay) before capturing artifacts.
- **FR-004**: The CLI MUST detect and report (without scoring) targets that resolve to an authentication wall, a server error response, or a page that fails to settle within the configured timeout.

#### Rubric application

- **FR-005**: The CLI MUST apply a rubric containing 10 named dimensions (Visual Design & Aesthetics; Layout & Responsiveness; Usability & Interaction Design; Accessibility — WCAG 2.2; Content & Information Architecture; Performance & Technical Quality; Code Quality — UI relevant; Brand & Emotional Design; Consistency & Design System Adherence; Microinteractions, Motion & States) with default weights that sum to 100.
- **FR-006**: Each dimension MUST decompose into named sub-criteria (≈ 47 in total across the rubric) and each sub-criterion MUST carry explicit anchor descriptions for every score level 0, 1, 2, 3, 4.
- **FR-007**: The CLI MUST score every sub-criterion on the integer scale 0–4 and compute each dimension's 0–100 score as the mean of its sub-criterion scores multiplied by 25.
- **FR-008**: The CLI MUST compute a single composite 0–100 score as the weighted average of dimension scores using the effective configured weights.
- **FR-009**: The CLI MUST assign a Nielsen severity rating (integer 0–4) to every sub-criterion finding, where 4 = "Usability catastrophe: imperative to fix before release" and 0 = "not a problem".
- **FR-010**: The CLI MUST raise a `blocking` entry for every sub-criterion that fails a WCAG 2.2 Level AA criterion (score 0 on a sub-criterion flagged as blocking-on-zero), and the blocking entry MUST cite the specific WCAG reference.
- **FR-011**: The CLI MUST produce a `top_issues` list ordered by `priority_score = dimension_weight × severity` descending, capped at a small N (default 10), with each entry carrying a concise actionable fix.

#### Evaluator behavior and bias mitigation

- **FR-012**: The CLI MUST invoke a vision-capable LLM as the evaluator, supplying the captured screenshots, DOM, computed styles, and source code in a single structured prompt.
- **FR-013**: The CLI MUST constrain the evaluator's output to a documented JSON schema and reject (with bounded retries) any response that fails schema validation.
- **FR-014**: The CLI MUST cap evaluator rationale at ≤ 2 sentences per sub-criterion (verbosity-bias mitigation).
- **FR-015**: The CLI MUST refuse to run when the configured evaluator model and the declared generator model belong to the same model family, unless an explicit override flag is supplied (self-preference mitigation).
- **FR-016**: The CLI MUST run the evaluator at temperature 0 (or near-zero, as supported by the chosen provider) by default to minimize run-to-run variance.
- **FR-017**: The CLI MUST NOT include the previous iteration's composite score or per-dimension scores in the evaluator's prompt (sycophancy mitigation); iteration-aware logic operates outside the evaluator's context.
- **FR-018**: The CLI MUST support a `--passes N` mode (default 1) in which N independent evaluations are run, dimension scores are compared, disagreements > 1 point per sub-criterion are recorded, and the lower (more conservative) score is taken on conflict.

#### Objective-tool integration

- **FR-019**: The CLI MUST support optional integration with one or more objective accessibility scanners and one or more performance/lab tools; when enabled, the corresponding sub-criteria are scored by tool output rather than by the LLM.
- **FR-020**: When an objective tool sets a sub-criterion score, the CLI MUST populate `evidence_source` to indicate the tool and MUST record the tool's rule identifier in the evidence field.
- **FR-021**: When an objective tool is enabled but unavailable at runtime, the CLI MUST follow a configurable fallback policy: either fall back to LLM judgment with a reduced confidence value, or fail fast — defaulting to fail-fast for any blocking-eligible criterion.
- **FR-022**: Performance sub-criteria scored from static / lab analysis MUST be marked as "predicted" rather than measured.

#### Configuration

- **FR-023**: The CLI MUST accept a declarative project configuration file that can override default dimension weights, toggle `blocking_if_zero` on individual sub-criteria, add custom sub-criteria under existing dimensions, and select the evaluator model.
- **FR-024**: The CLI MUST reject configurations whose weights do not sum to 100, whose custom sub-criteria are missing anchor descriptors for any of the score levels 0–4, or whose Accessibility-dimension weight falls below a documented floor (10) without an explicit, named override flag.
- **FR-025**: The CLI MUST record the effective configuration (resolved weights, blocking toggles, custom sub-criteria, evaluator model identifier, rubric version) in the output's `meta`.

#### Output and loop metadata

- **FR-026**: The CLI MUST emit its result as a single JSON document conforming to a published, versioned evaluator output schema, including `rubric_version`, `target`, `composite_score`, `blocking`, per-dimension scores and sub-criteria, `top_issues`, and `meta`.
- **FR-027**: Every sub-criterion entry in the output MUST contain `score`, `evidence` (a verbatim quote from code OR a concrete observation from a screenshot, ≤ 300 characters), `evidence_source`, `severity`, `suggested_fix` (≤ 280 characters), and optionally `location` and `confidence`.
- **FR-028**: The CLI MUST accept loop-metadata inputs (`--iteration`, `--previous-composite`, `--attempted-fixes <path>`) and populate the output's `meta.iteration`, `meta.previous_composite`, and `meta.delta` accordingly.
- **FR-029**: When an `attempted-fixes` list is supplied, the CLI MUST exclude any fix whose hash matches a prior attempt from the `top_issues` list (oscillation prevention).
- **FR-030**: The CLI MUST refuse iterations beyond a documented cap (default 5) unless an explicit override flag is supplied.
- **FR-031**: The CLI MUST emit a clear "ship-ready" indicator when `blocking` is empty and `composite_score ≥` a configurable threshold (default 75), and a "no-progress" indicator when delta < 3 across consecutive iterations.

#### Determinism, errors, and observability

- **FR-032**: Re-running the CLI with identical inputs, identical configuration, and objective-tool-only scoring MUST produce identical scores on objective sub-criteria.
- **FR-033**: On any unrecoverable error (missing credentials, malformed config, schema-validation failure after retries, target unreachable), the CLI MUST exit non-zero with a single actionable error message and MUST NOT emit a partial evaluation JSON.
- **FR-034**: The CLI MUST optionally persist debugging artifacts (captured screenshots, raw evaluator response, objective-tool reports) to a user-specified directory so that disagreements and failures are auditable.
- **FR-035**: The CLI MUST emit a one-line, machine-friendly summary (composite score, blocking count, top-issue count) to standard output suitable for piping into a Generator agent or a CI pipeline.

### Key Entities

- **Rubric Definition**: A versioned document declaring the 10 dimensions, their default weights, and each sub-criterion's name, description, 0–4 anchor descriptors, references (Nielsen / Shneiderman / WCAG / Material / HIG / Gestalt), `blocking_if_zero` flag, and any associated automated-check identifier. The rubric definition is independent of any single evaluation run.
- **Project Configuration**: A per-project overlay on the rubric definition declaring effective dimension weights, blocking toggles, custom sub-criteria, the selected evaluator model identifier, the declared generator model identifier (used for cross-family enforcement), and feature flags (objective tools on/off, passes, iteration cap, ship threshold).
- **Target Capture**: The set of artifacts captured for a single target before scoring: desktop screenshot, above-the-fold screenshot, mobile screenshot, DOM snapshot, computed-styles snapshot, source HTML/CSS, and a content hash that identifies this capture uniquely.
- **Evaluation Result**: The single JSON document the CLI emits per run, conforming to the evaluator output schema and containing rubric version, target reference, composite score, blocking list, per-dimension and per-sub-criterion scored findings, top-issues priority list, and meta (model identifiers, iteration, previous composite, delta, effective configuration).
- **Sub-criterion Finding**: A scored observation about a single sub-criterion, comprising score (0–4), evidence quote or observation, evidence source (screenshot/DOM/CSS/HTML/computed-style/tool), location reference (selector / bounding box / file:line where applicable), Nielsen severity (0–4), suggested fix, and confidence.
- **Top Issue**: A prioritized item in the `top_issues` list — references back to a sub-criterion finding, carries a `priority_score = dimension_weight × severity`, a rank, a concrete fix, and an optional expected-impact note.
- **Loop Metadata**: The set of fields linking one CLI invocation to the next in a Generator-driven loop: iteration index, previous composite score, delta, hashed list of previously attempted fixes, evaluator model identifier, generator model identifier.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A single evaluation against a representative web page completes end-to-end in under 3 minutes (target capture + objective tools + LLM scoring + JSON emission) on a typical broadband network.
- **SC-002**: 100 % of CLI runs that succeed emit a JSON document that validates against the published evaluator output schema; any malformed output causes a non-zero exit rather than a partial emission.
- **SC-003**: Across two independent evaluator passes on the same target, per-dimension scores agree within ±1 point on at least 90 % of dimensions for objective-leaning runs (with objective tools enabled).
- **SC-004**: For objective sub-criteria (e.g., contrast, target size) when objective tools are enabled, the CLI achieves 100 % agreement with the underlying tool's verdict and 100 % run-to-run determinism on identical inputs.
- **SC-005**: Every emitted sub-criterion finding contains a non-empty `evidence` field and a non-empty `suggested_fix` field; samples drawn from real runs confirm rationale length stays within the 2-sentence cap on at least 95 % of findings.
- **SC-006**: When a WCAG 2.2 Level AA criterion fails on the target, the CLI surfaces a `blocking` entry referencing the specific WCAG criterion on 100 % of such runs.
- **SC-007**: The `top_issues` list is correctly ordered by `priority_score` (dimension_weight × severity) descending and capped at the configured N (default 10) on 100 % of runs.
- **SC-008**: A Generator agent consuming the JSON can deterministically extract the blocking list and the top issues without parsing the full dimensions tree — verifiable by a contract test that loads sample outputs and reads only those two fields.
- **SC-009**: A reviewer can configure dimension weights, add a custom sub-criterion, and toggle a blocking flag through the project configuration file alone, without modifying the CLI source — measured by a configuration-only acceptance test.
- **SC-010**: In a wrapped Generator loop, the CLI's loop-metadata enables the loop to halt within at most 5 iterations on a representative target — verified by a loop test where the CLI is invoked iteratively and the loop detects either ship-readiness, no-progress, or iteration-cap exhaustion.
- **SC-011**: When the evaluator and the declared generator share a model family, the CLI refuses to run on 100 % of such configurations unless an explicit override flag is supplied.
- **SC-012**: All ten dimensions plus their full set of sub-criteria appear in every successful output, even when some sub-criteria are marked "not applicable" — measured by a structural completeness check on the output JSON.

## Assumptions

- The evaluator is invoked through a vision-capable hosted LLM accessible via standard API credentials supplied through environment variables; the CLI does not ship a model.
- Cross-family enforcement uses a declared, maintained mapping from model identifiers to "model families"; the operator is responsible for keeping that mapping accurate when new models appear.
- Targets are assumed to be public or locally accessible without authentication for v1; authentication-protected flows, complex multi-step user journeys, and full SPA route enumeration are out of scope for v1.
- A single CLI invocation scores a single page / single capture; multi-page or full-site evaluation is out of scope for v1 and can be composed by an outer orchestrator.
- The CLI runs in an environment where a headless browser can be launched (network egress permitting) and where one or more optional accessibility / performance tools can be installed alongside the CLI.
- The rubric is versioned independently of the CLI binary so that rubric updates (anchor revisions, new sub-criteria, WCAG 3 transition) do not require a CLI release.
- Performance sub-criteria are scored from lab / static signals (e.g., synthetic Core Web Vitals from a headless tool) and are explicitly marked as "predicted" rather than real-user-monitoring measurements.
- The Generator agent is a separate component out of scope for this feature; this CLI is only responsible for emitting a JSON the Generator can consume, plus accepting loop-metadata flags the Generator (or its wrapper) supplies.
- The accessibility-weight floor and the default ship threshold are policy defaults documented in the rubric definition; teams may tune them within bounds but the WCAG-AA blocking mechanism remains on by default and cannot be silently disabled.
- Stage-4 human calibration (Cohen's kappa against senior-designer scoring) is a downstream activity informed by this CLI's outputs and is not part of the CLI's v1 surface area.
