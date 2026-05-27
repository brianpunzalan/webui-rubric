import type { PixelComparisonResult, PixelComparisonViewport } from '../types/index.js';

/** Build a PixelComparisonResult from per-viewport results, or return null when no viewports were compared. */
export function buildPixelComparisonResult(
  viewports: PixelComparisonViewport[],
): PixelComparisonResult | null {
  if (viewports.length === 0) return null;
  return { viewports };
}
