import type { Page } from 'playwright';
import { PNG } from 'pngjs';

export interface MaskRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function resolveMaskSelectors(
  page: Page,
  selectors: string[],
): Promise<MaskRegion[]> {
  const regions: MaskRegion[] = [];

  for (const selector of selectors) {
    try {
      const elements = await page.$$(selector);
      for (const element of elements) {
        const box = await element.boundingBox();
        if (box) {
          regions.push({
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
          });
        }
      }
    } catch {
      // Selector didn't match — skip silently
    }
  }

  return regions;
}

export function applyMaskToPng(
  png: PNG,
  regions: MaskRegion[],
  maskColor: [number, number, number] = [255, 0, 255], // #FF00FF
): void {
  for (const region of regions) {
    for (let y = region.y; y < region.y + region.height && y < png.height; y++) {
      for (let x = region.x; x < region.x + region.width && x < png.width; x++) {
        const idx = (png.width * y + x) * 4;
        png.data[idx] = maskColor[0];
        png.data[idx + 1] = maskColor[1];
        png.data[idx + 2] = maskColor[2];
        png.data[idx + 3] = 255;
      }
    }
  }
}

export function countMaskedPixels(regions: MaskRegion[], width: number, height: number): number {
  let count = 0;
  for (const region of regions) {
    const effectiveWidth = Math.min(region.width, width - region.x);
    const effectiveHeight = Math.min(region.height, height - region.y);
    if (effectiveWidth > 0 && effectiveHeight > 0) {
      count += effectiveWidth * effectiveHeight;
    }
  }
  return count;
}

export function parseMaskColor(color?: string): [number, number, number] {
  if (!color || !color.startsWith('#') || color.length !== 7) {
    return [255, 0, 255];
  }
  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ];
}
