import { describe, it, expect } from 'vitest';
import { analyzeDiffRegions } from '../../src/pixelmatch/diff-regions.js';

function makeBuffer(
  width: number,
  height: number,
  diffPixels: Array<{ x: number; y: number }>,
  diffColor: [number, number, number] = [255, 0, 0],
): Uint8Array {
  const buf = new Uint8Array(width * height * 4);
  for (const { x, y } of diffPixels) {
    const idx = (y * width + x) * 4;
    buf[idx] = diffColor[0];
    buf[idx + 1] = diffColor[1];
    buf[idx + 2] = diffColor[2];
    buf[idx + 3] = 255;
  }
  return buf;
}

describe('analyzeDiffRegions', () => {
  it('returns empty array when no diff pixels exist', () => {
    const buf = new Uint8Array(100 * 100 * 4);
    const result = analyzeDiffRegions(buf, 100, 100);
    expect(result).toEqual([]);
  });

  it('identifies single diff region at top of image', () => {
    const diffs: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 50; x++) {
        diffs.push({ x, y });
      }
    }
    const buf = makeBuffer(100, 100, diffs);
    const result = analyzeDiffRegions(buf, 100, 100);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].y_start).toBe(0);
    expect(result[0].diff_pixel_count).toBe(500);
    expect(result[0].pct_of_total_diff).toBe(1);
  });

  it('returns at most 3 regions sorted by diff count', () => {
    const diffs: Array<{ x: number; y: number }> = [];
    // 4 bands with decreasing diff counts
    for (let y = 0; y < 5; y++) for (let x = 0; x < 40; x++) diffs.push({ x, y }); // 200
    for (let y = 80; y < 85; y++) for (let x = 0; x < 30; x++) diffs.push({ x, y }); // 150
    for (let y = 160; y < 165; y++) for (let x = 0; x < 20; x++) diffs.push({ x, y }); // 100
    for (let y = 240; y < 245; y++) for (let x = 0; x < 10; x++) diffs.push({ x, y }); // 50

    const buf = makeBuffer(100, 400, diffs);
    const result = analyzeDiffRegions(buf, 100, 400);
    expect(result.length).toBe(3);
    expect(result[0].diff_pixel_count).toBeGreaterThanOrEqual(result[1].diff_pixel_count);
    expect(result[1].diff_pixel_count).toBeGreaterThanOrEqual(result[2].diff_pixel_count);
  });

  it('calculates pct_of_total_diff correctly', () => {
    const diffs: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 10; x++) diffs.push({ x, y }); // 50 pixels band 0
    for (let y = 80; y < 85; y++) for (let x = 0; x < 10; x++) diffs.push({ x, y }); // 50 pixels band 1

    const buf = makeBuffer(100, 100, diffs);
    const result = analyzeDiffRegions(buf, 100, 100);
    expect(result.length).toBe(2);
    const totalPct = result.reduce((s, r) => s + r.pct_of_total_diff, 0);
    expect(totalPct).toBeCloseTo(1, 5);
  });
});
