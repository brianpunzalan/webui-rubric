import type { SubCriterion, SubCriterionFinding } from '../types/index.js';

/** Custom error thrown when a tool is unavailable and the policy is fail-fast. */
export class ToolUnavailableError extends Error {
  checkId: string;
  constructor(message: string, checkId: string) {
    super(message);
    this.name = 'ToolUnavailableError';
    this.checkId = checkId;
  }
}

/** Apply the configured fallback policy when a deterministic check tool is unavailable. */
export function applyFallback(params: {
  error: unknown;
  checkId: string;
  subCriterion: SubCriterion;
  policy: 'fail-fast' | 'mark-unavailable';
}): SubCriterionFinding {
  const { error, checkId, subCriterion, policy } = params;
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (policy === 'fail-fast' || subCriterion.blocking_if_zero === true) {
    throw new ToolUnavailableError(
      `Tool unavailable for blocking check ${checkId}: ${errorMessage}. Use tool_fallback_policy: 'mark-unavailable' to skip non-blocking checks.`,
      checkId,
    );
  }

  return {
    id: subCriterion.id,
    name: subCriterion.name,
    status: 'tool_unavailable',
    score: null,
    evidence: `Tool unavailable: ${errorMessage}`.slice(0, 300),
    evidence_source: checkId,
    severity: 0,
    suggested_fix: [],
    location: null,
    confidence: 'deterministic',
  };
}
