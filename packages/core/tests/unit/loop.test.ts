import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { detectNoProgress } from '../../src/loop/progress.js';
import { checkIterationCap } from '../../src/loop/cap.js';
import { computeFixHash, filterAttemptedFixes } from '../../src/loop/oscillation.js';
import { buildLoopOutput } from '../../src/loop/output.js';
import type { TopIssue } from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTopIssue(overrides: Partial<TopIssue> = {}): TopIssue {
  return {
    rank: 1,
    criterion_id: 'sub-1',
    dimension_id: 'dim-1',
    priority_score: 30,
    score: 1,
    severity: 3,
    fix: 'Do something',
    fix_hash: computeFixHash('Do something'),
    expected_impact: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loop modules', () => {
  // =========================================================================
  // detectNoProgress
  // =========================================================================
  describe('detectNoProgress', () => {
    it('returns true when absolute delta is less than threshold', () => {
      expect(detectNoProgress(2)).toBe(true);
      expect(detectNoProgress(0)).toBe(true);
      expect(detectNoProgress(-1)).toBe(true);
    });

    it('returns false when absolute delta is >= threshold', () => {
      expect(detectNoProgress(3)).toBe(false);
      expect(detectNoProgress(5)).toBe(false);
      expect(detectNoProgress(-5)).toBe(false);
    });

    it('returns false when delta is null (first iteration)', () => {
      expect(detectNoProgress(null)).toBe(false);
    });

    it('uses custom threshold', () => {
      expect(detectNoProgress(4, 5)).toBe(true);
      expect(detectNoProgress(5, 5)).toBe(false);
    });

    it('treats threshold=3 as strict less-than (delta 2.99 is no progress)', () => {
      expect(detectNoProgress(2.99, 3)).toBe(true);
    });

    it('treats exact threshold value as progress (abs(3) is NOT < 3)', () => {
      expect(detectNoProgress(3, 3)).toBe(false);
    });
  });

  // =========================================================================
  // checkIterationCap
  // =========================================================================
  describe('checkIterationCap', () => {
    it('allows iteration when under cap', () => {
      const result = checkIterationCap(3, 5);
      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('allows iteration when exactly at cap', () => {
      const result = checkIterationCap(5, 5);
      expect(result.allowed).toBe(true);
    });

    it('does not allow iteration when over cap', () => {
      const result = checkIterationCap(6, 5);
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('exceeds the configured cap');
    });

    it('allows over-cap iteration when allowOverrun is true', () => {
      const result = checkIterationCap(10, 5, true);
      expect(result.allowed).toBe(true);
    });

    it('allows when iteration is null (first pass)', () => {
      const result = checkIterationCap(null);
      expect(result.allowed).toBe(true);
    });

    it('uses default cap of 5', () => {
      const underCap = checkIterationCap(5);
      expect(underCap.allowed).toBe(true);

      const overCap = checkIterationCap(6);
      expect(overCap.allowed).toBe(false);
    });

    it('includes iteration number and cap in error message', () => {
      const result = checkIterationCap(8, 5);
      expect(result.message).toContain('8');
      expect(result.message).toContain('5');
    });
  });

  // =========================================================================
  // computeFixHash / filterAttemptedFixes
  // =========================================================================
  describe('computeFixHash', () => {
    it('produces consistent SHA-256 hash', () => {
      const fix = 'Add alt text to all images';
      const expected = createHash('sha256').update(fix).digest('hex');
      expect(computeFixHash(fix)).toBe(expected);
    });

    it('returns the same hash for the same input', () => {
      const hash1 = computeFixHash('same fix');
      const hash2 = computeFixHash('same fix');
      expect(hash1).toBe(hash2);
    });

    it('returns different hashes for different inputs', () => {
      const hash1 = computeFixHash('fix A');
      const hash2 = computeFixHash('fix B');
      expect(hash1).not.toBe(hash2);
    });

    it('returns a 64-character hex string', () => {
      const hash = computeFixHash('some fix');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('filterAttemptedFixes', () => {
    it('removes issues whose fix_hash is in the attempted set', () => {
      const hash = computeFixHash('Fix A');
      const issues: TopIssue[] = [
        makeTopIssue({ criterion_id: 's1', fix: 'Fix A', fix_hash: hash }),
        makeTopIssue({ criterion_id: 's2', fix: 'Fix B', fix_hash: computeFixHash('Fix B') }),
      ];
      const attempted = new Set([hash]);
      const result = filterAttemptedFixes(issues, attempted);
      expect(result).toHaveLength(1);
      expect(result[0].criterion_id).toBe('s2');
    });

    it('returns all issues when none are attempted', () => {
      const issues: TopIssue[] = [
        makeTopIssue({ criterion_id: 's1', fix_hash: computeFixHash('Fix A') }),
        makeTopIssue({ criterion_id: 's2', fix_hash: computeFixHash('Fix B') }),
      ];
      const result = filterAttemptedFixes(issues, new Set());
      expect(result).toHaveLength(2);
    });

    it('returns empty when all are attempted', () => {
      const hashA = computeFixHash('Fix A');
      const hashB = computeFixHash('Fix B');
      const issues: TopIssue[] = [
        makeTopIssue({ criterion_id: 's1', fix_hash: hashA }),
        makeTopIssue({ criterion_id: 's2', fix_hash: hashB }),
      ];
      const result = filterAttemptedFixes(issues, new Set([hashA, hashB]));
      expect(result).toHaveLength(0);
    });
  });

  // =========================================================================
  // buildLoopOutput
  // =========================================================================
  describe('buildLoopOutput', () => {
    it('computes delta correctly from current and previous composite', () => {
      const output = buildLoopOutput(80, 2, 65, 3);
      expect(output.iteration).toBe(2);
      expect(output.previous_composite).toBe(65);
      expect(output.delta).toBe(15); // 80 - 65
      expect(output.attempted_fixes_count).toBe(3);
    });

    it('returns null delta when previous_composite is null', () => {
      const output = buildLoopOutput(80, 1, null, 0);
      expect(output.delta).toBeNull();
      expect(output.previous_composite).toBeNull();
    });

    it('computes negative delta when score decreased', () => {
      const output = buildLoopOutput(50, 3, 70, 5);
      expect(output.delta).toBe(-20); // 50 - 70
    });

    it('computes zero delta when score unchanged', () => {
      const output = buildLoopOutput(75, 2, 75, 2);
      expect(output.delta).toBe(0);
    });

    it('handles null iteration', () => {
      const output = buildLoopOutput(80, null, null, 0);
      expect(output.iteration).toBeNull();
      expect(output.delta).toBeNull();
    });
  });
});
