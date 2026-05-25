import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

export interface ReferenceImageInfo {
  buffer: Buffer;
  png: PNG;
  width: number;
  height: number;
}

export function loadReferenceImage(imagePath: string): ReferenceImageInfo {
  const buffer = readFileSync(imagePath);
  const png = PNG.sync.read(buffer);
  return {
    buffer,
    png,
    width: png.width,
    height: png.height,
  };
}

export function inferDpr(
  referenceWidth: number,
  referenceHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): number {
  const widthRatio = referenceWidth / viewportWidth;
  const heightRatio = referenceHeight / viewportHeight;

  if (Math.abs(widthRatio - heightRatio) < 0.1 && widthRatio >= 1) {
    const rounded = Math.round(widthRatio);
    if (Math.abs(widthRatio - rounded) < 0.1) return rounded;
  }
  return 1;
}

export function validateReferenceDimensions(
  reference: ReferenceImageInfo,
  screenshotWidth: number,
  screenshotHeight: number,
  policy: 'fail-fast' | 'resize' = 'fail-fast',
): void {
  if (reference.width !== screenshotWidth || reference.height !== screenshotHeight) {
    if (policy === 'fail-fast') {
      throw new Error(
        `Reference image dimensions (${reference.width}x${reference.height}) do not match ` +
          `screenshot dimensions (${screenshotWidth}x${screenshotHeight}). ` +
          `Set reference_image_mismatch_policy to "resize" to allow automatic resizing.`,
      );
    }
  }
}

export function normalizeRgbaBuffer(png: PNG): Buffer {
  const { data, width, height } = png;
  const result = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    let r = data[offset];
    let g = data[offset + 1];
    let b = data[offset + 2];
    let a = data[offset + 3];

    // If transparent, composite onto white
    if (a < 255) {
      const alpha = a / 255;
      r = Math.round(r * alpha + 255 * (1 - alpha));
      g = Math.round(g * alpha + 255 * (1 - alpha));
      b = Math.round(b * alpha + 255 * (1 - alpha));
      a = 255;
    }

    result[offset] = r;
    result[offset + 1] = g;
    result[offset + 2] = b;
    result[offset + 3] = a;
  }

  return result;
}
