import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import { analyzeDiffRegions, type DiffRegion } from './diff-regions.js';

export interface PixelComparisonInput {
  screenshotBuffer: Buffer;
  referenceBuffer: Buffer;
  threshold?: number;
  diffOutputPath?: string | null;
}

export interface PixelComparisonOutput {
  diff_pixel_count: number;
  total_pixel_count: number;
  diff_ratio: number;
  threshold: number;
  diff_png_path: string | null;
  /** In-memory PNG buffer of the rendered diff image (always populated). */
  diff_buffer: Buffer;
  screenshot_dimensions: { width: number; height: number };
  reference_dimensions: { width: number; height: number };
  diff_regions: DiffRegion[];
}

export function runPixelmatch(input: PixelComparisonInput): PixelComparisonOutput {
  const screenshot = PNG.sync.read(input.screenshotBuffer);
  const reference = PNG.sync.read(input.referenceBuffer);

  const width = screenshot.width;
  const height = screenshot.height;
  const threshold = input.threshold ?? 0.1;

  const diff = new PNG({ width, height });

  const diffColor: [number, number, number] = [255, 0, 0];
  const mismatchCount = pixelmatch(screenshot.data, reference.data, diff.data, width, height, {
    threshold,
    diffColor,
  });

  const totalPixels = width * height;
  const diffRatio = totalPixels > 0 ? mismatchCount / totalPixels : 0;

  const diffBuffer = PNG.sync.write(diff);
  let diffPngPath: string | null = null;
  if (input.diffOutputPath) {
    writeFileSync(input.diffOutputPath, diffBuffer);
    diffPngPath = input.diffOutputPath;
  }

  const diff_regions = analyzeDiffRegions(
    new Uint8Array(diff.data.buffer, diff.data.byteOffset, diff.data.byteLength),
    width,
    height,
    diffColor,
  );

  return {
    diff_pixel_count: mismatchCount,
    total_pixel_count: totalPixels,
    diff_ratio: diffRatio,
    threshold,
    diff_png_path: diffPngPath,
    diff_buffer: diffBuffer,
    screenshot_dimensions: { width: screenshot.width, height: screenshot.height },
    reference_dimensions: { width: reference.width, height: reference.height },
    diff_regions,
  };
}
