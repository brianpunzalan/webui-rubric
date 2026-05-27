import type { SubCriterionFinding } from '../types/index.js';

export function markVisualParityNotApplicable(
  subCriterionId: string,
  subCriterionName: string,
  checkFullId: string,
): SubCriterionFinding {
  return {
    id: subCriterionId,
    name: subCriterionName,
    score: null,
    status: 'not_applicable',
    evidence: 'No reference image supplied for visual parity comparison',
    evidence_source: checkFullId,
    severity: 0,
    suggested_fix: [],
    location: null,
    confidence: 'deterministic',
  };
}
