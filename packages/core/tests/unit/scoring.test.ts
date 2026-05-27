import { describe, it, expect } from 'vitest';
import {
  scoreFromThreshold,
  assignSeverity,
  computeDimensionScore,
  computeCompositeScore,
  buildDimensionResult,
} from '../../src/scoring/index.js';
import type {
  BoundCheck,
  AnchorScore,
  SubCriterionFinding,
  DimensionResult,
  Dimension,
} from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBoundCheck(
  thresholdMap: Record<
    number,
    { operator: string; value?: number | null; min?: number | null; max?: number | null }
  >,
): BoundCheck {
  const mapped: Record<
    number,
    { operator: string; value: number | null; min: number | null; max: number | null }
  > = {};
  for (const [k, v] of Object.entries(thresholdMap)) {
    mapped[Number(k)] = {
      operator: v.operator,
      value: v.value ?? null,
      min: v.min ?? null,
      max: v.max ?? null,
    };
  }
  return {
    check_family: 'test',
    check_id: 'test',
    full_id: 'test.test',
    threshold_map: mapped,
    pinned_tool_version: '1.0.0',
    fix_template: '',
    severity_map: {},
  };
}

function makeFinding(overrides: Partial<SubCriterionFinding> = {}): SubCriterionFinding {
  return {
    id: 'sub-1',
    name: 'Sub 1',
    score: 3,
    status: 'scored',
    evidence: '',
    evidence_source: 'test',
    severity: 1,
    suggested_fix: [],
    location: null,
    confidence: 'deterministic',
    ...overrides,
  };
}

function makeDimension(overrides: Partial<Dimension> = {}): Dimension {
  return {
    id: 'dim-1',
    name: 'Dimension 1',
    default_weight: 20,
    weight_floor: null,
    sub_criteria: [],
    ...overrides,
  };
}

function makeDimensionResult(overrides: Partial<DimensionResult> = {}): DimensionResult {
  return {
    id: 'dim-1',
    name: 'Dimension 1',
    weight: 20,
    score: 75,
    sub_criteria: [],
    applicable_count: 3,
    excluded_count: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scoring engine', () => {
  // =========================================================================
  // scoreFromThreshold
  // =========================================================================
  describe('scoreFromThreshold', () => {
    it('matches lte operator', () => {
      const bc = makeBoundCheck({
        4: { operator: 'lte', value: 0 },
        3: { operator: 'lte', value: 5 },
        2: { operator: 'lte', value: 10 },
      });
      // value 0 matches score 4 (lte 0)
      expect(scoreFromThreshold(0, bc)).toBe(4);
      // value 3 matches score 3 (lte 5), but NOT score 4 (lte 0)
      expect(scoreFromThreshold(3, bc)).toBe(3);
      // value 7 matches score 2 (lte 10)
      expect(scoreFromThreshold(7, bc)).toBe(2);
    });

    it('matches gt operator', () => {
      const bc = makeBoundCheck({
        0: { operator: 'gt', value: 100 },
        2: { operator: 'gt', value: 50 },
        4: { operator: 'gt', value: 0 },
      });
      // 200 > 100 => matches score 4 first (checked highest to lowest), but wait:
      // score 4: gt 0 => 200 > 0 is true => returns 4
      expect(scoreFromThreshold(200, bc)).toBe(4);
      // 0 is NOT > 0, NOT > 50, NOT > 100 => returns 0 (default)
      expect(scoreFromThreshold(0, bc)).toBe(0);
    });

    it('matches eq operator', () => {
      const bc = makeBoundCheck({
        4: { operator: 'eq', value: 0 },
        2: { operator: 'eq', value: 5 },
        0: { operator: 'eq', value: 99 },
      });
      expect(scoreFromThreshold(0, bc)).toBe(4);
      expect(scoreFromThreshold(5, bc)).toBe(2);
      expect(scoreFromThreshold(99, bc)).toBe(0);
      // No match => default 0
      expect(scoreFromThreshold(42, bc)).toBe(0);
    });

    it('matches range operator (inclusive min, exclusive max)', () => {
      const bc = makeBoundCheck({
        4: { operator: 'range', min: 0, max: 5 },
        3: { operator: 'range', min: 5, max: 10 },
        2: { operator: 'range', min: 10, max: 20 },
      });
      // 0 >= 0 && 0 < 5 => score 4
      expect(scoreFromThreshold(0, bc)).toBe(4);
      // 4.99 >= 0 && 4.99 < 5 => score 4
      expect(scoreFromThreshold(4.99, bc)).toBe(4);
      // 5 is NOT in [0,5) but IS in [5,10) => score 3
      expect(scoreFromThreshold(5, bc)).toBe(3);
      // 10 is NOT in [5,10) but IS in [10,20) => score 2
      expect(scoreFromThreshold(10, bc)).toBe(2);
    });

    it('returns 0 when no threshold matches', () => {
      const bc = makeBoundCheck({
        4: { operator: 'eq', value: 999 },
      });
      expect(scoreFromThreshold(42, bc)).toBe(0);
    });

    it('handles exact boundary values for lte', () => {
      const bc = makeBoundCheck({
        4: { operator: 'lte', value: 10 },
      });
      // Exact boundary
      expect(scoreFromThreshold(10, bc)).toBe(4);
      // Just above
      expect(scoreFromThreshold(10.001, bc)).toBe(0);
    });

    it('handles gte operator', () => {
      const bc = makeBoundCheck({
        4: { operator: 'gte', value: 90 },
        3: { operator: 'gte', value: 70 },
      });
      expect(scoreFromThreshold(90, bc)).toBe(4);
      expect(scoreFromThreshold(100, bc)).toBe(4);
      expect(scoreFromThreshold(70, bc)).toBe(3);
      expect(scoreFromThreshold(69, bc)).toBe(0);
    });

    it('handles lt operator', () => {
      const bc = makeBoundCheck({
        4: { operator: 'lt', value: 5 },
      });
      expect(scoreFromThreshold(4.99, bc)).toBe(4);
      // Exact value does NOT match lt
      expect(scoreFromThreshold(5, bc)).toBe(0);
    });

    it('prefers highest score when multiple thresholds match', () => {
      const bc = makeBoundCheck({
        4: { operator: 'lte', value: 100 },
        3: { operator: 'lte', value: 100 },
        2: { operator: 'lte', value: 100 },
      });
      // All match, but 4 is checked first (highest)
      expect(scoreFromThreshold(50, bc)).toBe(4);
    });
  });

  // =========================================================================
  // assignSeverity
  // =========================================================================
  describe('assignSeverity', () => {
    it('returns inverse of score by default (score 0 => severity 4)', () => {
      expect(assignSeverity(0 as AnchorScore, {})).toBe(4);
    });

    it('returns inverse of score by default (score 4 => severity 0)', () => {
      expect(assignSeverity(4 as AnchorScore, {})).toBe(0);
    });

    it('returns inverse for intermediate scores', () => {
      expect(assignSeverity(1 as AnchorScore, {})).toBe(3);
      expect(assignSeverity(2 as AnchorScore, {})).toBe(2);
      expect(assignSeverity(3 as AnchorScore, {})).toBe(1);
    });

    it('uses explicit severity map entry when present', () => {
      const severityMap: Record<string, AnchorScore> = { '2': 3 };
      expect(assignSeverity(2 as AnchorScore, severityMap)).toBe(3);
    });

    it('falls back to inverse when severity map does not contain key', () => {
      const severityMap: Record<string, AnchorScore> = { '0': 4 };
      // Key "3" not in map => falls back to 4 - 3 = 1
      expect(assignSeverity(3 as AnchorScore, severityMap)).toBe(1);
    });

    it('supports full custom severity mapping', () => {
      const severityMap: Record<string, AnchorScore> = {
        '0': 4,
        '1': 4,
        '2': 3,
        '3': 1,
        '4': 0,
      };
      expect(assignSeverity(0 as AnchorScore, severityMap)).toBe(4);
      expect(assignSeverity(1 as AnchorScore, severityMap)).toBe(4);
      expect(assignSeverity(2 as AnchorScore, severityMap)).toBe(3);
      expect(assignSeverity(3 as AnchorScore, severityMap)).toBe(1);
      expect(assignSeverity(4 as AnchorScore, severityMap)).toBe(0);
    });
  });

  // =========================================================================
  // computeDimensionScore
  // =========================================================================
  describe('computeDimensionScore', () => {
    it('computes mean x 25 when all findings are scored', () => {
      const findings = [makeFinding({ score: 4 }), makeFinding({ score: 2 })];
      // mean = (4 + 2) / 2 = 3; score = 3 * 25 = 75
      const result = computeDimensionScore(findings);
      expect(result.score).toBe(75);
      expect(result.applicable_count).toBe(2);
      expect(result.excluded_count).toBe(0);
    });

    it('excludes not_applicable findings from the mean', () => {
      const findings = [
        makeFinding({ score: 4, status: 'scored' }),
        makeFinding({ score: null, status: 'not_applicable' }),
        makeFinding({ score: 2, status: 'scored' }),
      ];
      // applicable: score 4 and 2 => mean = 3, score = 75
      const result = computeDimensionScore(findings);
      expect(result.score).toBe(75);
      expect(result.applicable_count).toBe(2);
      expect(result.excluded_count).toBe(1);
    });

    it('returns score 0 with all excluded when all findings are not_applicable', () => {
      const findings = [
        makeFinding({ score: null, status: 'not_applicable' }),
        makeFinding({ score: null, status: 'tool_unavailable' }),
      ];
      const result = computeDimensionScore(findings);
      expect(result.score).toBe(0);
      expect(result.applicable_count).toBe(0);
      expect(result.excluded_count).toBe(2);
    });

    it('returns score 0 with empty findings array', () => {
      const result = computeDimensionScore([]);
      expect(result.score).toBe(0);
      expect(result.applicable_count).toBe(0);
      expect(result.excluded_count).toBe(0);
    });

    it('computes perfect score when all findings score 4', () => {
      const findings = [
        makeFinding({ score: 4 }),
        makeFinding({ score: 4 }),
        makeFinding({ score: 4 }),
      ];
      // mean = 4; score = 100
      const result = computeDimensionScore(findings);
      expect(result.score).toBe(100);
    });

    it('computes zero score when all findings score 0', () => {
      const findings = [makeFinding({ score: 0 }), makeFinding({ score: 0 })];
      const result = computeDimensionScore(findings);
      expect(result.score).toBe(0);
    });
  });

  // =========================================================================
  // computeCompositeScore
  // =========================================================================
  describe('computeCompositeScore', () => {
    it('computes weighted average of dimension scores', () => {
      const dims: DimensionResult[] = [
        makeDimensionResult({ id: 'a', score: 80, applicable_count: 3 }),
        makeDimensionResult({ id: 'b', score: 60, applicable_count: 2 }),
      ];
      const weights = { a: 60, b: 40 };
      // composite = (80 * 60 + 60 * 40) / 100 = (4800 + 2400) / 100 = 72
      expect(computeCompositeScore(dims, weights)).toBe(72);
    });

    it('re-normalizes weights when a dimension has applicable_count=0', () => {
      const dims: DimensionResult[] = [
        makeDimensionResult({ id: 'a', score: 80, applicable_count: 3 }),
        makeDimensionResult({ id: 'b', score: 0, applicable_count: 0 }),
        makeDimensionResult({ id: 'c', score: 60, applicable_count: 2 }),
      ];
      const weights = { a: 40, b: 20, c: 40 };
      // b excluded. Included weights: a=40, c=40, total=80
      // Normalized: a = (40/80)*100 = 50, c = (40/80)*100 = 50
      // composite = (80 * 50 + 60 * 50) / 100 = (4000 + 3000) / 100 = 70
      expect(computeCompositeScore(dims, weights)).toBe(70);
    });

    it('returns 0 when all dimensions are excluded', () => {
      const dims: DimensionResult[] = [
        makeDimensionResult({ id: 'a', applicable_count: 0 }),
        makeDimensionResult({ id: 'b', applicable_count: 0 }),
      ];
      const weights = { a: 50, b: 50 };
      expect(computeCompositeScore(dims, weights)).toBe(0);
    });

    it('handles a single included dimension', () => {
      const dims: DimensionResult[] = [
        makeDimensionResult({ id: 'a', score: 85, applicable_count: 4 }),
      ];
      const weights = { a: 100 };
      expect(computeCompositeScore(dims, weights)).toBe(85);
    });

    it('rounds to 2 decimal places', () => {
      const dims: DimensionResult[] = [
        makeDimensionResult({ id: 'a', score: 100, applicable_count: 1 }),
        makeDimensionResult({ id: 'b', score: 0, applicable_count: 1 }),
        makeDimensionResult({ id: 'c', score: 50, applicable_count: 1 }),
      ];
      // weights: a=33, b=33, c=34 => sum=100
      const weights = { a: 33, b: 33, c: 34 };
      // composite = (100*33 + 0*33 + 50*34) / 100 = (3300 + 0 + 1700) / 100 = 50
      expect(computeCompositeScore(dims, weights)).toBe(50);
    });
  });

  // =========================================================================
  // buildDimensionResult
  // =========================================================================
  describe('buildDimensionResult', () => {
    it('assembles dimension metadata with computed scores', () => {
      const dimension = makeDimension({ id: 'accessibility', name: 'Accessibility' });
      const findings = [makeFinding({ score: 4 }), makeFinding({ score: 2 })];
      const result = buildDimensionResult(dimension, findings, 20);

      expect(result.id).toBe('accessibility');
      expect(result.name).toBe('Accessibility');
      expect(result.weight).toBe(20);
      expect(result.score).toBe(75); // mean(4,2) = 3 * 25 = 75
      expect(result.applicable_count).toBe(2);
      expect(result.excluded_count).toBe(0);
      expect(result.sub_criteria).toBe(findings);
    });

    it('uses the effective weight provided, not the dimension default', () => {
      const dimension = makeDimension({ default_weight: 15 });
      const findings = [makeFinding({ score: 4 })];
      const result = buildDimensionResult(dimension, findings, 30);
      expect(result.weight).toBe(30);
    });

    it('handles empty findings', () => {
      const dimension = makeDimension();
      const result = buildDimensionResult(dimension, [], 10);
      expect(result.score).toBe(0);
      expect(result.applicable_count).toBe(0);
      expect(result.excluded_count).toBe(0);
    });
  });
});
