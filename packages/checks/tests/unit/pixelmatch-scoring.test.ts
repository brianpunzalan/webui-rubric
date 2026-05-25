import { describe, it, expect } from 'vitest';
import { scoreFromDiffRatio } from '../../src/pixelmatch/scoring.js';

describe('scoreFromDiffRatio', () => {
  it('returns 4 for a diff ratio of 0 (perfect match)', () => {
    expect(scoreFromDiffRatio(0)).toBe(4);
  });

  it('returns 3 for a diff ratio of 0.005 (within 0.01)', () => {
    expect(scoreFromDiffRatio(0.005)).toBe(3);
  });

  it('returns 3 for a diff ratio of exactly 0.01 (boundary)', () => {
    expect(scoreFromDiffRatio(0.01)).toBe(3);
  });

  it('returns 2 for a diff ratio of 0.03 (within 0.05)', () => {
    expect(scoreFromDiffRatio(0.03)).toBe(2);
  });

  it('returns 2 for a diff ratio of exactly 0.05 (boundary)', () => {
    expect(scoreFromDiffRatio(0.05)).toBe(2);
  });

  it('returns 1 for a diff ratio of 0.08 (within 0.1)', () => {
    expect(scoreFromDiffRatio(0.08)).toBe(1);
  });

  it('returns 1 for a diff ratio of exactly 0.1 (boundary)', () => {
    expect(scoreFromDiffRatio(0.1)).toBe(1);
  });

  it('returns 0 for a diff ratio of 0.15 (above 0.1)', () => {
    expect(scoreFromDiffRatio(0.15)).toBe(0);
  });

  it('returns 0 for a diff ratio of 1.0 (complete mismatch)', () => {
    expect(scoreFromDiffRatio(1.0)).toBe(0);
  });

  it('returns 3 for a very small non-zero ratio', () => {
    expect(scoreFromDiffRatio(0.001)).toBe(3);
  });

  it('returns 2 for ratio just above 0.01 boundary', () => {
    expect(scoreFromDiffRatio(0.0101)).toBe(2);
  });

  it('returns 1 for ratio just above 0.05 boundary', () => {
    expect(scoreFromDiffRatio(0.0501)).toBe(1);
  });

  it('returns 0 for ratio just above 0.1 boundary', () => {
    expect(scoreFromDiffRatio(0.1001)).toBe(0);
  });
});
