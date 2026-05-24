import { ProjectConfigSchema } from './schema.js';
import type { ProjectConfig, RubricDefinition } from '../types/index.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  config?: ProjectConfig;
}

export function validateProjectConfig(raw: unknown): ValidationResult {
  const result = ProjectConfigSchema.safeParse(raw);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }
  return { valid: true, errors: [], config: result.data as ProjectConfig };
}

export function validateWeights(
  weights: Record<string, number>,
  rubric: RubricDefinition,
  ack?: string[],
): string[] {
  const errors: string[] = [];
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.001) {
    errors.push(`Dimension weights must sum to 100, got ${sum}`);
  }
  // Check weight floor for accessibility
  for (const dim of rubric.dimensions) {
    if (dim.weight_floor !== null && weights[dim.id] !== undefined) {
      if (weights[dim.id] < dim.weight_floor) {
        if (!ack || !ack.includes(dim.id)) {
          errors.push(
            `${dim.name} weight (${weights[dim.id]}) is below the floor of ${dim.weight_floor}. ` +
              `Add "${dim.id}" to weight_overrides_ack to override.`,
          );
        }
      }
    }
  }
  return errors;
}

export function validateCustomSubCriteria(
  customs: Array<{ dimension: string; id: string; anchors?: unknown[]; bound_check?: unknown }>,
): string[] {
  const errors: string[] = [];
  for (const sub of customs) {
    if (!sub.anchors || sub.anchors.length !== 5) {
      errors.push(
        `Custom sub-criterion "${sub.id}" must have exactly 5 anchor descriptors (scores 0-4)`,
      );
    }
    if (!sub.bound_check) {
      errors.push(
        `Custom sub-criterion "${sub.id}" must have a bound_check with valid check_family and check_id`,
      );
    }
  }
  return errors;
}
