import type { PixelComparisonResult, PixelComparisonViewport } from '../types/index.js';

export function buildPixelComparisonResult(
  viewports: PixelComparisonViewport[],
): PixelComparisonResult | null {
  if (viewports.length === 0) return null;
  return { viewports };
}
