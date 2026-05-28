import { describe, it, expect, vi } from 'vitest';

vi.mock('chrome-launcher', () => ({
  launch: vi.fn().mockRejectedValue(new Error('Chrome not available in test environment')),
}));

import { runLighthouseChecks } from '../../src/performance/index.js';

describe('runLighthouseChecks', () => {
  it('returns suggested_fix as array (not string) when chrome-launcher throws', async () => {
    const results = await runLighthouseChecks('http://localhost:3000');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(Array.isArray(r.suggested_fix)).toBe(true);
      for (const fix of r.suggested_fix) {
        expect(typeof fix).toBe('string');
      }
    }
  });

  it('returns tool_unavailable status for all metrics when lighthouse fails', async () => {
    const results = await runLighthouseChecks('http://localhost:3000');
    for (const r of results) {
      expect(r.status).toBe('tool_unavailable');
      expect(r.score).toBeNull();
      expect(r.severity).toBe(0);
    }
  });

  it('returns one result per performance metric when lighthouse fails', async () => {
    const results = await runLighthouseChecks('http://localhost:3000');
    expect(results.length).toBeGreaterThan(0);
    const sources = results.map((r) => r.evidence_source);
    const unique = new Set(sources);
    expect(unique.size).toBe(results.length);
  });
});
