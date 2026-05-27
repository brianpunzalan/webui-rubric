import { describe, it, expect } from 'vitest';
import { buildVisualParitySuggestedFix } from '../../src/pixelmatch/suggested-fix.js';

describe('buildVisualParitySuggestedFix', () => {
  it('returns fallback message when no mapped regions', () => {
    const result = buildVisualParitySuggestedFix({
      mappedRegions: [],
      diffRatio: 0.05,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('5.0%');
    expect(result[0]).toContain('diff image');
  });

  it('returns per-element suggestions with background-color diff', () => {
    const result = buildVisualParitySuggestedFix({
      mappedRegions: [
        {
          y_start: 0,
          y_end: 100,
          diff_pixel_count: 500,
          pct_of_total_diff: 1,
          elements: [
            {
              selector: '.header',
              tagName: 'div',
              styleDiffs: [
                { property: 'background-color', actual: '#ffffff', expected: '#1a1a2e' },
                { property: 'color', actual: 'rgb(0,0,0)', expected: 'see reference' },
              ],
            },
          ],
        },
      ],
      diffRatio: 0.03,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('.header');
    expect(result[0]).toContain('background-color #ffffff→#1a1a2e');
    expect(result[0]).toContain('color');
  });

  it('returns one suggestion per element across multiple regions', () => {
    const result = buildVisualParitySuggestedFix({
      mappedRegions: [
        {
          y_start: 0,
          y_end: 50,
          diff_pixel_count: 300,
          pct_of_total_diff: 0.6,
          elements: [
            {
              selector: '.nav',
              tagName: 'nav',
              styleDiffs: [{ property: 'font-size', actual: '14px', expected: 'see reference' }],
            },
          ],
        },
        {
          y_start: 50,
          y_end: 100,
          diff_pixel_count: 200,
          pct_of_total_diff: 0.4,
          elements: [
            {
              selector: '.content',
              tagName: 'div',
              styleDiffs: [{ property: 'font-family', actual: 'Arial', expected: 'see reference' }],
            },
          ],
        },
      ],
      diffRatio: 0.05,
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('.nav');
    expect(result[1]).toContain('.content');
  });

  it('falls back to position label when element has no style diffs', () => {
    const result = buildVisualParitySuggestedFix({
      mappedRegions: [
        {
          y_start: 100,
          y_end: 200,
          diff_pixel_count: 100,
          pct_of_total_diff: 1,
          elements: [{ selector: '.mystery', tagName: 'div', styleDiffs: [] }],
        },
      ],
      diffRatio: 0.01,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('.mystery');
    expect(result[0]).toContain('y:100-200');
  });
});
