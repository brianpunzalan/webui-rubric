import type { DiffRegion } from './diff-regions.js';

export interface ElementLocation {
  selector: string;
  bbox: { x: number; y: number; width: number; height: number };
  tagName: string;
  computedStyles: Record<string, string>;
}

export interface StyleDiff {
  property: string;
  actual: string;
  expected: string;
}

export interface MappedDiffElement {
  selector: string;
  tagName: string;
  styleDiffs: StyleDiff[];
}

export interface MappedDiffRegion {
  y_start: number;
  y_end: number;
  diff_pixel_count: number;
  pct_of_total_diff: number;
  elements: MappedDiffElement[];
}

function parseRgb(css: string): [number, number, number] | null {
  const m = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

function sampleDominantColor(
  buffer: Uint8Array,
  imgWidth: number,
  bbox: { x: number; y: number; width: number; height: number },
): [number, number, number] | null {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  const x0 = Math.max(0, bbox.x);
  const y0 = Math.max(0, bbox.y);
  const x1 = Math.min(imgWidth, bbox.x + bbox.width);
  const y1 = Math.min(buffer.length / (imgWidth * 4), bbox.y + bbox.height);

  const step = Math.max(1, Math.floor(Math.min(bbox.width, bbox.height) / 10));

  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const idx = (y * imgWidth + x) * 4;
      if (idx + 3 >= buffer.length) continue;
      const r = Math.round(buffer[idx] / 8) * 8;
      const g = Math.round(buffer[idx + 1] / 8) * 8;
      const b = Math.round(buffer[idx + 2] / 8) * 8;
      const key = `${r},${g},${b}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.count++;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }
  }

  if (buckets.size === 0) return null;

  let best = { count: 0, r: 0, g: 0, b: 0 };
  for (const entry of buckets.values()) {
    if (entry.count > best.count) best = entry;
  }
  return [best.r, best.g, best.b];
}

const COLOR_DIFF_THRESHOLD = 30;

export function mapDiffRegionsToElements(
  regions: DiffRegion[],
  elementLocations: ElementLocation[],
  referenceBuffer: Uint8Array | null,
  imageWidth: number,
): MappedDiffRegion[] {
  return regions.map((region) => {
    const overlapping = elementLocations
      .map((el) => {
        const overlapStart = Math.max(region.y_start, el.bbox.y);
        const overlapEnd = Math.min(region.y_end, el.bbox.y + el.bbox.height);
        const overlap = Math.max(0, overlapEnd - overlapStart);
        return { el, overlap };
      })
      .filter((e) => e.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 3);

    const elements: MappedDiffElement[] = overlapping.map(({ el }) => {
      const styleDiffs: StyleDiff[] = [];

      if (referenceBuffer) {
        const refColor = sampleDominantColor(referenceBuffer, imageWidth, el.bbox);
        if (refColor) {
          const actualBg = el.computedStyles['background-color'];
          const actualRgb = parseRgb(actualBg);
          if (actualRgb && colorDistance(actualRgb, refColor) > COLOR_DIFF_THRESHOLD) {
            styleDiffs.push({
              property: 'background-color',
              actual: rgbToHex(...actualRgb),
              expected: rgbToHex(...refColor),
            });
          }
        }
      }

      for (const prop of ['color', 'font-size', 'font-family', 'font-weight', 'border-color']) {
        const val = el.computedStyles[prop];
        if (val) {
          styleDiffs.push({
            property: prop,
            actual: val,
            expected: 'see reference',
          });
        }
      }

      return {
        selector: el.selector,
        tagName: el.tagName,
        styleDiffs,
      };
    });

    return {
      y_start: region.y_start,
      y_end: region.y_end,
      diff_pixel_count: region.diff_pixel_count,
      pct_of_total_diff: region.pct_of_total_diff,
      elements,
    };
  });
}
