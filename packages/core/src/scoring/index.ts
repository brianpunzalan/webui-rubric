/**
 * @module scoring
 *
 * Scoring engine for the Web UI Evaluator CLI.
 *
 * Implements the scoring math specified by:
 * - FR-012: Dimension score = mean of applicable sub-criterion scores x 25
 * - FR-013: Composite = weighted average of dimension scores, re-normalized
 * - FR-014: Nielsen severity assignment from bound check results
 *
 * All functions are pure and deterministic — no side effects, no LLM calls.
 */

import type {
  SubCriterionFinding,
  DimensionResult,
  Dimension,
  BoundCheck,
  AnchorScore,
} from '../types/index.js';

/**
 * Determines the anchor score (0-4) for a numeric value by evaluating it
 * against a BoundCheck's threshold_map.
 *
 * Checks scores from 4 down to 0, returning the first threshold that matches.
 * This highest-first ordering ensures the best applicable score is selected
 * when multiple thresholds could match.
 *
 * Supported ThresholdRange operators:
 * - `eq`:    value === threshold.value
 * - `lte`:   value <= threshold.value
 * - `gte`:   value >= threshold.value
 * - `lt`:    value < threshold.value
 * - `gt`:    value > threshold.value
 * - `range`: value >= threshold.min && value < threshold.max
 *
 * @param value - The numeric measurement from a deterministic check
 * @param boundCheck - The bound check definition containing the threshold_map
 * @returns The matching AnchorScore (0-4), or 0 if no threshold matches
 *
 * @example
 * ```ts
 * const score = scoreFromThreshold(0.005, boundCheck);
 * // Returns the highest score whose threshold range contains 0.005
 * ```
 */
export function scoreFromThreshold(value: number, boundCheck: BoundCheck): AnchorScore {
  // Check scores from 4 down to 0, returning the first (highest) match.
  for (let s = 4; s >= 0; s--) {
    const threshold = boundCheck.threshold_map[s];
    if (!threshold) {
      continue;
    }

    let matches = false;

    switch (threshold.operator) {
      case 'eq':
        matches = value === threshold.value!;
        break;
      case 'lte':
        matches = value <= threshold.value!;
        break;
      case 'gte':
        matches = value >= threshold.value!;
        break;
      case 'lt':
        matches = value < threshold.value!;
        break;
      case 'gt':
        matches = value > threshold.value!;
        break;
      case 'range':
        matches = value >= threshold.min! && value < threshold.max!;
        break;
    }

    if (matches) {
      return s as AnchorScore;
    }
  }

  // Default to 0 if no threshold matched.
  return 0;
}

/**
 * Computes the Nielsen severity rating (0-4) for a sub-criterion finding
 * based on its anchor score and the bound check's severity mapping.
 *
 * Severity is the inverse of quality: a high score (good quality) implies
 * low severity (minor or cosmetic issue), and vice versa. The default
 * formula is `severity = 4 - score`.
 *
 * When the severity map contains an explicit mapping for the given score
 * (keyed by the string representation of the score), that value is used
 * instead of the default inverse.
 *
 * @param score - The anchor score (0-4) assigned to the sub-criterion
 * @param severityMap - A mapping from score (as string key) to severity value
 * @returns The severity rating as an integer (0-4)
 *
 * @example
 * ```ts
 * assignSeverity(4, {}); // Returns 0 (no issues — cosmetic)
 * assignSeverity(0, {}); // Returns 4 (catastrophic usability problem)
 * assignSeverity(2, { "2": 3 }); // Returns 3 (explicit override)
 * ```
 */
export function assignSeverity(
  score: AnchorScore,
  severityMap: Record<string, AnchorScore>,
): number {
  const key = String(score);
  if (key in severityMap) {
    return severityMap[key];
  }

  // Default: severity is the inverse of the score on the 0-4 scale.
  return 4 - score;
}

/**
 * Computes a dimension's 0-100 score from its sub-criterion findings.
 *
 * Per FR-012: dimension score = mean of applicable sub-criterion scores x 25.
 *
 * Only findings with `status === 'scored'` and a non-null `score` are
 * included in the mean ("applicable"). Findings with status `not_applicable`
 * or `tool_unavailable` are excluded, and the dimension's score is
 * re-weighted internally by considering only the applicable pool.
 *
 * The x25 multiplier maps the 0-4 anchor scale to 0-100:
 * - Mean score 0 -> dimension score 0
 * - Mean score 4 -> dimension score 100
 *
 * @param findings - The sub-criterion findings for a single dimension
 * @returns An object containing the computed score, the count of applicable
 *          findings, and the count of excluded findings
 *
 * @example
 * ```ts
 * const result = computeDimensionScore(findings);
 * // { score: 75, applicable_count: 4, excluded_count: 1 }
 * ```
 */
export function computeDimensionScore(findings: SubCriterionFinding[]): {
  score: number;
  applicable_count: number;
  excluded_count: number;
} {
  const applicable = findings.filter((f) => f.status === 'scored' && f.score !== null);
  const excludedCount = findings.filter((f) => f.status !== 'scored').length;

  if (applicable.length === 0) {
    return {
      score: 0,
      applicable_count: 0,
      excluded_count: findings.length,
    };
  }

  const sum = applicable.reduce((acc, f) => acc + f.score!, 0);
  const mean = sum / applicable.length;
  // Map 0-4 anchor scale to 0-100 dimension scale.
  const score = mean * 25;

  return {
    score,
    applicable_count: applicable.length,
    excluded_count: excludedCount,
  };
}

/**
 * Computes the composite 0-100 score as a weighted average of dimension
 * scores, re-normalizing weights when dimensions are fully excluded.
 *
 * Per FR-013: the composite is the weighted average using effective
 * configured weights. Dimensions whose every sub-criterion is excluded
 * (applicable_count === 0) contribute zero weight rather than zero score,
 * so they do not drag down the composite.
 *
 * The weights among included dimensions are re-normalized to sum to 100
 * before computing the weighted average.
 *
 * @param dimensions - The scored dimension results
 * @param weights - A mapping from dimension ID to its configured weight
 *                  (weights should sum to 100 before re-normalization)
 * @returns The composite score rounded to 2 decimal places (0-100)
 *
 * @example
 * ```ts
 * const composite = computeCompositeScore(dimensionResults, {
 *   'visual-design': 15,
 *   'accessibility': 20,
 *   // ... remaining dimensions
 * });
 * // Returns e.g. 72.35
 * ```
 */
export function computeCompositeScore(
  dimensions: DimensionResult[],
  weights: Record<string, number>,
): number {
  // Only include dimensions that have at least one applicable sub-criterion.
  const included = dimensions.filter((d) => d.applicable_count > 0);

  if (included.length === 0) {
    return 0;
  }

  // Re-normalize weights among included dimensions so they sum to 100.
  const totalIncludedWeight = included.reduce((acc, d) => acc + (weights[d.id] ?? 0), 0);

  if (totalIncludedWeight === 0) {
    return 0;
  }

  // composite = sum(dimension.score * normalizedWeight) / 100
  // where normalizedWeight = (originalWeight / totalIncludedWeight) * 100
  const weightedSum = included.reduce((acc, d) => {
    const originalWeight = weights[d.id] ?? 0;
    const normalizedWeight = (originalWeight / totalIncludedWeight) * 100;
    return acc + d.score * normalizedWeight;
  }, 0);

  const composite = weightedSum / 100;

  return Math.round(composite * 100) / 100;
}

/**
 * Builds a complete DimensionResult by combining dimension metadata with
 * computed scores from sub-criterion findings.
 *
 * This is the primary assembly function that ties together the dimension
 * definition, its scored findings, and the effective weight into the
 * output structure consumed by the evaluation artifact.
 *
 * @param dimension - The rubric dimension definition (id, name, sub_criteria)
 * @param findings - The scored sub-criterion findings for this dimension
 * @param effectiveWeight - The effective weight for this dimension after
 *                          config merging and weight-floor enforcement
 * @returns A fully populated DimensionResult for inclusion in the output
 *
 * @example
 * ```ts
 * const result = buildDimensionResult(accessibilityDimension, findings, 20);
 * // { id: 'accessibility', name: 'Accessibility', weight: 20,
 * //   score: 87.5, sub_criteria: [...], applicable_count: 8, excluded_count: 2 }
 * ```
 */
export function buildDimensionResult(
  dimension: Dimension,
  findings: SubCriterionFinding[],
  effectiveWeight: number,
): DimensionResult {
  const { score, applicable_count, excluded_count } = computeDimensionScore(findings);

  return {
    id: dimension.id,
    name: dimension.name,
    weight: effectiveWeight,
    score,
    sub_criteria: findings,
    applicable_count,
    excluded_count,
  };
}
