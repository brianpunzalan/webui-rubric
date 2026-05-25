import { describe, it, expect } from 'vitest';
import {
  validateProjectConfig,
  validateWeights,
  validateCustomSubCriteria,
} from '../../src/config/validate.js';
import type { RubricDefinition, Dimension } from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDimension(overrides: Partial<Dimension> = {}): Dimension {
  return {
    id: 'visual-design',
    name: 'Visual Design',
    default_weight: 15,
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

describe('config validation', () => {
  // =========================================================================
  // validateProjectConfig
  // =========================================================================
  describe('validateProjectConfig', () => {
    it('accepts a valid config object', () => {
      const result = validateProjectConfig({
        rubric_version: '1.0.0',
        ship_threshold: 80,
        iteration_cap: 3,
        weights: { 'visual-design': 15 },
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.config).toBeDefined();
    });

    it('rejects config with invalid field type', () => {
      const result = validateProjectConfig({
        ship_threshold: 'not-a-number',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('accepts an empty object (all fields are optional)', () => {
      const result = validateProjectConfig({});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.config).toBeDefined();
    });

    it('rejects ship_threshold out of range (> 100)', () => {
      const result = validateProjectConfig({ ship_threshold: 150 });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects negative pixelmatch_threshold', () => {
      const result = validateProjectConfig({ pixelmatch_threshold: -0.5 });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects non-positive iteration_cap', () => {
      const result = validateProjectConfig({ iteration_cap: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid tool_fallback_policy enum value', () => {
      const result = validateProjectConfig({ tool_fallback_policy: 'invalid-policy' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // validateWeights
  // =========================================================================
  describe('validateWeights', () => {
    it('returns no errors when weights sum to 100', () => {
      const rubric = makeRubric([
        makeDimension({ id: 'a', weight_floor: null }),
        makeDimension({ id: 'b', weight_floor: null }),
      ]);
      const errors = validateWeights({ a: 60, b: 40 }, rubric);
      expect(errors).toHaveLength(0);
    });

    it('returns an error when weights do not sum to 100', () => {
      const rubric = makeRubric([
        makeDimension({ id: 'a', weight_floor: null }),
        makeDimension({ id: 'b', weight_floor: null }),
      ]);
      const errors = validateWeights({ a: 50, b: 40 }, rubric);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('must sum to 100');
    });

    it('returns an error when accessibility weight is below floor without ack', () => {
      const rubric = makeRubric([
        makeDimension({ id: 'accessibility', name: 'Accessibility', weight_floor: 10 }),
        makeDimension({ id: 'other', weight_floor: null }),
      ]);
      const errors = validateWeights({ accessibility: 5, other: 95 }, rubric);
      expect(errors.some((e) => e.includes('below the floor'))).toBe(true);
    });

    it('allows weight below floor when ack includes the dimension id', () => {
      const rubric = makeRubric([
        makeDimension({ id: 'accessibility', name: 'Accessibility', weight_floor: 10 }),
        makeDimension({ id: 'other', weight_floor: null }),
      ]);
      const errors = validateWeights({ accessibility: 5, other: 95 }, rubric, ['accessibility']);
      // Only the "sum" check should pass (5 + 95 = 100), no floor error
      expect(errors.some((e) => e.includes('below the floor'))).toBe(false);
    });

    it('reports both sum error and floor error when applicable', () => {
      const rubric = makeRubric([
        makeDimension({ id: 'accessibility', name: 'Accessibility', weight_floor: 10 }),
      ]);
      // Weight 5, sum is 5 (not 100), and below floor
      const errors = validateWeights({ accessibility: 5 }, rubric);
      expect(errors.length).toBe(2);
    });
  });

  // =========================================================================
  // validateCustomSubCriteria
  // =========================================================================
  describe('validateCustomSubCriteria', () => {
    it('passes when custom sub-criterion has 5 anchors and bound_check', () => {
      const customs = [
        {
          dimension: 'visual-design',
          id: 'custom-1',
          anchors: [{}, {}, {}, {}, {}],
          bound_check: { check_family: 'test', check_id: 'test' },
        },
      ];
      const errors = validateCustomSubCriteria(customs);
      expect(errors).toHaveLength(0);
    });

    it('fails when anchors are missing', () => {
      const customs = [
        {
          dimension: 'visual-design',
          id: 'custom-1',
          bound_check: { check_family: 'test', check_id: 'test' },
        },
      ];
      const errors = validateCustomSubCriteria(customs);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('5 anchor descriptors');
    });

    it('fails when anchors count is not 5', () => {
      const customs = [
        {
          dimension: 'visual-design',
          id: 'custom-1',
          anchors: [{}, {}, {}],
          bound_check: { check_family: 'test', check_id: 'test' },
        },
      ];
      const errors = validateCustomSubCriteria(customs);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('5 anchor descriptors');
    });

    it('fails when bound_check is missing', () => {
      const customs = [
        {
          dimension: 'visual-design',
          id: 'custom-1',
          anchors: [{}, {}, {}, {}, {}],
        },
      ];
      const errors = validateCustomSubCriteria(customs);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('bound_check');
    });

    it('reports errors for multiple invalid customs', () => {
      const customs = [
        { dimension: 'd1', id: 'c1' }, // missing both
        { dimension: 'd2', id: 'c2', anchors: [{}] }, // wrong anchor count + missing bound_check
      ];
      const errors = validateCustomSubCriteria(customs);
      // c1: missing anchors + missing bound_check = 2 errors
      // c2: wrong anchors + missing bound_check = 2 errors
      expect(errors.length).toBe(4);
    });
  });
});
