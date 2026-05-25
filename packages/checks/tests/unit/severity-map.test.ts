import { describe, it, expect } from 'vitest';
import { axeSeverity, AXE_IMPACT_TO_SEVERITY } from '../../src/accessibility/severity-map.js';

describe('axeSeverity', () => {
  it('returns 4 for critical impact', () => {
    expect(axeSeverity('critical')).toBe(4);
  });

  it('returns 3 for serious impact', () => {
    expect(axeSeverity('serious')).toBe(3);
  });

  it('returns 2 for moderate impact', () => {
    expect(axeSeverity('moderate')).toBe(2);
  });

  it('returns 1 for minor impact', () => {
    expect(axeSeverity('minor')).toBe(1);
  });

  it('returns 1 for undefined impact (defaults to minor)', () => {
    expect(axeSeverity(undefined)).toBe(1);
  });

  it('returns 1 for unknown impact string', () => {
    expect(axeSeverity('unknown')).toBe(1);
  });

  it('returns 1 for empty string impact', () => {
    expect(axeSeverity('')).toBe(1);
  });
});

describe('AXE_IMPACT_TO_SEVERITY', () => {
  it('contains exactly 4 severity levels', () => {
    expect(Object.keys(AXE_IMPACT_TO_SEVERITY)).toHaveLength(4);
  });

  it('maps critical to 4', () => {
    expect(AXE_IMPACT_TO_SEVERITY['critical']).toBe(4);
  });

  it('maps serious to 3', () => {
    expect(AXE_IMPACT_TO_SEVERITY['serious']).toBe(3);
  });

  it('maps moderate to 2', () => {
    expect(AXE_IMPACT_TO_SEVERITY['moderate']).toBe(2);
  });

  it('maps minor to 1', () => {
    expect(AXE_IMPACT_TO_SEVERITY['minor']).toBe(1);
  });
});
