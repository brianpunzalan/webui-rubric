# Data Model: Web UI Evaluator CLI

**Date**: 2026-05-23 | **Plan**: `specs/001-ui-evaluator-cli/plan.md`

## Entity Relationship Overview

```
RubricDefinition 1──* Dimension 1──* SubCriterion 1──1 BoundCheck
       │                   │                │
       │                   │                ├── visual_parity: boolean
       │                   │                └── blocking_if_zero: boolean
       │                   │
       │                   └── weight (sums to 100 across all dimensions)
       │
ProjectConfig ──overlays──> RubricDefinition
       │
       ├── weight overrides
       ├── blocking toggles
       ├── custom sub-criteria
       ├── viewport config
       └── feature flags

TargetCapture ──produces──> CaptureArtifacts
       │                        │
       │                        ├── screenshots (desktop, above-fold, mobile)
       │                        ├── DOM snapshot
       │                        ├── computed styles
       │                        ├── console errors
       │                        └── network HAR
       │
       └── content_hash (SHA-256 of combined artifacts)

EvaluationResult 1──* DimensionResult 1──* SubCriterionFinding
       │                                        │
       │                                        ├── score (0–4 | null)
       │                                        ├── evidence
       │                                        ├── severity
       │                                        └── suggested_fix
       │
       ├── 1──* BlockingEntry
       ├── 1──* TopIssue
       ├── 0..1── PixelComparison
       └── 1──1 EvaluationMeta (includes LoopMetadata)
```

## Entities

### RubricDefinition

The versioned master document declaring all dimensions and sub-criteria.

| Field            | Type                     | Constraints                     | Notes                            |
| ---------------- | ------------------------ | ------------------------------- | -------------------------------- |
| `rubric_version` | `string`                 | Semver format (e.g., `"1.0.0"`) | Independent of CLI version       |
| `dimensions`     | `Dimension[]`            | Exactly 10 entries              | Fixed set for v1                 |
| `tool_versions`  | `Record<string, string>` | Exact version per tool          | e.g., `{ "axe-core": "4.10.2" }` |

### Dimension

One of the 10 scored evaluation dimensions.

| Field            | Type             | Constraints                           | Notes                                     |
| ---------------- | ---------------- | ------------------------------------- | ----------------------------------------- |
| `id`             | `string`         | Unique slug (e.g., `"accessibility"`) | Stable identifier across rubric versions  |
| `name`           | `string`         | Human-readable                        | e.g., `"Accessibility — WCAG 2.2"`        |
| `default_weight` | `number`         | Integer, 1–100                        | All defaults sum to 100                   |
| `weight_floor`   | `number \| null` | `null` or positive integer            | `10` for accessibility; `null` for others |
| `sub_criteria`   | `SubCriterion[]` | ≥ 1 entry per dimension               |                                           |

**Default weights** (v1):

| Dimension                             | Weight |
| ------------------------------------- | ------ |
| Visual Design & Aesthetics            | 10     |
| Layout & Responsiveness               | 10     |
| Usability & Interaction Design        | 12     |
| Accessibility — WCAG 2.2              | 15     |
| Content & Information Architecture    | 8      |
| Performance & Technical Quality       | 12     |
| Code Quality — UI relevant            | 8      |
| Brand & Emotional Design              | 5      |
| Consistency & Design System Adherence | 10     |
| Microinteractions, Motion & States    | 10     |

### SubCriterion

A single scoreable item within a dimension, bound to a deterministic check.

| Field              | Type                  | Constraints                                                   | Notes                                                                |
| ------------------ | --------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `id`               | `string`              | Unique across rubric (e.g., `"accessibility.color-contrast"`) | `dimension_id.check_name` convention                                 |
| `name`             | `string`              | Human-readable                                                |                                                                      |
| `description`      | `string`              | What this measures                                            |                                                                      |
| `bound_check`      | `BoundCheck`          | Required                                                      | The deterministic check that produces the score                      |
| `anchors`          | `AnchorDescriptor[5]` | Exactly 5 entries (scores 0–4)                                | Each describes the threshold for that score level                    |
| `blocking_if_zero` | `boolean`             | Default: `false`                                              | `true` for WCAG AA criteria                                          |
| `visual_parity`    | `boolean`             | Default: `false`                                              | `true` for pixelmatch-bound checks; not_applicable when no reference |
| `references`       | `string[]`            | ≥ 0 entries                                                   | e.g., `["WCAG 2.2 §1.4.3", "Nielsen #4"]`                            |

### BoundCheck

The binding between a sub-criterion and the deterministic check that scores it.

| Field                 | Type                             | Constraints                                                                                             | Notes                                                   |
| --------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `check_family`        | `string`                         | One of: `"axe"`, `"lighthouse"`, `"pixelmatch"`, `"dom"`, `"css"`, `"playwright"`, `"console"`, `"har"` | Identifies the adapter                                  |
| `check_id`            | `string`                         | Family-scoped identifier                                                                                | e.g., `"color-contrast"`, `"lcp"`, `"viewport=desktop"` |
| `full_id`             | `string`                         | Computed: `"{check_family}.{check_id}"`                                                                 | e.g., `"axe.color-contrast"`                            |
| `threshold_map`       | `Record<number, ThresholdRange>` | Keys 0–4                                                                                                | Maps score → value range for the check's output         |
| `pinned_tool_version` | `string`                         | Exact semver                                                                                            | From RubricDefinition.tool_versions                     |
| `fix_template`        | `string`                         | ≤ 280 chars                                                                                             | Template for suggested_fix, with `{value}` placeholders |
| `severity_map`        | `SeverityMapping`                | Maps check output → Nielsen 0–4                                                                         | e.g., axe impact levels                                 |

### AnchorDescriptor

Describes what a specific score level (0–4) means for a sub-criterion.

| Field         | Type             | Constraints                  | Notes                             |
| ------------- | ---------------- | ---------------------------- | --------------------------------- |
| `score`       | `number`         | Integer 0–4                  |                                   |
| `label`       | `string`         | Short label                  | e.g., `"Excellent"`, `"Critical"` |
| `description` | `string`         | Human-readable threshold     | e.g., `"LCP ≤ 1200ms"`            |
| `threshold`   | `ThresholdRange` | Defines the numeric boundary |                                   |

### ThresholdRange

Defines the numeric boundary for a score level.

| Field      | Type                                                | Constraints                               | Notes                                      |
| ---------- | --------------------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| `min`      | `number \| null`                                    | Inclusive lower bound or null (unbounded) |                                            |
| `max`      | `number \| null`                                    | Exclusive upper bound or null (unbounded) |                                            |
| `operator` | `"range" \| "eq" \| "lte" \| "gte" \| "lt" \| "gt"` | Comparison type                           | `"range"` uses min/max; others use `value` |
| `value`    | `number \| null`                                    | For single-value comparisons              |                                            |

### ProjectConfig

Per-project overlay on the rubric definition.

| Field                             | Type                                   | Constraints                                    | Notes                                      |
| --------------------------------- | -------------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| `rubric_version`                  | `string \| undefined`                  | If set, must match loaded rubric               | Version compatibility check                |
| `weights`                         | `Record<string, number> \| undefined`  | Must sum to 100 if provided                    | Dimension ID → weight                      |
| `weight_overrides_ack`            | `string[] \| undefined`                | List of dimension IDs                          | Required for overriding below weight_floor |
| `blocking_overrides`              | `Record<string, boolean> \| undefined` | Sub-criterion ID → toggle                      |                                            |
| `custom_sub_criteria`             | `CustomSubCriterion[] \| undefined`    | Each must have complete anchors + bound check  |                                            |
| `viewports`                       | `ViewportConfig \| undefined`          | Default: desktop (1280×800) + mobile (375×812) |                                            |
| `reference_images`                | `Record<string, string> \| undefined`  | Viewport name → image path                     |                                            |
| `reference_image_mismatch_policy` | `"fail-fast" \| "resize"`              | Default: `"fail-fast"`                         |                                            |
| `pixelmatch_threshold`            | `number \| undefined`                  | Default: `0.1`                                 | Anti-alias tolerance                       |
| `tool_fallback_policy`            | `"fail-fast" \| "mark-unavailable"`    | Default: `"fail-fast"`                         | Per FR-025                                 |
| `iteration_cap`                   | `number \| undefined`                  | Default: `5`                                   |                                            |
| `ship_threshold`                  | `number \| undefined`                  | Default: `75`                                  | Composite score for "ship-ready"           |
| `top_issues_cap`                  | `number \| undefined`                  | Default: `10`                                  | Max entries in top_issues                  |
| `settle_timeout_ms`               | `number \| undefined`                  | Default: `5000`                                | Additional wait after networkidle          |
| `redaction`                       | `boolean \| undefined`                 | Default: `true`                                | `false` equivalent to --no-redact          |

### ViewportConfig

| Field     | Type                                                             | Constraints                             | Notes                |
| --------- | ---------------------------------------------------------------- | --------------------------------------- | -------------------- |
| `desktop` | `{ width: number, height: number }`                              | Default: `{ width: 1280, height: 800 }` |                      |
| `mobile`  | `{ width: number, height: number }`                              | Default: `{ width: 375, height: 812 }`  |                      |
| `custom`  | `Record<string, { width: number, height: number }> \| undefined` |                                         | Additional viewports |

### TargetCapture

The set of artifacts captured from a single URL before scoring.

| Field                | Type                     | Constraints                   | Notes                          |
| -------------------- | ------------------------ | ----------------------------- | ------------------------------ |
| `url`                | `string`                 | Fully qualified URL           | The target that was evaluated  |
| `captured_at`        | `string`                 | ISO 8601 timestamp            |                                |
| `content_hash`       | `string`                 | SHA-256 hex                   | Hash of all artifacts combined |
| `viewports_captured` | `string[]`               | e.g., `["desktop", "mobile"]` |                                |
| `screenshots`        | `Record<string, Buffer>` | Viewport name → PNG buffer    | Desktop, above-fold, mobile    |
| `dom_snapshot`       | `string`                 | Full rendered HTML            | From `page.content()`          |
| `computed_styles`    | `ComputedStylesSnapshot` | Extracted style data          | Structured by element          |
| `console_errors`     | `ConsoleEntry[]`         | Filtered to error + warning   |                                |
| `har`                | `HarLog`                 | HAR 1.2 format                | Redacted per FR-039            |

### ConsoleEntry

| Field   | Type                   | Notes                    |
| ------- | ---------------------- | ------------------------ |
| `level` | `"error" \| "warning"` |                          |
| `text`  | `string`               | Message text             |
| `url`   | `string \| null`       | Source URL if available  |
| `line`  | `number \| null`       | Source line if available |

### EvaluationResult

The top-level JSON artifact emitted by the CLI.

| Field              | Type                            | Notes                                                   |
| ------------------ | ------------------------------- | ------------------------------------------------------- |
| `schema_version`   | `string`                        | Version of the output schema itself                     |
| `rubric_version`   | `string`                        | Version of the rubric used                              |
| `run_id`           | `string`                        | UUID v4 — unique per invocation                         |
| `timestamp`        | `string`                        | ISO 8601                                                |
| `target`           | `TargetReference`               | URL + capture metadata                                  |
| `composite_score`  | `number`                        | 0–100, weighted average of dimension scores             |
| `ship_ready`       | `boolean`                       | `true` when blocking is empty and composite ≥ threshold |
| `no_progress`      | `boolean`                       | `true` when delta < 3 across consecutive iterations     |
| `blocking`         | `BlockingEntry[]`               | WCAG AA failures requiring resolution                   |
| `dimensions`       | `DimensionResult[]`             | All 10 dimensions with scores and sub-criteria          |
| `top_issues`       | `TopIssue[]`                    | Priority-ordered, capped at N                           |
| `pixel_comparison` | `PixelComparisonResult \| null` | Present when reference image supplied                   |
| `meta`             | `EvaluationMeta`                | Configuration, tool versions, loop state                |

### TargetReference

| Field               | Type     | Notes                         |
| ------------------- | -------- | ----------------------------- |
| `url`               | `string` | The evaluated URL             |
| `content_hash`      | `string` | SHA-256 of captured artifacts |
| `captured_at`       | `string` | ISO 8601                      |
| `settle_timeout_ms` | `number` | Effective settle timeout used |

### DimensionResult

| Field              | Type                    | Notes                                                |
| ------------------ | ----------------------- | ---------------------------------------------------- |
| `id`               | `string`                | Dimension slug                                       |
| `name`             | `string`                | Human-readable name                                  |
| `weight`           | `number`                | Effective weight used in composite                   |
| `score`            | `number`                | 0–100 (mean of applicable sub-criteria × 25)         |
| `sub_criteria`     | `SubCriterionFinding[]` | All sub-criteria, including not_applicable           |
| `applicable_count` | `number`                | Sub-criteria contributing to the dimension score     |
| `excluded_count`   | `number`                | Sub-criteria with not_applicable or tool_unavailable |

### SubCriterionFinding

| Field             | Type                                                 | Constraints                       | Notes                                     |
| ----------------- | ---------------------------------------------------- | --------------------------------- | ----------------------------------------- |
| `id`              | `string`                                             | Sub-criterion ID                  |                                           |
| `name`            | `string`                                             | Human-readable                    |                                           |
| `score`           | `number \| null`                                     | 0–4 integer, or null with status  |                                           |
| `status`          | `"scored" \| "not_applicable" \| "tool_unavailable"` |                                   | Determines if score is null               |
| `evidence`        | `string`                                             | ≤ 300 chars, sanitized per FR-039 | Tool output, rule ID, or measurement      |
| `evidence_source` | `string`                                             | BoundCheck full_id                | e.g., `"axe.color-contrast"`              |
| `severity`        | `number`                                             | Nielsen 0–4                       |                                           |
| `suggested_fix`   | `string`                                             | ≤ 280 chars                       | From fix_template; empty if score = 4     |
| `location`        | `LocationReference \| null`                          |                                   | Selector, bounding box, or coordinates    |
| `confidence`      | `"deterministic" \| "predicted"`                     |                                   | `"predicted"` for lab/performance metrics |

### LocationReference

| Field          | Type                                                              | Notes                                   |
| -------------- | ----------------------------------------------------------------- | --------------------------------------- |
| `type`         | `"selector" \| "bounding_box" \| "coordinates"`                   |                                         |
| `selector`     | `string \| null`                                                  | CSS selector                            |
| `bounding_box` | `{ x: number, y: number, width: number, height: number } \| null` |                                         |
| `viewport`     | `string \| null`                                                  | Which viewport this location applies to |

### BlockingEntry

| Field          | Type                        | Notes                                                            |
| -------------- | --------------------------- | ---------------------------------------------------------------- |
| `criterion_id` | `string`                    | Sub-criterion ID that scored 0 with blocking_if_zero             |
| `reason`       | `string`                    | Human-readable description                                       |
| `wcag_ref`     | `string`                    | Specific WCAG 2.2 reference (e.g., `"1.4.3 Contrast (Minimum)"`) |
| `evidence`     | `string`                    | The evidence from the sub-criterion finding                      |
| `location`     | `LocationReference \| null` | Offending element                                                |
| `severity`     | `number`                    | Always 4 for blocking entries                                    |

### TopIssue

| Field             | Type             | Constraints                   | Notes                               |
| ----------------- | ---------------- | ----------------------------- | ----------------------------------- |
| `rank`            | `number`         | 1-based                       | Position in priority list           |
| `criterion_id`    | `string`         | Sub-criterion ID              |                                     |
| `dimension_id`    | `string`         | Parent dimension ID           |                                     |
| `priority_score`  | `number`         | `dimension_weight × severity` | Sorting key                         |
| `score`           | `number`         | 0–4                           | The sub-criterion's score           |
| `severity`        | `number`         | Nielsen 0–4                   |                                     |
| `fix`             | `string`         | ≤ 280 chars                   | Actionable fix from fix_template    |
| `fix_hash`        | `string`         | SHA-256 of fix text           | For oscillation prevention (FR-033) |
| `expected_impact` | `string \| null` | Optional improvement hint     |                                     |

### PixelComparisonResult

| Field       | Type                        | Notes                           |
| ----------- | --------------------------- | ------------------------------- |
| `viewports` | `PixelComparisonViewport[]` | One entry per viewport compared |

### PixelComparisonViewport

| Field                   | Type                                | Notes                                  |
| ----------------------- | ----------------------------------- | -------------------------------------- |
| `viewport`              | `string`                            | e.g., `"desktop"`, `"mobile"`          |
| `diff_pixel_count`      | `number`                            | Mismatched pixels                      |
| `total_pixel_count`     | `number`                            | Total pixels compared                  |
| `diff_ratio`            | `number`                            | `diff_pixel_count / total_pixel_count` |
| `threshold`             | `number`                            | pixelmatch threshold used              |
| `diff_png_path`         | `string \| null`                    | Path to persisted diff PNG (debug dir) |
| `reference_image_path`  | `string`                            | Path to the reference image used       |
| `screenshot_dimensions` | `{ width: number, height: number }` |                                        |
| `reference_dimensions`  | `{ width: number, height: number }` |                                        |

### EvaluationMeta

| Field                   | Type                                                           | Notes                                               |
| ----------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| `cli_version`           | `string`                                                       | CLI package version                                 |
| `rubric_version`        | `string`                                                       | Rubric definition version                           |
| `tool_versions`         | `Record<string, { pinned: string, resolved: string }>`         | Per FR-026a                                         |
| `determinism`           | `"pinned" \| "drifted"`                                        | Per FR-026a                                         |
| `tool_version_drift`    | `Record<string, { pinned: string, resolved: string }> \| null` | Non-null when drifted                               |
| `redaction`             | `"enabled" \| "disabled"`                                      | Per FR-039                                          |
| `effective_config`      | `EffectiveConfig`                                              | Resolved weights, blocking toggles, viewports, etc. |
| `iteration`             | `number \| null`                                               | Loop iteration index (FR-032)                       |
| `previous_composite`    | `number \| null`                                               | Previous run's composite (FR-032)                   |
| `delta`                 | `number \| null`                                               | `composite - previous_composite` (FR-032)           |
| `attempted_fixes_count` | `number`                                                       | Count of previously attempted fixes (FR-033)        |
| `duration_ms`           | `number`                                                       | Total evaluation time in milliseconds               |

### EffectiveConfig

| Field                  | Type                      | Notes                               |
| ---------------------- | ------------------------- | ----------------------------------- |
| `weights`              | `Record<string, number>`  | Dimension ID → effective weight     |
| `blocking_toggles`     | `Record<string, boolean>` | Sub-criterion ID → blocking_if_zero |
| `viewports`            | `ViewportConfig`          | Effective viewports                 |
| `ship_threshold`       | `number`                  |                                     |
| `iteration_cap`        | `number`                  |                                     |
| `top_issues_cap`       | `number`                  |                                     |
| `tool_fallback_policy` | `string`                  |                                     |
| `pixelmatch_threshold` | `number`                  |                                     |

## Validation Rules

1. **Weight sum**: `sum(dimensions.map(d => d.weight)) === 100` — validated on config load (FR-028).
2. **Weight floor**: `config.weights["accessibility"] >= 10` unless `"accessibility"` is in `weight_overrides_ack` (FR-028).
3. **Anchor completeness**: Every sub-criterion (including custom) must have exactly 5 anchor descriptors for scores 0–4 (FR-028).
4. **Bound check required**: Every sub-criterion must have a non-null `bound_check` with valid `check_family` and `check_id` (FR-010).
5. **Tool version pin**: Every `check_family` must have an entry in `rubric.tool_versions` (FR-026a).
6. **Composite re-weighting**: When all sub-criteria in a dimension are excluded, that dimension contributes zero weight and remaining dimensions are re-normalized to sum to 100 (FR-013).
7. **Evidence length**: `evidence.length <= 300`, `suggested_fix.length <= 280` (FR-031).
8. **Iteration cap**: `iteration <= iteration_cap` unless `--allow-overrun` (FR-034).
9. **Output schema**: The full EvaluationResult must validate against the zod schema before emission; validation failure → exit non-zero, no partial JSON (FR-036).

## State Transitions

The CLI is single-invocation with no persistent state. The conceptual lifecycle of a single evaluation run:

```
INIT → VALIDATE_CONFIG → VERIFY_TOOL_VERSIONS → CAPTURE → CHECK → SCORE → EMIT → EXIT

INIT: Parse CLI args, load config, load rubric
VALIDATE_CONFIG: zod validation, weight sum, weight floor, anchor completeness
VERIFY_TOOL_VERSIONS: Resolve installed versions, compare to rubric pins (FR-026a)
CAPTURE: Playwright navigation → settle → screenshot/DOM/HAR/styles/console capture
CHECK: Run all deterministic checks (axe, lighthouse, pixelmatch, structural)
SCORE: Apply anchors → sub-criterion scores → dimension scores → composite
EMIT: Build EvaluationResult, validate against schema, write JSON + summary
EXIT: Exit 0 (success) or non-zero (error at any prior stage)
```

Error at any stage before EMIT → exit non-zero with actionable error, no partial JSON.
