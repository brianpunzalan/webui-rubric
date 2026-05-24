/** Detect stalled progress when the composite score delta is below the threshold. */
export function detectNoProgress(delta: number | null, threshold: number = 3): boolean {
  if (delta === null) return false;
  return Math.abs(delta) < threshold;
}
