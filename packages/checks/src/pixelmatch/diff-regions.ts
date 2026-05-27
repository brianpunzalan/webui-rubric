export interface DiffRegion {
  y_start: number;
  y_end: number;
  diff_pixel_count: number;
  pct_of_total_diff: number;
}

export function analyzeDiffRegions(
  diffBuffer: Uint8Array,
  width: number,
  height: number,
  diffColor: [number, number, number] = [255, 0, 0],
): DiffRegion[] {
  const bandHeight = Math.max(1, Math.ceil(height / Math.min(10, Math.ceil(height / 80))));
  const bandCount = Math.ceil(height / bandHeight);
  const bandDiffs = new Array<number>(bandCount).fill(0);

  let totalDiffPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (
        diffBuffer[idx] === diffColor[0] &&
        diffBuffer[idx + 1] === diffColor[1] &&
        diffBuffer[idx + 2] === diffColor[2]
      ) {
        const band = Math.min(Math.floor(y / bandHeight), bandCount - 1);
        bandDiffs[band]++;
        totalDiffPixels++;
      }
    }
  }

  if (totalDiffPixels === 0) return [];

  const regions: DiffRegion[] = [];
  for (let i = 0; i < bandCount; i++) {
    if (bandDiffs[i] > 0) {
      regions.push({
        y_start: i * bandHeight,
        y_end: Math.min((i + 1) * bandHeight, height),
        diff_pixel_count: bandDiffs[i],
        pct_of_total_diff: bandDiffs[i] / totalDiffPixels,
      });
    }
  }

  regions.sort((a, b) => b.diff_pixel_count - a.diff_pixel_count);
  return regions.slice(0, 3);
}
