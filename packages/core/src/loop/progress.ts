export function detectNoProgress(delta: number | null, threshold: number = 3): boolean {
  if (delta === null) return false;
  return Math.abs(delta) < threshold;
}
