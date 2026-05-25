import { describe, it, expect } from 'vitest';
import { applyWeightOverrides } from '../../src/config/weights.js';
import { applyBlockingOverrides } from '../../src/config/blocking-toggles.js';
import { applyCustomSubCriteria } from '../../src/config/custom-sub-criteria.js';
import type {
  RubricDefinition,
  Dimension,
  SubCriterion,
  BoundCheck,
  CustomSubCriterion,
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

function makeRubric(dimensions: Dimension[]): RubricDefinition {
  return {
    rubric_version: '1.0.0',
    dimensions,
    tool_versions: {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('config overrides', () => {
  // =========================================================================
  // applyWeightOverrides
  // =========================================================================
  describe('applyWeightOverrides', () => {
    it('computes correct effective weights from overrides and defaults', () => {
      const rubric = makeRubric([
        makeDimension({ id: 'a', default_weight: 30 }),
        makeDimension({ id: 'b', default_weight: 70 }),
      ]);
      // Override 'a' to 40, 'b' keeps default 70 => but sum = 110 so expect error
      const { effectiveWeights, errors } = applyWeightOverrides(rubric, { a: 40 });
      expect(effectiveWeights.a).toBe(40);
      expect(effectiveWeights.b).toBe(70);
      // 40 + 70 = 110, not 100
      expect(errors.some((e) => e.includes('must sum to 100'))).toBe(true);
    });

    it('returns no errors when weights sum to 100', () => {
      const rubric = makeRubric([
        makeDimension({ id: 'a', default_weight: 50 }),
        makeDimension({ id: 'b', default_weight: 50 }),
      ]);
      const { effectiveWeights, errors } = applyWeightOverrides(rubric, { a: 60, b: 40 });
      expect(effectiveWeights.a).toBe(60);
      expect(effectiveWeights.b).toBe(40);
      expect(errors).toHaveLength(0);
    });

    it('uses default weights when no overrides provided', () => {
      const rubric = makeRubric([
        makeDimension({ id: 'a', default_weight: 50 }),
        makeDimension({ id: 'b', default_weight: 50 }),
      ]);
      const { effectiveWeights, errors } = applyWeightOverrides(rubric, {});
      expect(effectiveWeights.a).toBe(50);
      expect(effectiveWeights.b).toBe(50);
      expect(errors).toHaveLength(0);
    });

    it('reports sum validation error', () => {
      const rubric = makeRubric([
        makeDimension({ id: 'a', default_weight: 30 }),
        makeDimension({ id: 'b', default_weight: 30 }),
      ]);
      const { errors } = applyWeightOverrides(rubric, {});
      // 30 + 30 = 60, not 100
      expect(errors.some((e) => e.includes('must sum to 100'))).toBe(true);
    });

    it('enforces weight floor and reports error without ack', () => {
      const rubric = makeRubric([
        makeDimension({
          id: 'accessibility',
          name: 'Accessibility',
          weight_floor: 10,
          default_weight: 20,
        }),
        makeDimension({ id: 'other', default_weight: 80 }),
      ]);
      const { errors } = applyWeightOverrides(rubric, { accessibility: 5, other: 95 });
      expect(errors.some((e) => e.includes('below the floor'))).toBe(true);
    });

    it('allows weight below floor with ack', () => {
      const rubric = makeRubric([
        makeDimension({
          id: 'accessibility',
          name: 'Accessibility',
          weight_floor: 10,
          default_weight: 20,
        }),
        makeDimension({ id: 'other', default_weight: 80 }),
      ]);
      const { errors } = applyWeightOverrides(rubric, { accessibility: 5, other: 95 }, [
        'accessibility',
      ]);
      expect(errors.some((e) => e.includes('below the floor'))).toBe(false);
    });
  });

  // =========================================================================
  // applyBlockingOverrides
  // =========================================================================
  describe('applyBlockingOverrides', () => {
    it('toggles blocking_if_zero on matching sub-criteria', () => {
      const dimensions = [
        makeDimension({
          id: 'a',
          sub_criteria: [
            makeSubCriterion({ id: 'sub-1', blocking_if_zero: false }),
            makeSubCriterion({ id: 'sub-2', blocking_if_zero: true }),
          ],
        }),
      ];
      const result = applyBlockingOverrides(dimensions, { 'sub-1': true, 'sub-2': false });
      expect(result[0].sub_criteria[0].blocking_if_zero).toBe(true);
      expect(result[0].sub_criteria[1].blocking_if_zero).toBe(false);
    });

    it('does not modify sub-criteria not in overrides', () => {
      const dimensions = [
        makeDimension({
          sub_criteria: [makeSubCriterion({ id: 'sub-1', blocking_if_zero: true })],
        }),
      ];
      const result = applyBlockingOverrides(dimensions, { 'sub-other': false });
      expect(result[0].sub_criteria[0].blocking_if_zero).toBe(true);
    });

    it('returns new dimension objects (does not mutate originals)', () => {
      const original = makeDimension({
        sub_criteria: [makeSubCriterion({ id: 'sub-1', blocking_if_zero: false })],
      });
      const result = applyBlockingOverrides([original], { 'sub-1': true });
      expect(result[0]).not.toBe(original);
      expect(result[0].sub_criteria[0]).not.toBe(original.sub_criteria[0]);
      // Original unchanged
      expect(original.sub_criteria[0].blocking_if_zero).toBe(false);
    });

    it('handles empty overrides', () => {
      const dimensions = [
        makeDimension({
          sub_criteria: [makeSubCriterion({ id: 'sub-1', blocking_if_zero: false })],
        }),
      ];
      const result = applyBlockingOverrides(dimensions, {});
      expect(result[0].sub_criteria[0].blocking_if_zero).toBe(false);
    });
  });

  // =========================================================================
  // applyCustomSubCriteria
  // =========================================================================
  describe('applyCustomSubCriteria', () => {
    it('adds custom sub-criteria to the correct dimension', () => {
      const dimensions = [
        makeDimension({ id: 'visual-design', sub_criteria: [] }),
        makeDimension({ id: 'accessibility', sub_criteria: [] }),
      ];
      const customs: CustomSubCriterion[] = [
        {
          dimension: 'visual-design',
          id: 'custom-1',
          name: 'Custom Check',
          description: 'A custom check',
          bound_check: makeBoundCheck(),
          anchors: makeAnchorTuple(),
        },
      ];
      const { dimensions: result, errors } = applyCustomSubCriteria(dimensions, customs);
      expect(errors).toHaveLength(0);
      expect(result.find((d) => d.id === 'visual-design')!.sub_criteria).toHaveLength(1);
      expect(result.find((d) => d.id === 'visual-design')!.sub_criteria[0].id).toBe('custom-1');
      expect(result.find((d) => d.id === 'accessibility')!.sub_criteria).toHaveLength(0);
    });

    it('rejects custom sub-criteria targeting an invalid dimension', () => {
      const dimensions = [makeDimension({ id: 'visual-design' })];
      const customs: CustomSubCriterion[] = [
        {
          dimension: 'nonexistent',
          id: 'custom-1',
          name: 'Custom',
          description: '',
          bound_check: makeBoundCheck(),
          anchors: makeAnchorTuple(),
        },
      ];
      const { errors } = applyCustomSubCriteria(dimensions, customs);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('unknown dimension');
    });

    it('rejects custom with missing anchors', () => {
      const dimensions = [makeDimension({ id: 'visual-design' })];
      const customs = [
        {
          dimension: 'visual-design',
          id: 'custom-1',
          name: 'Custom',
          description: '',
          bound_check: makeBoundCheck(),
          anchors: undefined as unknown as AnchorTuple,
        },
      ];
      const { errors } = applyCustomSubCriteria(dimensions, customs);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('5 anchor descriptors');
    });

    it('rejects custom with missing bound_check', () => {
      const dimensions = [makeDimension({ id: 'visual-design' })];
      const customs = [
        {
          dimension: 'visual-design',
          id: 'custom-1',
          name: 'Custom',
          description: '',
          bound_check: undefined as unknown as BoundCheck,
          anchors: makeAnchorTuple(),
        },
      ];
      const { errors } = applyCustomSubCriteria(dimensions, customs);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('bound_check');
    });

    it('does not mutate original dimensions array', () => {
      const original = makeDimension({ id: 'visual-design', sub_criteria: [] });
      const customs: CustomSubCriterion[] = [
        {
          dimension: 'visual-design',
          id: 'custom-1',
          name: 'Custom',
          description: '',
          bound_check: makeBoundCheck(),
          anchors: makeAnchorTuple(),
        },
      ];
      applyCustomSubCriteria([original], customs);
      expect(original.sub_criteria).toHaveLength(0);
    });
  });
});
