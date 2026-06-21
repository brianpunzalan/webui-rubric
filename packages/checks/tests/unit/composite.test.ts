import { describe, it, expect } from 'vitest';
import { PNG } from 'pngjs';
import { buildSideBySide, cropStrip } from '../../src/pixelmatch/composite.js';
import { runPixelmatch } from '../../src/pixelmatch/index.js';

function solidPng(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    png.data[idx] = rgba[0];
    png.data[idx + 1] = rgba[1];
    png.data[idx + 2] = rgba[2];
    png.data[idx + 3] = rgba[3];
  }
  return PNG.sync.write(png);
}

describe('buildSideBySide', () => {
  it('produces a composite three panels wide (plus gutters) and one label band tall', () => {
    const w = 40;
    const h = 30;
    const reference = solidPng(w, h, [0, 128, 255, 255]);
    const screenshot = solidPng(w, h, [255, 128, 0, 255]);
    const diff = solidPng(w, h, [255, 0, 0, 255]);

    const out = PNG.sync.read(buildSideBySide(reference, screenshot, diff));

    // 3 panels of width w, 2 gutters of 8px between them.
    expect(out.width).toBe(w * 3 + 8 * 2);
    // panel height + 18px label band.
    expect(out.height).toBe(h + 18);
  });
});

describe('cropStrip', () => {
  it('returns a full-width strip of the requested row range', () => {
    const w = 50;
    const h = 100;
    const source = solidPng(w, h, [10, 20, 30, 255]);

    const out = PNG.sync.read(cropStrip(source, 20, 60));
    expect(out.width).toBe(w);
    expect(out.height).toBe(40);
  });

  it('clamps a range that runs past the image height', () => {
    const source = solidPng(10, 10, [0, 0, 0, 255]);
    const out = PNG.sync.read(cropStrip(source, 8, 999));
    expect(out.height).toBe(2);
  });
});

describe('runPixelmatch diff_buffer', () => {
  it('returns a decodable diff PNG buffer without requiring a disk path', () => {
    const screenshot = solidPng(16, 16, [255, 0, 0, 255]);
    const reference = solidPng(16, 16, [0, 0, 255, 255]);

    const result = runPixelmatch({
      screenshotBuffer: screenshot,
      referenceBuffer: reference,
    });

    expect(result.diff_png_path).toBeNull();
    expect(result.diff_buffer.length).toBeGreaterThan(0);
    const decoded = PNG.sync.read(result.diff_buffer);
    expect(decoded.width).toBe(16);
    expect(decoded.height).toBe(16);
  });
});
