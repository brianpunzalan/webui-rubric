# @webui-rubric/core

Shared foundation for the `webui-rubric` monorepo. Provides all TypeScript types, the V1 rubric definition (10 dimensions, sub-criteria, anchor thresholds), pure scoring math, Zod-based config and output schema validation, redaction utilities, and iterative-loop metadata. Every other package in the monorepo imports from here — core has no workspace dependencies.

## Installation

```bash
npm install @webui-rubric/core
# or
pnpm add @webui-rubric/core
```

## Dependencies

| Dependency | Version   | Purpose                             |
| ---------- | --------- | ----------------------------------- |
| `zod`      | `^3.23.0` | Config and output schema validation |

No workspace dependencies — this package is the root of the dependency graph.

## Package Interactions

```
@webui-rubric/core          ← no workspace deps (only zod)
    ↑           ↑       ↑
capture      checks    cli
```

All other packages import types, the rubric definition, and utilities from `@webui-rubric/core`. It exports no runtime side-effects — every exported function is pure and deterministic.

---

## API Reference

### Types (`src/types/index.ts`)

All shared TypeScript interfaces and type aliases.

#### Rubric structure

```typescript
interface RubricDefinition {
  rubric_version: string;
  dimensions: Dimension[];
  tool_versions: Record<string, string>; // pinned semver per tool family
}

interface Dimension {
  id: string;
  name: string;
  default_weight: number;
  weight_floor: number | null; // minimum allowed weight (accessibility = 10)
  sub_criteria: SubCriterion[];
}

interface SubCriterion {
  id: string;
  name: string;
  description: string;
  bound_check: BoundCheck;
  anchors: AnchorTuple; // exactly 5 descriptors (scores 0–4)
  blocking_if_zero: boolean; // true → WCAG blocking
  visual_parity: boolean; // true → requires reference image
  references: string[]; // e.g. ["WCAG 2.2 §1.4.3"]
}

interface BoundCheck {
  check_family: string; // "axe" | "lighthouse" | "pixelmatch" | "dom" | "css" | "console" | "har" | "playwright"
  check_id: string; // family-specific identifier
  full_id: string; // "{family}.{id}", e.g. "axe.color-contrast"
  threshold_map: Record<number, ThresholdRange>; // score (0–4) → threshold
  pinned_tool_version: string;
  fix_template: string; // ≤280 chars
  severity_map: SeverityMapping;
}

interface AnchorDescriptor {
  score: AnchorScore; // 0 | 1 | 2 | 3 | 4
  label: string;
  description: string;
  threshold: ThresholdRange;
}

type AnchorTuple = [
  AnchorDescriptor,
  AnchorDescriptor,
  AnchorDescriptor,
  AnchorDescriptor,
  AnchorDescriptor,
];
type AnchorScore = 0 | 1 | 2 | 3 | 4;

interface ThresholdRange {
  min: number | null;
  max: number | null;
  operator: 'range' | 'eq' | 'lte' | 'gte' | 'lt' | 'gt';
  value: number | null;
}

type SeverityMapping = Record<string, AnchorScore>;
```

#### Evaluation output

```typescript
interface EvaluationResult {
  schema_version: string;
  rubric_version: string;
  run_id: string; // UUID v4
  timestamp: string; // ISO 8601
  target: TargetReference;
  composite_score: number; // 0–100 weighted average
  ship_ready: boolean;
  no_progress: boolean; // true when delta < 3
  blocking: BlockingEntry[];
  dimensions: DimensionResult[];
  top_issues: TopIssue[]; // priority-sorted, capped at N
  pixel_comparison: PixelComparisonResult | null;
  artifact?: ArtifactReference; // present only when the CLI ran with --artifact-dir
  meta: EvaluationMeta;
}

interface DimensionResult {
  id: string;
  name: string;
  weight: number;
  score: number; // 0–100
  sub_criteria: SubCriterionFinding[];
  applicable_count: number;
  excluded_count: number;
}

interface SubCriterionFinding {
  id: string;
  name: string;
  score: number | null;
  status: FindingStatus; // "scored" | "not_applicable" | "tool_unavailable"
  evidence: string; // ≤300 chars
  evidence_source: string; // e.g. "axe.color-contrast"
  severity: number; // 0–4 Nielsen scale
  suggested_fix: string[];
  location: LocationReference | null;
  confidence: Confidence; // "deterministic" | "predicted"
}

interface BlockingEntry {
  criterion_id: string;
  reason: string;
  wcag_ref: string;
  evidence: string;
  location: LocationReference | null;
  severity: number; // always 4 for blocking entries
}

interface TopIssue {
  rank: number;
  criterion_id: string;
  dimension_id: string;
  priority_score: number; // dimension_weight × severity
  score: number;
  severity: number;
  fix: string[];
  fix_hash: string; // SHA-256 of fix text (oscillation prevention)
  expected_impact: string | null;
}
```

`schema_version` is `1.1.0`, which adds the optional `artifact` block (below). Results without an artifact bundle remain backward-compatible.

#### Artifact reference

Populated by `@webui-rubric/cli` when the `evaluate` command runs with `--artifact-dir` (and a reference comparison). All paths are relative to `dir`, so the bundle is portable.

```typescript
interface ArtifactReference {
  dir: string; // absolute path to the bundle directory
  manifest_path: string; // relative path to manifest.json
  report_path: string; // relative path to report.html
  viewports: ArtifactViewportImages[];
}

interface ArtifactViewportImages {
  viewport: string;
  reference: string; // relative path to reference-<viewport>.png
  screenshot: string; // relative path to screenshot-<viewport>.png
  diff: string; // relative path to diff-<viewport>.png
  composite: string; // relative path to composite-<viewport>.png
  regions: string[]; // relative paths to regions/region-<viewport>-<n>.png crops
}
```

#### Configuration

```typescript
interface ProjectConfig {
  rubric_version?: string;
  weights?: Record<string, number>; // must sum to 100
  weight_overrides_ack?: string[]; // dimension IDs acknowledging floor override
  blocking_overrides?: Record<string, boolean>;
  custom_sub_criteria?: CustomSubCriterion[];
  viewports?: ViewportConfig;
  reference_images?: Record<string, string>; // viewport name → PNG path
  reference_image_mismatch_policy?: 'fail-fast' | 'resize';
  pixelmatch_threshold?: number; // 0–1, default 0.1
  tool_fallback_policy?: 'fail-fast' | 'mark-unavailable';
  iteration_cap?: number; // default 5
  ship_threshold?: number; // default 75
  top_issues_cap?: number; // default 10
  settle_timeout_ms?: number; // default 30000
  redaction?: boolean; // default true
  capture?: CaptureConfig;
  pixel_comparison?: PixelComparisonConfig;
}

interface ViewportConfig {
  desktop: ViewportDimensions; // default 1280×800
  mobile: ViewportDimensions; // default 375×812
  custom?: Record<string, ViewportDimensions>;
}

interface ViewportDimensions {
  width: number;
  height: number;
}

interface CaptureConfig {
  dismiss_selectors?: string[]; // CSS selectors for consent banner dismiss buttons
  auto_dismiss?: boolean; // default true
}

interface PixelComparisonConfig {
  mask_selectors?: string[];
  mask_color?: string; // hex color, default "#FF00FF"
  device_pixel_ratio?: 'auto' | number;
}

interface CustomSubCriterion {
  dimension: string;
  id: string;
  name: string;
  description: string;
  bound_check: BoundCheck;
  anchors: AnchorTuple;
  blocking_if_zero?: boolean;
  visual_parity?: boolean;
  references?: string[];
}
```

#### Other shared types

```typescript
type FindingStatus = 'scored' | 'not_applicable' | 'tool_unavailable';
type Confidence = 'deterministic' | 'predicted';
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LocationReference {
  type: 'selector' | 'bounding_box' | 'coordinates';
  selector: string | null;
  bounding_box: { x: number; y: number; width: number; height: number } | null;
  viewport: string | null;
}

interface ConsoleEntry {
  level: 'error' | 'warning';
  text: string;
  url: string | null;
  line: number | null;
}

// Snapshot of computed CSS properties per element selector
type ComputedStylesSnapshot = Record<string, Record<string, string>>;

// The browser-captured artifacts passed to check adapters
interface TargetCapture {
  url: string;
  captured_at: string;
  content_hash: string;
  viewports_captured: string[];
  screenshots: Map<string, Buffer>;
  dom_snapshot: string;
  computed_styles: ComputedStylesSnapshot;
  element_locations: Array<{
    selector: string;
    bbox: { x: number; y: number; width: number; height: number };
    tagName: string;
    computedStyles: Record<string, string>;
  }>;
  console_errors: ConsoleEntry[];
  har: unknown;
}

// Return type of every check adapter's run() method
interface CheckResult {
  score: number | null;
  status: FindingStatus;
  evidence: string;
  evidence_source: string;
  severity: number;
  suggested_fix: string[];
  location: LocationReference | null;
  confidence: Confidence;
}

// Interface that all check adapters must implement
interface CheckAdapter {
  check_family: string;
  check_id: string;
  full_id: string;
  run(capture: TargetCapture, config?: ProjectConfig): Promise<CheckResult[]>;
}

interface PixelComparisonResult {
  viewports: PixelComparisonViewport[];
}

interface PixelComparisonViewport {
  viewport: string;
  diff_pixel_count: number;
  total_pixel_count: number;
  diff_ratio: number;
  threshold: number;
  diff_png_path: string | null;
  reference_image_path: string;
  screenshot_dimensions: ViewportDimensions;
  reference_dimensions: ViewportDimensions;
  diff_regions?: MappedDiffRegion[];
}

interface MappedDiffRegion {
  y_start: number;
  y_end: number;
  diff_pixel_count: number;
  pct_of_total_diff: number;
  elements: MappedDiffElement[];
}

interface MappedDiffElement {
  selector: string;
  tagName: string;
  styleDiffs: StyleDiff[];
}

interface StyleDiff {
  property: string;
  actual: string;
  expected: string;
}

interface EvaluationMeta {
  cli_version: string;
  rubric_version: string;
  tool_versions: Record<string, ToolVersionEntry>;
  determinism: 'pinned' | 'drifted';
  tool_version_drift: Record<string, ToolVersionEntry> | null;
  redaction: 'enabled' | 'disabled';
  effective_config: EffectiveConfig;
  iteration: number | null;
  previous_composite: number | null;
  delta: number | null;
  attempted_fixes_count: number;
  duration_ms: number;
}

interface ToolVersionEntry {
  pinned: string;
  resolved: string;
}

interface EffectiveConfig {
  weights: Record<string, number>;
  blocking_toggles: Record<string, boolean>;
  viewports: ViewportConfig;
  ship_threshold: number;
  iteration_cap: number;
  top_issues_cap: number;
  tool_fallback_policy: string;
  pixelmatch_threshold: number;
}

interface TargetReference {
  url: string;
  content_hash: string;
  captured_at: string;
  settle_timeout_ms: number;
}
```

---

### Rubric (`src/rubric/`)

#### `V1_RUBRIC`

The singleton rubric definition for version 1.0.0. Includes all 10 dimensions with their sub-criteria, anchor thresholds, and pinned tool versions.

```typescript
import { V1_RUBRIC } from '@webui-rubric/core';

V1_RUBRIC.rubric_version; // "1.0.0"
V1_RUBRIC.dimensions; // 10 Dimension objects
V1_RUBRIC.tool_versions; // { "axe-core": "4.10.2", "lighthouse": "12.2.1", ... }
```

**Dimensions and default weights:**

| ID                  | Name                                  | Weight | Weight Floor |
| ------------------- | ------------------------------------- | ------ | ------------ |
| `visual_design`     | Visual Design & Aesthetics            | 10     | —            |
| `layout`            | Layout & Responsiveness               | 10     | —            |
| `usability`         | Usability & Interaction Design        | 12     | —            |
| `accessibility`     | Accessibility — WCAG 2.2              | 15     | 10           |
| `content_ia`        | Content & Information Architecture    | 8      | —            |
| `performance`       | Performance & Technical Quality       | 12     | —            |
| `code_quality`      | Code Quality — UI relevant            | 8      | —            |
| `brand`             | Brand & Emotional Design              | 5      | —            |
| `consistency`       | Consistency & Design System Adherence | 10     | —            |
| `microinteractions` | Microinteractions, Motion & States    | 10     | —            |

**Pinned tool versions:**

| Tool         | Pinned version |
| ------------ | -------------- |
| `axe-core`   | 4.10.2         |
| `lighthouse` | 12.2.1         |
| `pixelmatch` | 7.1.0          |
| `playwright` | 1.52.0         |

---

### Scoring (`src/scoring/`)

All scoring functions are pure and deterministic — no side effects, no I/O.

#### `scoreFromThreshold(value, boundCheck): AnchorScore`

Maps a numeric measurement from a deterministic check to a 0–4 anchor score by evaluating the `BoundCheck`'s `threshold_map`, checking scores from 4 down to 0 and returning the first match.

Supported `ThresholdRange` operators: `eq`, `lte`, `gte`, `lt`, `gt`, `range` (inclusive min, exclusive max).

```typescript
import { scoreFromThreshold } from '@webui-rubric/core';

const score = scoreFromThreshold(0.003, boundCheck);
// Returns 4 if threshold_map[4] is lte(0.005) and 0.003 <= 0.005
```

#### `assignSeverity(score, severityMap): number`

Computes Nielsen severity (0–4) from an anchor score. Default formula: `severity = 4 - score`. An explicit mapping in `severityMap` (keyed by string score) overrides the default.

```typescript
import { assignSeverity } from '@webui-rubric/core';

assignSeverity(4, {}); // 0 — no issue
assignSeverity(0, {}); // 4 — catastrophic
assignSeverity(2, { '2': 3 }); // 3 — explicit override
```

#### `computeDimensionScore(findings): { score, applicable_count, excluded_count }`

Computes a dimension's 0–100 score from its sub-criterion findings. Only findings with `status === 'scored'` contribute to the mean. Formula: `mean(applicable scores) × 25`.

```typescript
import { computeDimensionScore } from '@webui-rubric/core';

const { score, applicable_count, excluded_count } = computeDimensionScore(findings);
// score: 0-100, applicable_count: how many were scored, excluded_count: not_applicable + tool_unavailable
```

#### `computeCompositeScore(dimensions, weights): number`

Computes the 0–100 composite score as a weighted average of dimension scores. Dimensions with `applicable_count === 0` are excluded from the calculation and their weights re-normalized so excluded dimensions do not drag down the composite.

Returns a number rounded to 2 decimal places.

```typescript
import { computeCompositeScore } from '@webui-rubric/core';

const composite = computeCompositeScore(dimensionResults, {
  visual_design: 10,
  accessibility: 15,
  // ... all 10 dimensions
});
// e.g. 72.35
```

#### `buildDimensionResult(dimension, findings, effectiveWeight): DimensionResult`

Assembles a complete `DimensionResult` from a rubric `Dimension`, its scored findings, and the effective weight (after config merging). This is the primary output assembly function.

```typescript
import { buildDimensionResult } from '@webui-rubric/core';

const result = buildDimensionResult(V1_RUBRIC.dimensions[3], findings, 20);
// { id: 'accessibility', name: 'Accessibility — WCAG 2.2', weight: 20, score: 87.5, ... }
```

---

### Config (`src/config/`)

#### `ProjectConfigSchema`

Zod schema for `.webui-rubric.yml` project configuration files. Export it when you need to parse and type-check raw YAML.

```typescript
import { ProjectConfigSchema } from '@webui-rubric/core';

const result = ProjectConfigSchema.safeParse(rawYaml);
```

#### `type ValidatedProjectConfig`

TypeScript type inferred from `ProjectConfigSchema` (equivalent to `z.infer<typeof ProjectConfigSchema>`).

#### `validateProjectConfig(raw): ValidationResult`

Validates raw (unknown) config input against the schema. Returns `{ valid, errors, config? }` — `config` is populated only when valid.

```typescript
import { validateProjectConfig } from '@webui-rubric/core';

const { valid, errors, config } = validateProjectConfig(rawYaml);
if (!valid) process.exit(2);
```

`ValidationResult`:

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  config?: ProjectConfig;
}
```

#### `validateWeights(weights, rubric, ack?): string[]`

Validates that dimension weights sum to 100 and that no dimension falls below its `weight_floor` unless its ID appears in `ack`. Returns an array of error strings (empty = valid).

```typescript
import { validateWeights, V1_RUBRIC } from '@webui-rubric/core';

const errors = validateWeights({ accessibility: 8 /* ... */ }, V1_RUBRIC, ['accessibility']);
// [] if ack includes 'accessibility', otherwise error about weight floor
```

#### `validateCustomSubCriteria(customs): string[]`

Validates custom sub-criterion definitions. Each must have exactly 5 anchor descriptors and a `bound_check`. Returns error strings.

---

### Output (`src/output/`)

#### `EvaluationResultSchema`

Zod schema (output `schema_version` `1.1.0`) for the complete `EvaluationResult` JSON artifact, including the optional `artifact` block. Used internally by `validateOutput`.

#### `validateOutput(result): OutputValidationResult`

Validates a complete evaluation result against the output schema before emission. Any failure means the run exits non-zero; no partial JSON is emitted.

```typescript
import { validateOutput } from '@webui-rubric/core';

const { valid, errors } = validateOutput(result);
if (!valid) {
  console.error(errors.join('\n'));
  process.exit(1);
}
```

`OutputValidationResult`:

```typescript
interface OutputValidationResult {
  valid: boolean;
  errors: string[];
}
```

#### `buildBlockingList(...): BlockingEntry[]`

Constructs the blocking list from sub-criterion findings — includes every finding with `score === 0` on a sub-criterion with `blocking_if_zero: true`.

#### `buildTopIssues(...): TopIssue[]`

Builds a priority-ordered list of top issues sorted by `priority_score = dimension_weight × severity`, capped at `top_issues_cap` (default 10). Issues whose `fix_hash` appears in the attempted-fixes set are excluded (oscillation prevention).

#### `isShipReady(composite, blockingCount, threshold): boolean`

Returns `true` when `blockingCount === 0 && composite >= threshold`.

#### `buildPixelComparisonResult(...): PixelComparisonResult`

Formats per-viewport pixel comparison output into the `PixelComparisonResult` structure.

#### `buildEffectiveConfig(config, rubric): EffectiveConfig`

Captures the resolved configuration used for a run, including merged weights, blocking toggles, and behavior flags.

---

### Redaction (`src/redaction/`)

Default-on sanitization engine (FR-039) that replaces sensitive values with `<redacted>` before they flow into the emitted JSON artifact or debug artifacts.

#### `REDACTED_PLACEHOLDER`

```typescript
const REDACTED_PLACEHOLDER = '<redacted>';
```

#### `SENSITIVE_HEADER_PATTERNS`

Array of `RegExp` matching header names that are redacted: `Set-Cookie`, `Cookie`, `Authorization`, headers containing `-csrf-`, `x-api-key`, and headers starting with `x-auth-`.

#### `redactHarHeaders(har): unknown`

Redacts sensitive header values and write-method (`POST`/`PUT`/`PATCH`) request bodies from a HAR 1.2 log object. Mutates the object in place and returns it.

```typescript
import { redactHarHeaders } from '@webui-rubric/core';

redactHarHeaders(har);
// Cookies, Authorization headers, and POST bodies are now '<redacted>'
```

#### `redactDomSnapshot(html): string`

Redacts the `value` attribute of `<input type="password">`, `<input type="email">`, `<input type="tel">`, and elements with `autocomplete` starting with `cc-`. Uses regex — does not parse the DOM tree.

```typescript
import { redactDomSnapshot } from '@webui-rubric/core';

const clean = redactDomSnapshot('<input type="password" value="s3cr3t">');
// '<input type="password" value="<redacted>">'
```

#### `redactEvidenceString(evidence): string`

Scans an evidence string for `Cookie:`, `Set-Cookie:`, `Authorization:`, and `Bearer ` patterns and replaces the values with `<redacted>`.

#### `isRedactionEnabled(config): boolean`

Returns `true` unless `config.redaction` is explicitly `false`. Redaction is on by default.

```typescript
import { isRedactionEnabled } from '@webui-rubric/core';

isRedactionEnabled({}); // true
isRedactionEnabled({ redaction: false }); // false
```

---

### Loop (`src/loop/`)

Utilities for iterative Evaluator/Generator agent loops — iteration tracking, convergence detection, and oscillation prevention.

#### `parseLoopInput(options): Promise<LoopInput>`

Parses CLI loop flags into a typed `LoopInput`. If `attemptedFixesPath` is provided, reads the JSON file (array of hash strings) into a `Set`.

```typescript
import { parseLoopInput } from '@webui-rubric/core';

const loopInput = await parseLoopInput({
  iteration: 3,
  previousComposite: 68.5,
  attemptedFixesPath: './fixes.json',
});
// { iteration: 3, previousComposite: 68.5, attemptedFixHashes: Set(['abc...', ...]) }
```

`LoopInput`:

```typescript
interface LoopInput {
  iteration: number | null;
  previousComposite: number | null;
  attemptedFixHashes: Set<string>;
}
```

#### `buildLoopOutput(...): LoopOutput`

Constructs the loop portion of `EvaluationMeta` (iteration, delta, no_progress, attempted_fixes_count).

#### `computeFixHash(fix): string`

Returns the SHA-256 hash of a fix string array (JSON-encoded). Used to produce `TopIssue.fix_hash` and populate the attempted-fixes set.

#### `filterAttemptedFixes(issues, hashes): TopIssue[]`

Removes any top issue whose `fix_hash` is in the `hashes` set, preventing the Evaluator from suggesting the same fix twice.

#### `detectNoProgress(delta): boolean`

Returns `true` when `Math.abs(delta) < 3`, signalling that the loop is not making meaningful progress.

#### `checkIterationCap(iteration, cap, allowOverrun): CapCheckResult`

Checks whether the current iteration exceeds the configured cap. Returns `{ exceeded: boolean, message?: string }`. When exceeded and `allowOverrun` is false, the CLI exits with code 4.

`CapCheckResult`:

```typescript
interface CapCheckResult {
  exceeded: boolean;
  message?: string;
}
```

---

### Logger (`src/logger.ts`)

Singleton leveled logger that writes exclusively to `stderr`, preserving `stdout` for JSON output (FR-002).

#### `logger`

```typescript
import { logger } from '@webui-rubric/core';

logger.debug('Loading rubric definition');
logger.info('Starting capture phase');
logger.warn('Tool version drift detected');
logger.error('Schema validation failed');
```

#### `setLogLevel(level: LogLevel): void`

Sets the minimum severity level. Messages below this level are suppressed. Default: `'info'`.

```typescript
import { setLogLevel } from '@webui-rubric/core';

setLogLevel('debug'); // show all messages
setLogLevel('warn'); // only warn and error
```

#### `setQuiet(quiet: boolean): void`

When `true`, suppresses all messages except `error`, regardless of the configured log level.

```typescript
import { setQuiet } from '@webui-rubric/core';

setQuiet(true); // only errors emitted
```

**Log format:** `[ISO-8601] [LEVEL] message\n`

---

## Usage Examples

### Score a single dimension

```typescript
import {
  V1_RUBRIC,
  computeDimensionScore,
  buildDimensionResult,
  type SubCriterionFinding,
} from '@webui-rubric/core';

const accessibilityDimension = V1_RUBRIC.dimensions.find((d) => d.id === 'accessibility')!;

const findings: SubCriterionFinding[] = [
  {
    id: 'accessibility.color-contrast',
    name: 'Color Contrast',
    score: 2,
    status: 'scored',
    evidence: '3 contrast violations detected',
    evidence_source: 'axe.color-contrast',
    severity: 2,
    suggested_fix: ['Increase contrast ratio to 4.5:1'],
    location: null,
    confidence: 'deterministic',
  },
  // ... more findings
];

const result = buildDimensionResult(accessibilityDimension, findings, 15);
console.log(result.score); // 0-100
```

### Validate a config file

```typescript
import { validateProjectConfig, validateWeights, V1_RUBRIC } from '@webui-rubric/core';
import { parse } from 'yaml';
import { readFileSync } from 'fs';

const raw = parse(readFileSync('.webui-rubric.yml', 'utf-8'));
const { valid, errors, config } = validateProjectConfig(raw);
if (!valid) throw new Error(errors.join('\n'));

if (config!.weights) {
  const weightErrors = validateWeights(config!.weights, V1_RUBRIC, config!.weight_overrides_ack);
  if (weightErrors.length) throw new Error(weightErrors.join('\n'));
}
```

### Redact a HAR before persisting

```typescript
import { redactHarHeaders, redactDomSnapshot, isRedactionEnabled } from '@webui-rubric/core';

function applyRedaction(har: unknown, dom: string, config: { redaction?: boolean }) {
  if (!isRedactionEnabled(config)) return { har, dom };
  return {
    har: redactHarHeaders(har),
    dom: redactDomSnapshot(dom),
  };
}
```
