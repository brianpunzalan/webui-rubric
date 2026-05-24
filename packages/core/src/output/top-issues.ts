import { createHash } from 'node:crypto';
import type { TopIssue, DimensionResult } from '../types/index.js';

/** Build a prioritized list of top issues, ranked by weight x severity, excluding attempted fixes. */
export function buildTopIssues(
  dimensionResults: DimensionResult[],
  cap: number = 10,
  attemptedFixHashes?: Set<string>,
): TopIssue[] {
  const candidates: TopIssue[] = [];

  for (const dim of dimensionResults) {
    for (const finding of dim.sub_criteria) {
      if (finding.status !== 'scored' || finding.score === null || finding.score >= 4) continue;

      const priorityScore = dim.weight * finding.severity;
      const fixHash = createHash('sha256').update(finding.suggested_fix).digest('hex');

      candidates.push({
        rank: 0,
        criterion_id: finding.id,
        dimension_id: dim.id,
        priority_score: priorityScore,
        score: finding.score,
        severity: finding.severity,
        fix: finding.suggested_fix.slice(0, 280),
        fix_hash: fixHash,
        expected_impact: null,
      });
    }
  }

  return candidates
    .filter((issue) => !attemptedFixHashes || !attemptedFixHashes.has(issue.fix_hash))
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, cap)
    .map((issue, i) => ({ ...issue, rank: i + 1 }));
}
