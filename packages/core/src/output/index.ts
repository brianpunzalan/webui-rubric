import { EvaluationResultSchema } from './schema.js';
import type { EvaluationResult } from '../types/index.js';

export { EvaluationResultSchema, type ValidatedEvaluationResult } from './schema.js';
export { buildBlockingList } from './blocking.js';
export { buildTopIssues } from './top-issues.js';
export { isShipReady } from './ship-ready.js';
export { buildPixelComparisonResult } from './pixel-comparison.js';
export { buildEffectiveConfig } from './effective-config.js';

export interface OutputValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateOutput(result: EvaluationResult): OutputValidationResult {
  const parsed = EvaluationResultSchema.safeParse(result);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    };
  }
  return { valid: true, errors: [] };
}
