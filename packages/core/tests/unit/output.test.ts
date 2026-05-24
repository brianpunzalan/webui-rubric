import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { buildBlockingList } from '../../src/output/blocking.js';
import { buildTopIssues } from '../../src/output/top-issues.js';
import { isShipReady } from '../../src/output/ship-ready.js';
import type {
  Dimension,
  SubCriterion,
  SubCriterionFinding,
  DimensionResult,
  BlockingEntry,
  BoundCheck,
  AnchorDescriptor,
  AnchorTuple,
} from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBoundCheck(): BoundCheck {
  return {
    check_family: 'test',
    check_id: 'test',
    full_id: 'test.test',
    threshold_map: {},
    pinned_tool_version: '1.0.0',
    fix_template: '',
    severity_map: {},
  };
}

function makeAnchor(score: 0 | 1 | 2 | 3 | 4): AnchorDescriptor {
  return {
    score,
    label: `Score ${score}`,
    description: `Description for score ${score}`,
    threshold: { operator: 'eq', value: score, min: null, max: null },
  };
}

function makeAnchorTuple(): AnchorTuple {
  return [makeAnchor(0), makeAnchor(1), makeAnchor(2), makeAnchor(3), makeAnchor(4)];
}

function makeSubCriterion(overrides: Partial<SubCriterion> = {}): SubCriterion {
  return {
    id: 'sub-1',
    name: 'Sub Criterion 1',
    description: '',
    bound_check: makeBoundCheck(),
    anchors: makeAnchorTuple(),
    blocking_if_zero: false,
    visual_parity: false,
    references: [],
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

function makeFinding(overrides: Partial<SubCriterionFinding> = {}): SubCriterionFinding {
  return {
    id: 'sub-1',
    name: 'Sub 1',
    score: 3,
    status: 'scored',
    evidence: 'some evidence',
    evidence_source: 'test',
    severity: 1,
    suggested_fix: 'Fix this issue',
    location: null,
    confidence: 'deterministic',
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

describe('output modules', () => {
  // =========================================================================
  // buildBlockingList
  // =========================================================================
  describe('buildBlockingList', () => {
    it('builds blocking entries for score-0 blocking_if_zero sub-criteria', () => {
      const dimensions = [
        makeDimension({
          id: 'accessibility',
          sub_criteria: [
            makeSubCriterion({
              id: 'a11y-1',
              name: 'Alt Text',
              blocking_if_zero: true,
              references: ['WCAG 1.1.1'],
            }),
          ],
        }),
      ];
      const findings = new Map<string, SubCriterionFinding[]>([
        [
          'accessibility',
          [makeFinding({ id: 'a11y-1', score: 0, status: 'scored', evidence: 'Missing alt text' })],
        ],
      ]);
      const result = buildBlockingList(dimensions, findings);
      expect(result).toHaveLength(1);
      expect(result[0].criterion_id).toBe('a11y-1');
      expect(result[0].reason).toContain('Alt Text');
      expect(result[0].reason).toContain('score 0');
      expect(result[0].wcag_ref).toBe('WCAG 1.1.1');
      expect(result[0].severity).toBe(4);
    });

    it('returns empty list when no blocking failures exist', () => {
      const dimensions = [
        makeDimension({
          id: 'd1',
          sub_criteria: [
            makeSubCriterion({ id: 'sub-1', blocking_if_zero: true }),
          ],
        }),
      ];
      const findings = new Map<string, SubCriterionFinding[]>([
        ['d1', [makeFinding({ id: 'sub-1', score: 3, status: 'scored' })]],
      ]);
      const result = buildBlockingList(dimensions, findings);
      expect(result).toHaveLength(0);
    });

    it('does not block on non-blocking sub-criteria with score 0', () => {
      const dimensions = [
        makeDimension({
          id: 'd1',
          sub_criteria: [
            makeSubCriterion({ id: 'sub-1', blocking_if_zero: false }),
          ],
        }),
      ];
      const findings = new Map<string, SubCriterionFinding[]>([
        ['d1', [makeFinding({ id: 'sub-1', score: 0, status: 'scored' })]],
      ]);
      const result = buildBlockingList(dimensions, findings);
      expect(result).toHaveLength(0);
    });

    it('does not block on not_applicable findings even if blocking_if_zero', () => {
      const dimensions = [
        makeDimension({
          id: 'd1',
          sub_criteria: [
            makeSubCriterion({ id: 'sub-1', blocking_if_zero: true }),
          ],
        }),
      ];
      const findings = new Map<string, SubCriterionFinding[]>([
        ['d1', [makeFinding({ id: 'sub-1', score: 0, status: 'not_applicable' })]],
      ]);
      const result = buildBlockingList(dimensions, findings);
      expect(result).toHaveLength(0);
    });

    it('uses empty wcag_ref when no WCAG reference present', () => {
      const dimensions = [
        makeDimension({
          id: 'd1',
          sub_criteria: [
            makeSubCriterion({ id: 'sub-1', blocking_if_zero: true, references: ['ARIA 1.0'] }),
          ],
        }),
      ];
      const findings = new Map<string, SubCriterionFinding[]>([
        ['d1', [makeFinding({ id: 'sub-1', score: 0, status: 'scored' })]],
      ]);
      const result = buildBlockingList(dimensions, findings);
      expect(result[0].wcag_ref).toBe('');
    });
  });

  // =========================================================================
  // buildTopIssues
  // =========================================================================
  describe('buildTopIssues', () => {
    it('sorts by priority_score descending', () => {
      const dimResults: DimensionResult[] = [
        makeDimensionResult({
          id: 'dim-a',
          weight: 10,
          sub_criteria: [
            makeFinding({ id: 's1', score: 1, severity: 3, suggested_fix: 'Fix A' }),
            makeFinding({ id: 's2', score: 2, severity: 2, suggested_fix: 'Fix B' }),
          ],
        }),
      ];
      const result = buildTopIssues(dimResults, 10);
      // s1: priority = 10 * 3 = 30, s2: priority = 10 * 2 = 20
      expect(result[0].criterion_id).toBe('s1');
      expect(result[0].priority_score).toBe(30);
      expect(result[1].criterion_id).toBe('s2');
      expect(result[1].priority_score).toBe(20);
    });

    it('caps at N issues', () => {
      const findings: SubCriterionFinding[] = [];
      for (let i = 0; i < 15; i++) {
        findings.push(
          makeFinding({ id: `s-${i}`, score: 1, severity: 3, suggested_fix: `Fix ${i}` }),
        );
      }
      const dimResults: DimensionResult[] = [
        makeDimensionResult({ id: 'dim-a', weight: 10, sub_criteria: findings }),
      ];
      const result = buildTopIssues(dimResults, 5);
      expect(result).toHaveLength(5);
    });

    it('filters out attempted fixes', () => {
      const fix = 'Already tried this fix';
      const hash = createHash('sha256').update(fix).digest('hex');
      const dimResults: DimensionResult[] = [
        makeDimensionResult({
          id: 'dim-a',
          weight: 10,
          sub_criteria: [
            makeFinding({ id: 's1', score: 1, severity: 3, suggested_fix: fix }),
            makeFinding({ id: 's2', score: 2, severity: 2, suggested_fix: 'New fix' }),
          ],
        }),
      ];
      const attempted = new Set([hash]);
      const result = buildTopIssues(dimResults, 10, attempted);
      expect(result).toHaveLength(1);
      expect(result[0].criterion_id).toBe('s2');
    });

    it('assigns rank numbers starting at 1', () => {
      const dimResults: DimensionResult[] = [
        makeDimensionResult({
          id: 'dim-a',
          weight: 10,
          sub_criteria: [
            makeFinding({ id: 's1', score: 1, severity: 3, suggested_fix: 'Fix A' }),
            makeFinding({ id: 's2', score: 2, severity: 1, suggested_fix: 'Fix B' }),
          ],
        }),
      ];
      const result = buildTopIssues(dimResults, 10);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });

    it('excludes findings with score >= 4 (perfect)', () => {
      const dimResults: DimensionResult[] = [
        makeDimensionResult({
          id: 'dim-a',
          weight: 10,
          sub_criteria: [
            makeFinding({ id: 's1', score: 4, severity: 0, suggested_fix: 'No fix needed' }),
          ],
        }),
      ];
      const result = buildTopIssues(dimResults, 10);
      expect(result).toHaveLength(0);
    });

    it('returns empty list when no findings qualify', () => {
      const dimResults: DimensionResult[] = [
        makeDimensionResult({
          id: 'dim-a',
          weight: 10,
          sub_criteria: [],
        }),
      ];
      const result = buildTopIssues(dimResults, 10);
      expect(result).toHaveLength(0);
    });
  });

  // =========================================================================
  // isShipReady
  // =========================================================================
  describe('isShipReady', () => {
    it('returns true when no blocking entries and composite >= threshold', () => {
      expect(isShipReady([], 80, 75)).toBe(true);
    });

    it('returns true when composite equals threshold exactly', () => {
      expect(isShipReady([], 75, 75)).toBe(true);
    });

    it('returns false when blocking entries exist', () => {
      const blocking: BlockingEntry[] = [
        {
          criterion_id: 'a11y-1',
          reason: 'Failed',
          wcag_ref: 'WCAG 1.1.1',
          evidence: '',
          location: null,
          severity: 4,
        },
      ];
      expect(isShipReady(blocking, 90, 75)).toBe(false);
    });

    it('returns false when composite is below threshold', () => {
      expect(isShipReady([], 70, 75)).toBe(false);
    });

    it('returns false when both blocking exists and below threshold', () => {
      const blocking: BlockingEntry[] = [
        {
          criterion_id: 'a11y-1',
          reason: 'Failed',
          wcag_ref: '',
          evidence: '',
          location: null,
          severity: 4,
        },
      ];
      expect(isShipReady(blocking, 50, 75)).toBe(false);
    });

    it('uses default threshold of 75 when not specified', () => {
      expect(isShipReady([], 75)).toBe(true);
      expect(isShipReady([], 74)).toBe(false);
    });
  });
});
