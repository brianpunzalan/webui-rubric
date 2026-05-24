import type { RubricDefinition } from '../types/index.js';

export function applyWeightOverrides(
  rubric: RubricDefinition,
  weights: Record<string, number>,
  ack?: string[],
): { effectiveWeights: Record<string, number>; errors: string[] } {
  const errors: string[] = [];
  const effectiveWeights: Record<string, number> = {};

  for (const dim of rubric.dimensions) {
    effectiveWeights[dim.id] = weights[dim.id] ?? dim.default_weight;
  }

  const sum = Object.values(effectiveWeights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.001) {
    errors.push(`Dimension weights must sum to 100, got ${sum}`);
  }

  for (const dim of rubric.dimensions) {
    if (dim.weight_floor !== null && effectiveWeights[dim.id] < dim.weight_floor) {
      if (!ack || !ack.includes(dim.id)) {
        errors.push(
          `${dim.name} weight (${effectiveWeights[dim.id]}) is below the floor of ${dim.weight_floor}. ` +
          `Add "${dim.id}" to weight_overrides_ack to override.`,
        );
      }
    }
  }

  return { effectiveWeights, errors };
}
