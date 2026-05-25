import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

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
  screenshot_dimensions: { width: number; height: number };
  reference_dimensions: { width: number; height: number };
}

export function runPixelmatch(input: PixelComparisonInput): PixelComparisonOutput {
  const screenshot = PNG.sync.read(input.screenshotBuffer);
  const reference = PNG.sync.read(input.referenceBuffer);

  const width = screenshot.width;
  const height = screenshot.height;
  const threshold = input.threshold ?? 0.1;

  const diff = new PNG({ width, height });

  const mismatchCount = pixelmatch(screenshot.data, reference.data, diff.data, width, height, {
    threshold,
  });

  const totalPixels = width * height;
  const diffRatio = totalPixels > 0 ? mismatchCount / totalPixels : 0;

  let diffPngPath: string | null = null;
  if (input.diffOutputPath) {
    const diffBuffer = PNG.sync.write(diff);
    writeFileSync(input.diffOutputPath, diffBuffer);
    diffPngPath = input.diffOutputPath;
  }

  return {
    diff_pixel_count: mismatchCount,
    total_pixel_count: totalPixels,
    diff_ratio: diffRatio,
    threshold,
    diff_png_path: diffPngPath,
    screenshot_dimensions: { width: screenshot.width, height: screenshot.height },
    reference_dimensions: { width: reference.width, height: reference.height },
  };
}
