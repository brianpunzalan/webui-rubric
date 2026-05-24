import type { Dimension } from '../types/index.js';

export function applyBlockingOverrides(
  dimensions: Dimension[],
  overrides: Record<string, boolean>,
): Dimension[] {
  return dimensions.map((dim) => ({
    ...dim,
    sub_criteria: dim.sub_criteria.map((sub) => {
      if (sub.id in overrides) {
        return { ...sub, blocking_if_zero: overrides[sub.id] };
      }
      return sub;
    }),
  }));
}
