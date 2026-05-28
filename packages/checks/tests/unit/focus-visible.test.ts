import { describe, it, expect } from 'vitest';
import { checkFocusVisible } from '../../src/structural/focus-visible.js';

const makePage = (evalResult: unknown) => ({
  evaluate: () => Promise.resolve(evalResult),
});

const throwingPage = {
  evaluate: () => {
    throw new Error('playwright unavailable');
  },
};

describe('checkFocusVisible', () => {
  it('returns suggested_fix as array (not string) when evaluate throws', async () => {
    const result = await checkFocusVisible(throwingPage);
    expect(Array.isArray(result.suggested_fix)).toBe(true);
    expect(result.suggested_fix).toEqual([]);
    expect(result.score).toBeNull();
    expect(result.severity).toBe(0);
    expect(result.evidence_source).toBe('playwright.focus-visible');
  });

  it('returns score 4 with empty suggested_fix when no interactive elements found', async () => {
    const result = await checkFocusVisible(makePage({ total: 0, withFocus: 0 }));
    expect(result.score).toBe(4);
    expect(result.severity).toBe(0);
    expect(result.suggested_fix).toEqual([]);
  });

  it('returns score 4 when >90% of elements have focus indicators', async () => {
    const result = await checkFocusVisible(makePage({ total: 10, withFocus: 10 }));
    expect(result.score).toBe(4);
    expect(result.suggested_fix).toEqual([]);
  });

  it('returns score 3 when 50-90% of elements have focus indicators', async () => {
    const result = await checkFocusVisible(makePage({ total: 10, withFocus: 7 }));
    expect(result.score).toBe(3);
    expect(result.severity).toBe(1);
    expect(Array.isArray(result.suggested_fix)).toBe(true);
    expect(result.suggested_fix.length).toBeGreaterThan(0);
  });

  it('returns score 2 when 25-49% of elements have focus indicators', async () => {
    const result = await checkFocusVisible(makePage({ total: 10, withFocus: 3 }));
    expect(result.score).toBe(2);
    expect(result.severity).toBe(2);
    expect(Array.isArray(result.suggested_fix)).toBe(true);
  });

  it('returns score 1 when >0% but <25% of elements have focus indicators', async () => {
    const result = await checkFocusVisible(makePage({ total: 10, withFocus: 1 }));
    expect(result.score).toBe(1);
    expect(result.severity).toBe(3);
    expect(Array.isArray(result.suggested_fix)).toBe(true);
  });

  it('returns score 0 when no elements have focus indicators', async () => {
    const result = await checkFocusVisible(makePage({ total: 10, withFocus: 0 }));
    expect(result.score).toBe(0);
    expect(result.severity).toBe(4);
    expect(Array.isArray(result.suggested_fix)).toBe(true);
    expect(result.suggested_fix.length).toBeGreaterThan(0);
  });

  it('every suggested_fix item is a string', async () => {
    const result = await checkFocusVisible(makePage({ total: 5, withFocus: 2 }));
    for (const fix of result.suggested_fix) {
      expect(typeof fix).toBe('string');
    }
  });
});
