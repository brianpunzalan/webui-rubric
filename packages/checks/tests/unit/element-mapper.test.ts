import { describe, it, expect } from 'vitest';
import { mapDiffRegionsToElements } from '../../src/pixelmatch/element-mapper.js';
import type { DiffRegion } from '../../src/pixelmatch/diff-regions.js';

function makeElement(selector: string, y: number, height: number) {
  return {
    selector,
    bbox: { x: 0, y, width: 100, height },
    tagName: 'div',
    computedStyles: {
      'background-color': 'rgb(255, 255, 255)',
      color: 'rgb(0, 0, 0)',
      'font-size': '16px',
      'font-family': 'Arial',
      'font-weight': '400',
      'border-color': 'rgb(0, 0, 0)',
    },
  };
}

describe('mapDiffRegionsToElements', () => {
  it('returns empty elements when no elements overlap', () => {
    const regions: DiffRegion[] = [
      { y_start: 0, y_end: 50, diff_pixel_count: 100, pct_of_total_diff: 1 },
    ];
    const elements = [makeElement('.footer', 500, 50)];
    const result = mapDiffRegionsToElements(regions, elements, null, 100);
    expect(result).toHaveLength(1);
    expect(result[0].elements).toHaveLength(0);
  });

  it('maps overlapping elements to diff regions', () => {
    const regions: DiffRegion[] = [
      { y_start: 0, y_end: 100, diff_pixel_count: 100, pct_of_total_diff: 1 },
    ];
    const elements = [
      makeElement('.header', 0, 60),
      makeElement('.nav', 60, 40),
      makeElement('.footer', 500, 50),
    ];
    const result = mapDiffRegionsToElements(regions, elements, null, 100);
    expect(result[0].elements).toHaveLength(2);
    expect(result[0].elements[0].selector).toBe('.header');
    expect(result[0].elements[1].selector).toBe('.nav');
  });

  it('limits to top 3 elements per region', () => {
    const regions: DiffRegion[] = [
      { y_start: 0, y_end: 200, diff_pixel_count: 100, pct_of_total_diff: 1 },
    ];
    const elements = [
      makeElement('.a', 0, 50),
      makeElement('.b', 50, 50),
      makeElement('.c', 100, 50),
      makeElement('.d', 150, 50),
    ];
    const result = mapDiffRegionsToElements(regions, elements, null, 100);
    expect(result[0].elements).toHaveLength(3);
  });

  it('includes style diffs with "see reference" for non-color properties', () => {
    const regions: DiffRegion[] = [
      { y_start: 0, y_end: 100, diff_pixel_count: 100, pct_of_total_diff: 1 },
    ];
    const elements = [makeElement('.header', 0, 100)];
    const result = mapDiffRegionsToElements(regions, elements, null, 100);
    const styleDiffs = result[0].elements[0].styleDiffs;
    const fontSizeDiff = styleDiffs.find((d) => d.property === 'font-size');
    expect(fontSizeDiff).toBeDefined();
    expect(fontSizeDiff!.actual).toBe('16px');
    expect(fontSizeDiff!.expected).toBe('see reference');
  });

  it('detects background-color diff from reference buffer', () => {
    const regions: DiffRegion[] = [
      { y_start: 0, y_end: 10, diff_pixel_count: 100, pct_of_total_diff: 1 },
    ];
    const elements = [
      {
        selector: '.header',
        bbox: { x: 0, y: 0, width: 10, height: 10 },
        tagName: 'div',
        computedStyles: {
          'background-color': 'rgb(255, 255, 255)',
          color: 'rgb(0, 0, 0)',
          'font-size': '16px',
          'font-family': 'Arial',
          'font-weight': '400',
          'border-color': 'rgb(0, 0, 0)',
        },
      },
    ];

    // Reference buffer filled with dark color (30, 30, 60)
    const refBuffer = new Uint8Array(10 * 10 * 4);
    for (let i = 0; i < 10 * 10; i++) {
      refBuffer[i * 4] = 30;
      refBuffer[i * 4 + 1] = 30;
      refBuffer[i * 4 + 2] = 60;
      refBuffer[i * 4 + 3] = 255;
    }

    const result = mapDiffRegionsToElements(regions, elements, refBuffer, 10);
    const bgDiff = result[0].elements[0].styleDiffs.find((d) => d.property === 'background-color');
    expect(bgDiff).toBeDefined();
    expect(bgDiff!.actual).not.toBe(bgDiff!.expected);
  });
});
