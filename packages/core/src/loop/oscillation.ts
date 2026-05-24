import { createHash } from 'node:crypto';
import type { TopIssue } from '../types/index.js';

/** Compute a SHA-256 hash of a suggested fix string for deduplication. */
export function computeFixHash(fix: string): string {
  return createHash('sha256').update(fix).digest('hex');
}

/** Filter out issues whose fix_hash appears in the set of previously attempted fixes. */
export function filterAttemptedFixes(
  issues: TopIssue[],
  attemptedFixHashes: Set<string>,
): TopIssue[] {
  return issues.filter((issue) => !attemptedFixHashes.has(issue.fix_hash));
}
