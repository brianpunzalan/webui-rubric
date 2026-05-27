# Core API Reference

`@webui-rubric/core` — rubric engine, scoring math, check registry, config
validation, redaction, loop metadata, and output schema validation.

**Source:** `packages/core/src/`

---

## Exports overview

### Scoring (`scoring/index.ts`)

| Export | Description |
|---|---|
| `scoreFromThreshold(value, boundCheck)` | Map a numeric measurement to an anchor score (0–4) via the check's `threshold_map`. |
| `assignSeverity(score, severityMap)` | Compute Nielsen severity (0–4) from an anchor score; defaults to `4 - score`. |
| `computeDimensionScore(findings)` | Mean of scored findings × 25 → 0–100 dimension score (FR-012). |
| `computeCompositeScore(dimensions, weights)` | Weighted average of dimension scores with re-normalization for excluded dimensions (FR-013). |
| `buildDimensionResult(dimension, findings, weight)` | Assemble a complete `DimensionResult` from a dimension definition + scored findings. |

### Check Registry (`registry/index.ts`)

| Export | Description |
|---|---|
| `CheckRegistry` | Class storing `CheckAdapter` instances keyed by `full_id`. |
| `registry` | Singleton `CheckRegistry` shared across the application. |
| `registerCheck(adapter)` | Convenience wrapper to register an adapter on the singleton. |
| `createRegistry()` | Factory that returns a fresh, empty `CheckRegistry` (useful in tests). |
| `ToolUnavailableError` | Error thrown when a required tool cannot be executed. |
| `applyFallback(result, policy)` | Apply the configured tool-fallback policy to a check result. |

### Config Validation (`config/validate.ts`)

| Export | Description |
|---|---|
| `validateProjectConfig(raw)` | Parse raw YAML/JSON input against the project config schema; returns `ValidationResult`. |
| `validateWeights(weights, rubric, ack?)` | Verify weights sum to 100 and respect per-dimension `weight_floor` values. |
| `validateCustomSubCriteria(customs)` | Validate custom sub-criterion definitions (5 anchors + bound check required). |
| `ValidationResult` | `{ valid, errors, config? }` returned by `validateProjectConfig`. |

### Redaction (`redaction/index.ts`)

| Export | Description |
|---|---|
| `redactHarHeaders(har)` | Redact sensitive header values and POST/PUT/PATCH bodies from a HAR 1.2 object (FR-039). |
| `redactDomSnapshot(html)` | Redact `value` attributes of password/email/tel inputs and `cc-*` autocomplete fields. |
| `redactEvidenceString(evidence)` | Scrub Cookie, Authorization, and Bearer token values from an evidence string. |
| `isRedactionEnabled(config)` | Returns `true` unless `config.redaction` is explicitly `false`. |
| `REDACTED_PLACEHOLDER` | Constant `'<redacted>'` used as the replacement string. |
| `SENSITIVE_HEADER_PATTERNS` | Array of `RegExp` patterns identifying sensitive HTTP headers. |

### Output Schema (`output/schema.ts`)

| Export | Description |
|---|---|
| `EvaluationResultSchema` | Zod schema for the full evaluation artifact (FR-011). |
| `ValidatedEvaluationResult` | TypeScript type inferred from `EvaluationResultSchema`. |

### Loop Metadata (`loop/`)

| Export | Description |
|---|---|
| `parseLoopInput(options)` | Read `--iteration`, `--previous-composite`, and attempted-fix hashes from CLI options. |
| `buildLoopOutput(composite, iteration, prev, count)` | Assemble `LoopOutput` with delta calculation. |
| `computeFixHash(fix)` | SHA-256 hash of a suggested-fix string for deduplication. |
| `filterAttemptedFixes(issues, hashes)` | Remove issues whose `fix_hash` was previously attempted. |
| `detectNoProgress(delta, threshold?)` | Return `true` when `|delta| < threshold` (default 3). |
| `checkIterationCap(iteration, cap?, allowOverrun?)` | Enforce the iteration cap; returns `{ allowed, message? }`. |

---

## Key types

```ts
type AnchorScore = 0 | 1 | 2 | 3 | 4;

interface DimensionResult {
  id: string; name: string; weight: number; score: number;
  sub_criteria: SubCriterionFinding[];
  applicable_count: number; excluded_count: number;
}

interface ValidationResult {
  valid: boolean; errors: string[]; config?: ProjectConfig;
}

interface LoopInput {
  iteration: number | null;
  previousComposite: number | null;
  attemptedFixHashes: Set<string>;
}
```

---

## Usage example

```ts
import {
  computeCompositeScore, buildDimensionResult,
  registry, registerCheck, validateProjectConfig,
  redactHarHeaders, EvaluationResultSchema,
} from '@webui-rubric/core';

// Register a check adapter
registerCheck(myAxeAdapter);

// Validate config
const result = validateProjectConfig(rawYaml);
if (!result.valid) throw new Error(result.errors.join('; '));

// Compute scores
const dimResult = buildDimensionResult(dimension, findings, 20);
const composite = computeCompositeScore([dimResult], { accessibility: 20 });

// Redact before persisting
redactHarHeaders(harData);

// Validate output shape
EvaluationResultSchema.parse(artifact);
```

**Source:** `packages/core/src/`
