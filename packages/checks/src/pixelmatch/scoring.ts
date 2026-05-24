export function scoreFromDiffRatio(diffRatio: number): number {
  if (diffRatio === 0) return 4;
  if (diffRatio <= 0.01) return 3;
  if (diffRatio <= 0.05) return 2;
  if (diffRatio <= 0.1) return 1;
  return 0;
}
