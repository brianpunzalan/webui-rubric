import { describe, it, expect } from 'vitest';
import { scoreFromDiffRatio } from '../../src/pixelmatch/scoring.js';

describe('scoreFromDiffRatio', () => {
  it('returns 4 for a diff ratio of 0 (perfect match)', () => {
    expect(scoreFromDiffRatio(0)).toBe(4);
  });

  it('returns 4 for a diff ratio of 0.001 (within 0.5%)', () => {
    expect(scoreFromDiffRatio(0.001)).toBe(4);
  });

  it('returns 4 for a diff ratio of exactly 0.005 (boundary)', () => {
    expect(scoreFromDiffRatio(0.005)).toBe(4);
  });

  it('returns 3 for a diff ratio just above 0.005', () => {
    expect(scoreFromDiffRatio(0.0051)).toBe(3);
  });

  it('returns 3 for a diff ratio of 0.008 (within 1%)', () => {
    expect(scoreFromDiffRatio(0.008)).toBe(3);
  });

  it('returns 3 for a diff ratio of exactly 0.01 (boundary)', () => {
    expect(scoreFromDiffRatio(0.01)).toBe(3);
  });

  it('returns 2 for a diff ratio of 0.03 (within 5%)', () => {
    expect(scoreFromDiffRatio(0.03)).toBe(2);
  });

  it('returns 2 for a diff ratio of exactly 0.05 (boundary)', () => {
    expect(scoreFromDiffRatio(0.05)).toBe(2);
  });

  it('returns 1 for a diff ratio of 0.08 (within 10%)', () => {
    expect(scoreFromDiffRatio(0.08)).toBe(1);
  });

  it('returns 1 for a diff ratio of exactly 0.1 (boundary)', () => {
    expect(scoreFromDiffRatio(0.1)).toBe(1);
  });

  it('returns 0 for a diff ratio of 0.15 (above 10%)', () => {
    expect(scoreFromDiffRatio(0.15)).toBe(0);
  });

  it('returns 0 for a diff ratio of 1.0 (complete mismatch)', () => {
    expect(scoreFromDiffRatio(1.0)).toBe(0);
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
