import { createHash } from 'node:crypto';
import type { TopIssue } from '../types/index.js';

export function computeFixHash(fix: string): string {
  return createHash('sha256').update(fix).digest('hex');
}

export function filterAttemptedFixes(
  issues: TopIssue[],
  attemptedFixHashes: Set<string>,
): TopIssue[] {
  return issues.filter(issue => !attemptedFixHashes.has(issue.fix_hash));
}
