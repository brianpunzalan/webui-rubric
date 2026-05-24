import { describe, it, expect } from 'vitest';
import {
  checkUniqueColorCount,
  checkFontFamilyCount,
  checkSpacingConsistency,
} from '../../src/structural/css-checks.js';

describe('checkUniqueColorCount', () => {
  it('returns score 4 for few colors (<=5)', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { color: 'rgb(0, 0, 0)' },
      '.b': { color: 'rgb(255, 255, 255)' },
      '.c': { 'background-color': 'rgb(100, 100, 100)' },
    };
    const result = checkUniqueColorCount(styles);
    expect(result.score).toBe(4);
    expect(result.evidence_source).toBe('css.unique-color-count');
    expect(result.suggested_fix).toBe('');
  });

  it('returns score 3 for 6-10 colors', () => {
    const styles: Record<string, Record<string, string>> = {};
    for (let i = 0; i < 8; i++) {
      styles[`.el${i}`] = { color: `rgb(${i * 30}, ${i * 20}, ${i * 10})` };
    }
    const result = checkUniqueColorCount(styles);
    expect(result.score).toBe(3);
  });

  it('returns score 2 for 11-20 colors', () => {
    const styles: Record<string, Record<string, string>> = {};
    for (let i = 0; i < 15; i++) {
      styles[`.el${i}`] = { color: `rgb(${i}, ${i + 50}, ${i + 100})` };
    }
    const result = checkUniqueColorCount(styles);
    expect(result.score).toBe(2);
  });

  it('returns score 1 for 21-30 colors', () => {
    const styles: Record<string, Record<string, string>> = {};
    for (let i = 0; i < 25; i++) {
      styles[`.el${i}`] = { color: `rgb(${i}, ${i * 2}, ${i * 3})` };
    }
    const result = checkUniqueColorCount(styles);
    expect(result.score).toBe(1);
  });

  it('returns score 0 for more than 30 colors', () => {
    const styles: Record<string, Record<string, string>> = {};
    for (let i = 0; i < 35; i++) {
      styles[`.el${i}`] = { color: `rgb(${i}, ${i * 2}, ${i * 3})` };
    }
    const result = checkUniqueColorCount(styles);
    expect(result.score).toBe(0);
    expect(result.severity).toBe(4);
  });

  it('ignores transparent background-color rgba(0, 0, 0, 0)', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'background-color': 'rgba(0, 0, 0, 0)' },
      '.b': { color: 'rgb(0, 0, 0)' },
    };
    const result = checkUniqueColorCount(styles);
    // Only 1 color counted (the transparent bg is ignored)
    expect(result.score).toBe(4);
  });

  it('ignores default border-color rgb(0, 0, 0)', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'border-color': 'rgb(0, 0, 0)' },
      '.b': { color: 'rgb(255, 0, 0)' },
    };
    const result = checkUniqueColorCount(styles);
    // Only 1 color counted (default border-color excluded)
    expect(result.score).toBe(4);
  });

  it('counts distinct colors from color, background-color, and border-color', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': {
        color: 'rgb(255, 0, 0)',
        'background-color': 'rgb(0, 255, 0)',
        'border-color': 'rgb(0, 0, 255)',
      },
    };
    const result = checkUniqueColorCount(styles);
    expect(result.score).toBe(4); // 3 colors <= 5
  });

  it('deduplicates identical color values', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { color: 'rgb(255, 0, 0)' },
      '.b': { color: 'rgb(255, 0, 0)' },
      '.c': { 'background-color': 'rgb(255, 0, 0)' },
    };
    const result = checkUniqueColorCount(styles);
    // Only 1 unique color
    expect(result.score).toBe(4);
  });

  it('returns score 4 for empty styles object', () => {
    const result = checkUniqueColorCount({});
    expect(result.score).toBe(4);
  });
});

describe('checkFontFamilyCount', () => {
  it('returns score 4 for 1-2 font families', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'font-family': 'Arial, sans-serif' },
      '.b': { 'font-family': 'Georgia, serif' },
    };
    const result = checkFontFamilyCount(styles);
    expect(result.score).toBe(4);
    expect(result.evidence_source).toBe('css.font-family-count');
    expect(result.suggested_fix).toBe('');
  });

  it('returns score 3 for 3 font families', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'font-family': 'Arial, sans-serif' },
      '.b': { 'font-family': 'Georgia, serif' },
      '.c': { 'font-family': 'Courier New, monospace' },
    };
    const result = checkFontFamilyCount(styles);
    expect(result.score).toBe(3);
  });

  it('returns score 2 for 4 font families', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'font-family': 'Arial' },
      '.b': { 'font-family': 'Georgia' },
      '.c': { 'font-family': 'Courier New' },
      '.d': { 'font-family': 'Verdana' },
    };
    const result = checkFontFamilyCount(styles);
    expect(result.score).toBe(2);
  });

  it('returns score 1 for 5-6 font families', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'font-family': 'Arial' },
      '.b': { 'font-family': 'Georgia' },
      '.c': { 'font-family': 'Courier New' },
      '.d': { 'font-family': 'Verdana' },
      '.e': { 'font-family': 'Trebuchet MS' },
    };
    const result = checkFontFamilyCount(styles);
    expect(result.score).toBe(1);
  });

  it('returns score 0 for more than 6 font families', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'font-family': 'Arial' },
      '.b': { 'font-family': 'Georgia' },
      '.c': { 'font-family': 'Courier New' },
      '.d': { 'font-family': 'Verdana' },
      '.e': { 'font-family': 'Trebuchet MS' },
      '.f': { 'font-family': 'Impact' },
      '.g': { 'font-family': 'Comic Sans MS' },
    };
    const result = checkFontFamilyCount(styles);
    expect(result.score).toBe(0);
    expect(result.severity).toBe(4);
  });

  it('extracts only the primary (first) font family from comma-separated list', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'font-family': 'Arial, Helvetica, sans-serif' },
      '.b': { 'font-family': 'Arial, sans-serif' },
    };
    const result = checkFontFamilyCount(styles);
    // Both resolve to "arial" -> 1 family
    expect(result.score).toBe(4);
  });

  it('normalizes font family names to lowercase for deduplication', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'font-family': 'Arial' },
      '.b': { 'font-family': 'arial' },
      '.c': { 'font-family': 'ARIAL' },
    };
    const result = checkFontFamilyCount(styles);
    // All "arial" -> 1 family
    expect(result.score).toBe(4);
  });

  it('strips quotes from font family names', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'font-family': '"Courier New", monospace' },
      '.b': { 'font-family': "'Courier New', monospace" },
    };
    const result = checkFontFamilyCount(styles);
    // Both resolve to "courier new" -> 1 family
    expect(result.score).toBe(4);
  });

  it('returns score 4 for empty styles', () => {
    const result = checkFontFamilyCount({});
    expect(result.score).toBe(4);
  });
});

describe('checkSpacingConsistency', () => {
  it('returns score 4 for very consistent spacing (low stddev)', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'margin-top': '16px', 'padding-top': '16px' },
      '.b': { 'margin-top': '16px', 'padding-bottom': '16px' },
      '.c': { 'margin-bottom': '16px', 'padding-left': '16px' },
    };
    const result = checkSpacingConsistency(styles);
    expect(result.score).toBe(4);
    expect(result.evidence_source).toBe('css.spacing-consistency');
    expect(result.suggested_fix).toBe('');
  });

  it('returns low score for high variance spacing', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'margin-top': '2px', 'padding-top': '100px' },
      '.b': { 'margin-bottom': '5px', 'padding-bottom': '200px' },
      '.c': { 'margin-left': '1px', 'padding-right': '150px' },
    };
    const result = checkSpacingConsistency(styles);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('returns score 4 for insufficient data (fewer than 2 values)', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'margin-top': '16px' },
    };
    const result = checkSpacingConsistency(styles);
    expect(result.score).toBe(4);
    expect(result.evidence).toBe('Insufficient spacing data');
  });

  it('returns score 4 for empty styles', () => {
    const result = checkSpacingConsistency({});
    expect(result.score).toBe(4);
    expect(result.evidence).toBe('Insufficient spacing data');
  });

  it('ignores zero-value spacing', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'margin-top': '0px', 'padding-top': '16px' },
    };
    const result = checkSpacingConsistency(styles);
    // Only 1 non-zero value => insufficient data
    expect(result.score).toBe(4);
    expect(result.evidence).toBe('Insufficient spacing data');
  });

  it('ignores non-numeric spacing values', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'margin-top': 'auto', 'padding-top': '16px' },
    };
    const result = checkSpacingConsistency(styles);
    // Only 1 valid value => insufficient data
    expect(result.score).toBe(4);
  });

  it('returns score 3 for moderate variance (stddev 6-15)', () => {
    // Values with moderate spread
    const styles: Record<string, Record<string, string>> = {
      '.a': { 'margin-top': '10px', 'padding-top': '20px' },
      '.b': { 'margin-bottom': '30px', 'padding-bottom': '15px' },
      '.c': { 'margin-left': '25px', 'padding-right': '12px' },
    };
    const result = checkSpacingConsistency(styles);
    expect(result.score).toBe(3);
  });

  it('reads from all 8 spacing properties', () => {
    const styles: Record<string, Record<string, string>> = {
      '.a': {
        'margin-top': '10px',
        'margin-bottom': '10px',
        'margin-left': '10px',
        'margin-right': '10px',
        'padding-top': '10px',
        'padding-bottom': '10px',
        'padding-left': '10px',
        'padding-right': '10px',
      },
    };
    const result = checkSpacingConsistency(styles);
    // All same value => stddev = 0 => score 4
    expect(result.score).toBe(4);
  });
});
