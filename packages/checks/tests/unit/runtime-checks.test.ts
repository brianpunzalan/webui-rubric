import { describe, it, expect } from 'vitest';
import { checkConsoleErrors, checkResourceCount } from '../../src/structural/runtime-checks.js';

describe('checkConsoleErrors', () => {
  it('returns score 4 when no errors exist', () => {
    const result = checkConsoleErrors([]);
    expect(result.score).toBe(4);
    expect(result.severity).toBe(0);
    expect(result.evidence_source).toBe('console.error-count');
    expect(result.suggested_fix).toEqual([]);
  });

  it('returns score 4 when only warnings exist (no errors)', () => {
    const entries = [
      { level: 'warning' as const, text: 'Deprecation warning' },
      { level: 'warning' as const, text: 'Another warning' },
    ];
    const result = checkConsoleErrors(entries);
    expect(result.score).toBe(4);
  });

  it('returns score 3 for 1-2 errors', () => {
    const entries = [
      { level: 'error' as const, text: 'Error 1' },
      { level: 'error' as const, text: 'Error 2' },
    ];
    const result = checkConsoleErrors(entries);
    expect(result.score).toBe(3);
    expect(result.severity).toBe(1);
  });

  it('returns score 2 for 3-5 errors', () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      level: 'error' as const,
      text: `Error ${i}`,
    }));
    const result = checkConsoleErrors(entries);
    expect(result.score).toBe(2);
  });

  it('returns score 1 for 6-10 errors', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      level: 'error' as const,
      text: `Error ${i}`,
    }));
    const result = checkConsoleErrors(entries);
    expect(result.score).toBe(1);
  });

  it('returns score 0 for more than 10 errors', () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({
      level: 'error' as const,
      text: `Error ${i}`,
    }));
    const result = checkConsoleErrors(entries);
    expect(result.score).toBe(0);
    expect(result.severity).toBe(4);
  });

  it('only counts errors, not warnings, in the total', () => {
    const entries = [
      { level: 'error' as const, text: 'Error 1' },
      { level: 'warning' as const, text: 'Warning 1' },
      { level: 'warning' as const, text: 'Warning 2' },
      { level: 'warning' as const, text: 'Warning 3' },
    ];
    const result = checkConsoleErrors(entries);
    // Only 1 error => score 3
    expect(result.score).toBe(3);
  });

  it('includes error count in evidence string', () => {
    const entries = [{ level: 'error' as const, text: 'Oops' }];
    const result = checkConsoleErrors(entries);
    expect(result.evidence).toContain('1 console error');
  });
});

describe('checkResourceCount', () => {
  it('returns score 4 for few requests (<=25)', () => {
    const har = {
      log: {
        entries: Array.from({ length: 10 }, () => ({ request: {}, response: {} })),
      },
    };
    const result = checkResourceCount(har);
    expect(result.score).toBe(4);
    expect(result.evidence_source).toBe('har.resource-count');
    expect(result.suggested_fix).toEqual([]);
  });

  it('returns score 3 for 26-40 requests', () => {
    const har = {
      log: {
        entries: Array.from({ length: 35 }, () => ({})),
      },
    };
    const result = checkResourceCount(har);
    expect(result.score).toBe(3);
  });

  it('returns score 2 for 41-60 requests', () => {
    const har = {
      log: {
        entries: Array.from({ length: 50 }, () => ({})),
      },
    };
    const result = checkResourceCount(har);
    expect(result.score).toBe(2);
  });

  it('returns score 1 for 61-100 requests', () => {
    const har = {
      log: {
        entries: Array.from({ length: 80 }, () => ({})),
      },
    };
    const result = checkResourceCount(har);
    expect(result.score).toBe(1);
  });

  it('returns score 0 for more than 100 requests', () => {
    const har = {
      log: {
        entries: Array.from({ length: 150 }, () => ({})),
      },
    };
    const result = checkResourceCount(har);
    expect(result.score).toBe(0);
    expect(result.severity).toBe(4);
  });

  it('returns score 4 for null HAR data', () => {
    const result = checkResourceCount(null);
    // null?.log would be undefined, entries won't be array => requestCount stays 0
    expect(result.score).toBe(4);
  });

  it('returns score 4 for undefined HAR data', () => {
    const result = checkResourceCount(undefined);
    expect(result.score).toBe(4);
  });

  it('returns score 4 for HAR with no log property', () => {
    const result = checkResourceCount({});
    expect(result.score).toBe(4);
  });

  it('returns score 4 for HAR with log but no entries', () => {
    const result = checkResourceCount({ log: {} });
    expect(result.score).toBe(4);
  });

  it('returns score 4 for HAR with non-array entries', () => {
    const result = checkResourceCount({ log: { entries: 'not-an-array' } });
    expect(result.score).toBe(4);
  });

  it('returns score 4 for empty entries array', () => {
    const result = checkResourceCount({ log: { entries: [] } });
    expect(result.score).toBe(4);
  });

  it('includes request count in evidence string', () => {
    const har = {
      log: { entries: Array.from({ length: 42 }, () => ({})) },
    };
    const result = checkResourceCount(har);
    expect(result.evidence).toContain('42');
  });
});
